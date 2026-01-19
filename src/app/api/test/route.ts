// Test endpoint to show data without PostGIS
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const routes = await db.manyOrNone(`
      SELECT route_id, route_short_name, route_long_name, route_color
      FROM routes
      ORDER BY route_short_name
      LIMIT 10
    `);

    const stops = await db.manyOrNone(`
      SELECT stop_id, stop_name, stop_lat, stop_lon
      FROM stops
      ORDER BY stop_name
      LIMIT 20
    `);

    const stats = await db.one(`
      SELECT
        (SELECT COUNT(*) FROM routes) as routes_count,
        (SELECT COUNT(*) FROM stops) as stops_count,
        (SELECT COUNT(*) FROM trips) as trips_count,
        (SELECT COUNT(*) FROM stop_times) as stop_times_count,
        (SELECT COUNT(*) FROM census_sections) as sections_count
    `);

    const sections = await db.manyOrNone(`
      SELECT section_code, name
      FROM census_sections
      ORDER BY section_code
      LIMIT 10
    `);

    // Check if PostGIS is available
    const postgisCheck = await db.oneOrNone(`
      SELECT installed_version
      FROM pg_available_extensions
      WHERE name = 'postgis' AND installed_version IS NOT NULL
    `);

    return NextResponse.json({
      status: 'ok',
      postgis_available: !!postgisCheck,
      postgis_version: postgisCheck?.installed_version || null,
      stats,
      sample_routes: routes,
      sample_stops: stops,
      sample_sections: sections
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
