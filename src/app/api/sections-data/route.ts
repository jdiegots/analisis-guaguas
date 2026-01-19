import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sections = await db.any(`
      SELECT
        cs.section_code,
      --Demographics from census_sections
    cs.population_total,
      cs.unemployment_rate,
      cs.prop_elderly as census_prop_elderly,
      cs.education_low_pct,
      cs.working_class_pct,
      cs.occ_agriculture,
      cs.occ_industry,
      cs.occ_construction,
      cs.occ_services,

      --Calculated Share
    CASE
    WHEN(cs.occ_agriculture + cs.occ_industry + cs.occ_construction + cs.occ_services) > 0
          THEN cs.occ_services::double precision /
      (cs.occ_agriculture + cs.occ_industry + cs.occ_construction + cs.occ_services)
          ELSE NULL
        END AS services_share,

      --Metrics from section_metrics
    sm.stops_count,
      sm.stops_per_km2,
      sm.nearest_stop_meters,
      sm.coverage_300_area_pct,
      sm.coverage_500_area_pct,

      --Frequencies
    sm.stop_time_events_all_day,
      sm.stop_time_events_morning,
      sm.stop_time_events_midday,
      sm.stop_time_events_afternoon,
      sm.stop_time_events_night,

      --Routes
    sm.unique_routes_all_day,
      sm.unique_routes_morning,
      sm.unique_routes_midday,
      sm.unique_routes_afternoon,
      sm.unique_routes_night,

      --Social Metrics
    sm.income_median,
      sm.prop_elderly as metrics_prop_elderly, --Sometimes duplicated, favoring census usually but keeping both just in case

    --Indicators
    sm.indicator_elderly_desert,
      sm.indicator_mobility_inequality,
      sm.indicator_working_class,
      sm.indicator_education_gap,
      sm.indicator_unemployment_trap,
      sm.indicator_service_dependency,
      sm.indicator_immigrant_segregation,
      sm.indicator_student_access,
      sm.indicator_worker_commute,

      --Indices
    sm.events_per_1000,
      sm.routes_per_10k,
      sm.service_value_index,
      sm.service_percentile

      FROM census_sections cs
      LEFT JOIN section_metrics sm ON cs.section_code = sm.section_code
      ORDER BY cs.section_code
      `);

    return NextResponse.json(sections);
  } catch (error) {
    console.error('Error fetching sections data:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}
