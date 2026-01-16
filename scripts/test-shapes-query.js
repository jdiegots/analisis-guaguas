require('dotenv').config();
const { db } = require('./db-config');

async function main() {
  try {
    console.log('Testing shapes query...\n');

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
      LIMIT 5
    `);

    console.log(`Found ${shapes.length} shapes`);
    console.log('\nSample data:');
    shapes.forEach(s => {
      console.log(`  ${s.shape_id}: route=${s.route_short_name}, color=${s.route_color}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$pool.end();
  }
}

main();
