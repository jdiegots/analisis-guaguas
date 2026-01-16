// Get all sections with metrics and simplified geometry
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeSlot = searchParams.get('timeSlot') || 'all_day';
    const metric = searchParams.get('metric') || 'stop_time_events_all_day';

    // Get sections with metrics
    const sections = await db.manyOrNone(`
      SELECT
        cs.section_code,
        cs.name,
        cs.area_km2,
        ST_AsGeoJSON(ST_Simplify(cs.geom, 0.0001))::json as geometry,
        sm.stops_count,
        sm.stops_per_km2,
        sm.nearest_stop_meters,
        sm.coverage_300_area_pct,
        sm.coverage_500_area_pct,
        sm.stop_time_events_all_day,
        sm.unique_routes_all_day,
        sm.stop_time_events_morning,
        sm.unique_routes_morning,
        sm.stop_time_events_midday,
        sm.unique_routes_midday,
        sm.stop_time_events_afternoon,
        sm.unique_routes_afternoon,
        sm.stop_time_events_night,
        sm.unique_routes_night,
        sm.indicator_education_gap,
        sm.indicator_unemployment_trap,
        sm.indicator_elderly_desert,
        sm.indicator_service_dependency,
        sm.occ_services,
        sm.occ_construction,
        sm.occ_industry,
        sm.occ_agriculture
      FROM census_sections cs
      LEFT JOIN section_metrics sm ON cs.section_code = sm.section_code
      WHERE COALESCE(sm.stops_count, 0) > 0
      ORDER BY cs.section_code
    `);

    // Build GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection',
      features: sections.map((section: any) => ({
        type: 'Feature',
        id: section.section_code,
        geometry: section.geometry,
        properties: {
          section_code: section.section_code,
          name: section.name,
          area_km2: section.area_km2,
          stops_count: section.stops_count,
          stops_per_km2: section.stops_per_km2,
          nearest_stop_meters: section.nearest_stop_meters,
          coverage_300_area_pct: section.coverage_300_area_pct,
          coverage_500_area_pct: section.coverage_500_area_pct,
          stop_time_events_all_day: section.stop_time_events_all_day,
          unique_routes_all_day: section.unique_routes_all_day,
          stop_time_events_morning: section.stop_time_events_morning,
          unique_routes_morning: section.unique_routes_morning,
          stop_time_events_midday: section.stop_time_events_midday,
          unique_routes_midday: section.unique_routes_midday,
          stop_time_events_afternoon: section.stop_time_events_afternoon,
          unique_routes_afternoon: section.unique_routes_afternoon,
          stop_time_events_night: section.stop_time_events_night,
          unique_routes_night: section.unique_routes_night,
          // Political Indicators
          income_median: section.income_median,
          prop_elderly: section.prop_elderly,
          indicator_working_class: section.indicator_working_class,
          indicator_education_gap: section.indicator_education_gap,
          indicator_unemployment_trap: section.indicator_unemployment_trap,
          indicator_elderly_desert: section.indicator_elderly_desert,
          indicator_service_dependency: section.indicator_service_dependency,
          // Sectors
          occ_services: section.occ_services,
          occ_construction: section.occ_construction,
          occ_industry: section.occ_industry,
          occ_agriculture: section.occ_agriculture,
        },
      })),
    };

    return NextResponse.json(geojson);
  } catch (error) {
    console.error('Error fetching sections:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
