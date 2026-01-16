import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const stats = await db.one(`
      SELECT
        AVG(cs.unemployment_rate) as avg_unemployment,
        AVG(cs.prop_elderly) as avg_elderly_prop,
        AVG(cs.education_low_pct) as avg_low_education,
        COUNT(*) FILTER (WHERE cs.unemployment_rate > 0.25) as sections_high_unemployment,
        COUNT(*) FILTER (WHERE cs.prop_elderly > 0.25) as sections_high_elderly,
        COUNT(*) FILTER (WHERE sm.coverage_300_area_pct < 50) as sections_poor_coverage,
        COUNT(*) as total_sections,
        AVG(sm.stops_per_km2) as avg_stops_density,
        AVG(sm.nearest_stop_meters) as avg_nearest_stop_dist,
        AVG(sm.coverage_300_area_pct) as avg_coverage_300,
        AVG(sm.stop_time_events_all_day) as avg_freq_day,
        AVG(sm.stop_time_events_morning) as avg_freq_morning
      FROM census_sections cs
      LEFT JOIN section_metrics sm ON cs.section_code = sm.section_code
    `);

    return NextResponse.json({
      avg_unemployment: parseFloat(stats.avg_unemployment) || 0,
      avg_elderly_prop: parseFloat(stats.avg_elderly_prop) || 0,
      avg_low_education: parseFloat(stats.avg_low_education) || 0,
      sections_high_unemployment: parseInt(stats.sections_high_unemployment) || 0,
      sections_high_elderly: parseInt(stats.sections_high_elderly) || 0,
      sections_poor_coverage: parseInt(stats.sections_poor_coverage) || 0,
      total_sections: parseInt(stats.total_sections) || 0,
      // Bus Metrics
      avg_stops_density: parseFloat(stats.avg_stops_density) || 0,
      avg_nearest_stop_dist: parseFloat(stats.avg_nearest_stop_dist) || 0,
      avg_coverage_300: parseFloat(stats.avg_coverage_300) || 0,
      avg_freq_day: parseFloat(stats.avg_freq_day) || 0,
      avg_freq_morning: parseFloat(stats.avg_freq_morning) || 0,
    });
  } catch (error) {
    console.error('Error fetching fare analysis:', error);
    return NextResponse.json({ error: 'Error fetching analysis' }, { status: 500 });
  }
}
