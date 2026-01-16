// Get detailed information for a specific section
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await params;

    // Get section details
    const section = await db.oneOrNone(`
      SELECT
        cs.section_code,
        cs.name,
        cs.area_km2,
        ST_AsGeoJSON(cs.geom)::json as geometry,
        sm.*
      FROM census_sections cs
      LEFT JOIN section_metrics sm ON cs.section_code = sm.section_code
      WHERE cs.section_code = $1
    `, [code]);

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Get stops in this section
    const stops = await db.manyOrNone(`
      SELECT
        s.stop_id,
        s.stop_name,
        s.stop_lat,
        s.stop_lon,
        ST_AsGeoJSON(s.geom)::json as geometry
      FROM stops s
      INNER JOIN census_sections cs ON ST_Within(s.geom, cs.geom)
      WHERE cs.section_code = $1
      ORDER BY s.stop_name
    `, [code]);

    // Get top routes for all time slots
    const topRoutes = await db.manyOrNone(`
      SELECT
        time_slot,
        route_id,
        route_short_name,
        route_long_name,
        stop_time_events,
        rank
      FROM section_top_routes
      WHERE section_code = $1
      ORDER BY time_slot, rank
    `, [code]);

    // Group top routes by time slot
    const topRoutesBySlot: Record<string, any[]> = {};
    topRoutes.forEach((route: any) => {
      if (!topRoutesBySlot[route.time_slot]) {
        topRoutesBySlot[route.time_slot] = [];
      }
      topRoutesBySlot[route.time_slot].push({
        route_id: route.route_id,
        route_short_name: route.route_short_name,
        route_long_name: route.route_long_name,
        stop_time_events: route.stop_time_events,
        rank: route.rank,
      });
    });

    return NextResponse.json({
      section,
      stops,
      topRoutes: topRoutesBySlot,
    });
  } catch (error) {
    console.error('Error fetching section details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
