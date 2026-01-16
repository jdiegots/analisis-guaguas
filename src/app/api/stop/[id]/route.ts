// Get detailed information for a specific stop
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get stop details
    const stop = await db.oneOrNone(`
      SELECT
        s.stop_id,
        s.stop_code,
        s.stop_name,
        s.stop_desc,
        s.stop_lat,
        s.stop_lon,
        ST_AsGeoJSON(s.geom)::json as geometry,
        cs.section_code,
        cs.name as section_name
      FROM stops s
      LEFT JOIN census_sections cs ON ST_Within(s.geom, cs.geom)
      WHERE s.stop_id = $1
    `, [id]);

    if (!stop) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // Get routes serving this stop
    const routes = await db.manyOrNone(`
      SELECT DISTINCT
        r.route_id,
        r.route_short_name,
        r.route_long_name,
        r.route_color,
        r.route_text_color,
        COUNT(DISTINCT t.trip_id)::int as trip_count
      FROM routes r
      INNER JOIN trips t ON r.route_id = t.route_id
      INNER JOIN stop_times st ON t.trip_id = st.trip_id
      WHERE st.stop_id = $1
      GROUP BY r.route_id, r.route_short_name, r.route_long_name, r.route_color, r.route_text_color
      ORDER BY r.route_short_name
    `, [id]);

    // Get sample stop times (next 10 arrivals from a typical day)
    const stopTimes = await db.manyOrNone(`
      SELECT
        st.arrival_time,
        st.departure_time,
        r.route_short_name,
        r.route_long_name,
        t.trip_headsign
      FROM stop_times st
      INNER JOIN trips t ON st.trip_id = t.trip_id
      INNER JOIN routes r ON t.route_id = r.route_id
      WHERE st.stop_id = $1
      ORDER BY st.arrival_time
      LIMIT 20
    `, [id]);

    return NextResponse.json({
      stop,
      routes,
      stopTimes,
    });
  } catch (error) {
    console.error('Error fetching stop details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
