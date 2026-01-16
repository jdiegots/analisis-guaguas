import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const fares = await db.any(`
      SELECT
        name,
        type,
        price_euros,
        trips_included,
        validity_days,
        cost_per_trip,
        requirements,
        target_group,
        is_social_fare
      FROM fares
      ORDER BY
        CASE target_group
          WHEN 'general' THEN 1
          WHEN 'students' THEN 2
          WHEN 'elderly' THEN 3
          WHEN 'unemployed' THEN 4
          WHEN 'families' THEN 5
          WHEN 'youth' THEN 6
          WHEN 'residents' THEN 7
          WHEN 'elderly_low_income' THEN 8
          WHEN 'tourists' THEN 9
          ELSE 10
        END,
        cost_per_trip ASC
    `);

    return NextResponse.json(fares);
  } catch (error) {
    console.error('Error fetching fares:', error);
    return NextResponse.json({ error: 'Error fetching fares' }, { status: 500 });
  }
}
