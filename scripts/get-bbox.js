require('dotenv').config();
const { db } = require('./db-config');

async function main() {
  try {
    const result = await db.one(`
      SELECT
        ST_XMin(ST_Extent(geom)) as min_lon,
        ST_YMin(ST_Extent(geom)) as min_lat,
        ST_XMax(ST_Extent(geom)) as max_lon,
        ST_YMax(ST_Extent(geom)) as max_lat
      FROM census_sections
    `);

    console.log('Las Palmas de Gran Canaria bounding box (EPSG:4326):');
    console.log(`  Min Longitude: ${result.min_lon}`);
    console.log(`  Min Latitude: ${result.min_lat}`);
    console.log(`  Max Longitude: ${result.max_lon}`);
    console.log(`  Max Latitude: ${result.max_lat}`);
    console.log(`\nBBOX: ${result.min_lon},${result.min_lat},${result.max_lon},${result.max_lat}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$pool.end();
  }
}

main();
