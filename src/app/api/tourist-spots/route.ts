import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const accommodations = await db.manyOrNone(`
      SELECT
        t.id,
        t.name,
        t.type,
        t.subtype,
        t.places,
        ST_AsGeoJSON(t.geom)::json as geometry
      FROM tourist_accommodations t
      JOIN census_sections cs ON ST_Within(t.geom, cs.geom)
      JOIN section_metrics sm ON cs.section_code = sm.section_code
      WHERE sm.stops_count > 0
    `);

        const features = accommodations.map((a: any) => ({
            type: 'Feature',
            geometry: a.geometry,
            properties: {
                id: a.id,
                name: a.name,
                type: a.type,
                subtype: a.subtype,
                places: a.places,
                color: a.type === 'Hotel' ? '#2980b9' : '#e67e22' // Blue for Hotels, Orange for VV
            }
        }));

        return NextResponse.json({
            type: 'FeatureCollection',
            features
        });
    } catch (error) {
        console.error('Error fetching tourist spots:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
