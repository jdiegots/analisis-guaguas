// Convert shapefile to GeoJSON with proper WGS84 coordinates
// The shapefile is in ETRS89 UTM Zone 30N, we need to reproject to WGS84
const shapefile = require('shapefile');
const proj4 = require('proj4');
const fs = require('fs');
const path = require('path');

const SHP_PATH = path.join(__dirname, '..', 'data', 'España_Seccionado2025_ETRS89H30', 'SECC_CE_20250101.shp');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'census_sections_las_palmas.geojson');

// Define projections
// EPSG:25830 - ETRS89 / UTM zone 30N
proj4.defs('EPSG:25830', '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
// EPSG:4326 - WGS84
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

function reprojectCoordinates(coords, fromProj, toProj) {
  if (!coords || coords.length === 0) return coords;

  // Check if it's a nested array (polygon)
  if (Array.isArray(coords[0])) {
    return coords.map(ring => reprojectCoordinates(ring, fromProj, toProj));
  }

  // It's a coordinate pair [x, y]
  return proj4(fromProj, toProj, coords);
}

function reprojectGeometry(geometry) {
  if (!geometry) return null;

  const newGeometry = { ...geometry };

  if (geometry.type === 'Polygon') {
    newGeometry.coordinates = geometry.coordinates.map(ring =>
      ring.map(coord => proj4('EPSG:25830', 'EPSG:4326', coord))
    );
  } else if (geometry.type === 'MultiPolygon') {
    newGeometry.coordinates = geometry.coordinates.map(polygon =>
      polygon.map(ring =>
        ring.map(coord => proj4('EPSG:25830', 'EPSG:4326', coord))
      )
    );
  }

  return newGeometry;
}

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
        // Reproject geometry from UTM to WGS84
        const reprojectedGeometry = reprojectGeometry(result.value.geometry);

        features.push({
          ...result.value,
          geometry: reprojectedGeometry
        });

        filtered++;

        if (filtered % 10 === 0) {
          process.stdout.write(`\r  Found and reprojected ${filtered} sections...`);
        }
      }
    }

    console.log(`\n  ✅ Filtered ${filtered} sections from ${total} total`);
    console.log('  ✅ Reprojected from EPSG:25830 (UTM 30N) to EPSG:4326 (WGS84)');

    // Create GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      crs: {
        type: 'name',
        properties: {
          name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
        }
      },
      features: features
    };

    console.log('\n💾 Writing GeoJSON...');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson, null, 2));
    console.log(`  ✅ Saved to: ${OUTPUT_PATH}`);

    const sizeKB = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
    console.log(`  📊 File size: ${sizeKB} KB`);

    // Show sample coordinates
    if (features.length > 0) {
      const sampleCoord = features[0].geometry.coordinates[0][0][0];
      console.log('\n📋 Sample coordinates (WGS84):');
      console.log(`  Longitude: ${sampleCoord[0].toFixed(6)}`);
      console.log(`  Latitude: ${sampleCoord[1].toFixed(6)}`);
      console.log(`  Expected range: Lon -15.5 to -15.3, Lat 28.0 to 28.2`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

convertShapefile();
