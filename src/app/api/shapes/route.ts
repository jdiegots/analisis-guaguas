import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Generate a unique color based on shape_id hash
function generateColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = Math.abs(hash % 360);
  const s = 65 + (Math.abs(hash) % 20); // 65-85%
  const l = 50 + (Math.abs(hash >> 8) % 15); // 50-65%

  return `hsl(${h}, ${s}%, ${l}%)`;
}

export async function GET() {
  try {
    const shapes = await db.any(`
      SELECT
        sg.shape_id,
        ST_AsGeoJSON(sg.geom)::json as geometry,
        r.route_short_name,
        r.route_long_name,
        r.route_color
      FROM shape_geometries sg
      LEFT JOIN trips t ON sg.shape_id = t.shape_id
      LEFT JOIN routes r ON t.route_id = r.route_id
      GROUP BY sg.shape_id, sg.geom, r.route_short_name, r.route_long_name, r.route_color
      ORDER BY sg.shape_id
    `);

    const geojson = {
      type: 'FeatureCollection',
      features: shapes.map(shape => {
        // Use route color if available, otherwise generate from shape_id
        let color = '#FDB913'; // default yellow

        if (shape.route_color && shape.route_color.length === 6) {
          color = `#${shape.route_color}`;
        } else {
          color = generateColor(shape.shape_id);
        }

        return {
          type: 'Feature',
          properties: {
            shape_id: shape.shape_id,
            route_short_name: shape.route_short_name,
            route_long_name: shape.route_long_name,
            color: color,
          },
          geometry: shape.geometry,
        };
      }),
    };

    return NextResponse.json(geojson);
  } catch (error) {
    console.error('Error fetching shapes:', error);
    return NextResponse.json({ error: 'Error fetching shapes' }, { status: 500 });
  }
}
