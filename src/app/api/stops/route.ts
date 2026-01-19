// Get all stops with their locations
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all stops
    const stops = await db.manyOrNone(`
      SELECT
        s.stop_id,
        s.stop_name,
        s.stop_lat,
        s.stop_lon,
        ST_AsGeoJSON(s.geom)::json as geometry,
        cs.section_code
      FROM stops s
      LEFT JOIN census_sections cs ON ST_Within(s.geom, cs.geom)
      ORDER BY s.stop_name
    `);

    // Build GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection',
      features: stops.map((stop: any) => ({
        type: 'Feature',
        id: stop.stop_id,
        geometry: stop.geometry,
        properties: {
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
          section_code: stop.section_code,
        },
      })),
    };

    return NextResponse.json(geojson);
  } catch (error) {
    console.error('Error fetching stops:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
