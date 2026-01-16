// Convert shapefile to GeoJSON filtering Las Palmas
// Using shapefile npm package
const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

const SHP_PATH = path.join(__dirname, '..', 'data', 'España_Seccionado2025_ETRS89H30', 'SECC_CE_20250101.shp');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'census_sections_las_palmas.geojson');

async function convertShapefile() {
  console.log('📂 Reading shapefile...');
  console.log(`   Input: ${SHP_PATH}`);

  const features = [];
  let total = 0;
  let filtered = 0;

  try {
    const source = await shapefile.open(SHP_PATH);

    while (true) {
      const result = await source.read();
      if (result.done) break;

      total++;

      // Filter: CPRO='35' AND CMUN='016' (Las Palmas de Gran Canaria)
      const props = result.value.properties;
      if (props.CPRO === '35' && props.CMUN === '016') {
        features.push(result.value);
        filtered++;

        if (filtered % 10 === 0) {
          process.stdout.write(`\r  Found ${filtered} sections...`);
        }
      }
    }

    console.log(`\n  ✅ Filtered ${filtered} sections from ${total} total`);

    // Create GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      features: features
    };

    console.log('\n💾 Writing GeoJSON...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson, null, 2));
    console.log(`  ✅ Saved to: ${OUTPUT_PATH}`);

    const sizeKB = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
    console.log(`  📊 File size: ${sizeKB} KB`);

    // Show sample
    if (features.length > 0) {
      console.log('\n📋 Sample section:');
      console.log(`  Section code: ${features[0].properties.CPRO}${features[0].properties.CMUN}${features[0].properties.CDIS}${features[0].properties.CSEC}`);
      console.log(`  Fields:`, Object.keys(features[0].properties).join(', '));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

convertShapefile();
