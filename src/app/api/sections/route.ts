// Get all sections with metrics and simplified geometry
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
        COALESCE(sm.stops_count, 0) as stops_count,
        COALESCE(sm.stops_per_km2, 0) as stops_per_km2,
        COALESCE(sm.nearest_stop_meters, 0) as nearest_stop_meters,
        COALESCE(sm.coverage_300_area_pct, 0) as coverage_300_area_pct,
        COALESCE(sm.coverage_500_area_pct, 0) as coverage_500_area_pct,
        COALESCE(sm.stop_time_events_all_day, 0) as stop_time_events_all_day,
        COALESCE(sm.unique_routes_all_day, 0) as unique_routes_all_day,
        COALESCE(sm.stop_time_events_morning, 0) as stop_time_events_morning,
        COALESCE(sm.unique_routes_morning, 0) as unique_routes_morning,
        COALESCE(sm.stop_time_events_midday, 0) as stop_time_events_midday,
        COALESCE(sm.unique_routes_midday, 0) as unique_routes_midday,
        COALESCE(sm.stop_time_events_afternoon, 0) as stop_time_events_afternoon,
        COALESCE(sm.unique_routes_afternoon, 0) as unique_routes_afternoon,
        COALESCE(sm.stop_time_events_night, 0) as stop_time_events_night,
        COALESCE(sm.unique_routes_night, 0) as unique_routes_night,
        COALESCE(sm.indicator_education_gap, 0) as indicator_education_gap,
        COALESCE(sm.indicator_unemployment_trap, 0) as indicator_unemployment_trap,
        COALESCE(sm.indicator_elderly_desert, 0) as indicator_elderly_desert,
        COALESCE(sm.indicator_service_dependency, 0) as indicator_service_dependency,
        COALESCE(sm.indicator_student_access, 0) as indicator_student_access,
        COALESCE(sm.indicator_immigrant_segregation, 0) as indicator_immigrant_segregation,
        COALESCE(sm.indicator_worker_commute, 0) as indicator_worker_commute,
        COALESCE(sm.occ_services, 0) as occ_services,
        COALESCE(sm.occ_construction, 0) as occ_construction,
        COALESCE(sm.occ_industry, 0) as occ_industry,
        COALESCE(sm.occ_agriculture, 0) as occ_agriculture,
        
        -- Advanced Fare/Service Metrics
        COALESCE(sm.service_value_index, 0) as service_value_index,
        COALESCE(sm.service_percentile, 0) as service_percentile,
        COALESCE(sm.income_median, 0) as income_median,
        COALESCE(sm.prop_elderly, 0) as prop_elderly,
        
        -- Calculated Fields for Frontend (Effective Price & Tax)
        -- Nominal price is constant (1.40), so we can compute ratios here or in frontend.
        -- We'll provide the raw service index so frontend can do user-selected fare math.
        CASE 
          WHEN sm.service_value_index > 0 THEN 1.40 / sm.service_value_index 
          ELSE 0 
        END as effective_price_single

      FROM census_sections cs
      LEFT JOIN section_metrics sm ON cs.section_code = sm.section_code
      WHERE sm.stops_count > 0
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
          indicator_student_access: section.indicator_student_access,
          indicator_immigrant_segregation: section.indicator_immigrant_segregation,
          indicator_worker_commute: section.indicator_worker_commute,
          // Sectors
          occ_services: section.occ_services,
          occ_construction: section.occ_construction,
          occ_industry: section.occ_industry,
          occ_agriculture: section.occ_agriculture,

          // Advanced Analysis
          service_value_index: section.service_value_index,
          service_percentile: section.service_percentile,
          effective_price_single: section.effective_price_single,
          geographic_tax_ratio: section.service_value_index > 0 ? (1.0 / section.service_value_index) : 0, // Simplified tax calculation
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
