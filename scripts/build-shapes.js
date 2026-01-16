require('dotenv').config();
const { db } = require('./db-config');

async function main() {
  console.log('🗺️  Building shape geometries...\n');

  try {
    // Build LINESTRING geometries from shapes points
    console.log('Creating LINESTRING geometries from shapes table...');
    await db.none(`
      INSERT INTO shape_geometries (shape_id, geom)
      SELECT
        shape_id,
        ST_MakeLine(
          ST_SetSRID(ST_MakePoint(shape_pt_lon, shape_pt_lat), 4326)
          ORDER BY shape_pt_sequence
        )
      FROM shapes
      GROUP BY shape_id
    `);

    const count = await db.one('SELECT COUNT(*) as count FROM shape_geometries');
    console.log(`✓ Created ${count.count} shape geometries\n`);

    // Show sample shapes
    const samples = await db.any(`
      SELECT
        shape_id,
        ST_NumPoints(geom) as num_points,
        ST_Length(geom::geography) as length_meters
      FROM shape_geometries
      ORDER BY shape_id
      LIMIT 5
    `);

    console.log('Sample shapes:');
    samples.forEach(s => {
      console.log(`  ${s.shape_id}: ${s.num_points} points, ${Math.round(s.length_meters)}m length`);
    });

    console.log('\n✅ Shape geometries built successfully!');

  } catch (error) {
    console.error('Error building shapes:', error);
    throw error;
  } finally {
    await db.$pool.end();
  }
}

main().catch(console.error);
