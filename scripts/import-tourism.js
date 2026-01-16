require('dotenv').config();
const https = require('https');
const { db } = require('./db-config');

const LAYERS = [
  { name: 'ALOJATIVOS_HOTELERO', type: 'hotel' },
  { name: 'RESTAURACION', type: 'restaurant' },
  { name: 'ALOJATIVOS_EXTRAHOTELERO_VV', type: 'vacation_rental' }
];

// Las Palmas bounding box
const BBOX = { minLon: -15.527, minLat: 28.024, maxLon: -15.396, maxLat: 28.181 };

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseTourismHtml(html) {
  const features = [];
  const blocks = html.split(/<table[^>]*border\s*=\s*["\']?0["\']?[^>]*>/i).slice(1);

  for (const block of blocks) {
    if (!block.trim() || block.includes('IDECanarias') || block.includes('Grafcan')) continue;

    const feature = { properties: {} };
    const rowPattern = /<td[^>]*class\s*=\s*["\']?epigrafe[^>]*>([^<]+)<\/td>\s*<td[^>]*class\s*=\s*["\']?valor[^>]*>([^<]+)<\/td>/gi;

    let match;
    while ((match = rowPattern.exec(block)) !== null) {
      const key = match[1].replace(/:/g, '').trim();
      const value = match[2]
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]*>/g, '')
        .trim();
      feature.properties[key] = value;
    }

    if (feature.properties['Establecimiento']) {
      features.push(feature);
    }
  }

  return features;
}

async function geocodeAddress(address) {
  // Use Nominatim with Las Palmas constraint
  const query = encodeURIComponent(`${address}, Las Palmas de Gran Canaria, Canarias, España`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=es&viewbox=${BBOX.minLon},${BBOX.minLat},${BBOX.maxLon},${BBOX.maxLat}&bounded=1`;

  try {
    const response = await httpsGet(url);
    const data = JSON.parse(response);

    if (data && data.length > 0) {
      return {
        lon: parseFloat(data[0].lon),
        lat: parseFloat(data[0].lat)
      };
    }
  } catch (error) {
    console.error(`  Geocoding error for "${address}":`, error.message);
  }

  return null;
}

async function main() {
  console.log('🏨 Importing tourism establishments for Las Palmas de Gran Canaria...\n');

  try {
    // Create table
    await db.none(`
      CREATE TABLE IF NOT EXISTS tourism_establishments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500),
        code VARCHAR(100),
        type VARCHAR(100),
        address VARCHAR(500),
        geom GEOMETRY(Point, 4326),
        properties JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.none(`CREATE INDEX IF NOT EXISTS idx_tourism_geom ON tourism_establishments USING GIST(geom)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_tourism_type ON tourism_establishments(type)`);
    await db.none(`DELETE FROM tourism_establishments`);

    console.log('✓ Table ready\n');

    const gridSize = 8;
    const lonStep = (BBOX.maxLon - BBOX.minLon) / gridSize;
    const latStep = (BBOX.maxLat - BBOX.minLat) / gridSize;

    let totalImported = 0;
    const seenEstablishments = new Set();

    for (const layer of LAYERS) {
      console.log(`Processing layer: ${layer.name} (${layer.type})...`);
      let layerCount = 0;

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const bbox = {
            minLon: BBOX.minLon + (i * lonStep),
            minLat: BBOX.minLat + (j * latStep),
            maxLon: BBOX.minLon + ((i + 1) * lonStep),
            maxLat: BBOX.minLat + ((j + 1) * latStep)
          };

          const url = `https://idecan2.grafcan.es/ServicioWMS/EstablecimientosTuristicos?` +
            `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
            `&LAYERS=${layer.name}&QUERY_LAYERS=${layer.name}` +
            `&BBOX=${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}` +
            `&WIDTH=800&HEIGHT=800&SRS=EPSG:4326&FORMAT=image/png` +
            `&INFO_FORMAT=text/html&X=400&Y=400&FEATURE_COUNT=50`;

          try {
            const html = await httpsGet(url);
            const features = parseTourismHtml(html);

            for (const feature of features) {
              const estabName = feature.properties['Establecimiento'];

              // Skip duplicates
              if (seenEstablishments.has(estabName)) continue;
              seenEstablishments.add(estabName);

              // Extract code from name (format: "Name (CODE)")
              const codeMatch = estabName.match(/\(([^)]+)\)/);
              const code = codeMatch ? codeMatch[1] : null;
              const name = estabName.replace(/\s*\([^)]+\)\s*$/, '').trim();

              const address = feature.properties['Dirección'] || feature.properties['Direccion'];

              // Geocode address
              let geom = null;
              if (address) {
                console.log(`    Geocoding: ${name} - ${address}...`);
                const coords = await geocodeAddress(address);

                if (coords) {
                  geom = `POINT(${coords.lon} ${coords.lat})`;
                  console.log(`      ✓ ${coords.lon}, ${coords.lat}`);
                } else {
                  console.log(`      ✗ Not found`);
                }

                // Rate limit Nominatim (1 req/sec)
                await new Promise(resolve => setTimeout(resolve, 1100));
              }

              // Insert
              await db.none(`
                INSERT INTO tourism_establishments (name, code, type, address, geom, properties)
                VALUES ($1, $2, $3, $4, ST_GeomFromText($5, 4326), $6)
              `, [name, code, layer.type, address, geom || 'POINT(0 0)', feature.properties]);

              layerCount++;
              totalImported++;
            }

            // Rate limit WMS
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            console.error(`  Error in grid [${i},${j}]:`, error.message);
          }
        }
      }

      console.log(`  ${layer.name}: ${layerCount} establishments\n`);
    }

    console.log(`\n✅ Imported ${totalImported} tourism establishments!`);

    // Show summary
    const summary = await db.any(`
      SELECT type, COUNT(*) as count
      FROM tourism_establishments
      WHERE ST_X(geom) != 0
      GROUP BY type
      ORDER BY count DESC
    `);

    console.log('\n📊 Summary (with valid coordinates):');
    summary.forEach(s => {
      console.log(`  ${s.type}: ${s.count} establishments`);
    });

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await db.$pool.end();
  }
}

main().catch(console.error);
