require('dotenv').config();
const https = require('https');
const { db } = require('./db-config');

const LAYERS = [
  { name: 'ALOJATIVOS_HOTELERO', type: 'hotel' },
  { name: 'RESTAURACION', type: 'restaurant' },
  { name: 'ALOJATIVOS_EXTRAHOTELERO_VV', type: 'vacation_rental' },
  { name: 'ALOJATIVOS_EXTRAHOTELERO_SIN_VV', type: 'other_accommodation' }
];

// Las Palmas bounding box
const BBOX = {
  minLon: -15.527,
  minLat: 28.024,
  maxLon: -15.396,
  maxLat: 28.181
};

function getFeatureInfoUrl(layer, x, y, bbox) {
  const width = 800;
  const height = 800;

  return `https://idecan2.grafcan.es/ServicioWMS/EstablecimientosTuristicos?` +
    `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
    `&LAYERS=${layer}&QUERY_LAYERS=${layer}` +
    `&BBOX=${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}` +
    `&WIDTH=${width}&HEIGHT=${height}` +
    `&SRS=EPSG:4326&FORMAT=image/png` +
    `&INFO_FORMAT=text/html` +
    `&X=${x}&Y=${y}` +
    `&FEATURE_COUNT=50`;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseHtmlFeatures(html, type) {
  const features = [];

  // Simple HTML parsing - look for coordinate patterns
  // This is a basic approach; WMS HTML responses vary
  const lines = html.split('\n');
  let currentFeature = null;

  for (const line of lines) {
    // Look for coordinate patterns or feature boundaries
    if (line.includes('Feature') || line.includes('feature')) {
      if (currentFeature) {
        features.push(currentFeature);
      }
      currentFeature = { type, properties: {} };
    }

    // Extract any visible data
    if (currentFeature && line.trim()) {
      const match = line.match(/([^:]+):\s*(.+)/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/<[^>]*>/g, '');
        currentFeature.properties[key] = value;
      }
    }
  }

  if (currentFeature) {
    features.push(currentFeature);
  }

  return features;
}

async function main() {
  console.log('🏨 Downloading tourism establishments data...\n');

  try {
    // Create table
    console.log('Creating tourism_establishments table...');
    await db.none(`
      CREATE TABLE IF NOT EXISTS tourism_establishments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500),
        type VARCHAR(100),
        subtype VARCHAR(100),
        address VARCHAR(500),
        municipality VARCHAR(100),
        geom GEOMETRY(Point, 4326),
        properties JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.none(`CREATE INDEX IF NOT EXISTS idx_tourism_geom ON tourism_establishments USING GIST(geom)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_tourism_type ON tourism_establishments(type)`);

    console.log('✓ Table created\n');

    // Try a different approach: Use GetMap to check if data exists, then GetFeature
    console.log('Note: WMS GetFeatureInfo often returns limited data.');
    console.log('Attempting to query the service...\n');

    const gridSize = 10;
    const lonStep = (BBOX.maxLon - BBOX.minLon) / gridSize;
    const latStep = (BBOX.maxLat - BBOX.minLat) / gridSize;

    let totalFeatures = 0;

    for (const layer of LAYERS) {
      console.log(`Querying layer: ${layer.name} (${layer.type})...`);
      let layerCount = 0;

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const bbox = {
            minLon: BBOX.minLon + (i * lonStep),
            minLat: BBOX.minLat + (j * latStep),
            maxLon: BBOX.minLon + ((i + 1) * lonStep),
            maxLat: BBOX.minLat + ((j + 1) * latStep)
          };

          const x = 400; // Center of 800x800 tile
          const y = 400;

          try {
            const url = getFeatureInfoUrl(layer.name, x, y, bbox);
            const response = await httpsGet(url);

            if (response.includes('Feature') || response.includes('NOMBRE') || response.includes('nombre')) {
              console.log(`  Found data in grid cell [${i},${j}]`);
              console.log(`  Response sample: ${response.substring(0, 200)}...`);
              layerCount++;
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`  Error querying grid [${i},${j}]:`, error.message);
          }
        }
      }

      console.log(`  ${layer.name}: ${layerCount} grid cells with data\n`);
      totalFeatures += layerCount;
    }

    if (totalFeatures === 0) {
      console.log('\n⚠️  No features found via GetFeatureInfo.');
      console.log('This WMS service may not support feature querying, or data is sparse.');
      console.log('\nAlternative approaches:');
      console.log('1. Use the WMS layers directly in the map (already implemented)');
      console.log('2. Contact IDECanarias for bulk data download');
      console.log('3. Check opendata.sitcan.es for CSV/JSON datasets');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await db.$pool.end();
  }
}

main().catch(console.error);
