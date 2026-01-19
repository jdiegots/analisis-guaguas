import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type SocioMetricConfig = {
  key: string;
  label: string;
  column: string;
  unit: '%' | 'ratio';
  description: string;
};

const socioMetrics: SocioMetricConfig[] = [
  {
    key: 'unemployment',
    label: 'Desempleo',
    column: 'unemployment_rate',
    unit: '%',
    description: 'Proporción de población activa en paro.'
  },
  {
    key: 'elderly',
    label: 'Envejecimiento',
    column: 'prop_elderly',
    unit: '%',
    description: 'Población de 65+ sobre el total.'
  },
  {
    key: 'low_education',
    label: 'Baja formación',
    column: 'education_low_pct',
    unit: '%',
    description: 'Primaria + primera etapa secundaria.'
  },
  {
    key: 'working_class',
    label: 'Clase trabajadora',
    column: 'working_class_pct',
    unit: '%',
    description: 'Agricultura + industria + construcción sobre ocupados.'
  },
  {
    key: 'services_share',
    label: 'Empleo en servicios',
    column: 'services_share',
    unit: '%',
    description: 'Servicios sobre ocupados.'
  }
];

const baseCte = `
  WITH base AS (
    SELECT
      cs.section_code,
      cs.unemployment_rate,
      cs.prop_elderly,
      cs.education_low_pct,
      cs.working_class_pct,
      CASE
        WHEN (cs.occ_agriculture + cs.occ_industry + cs.occ_construction + cs.occ_services) > 0
        THEN cs.occ_services::double precision /
          (cs.occ_agriculture + cs.occ_industry + cs.occ_construction + cs.occ_services)
        ELSE NULL
      END AS services_share,
      sm.stops_count,
      sm.stops_per_km2,
      sm.nearest_stop_meters,
      sm.coverage_300_area_pct,
      sm.coverage_500_area_pct,
      sm.stop_time_events_all_day,
      sm.stop_time_events_morning,
      sm.stop_time_events_midday,
      sm.stop_time_events_afternoon,
      sm.stop_time_events_night
    FROM census_sections cs
    LEFT JOIN section_metrics sm ON cs.section_code = sm.section_code
    WHERE COALESCE(sm.stops_count, 0) > 0
  )
`;

function parseNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function GET() {
  try {
    const summary = await db.one(`${baseCte}
      SELECT
        AVG(unemployment_rate) as avg_unemployment,
        AVG(prop_elderly) as avg_elderly_prop,
        AVG(education_low_pct) as avg_low_education,
        AVG(working_class_pct) as avg_working_class,
        AVG(services_share) as avg_services_share,
        COUNT(*) as total_sections,
        AVG(stops_count) as avg_stops_count,
        AVG(stops_per_km2) as avg_stops_density,
        AVG(nearest_stop_meters) as avg_nearest_stop_dist,
        AVG(coverage_300_area_pct) as avg_coverage_300,
        AVG(coverage_500_area_pct) as avg_coverage_500,
        AVG(stop_time_events_all_day) as avg_freq_day,
        AVG(stop_time_events_morning) as avg_freq_morning,
        AVG(stop_time_events_midday) as avg_freq_midday,
        AVG(stop_time_events_afternoon) as avg_freq_afternoon,
        AVG(stop_time_events_night) as avg_freq_night,
        percentile_disc(0.5) WITHIN GROUP (ORDER BY coverage_300_area_pct) as median_coverage_300,
        percentile_disc(0.5) WITHIN GROUP (ORDER BY nearest_stop_meters) as median_nearest_stop
      FROM base
    `);

    const contrastPromises = socioMetrics.map(async metric => {
      const contrast = await db.one(`${baseCte}
        , stats AS (
          SELECT
            AVG(coverage_300_area_pct) as mean_cov300,
            STDDEV_POP(coverage_300_area_pct) as sd_cov300,
            AVG(coverage_500_area_pct) as mean_cov500,
            STDDEV_POP(coverage_500_area_pct) as sd_cov500,
            AVG(nearest_stop_meters) as mean_near,
            STDDEV_POP(nearest_stop_meters) as sd_near,
            AVG(stop_time_events_all_day) as mean_freq,
            STDDEV_POP(stop_time_events_all_day) as sd_freq,
            AVG(stops_per_km2) as mean_density,
            STDDEV_POP(stops_per_km2) as sd_density
          FROM base
        ),
        thresholds AS (
          SELECT
            percentile_disc(0.25) WITHIN GROUP (ORDER BY ${metric.column}) as p25,
            percentile_disc(0.75) WITHIN GROUP (ORDER BY ${metric.column}) as p75
          FROM base
          WHERE ${metric.column} IS NOT NULL
        ),
        segments AS (
          SELECT
            CASE
              WHEN ${metric.column} >= thresholds.p75 THEN 'high'
              WHEN ${metric.column} <= thresholds.p25 THEN 'low'
            END as segment,
            base.*,
            (
              (stats.mean_cov300 - base.coverage_300_area_pct) / NULLIF(stats.sd_cov300, 0) +
              (stats.mean_cov500 - base.coverage_500_area_pct) / NULLIF(stats.sd_cov500, 0) +
              (base.nearest_stop_meters - stats.mean_near) / NULLIF(stats.sd_near, 0) +
              (stats.mean_freq - base.stop_time_events_all_day) / NULLIF(stats.sd_freq, 0) +
              (stats.mean_density - base.stops_per_km2) / NULLIF(stats.sd_density, 0)
            ) / 5 as access_penalty_index
          FROM base
          CROSS JOIN thresholds
          CROSS JOIN stats
          WHERE ${metric.column} IS NOT NULL
            AND (${metric.column} >= thresholds.p75 OR ${metric.column} <= thresholds.p25)
        )
        SELECT
          (SELECT p25 FROM thresholds) as p25,
          (SELECT p75 FROM thresholds) as p75,
          COUNT(*) FILTER (WHERE segment = 'high') as high_sections,
          COUNT(*) FILTER (WHERE segment = 'low') as low_sections,
          AVG(${metric.column}) FILTER (WHERE segment = 'high') as high_avg_value,
          AVG(${metric.column}) FILTER (WHERE segment = 'low') as low_avg_value,
          AVG(coverage_300_area_pct) FILTER (WHERE segment = 'high') as high_coverage_300,
          AVG(coverage_300_area_pct) FILTER (WHERE segment = 'low') as low_coverage_300,
          AVG(coverage_500_area_pct) FILTER (WHERE segment = 'high') as high_coverage_500,
          AVG(coverage_500_area_pct) FILTER (WHERE segment = 'low') as low_coverage_500,
          AVG(nearest_stop_meters) FILTER (WHERE segment = 'high') as high_nearest_stop,
          AVG(nearest_stop_meters) FILTER (WHERE segment = 'low') as low_nearest_stop,
          AVG(stops_count) FILTER (WHERE segment = 'high') as high_stops_count,
          AVG(stops_count) FILTER (WHERE segment = 'low') as low_stops_count,
          AVG(stops_per_km2) FILTER (WHERE segment = 'high') as high_stops_density,
          AVG(stops_per_km2) FILTER (WHERE segment = 'low') as low_stops_density,
          AVG(stop_time_events_all_day) FILTER (WHERE segment = 'high') as high_freq_day,
          AVG(stop_time_events_all_day) FILTER (WHERE segment = 'low') as low_freq_day,
          AVG(access_penalty_index) FILTER (WHERE segment = 'high') as high_penalty,
          AVG(access_penalty_index) FILTER (WHERE segment = 'low') as low_penalty
        FROM segments
      `);

      const correlations = await db.one(`${baseCte}
        SELECT
          CORR(${metric.column}, coverage_300_area_pct) as corr_coverage_300,
          CORR(${metric.column}, coverage_500_area_pct) as corr_coverage_500,
          CORR(${metric.column}, nearest_stop_meters) as corr_nearest_stop,
          CORR(${metric.column}, stops_per_km2) as corr_stops_density,
          CORR(${metric.column}, stop_time_events_all_day) as corr_freq_day
        FROM base
        WHERE ${metric.column} IS NOT NULL
      `);

      return {
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        description: metric.description,
        thresholds: {
          p25: parseNumber(contrast.p25),
          p75: parseNumber(contrast.p75)
        },
        sections: {
          high: parseInt(contrast.high_sections, 10) || 0,
          low: parseInt(contrast.low_sections, 10) || 0
        },
        averages: {
          high_value: parseNumber(contrast.high_avg_value),
          low_value: parseNumber(contrast.low_avg_value),
          high_coverage_300: parseNumber(contrast.high_coverage_300),
          low_coverage_300: parseNumber(contrast.low_coverage_300),
          high_coverage_500: parseNumber(contrast.high_coverage_500),
          low_coverage_500: parseNumber(contrast.low_coverage_500),
          high_nearest_stop: parseNumber(contrast.high_nearest_stop),
          low_nearest_stop: parseNumber(contrast.low_nearest_stop),
          high_stops_count: parseNumber(contrast.high_stops_count),
          low_stops_count: parseNumber(contrast.low_stops_count),
          high_stops_density: parseNumber(contrast.high_stops_density),
          low_stops_density: parseNumber(contrast.low_stops_density),
          high_freq_day: parseNumber(contrast.high_freq_day),
          low_freq_day: parseNumber(contrast.low_freq_day),
          high_penalty: parseNumber(contrast.high_penalty),
          low_penalty: parseNumber(contrast.low_penalty)
        },
        gaps: {
          coverage_300: parseNumber(contrast.high_coverage_300) - parseNumber(contrast.low_coverage_300),
          coverage_500: parseNumber(contrast.high_coverage_500) - parseNumber(contrast.low_coverage_500),
          nearest_stop: parseNumber(contrast.high_nearest_stop) - parseNumber(contrast.low_nearest_stop),
          stops_density: parseNumber(contrast.high_stops_density) - parseNumber(contrast.low_stops_density),
          stops_count: parseNumber(contrast.high_stops_count) - parseNumber(contrast.low_stops_count),
          freq_day: parseNumber(contrast.high_freq_day) - parseNumber(contrast.low_freq_day),
          penalty_index: parseNumber(contrast.high_penalty) - parseNumber(contrast.low_penalty)
        },
        correlations: {
          coverage_300: parseNumber(correlations.corr_coverage_300),
          coverage_500: parseNumber(correlations.corr_coverage_500),
          nearest_stop: parseNumber(correlations.corr_nearest_stop),
          stops_density: parseNumber(correlations.corr_stops_density),
          freq_day: parseNumber(correlations.corr_freq_day)
        }
      };
    });

    const contrasts = await Promise.all(contrastPromises);

    return NextResponse.json({
      summary: {
        avg_unemployment: parseNumber(summary.avg_unemployment),
        avg_elderly_prop: parseNumber(summary.avg_elderly_prop),
        avg_low_education: parseNumber(summary.avg_low_education),
        avg_working_class: parseNumber(summary.avg_working_class),
        avg_services_share: parseNumber(summary.avg_services_share),
        total_sections: parseInt(summary.total_sections, 10) || 0,
        median_coverage_300: parseNumber(summary.median_coverage_300),
        median_nearest_stop: parseNumber(summary.median_nearest_stop)
      },
      bus: {
        avg_stops_count: parseNumber(summary.avg_stops_count),
        avg_stops_density: parseNumber(summary.avg_stops_density),
        avg_nearest_stop_dist: parseNumber(summary.avg_nearest_stop_dist),
        avg_coverage_300: parseNumber(summary.avg_coverage_300),
        avg_coverage_500: parseNumber(summary.avg_coverage_500),
        avg_freq_day: parseNumber(summary.avg_freq_day),
        avg_freq_morning: parseNumber(summary.avg_freq_morning),
        avg_freq_midday: parseNumber(summary.avg_freq_midday),
        avg_freq_afternoon: parseNumber(summary.avg_freq_afternoon),
        avg_freq_night: parseNumber(summary.avg_freq_night)
      },
      contrasts
    });
  } catch (error) {
    console.error('Error fetching fare analysis:', error);
    return NextResponse.json({ error: 'Error fetching analysis' }, { status: 500 });
  }
}
