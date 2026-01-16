// Import census sections GeoJSON into PostgreSQL
const fs = require('fs');
const path = require('path');
const { db } = require('./db-config');

const SECTIONS_FILE = path.join(__dirname, '..', 'data', 'census_sections_las_palmas.geojson');

async function importSections() {
  try {
    console.log('🗺️  Starting census sections import...');

    if (!fs.existsSync(SECTIONS_FILE)) {
      console.error('❌ GeoJSON file not found:', SECTIONS_FILE);
      console.log('\n📚 INSTRUCCIONES para obtener las secciones censales:');
      console.log('\n1. Descargar cartografía del INE:');
      console.log('   URL: https://www.ine.es/ss/Satellite?L=es_ES&c=Page&cid=1259952026632&p=1259952026632&pagename=ProductosYServicios%2FPYSLayout');
      console.log('   Buscar: "Cartografía de Secciones Censales" del año más reciente');
      console.log('   Descargar: Shapefile de Canarias (35) o de toda España\n');
      console.log('2. Extraer el ZIP y buscar los archivos .shp de secciones censales\n');
      console.log('3. Filtrar por Las Palmas de Gran Canaria (CMUN = 016):');
      console.log('   - Opción A: Usar QGIS:');
      console.log('     * Abrir el shapefile en QGIS');
      console.log('     * Filtrar por CPRO=\'35\' AND CMUN=\'016\'');
      console.log('     * Exportar como GeoJSON con CRS EPSG:4326 (WGS84)');
      console.log('   - Opción B: Usar ogr2ogr (GDAL):');
      console.log('     ogr2ogr -f GeoJSON -t_srs EPSG:4326 \\');
      console.log('       census_sections_las_palmas.geojson \\');
      console.log('       SECC_CE_20210101.shp \\');
      console.log('       -where "CPRO=\'35\' AND CMUN=\'016\'"');
      console.log('\n4. Colocar el archivo resultante en:');
      console.log(`   ${SECTIONS_FILE}\n`);
      console.log('5. Volver a ejecutar: npm run import:sections\n');

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

      // Build section_code from INE fields
      // Expected fields: CPRO, CMUN, CDIS, CSEC or CUSEC
      const cpro = props.CPRO || props.cpro || '35';
      const cmun = props.CMUN || props.cmun || '016';
      const cdis = props.CDIS || props.cdis || props.DIST || '00';
      const csec = props.CSEC || props.csec || props.SECC || String(imported + 1).padStart(3, '0');

      const section_code = `${cpro}${cmun}${cdis}${csec}`;
      const cusec = props.CUSEC || props.cusec || section_code;
      const name = props.NOMBRE || props.nombre || `Sección ${csec}`;

      // Convert GeoJSON geometry to WKT for PostGIS
      const geomJSON = JSON.stringify(feature.geometry);

      await db.none(`
        INSERT INTO census_sections (section_code, cusec, cumun, cdis, csec, name, geom)
        VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_GeomFromGeoJSON($7), 4326))
      `, [section_code, cusec, cmun, cdis, csec, name, geomJSON]);

      imported++;

      if (imported % 50 === 0) {
        console.log(`  📍 Imported ${imported} sections...`);
      }
    }

    console.log(`\n✅ Imported ${imported} census sections`);

    // Calculate areas
    console.log('\n🔧 Calculating section areas...');
    await db.none('SELECT calculate_section_areas()');
    console.log('✅ Areas calculated');

    // Show summary
    const summary = await db.one(`
      SELECT
        COUNT(*) as total_sections,
        ROUND(AVG(area_km2)::numeric, 3) as avg_area_km2,
        ROUND(MIN(area_km2)::numeric, 3) as min_area_km2,
        ROUND(MAX(area_km2)::numeric, 3) as max_area_km2
      FROM census_sections
    `);

    console.log('\n📊 Census Sections Summary:');
    console.log(`  Total sections: ${summary.total_sections}`);
    console.log(`  Avg area: ${summary.avg_area_km2} km²`);
    console.log(`  Min area: ${summary.min_area_km2} km²`);
    console.log(`  Max area: ${summary.max_area_km2} km²`);

  } catch (error) {
    console.error('❌ Error importing census sections:', error);
    process.exit(1);
  } finally {
    await db.$pool.end();
  }
}

importSections();
