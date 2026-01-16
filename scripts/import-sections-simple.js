// Import census sections WITHOUT PostGIS (store geom as JSON)
const fs = require('fs');
const path = require('path');
const { db } = require('./db-config');

const SECTIONS_FILE = path.join(__dirname, '..', 'data', 'census_sections_las_palmas.geojson');

async function importSections() {
  try {
    console.log('🗺️  Starting census sections import (NO PostGIS)...');

    if (!fs.existsSync(SECTIONS_FILE)) {
      console.error('❌ GeoJSON file not found:', SECTIONS_FILE);
      process.exit(1);
    }

    console.log(`📂 Reading GeoJSON: ${SECTIONS_FILE}`);
    const geojson = JSON.parse(fs.readFileSync(SECTIONS_FILE, 'utf-8'));

    if (!geojson.features || geojson.features.length === 0) {
      console.error('❌ GeoJSON contains no features');
      process.exit(1);
    }

    console.log(`  ℹ️  Found ${geojson.features.length} features`);

    // Truncate table
    await db.none('TRUNCATE TABLE census_sections CASCADE');

    // Insert each feature
    let imported = 0;
    for (const feature of geojson.features) {
      const props = feature.properties;

      const cpro = props.CPRO || '35';
      const cmun = props.CMUN || '016';
      const cdis = props.CDIS || '00';
      const csec = props.CSEC || String(imported + 1).padStart(3, '0');

      const section_code = `${cpro}${cmun}${cdis}${csec}`;
      const cusec = props.CUSEC || section_code;
      const name = props.NMUN || `Sección ${csec}`;

      // Store geometry as JSON text (no PostGIS)
      const geomJSON = JSON.stringify(feature.geometry);

      await db.none(`
        INSERT INTO census_sections (section_code, cusec, cumun, cdis, csec, cpro, name, geom_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [section_code, cusec, cmun, cdis, csec, cpro, name, geomJSON]);

      imported++;

      if (imported % 50 === 0) {
        console.log(`  📍 Imported ${imported} sections...`);
      }
    }

    console.log(`\n✅ Imported ${imported} census sections`);

    // Show summary
    const summary = await db.one(`
      SELECT
        COUNT(*) as total_sections,
        COUNT(DISTINCT cpro) as provinces,
        COUNT(DISTINCT cumun) as municipalities
      FROM census_sections
    `);

    console.log('\n📊 Census Sections Summary:');
    console.log(`  Total sections: ${summary.total_sections}`);
    console.log(`  Provinces: ${summary.provinces}`);
    console.log(`  Municipalities: ${summary.municipalities}`);

    console.log('\n⚠️  Note: Geometries stored as JSON text (PostGIS not available)');
    console.log('   Install PostGIS to enable spatial queries and metrics');

  } catch (error) {
    console.error('❌ Error importing census sections:', error);
    process.exit(1);
  } finally {
    await db.$pool.end();
  }
}

importSections();
