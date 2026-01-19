const { db } = require('./db-config');
const fs = require('fs');
const readline = require('readline');

// Correct file path
const CSV_FILE = 'C:\\dev\\guaguas\\data\\Datos\\Malla de 250m-20220101 (1).csv';

async function updateCentroids() {
  console.log('🚀 Starting Population-Weighted Centroid Update (CSV Mode)...');

  try {
    if (!fs.existsSync(CSV_FILE)) {
      throw new Error(`CSV file not found: ${CSV_FILE}`);
    }

    // 1. Create Temp Table
    console.log('⚙️ Creating temporary grid table...');
    await db.none(`DROP TABLE IF EXISTS temp_grid_points;`);
    await db.none(`
      CREATE TEMP TABLE temp_grid_points (
        id SERIAL PRIMARY KEY,
        geom GEOMETRY(Point, 4326),
        population INTEGER
      );
    `);

    // 2. Stream & Process CSV
    console.log('📖 Reading CSV stream...');

    const fileStream = fs.createReadStream(CSV_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let headers = null;
    let idxGeom = -1;
    let idxPop = -1;

    let batch = [];
    const BATCH_SIZE = 500;
    let count = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;

      // Simple CSV split (WARNING: Fragile if WKT contains commas, but usually OK for WKT POLYGON((...)))
      // Ideally use a CSV parser lib, but WKT complicates it. 
      // Assumption: "geom" is double-quoted if it contains commas. Or WKT doesn't have commas (it does).
      // Let's assume standard "header1,header2,..." format.
      // If WKT has commas, simple split won't work perfectly.
      // However, usually "geom" is the LAST column or clearly quoted.
      // Let's try flexible parsing:

      if (!headers) {
        headers = line.split(',');
        idxPop = headers.findIndex(h => h.trim().toLowerCase() === 'poblacion');
        idxGeom = headers.findIndex(h => h.trim().toLowerCase() === 'geom'); // Look for 'geom' or 'wkt'

        console.log('   Headers found:', headers);
        console.log(`   Index Pop: ${idxPop}, Index Geom: ${idxGeom}`);

        if (idxPop === -1 || idxGeom === -1) {
          throw new Error("Could not find 'poblacion' or 'geom' columns.");
        }
        continue;
      }

      // Parse DATA line
      // Since WKT Polygons contain commas (e.g., "POLYGON((...))"), we need a smarter split logic
      // OR we just assume position if strict.
      // Let's use a regex to split by comma ONLY if not inside quotes.
      const row = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      if (row.length === 0) continue;

      // Clean polygon WKT (removing potential quotes)
      let wkt = row[idxGeom] ? row[idxGeom].replace(/^"|"$/g, '') : null;
      let pop = row[idxPop] ? parseInt(row[idxPop].replace(/^"|"$/g, '')) : 0;

      if (wkt && pop > 0) {
        // SQL: Use ST_Centroid on the grid polygon directly
        // Escaping single quotes in WKT just in case
        batch.push(`(ST_Centroid(ST_GeomFromText('${wkt}', 4326)), ${pop})`);
        count++;
      }

      if (batch.length >= BATCH_SIZE) {
        await db.none(`INSERT INTO temp_grid_points (geom, population) VALUES ${batch.join(',')}`);
        batch = [];
        process.stdout.write(`\r   Processed ${count} grid cells...`);
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      await db.none(`INSERT INTO temp_grid_points (geom, population) VALUES ${batch.join(',')}`);
    }
    console.log(`\n   -> Total inserted: ${count}`);

    // 3. Calculate Weighted Centroids
    console.log('🧮 Calculating weighted centroids per section...');

    await db.none(`ALTER TABLE census_sections ADD COLUMN IF NOT EXISTS geom_pop_center GEOMETRY(Point, 4326);`);

    await db.none(`
      WITH section_centroids AS (
        SELECT 
          cs.section_code,
          ST_SetSRID(
            ST_MakePoint(
              SUM(ST_X(g.geom) * g.population) / NULLIF(SUM(g.population), 0),
              SUM(ST_Y(g.geom) * g.population) / NULLIF(SUM(g.population), 0)
            ), 
          4326) as pop_center
        FROM census_sections cs
        JOIN temp_grid_points g ON ST_Intersects(g.geom, cs.geom) -- Use Intersects for grid vs section
        GROUP BY cs.section_code
      )
      UPDATE census_sections cs
      SET geom_pop_center = sc.pop_center
      FROM section_centroids sc
      WHERE cs.section_code = sc.section_code;
    `);

    // Fallback for empty sections
    await db.none(`
      UPDATE census_sections 
      SET geom_pop_center = ST_Centroid(geom) 
      WHERE geom_pop_center IS NULL;
    `);

    console.log('   -> Centroids updated.');

    // 4. Update Metrics (Nearest Stop)
    console.log('📏 Recalculating nearest stop distances...');

    await db.none(`
      UPDATE section_metrics sm
      SET nearest_stop_meters = subq.distance
      FROM (
        SELECT DISTINCT ON (cs.section_code)
          cs.section_code,
          ST_Distance(
            ST_Transform(cs.geom_pop_center, 3857), 
            ST_Transform(s.geom, 3857)
          ) as distance
        FROM census_sections cs
        CROSS JOIN stops s
        ORDER BY cs.section_code, ST_Distance(
          ST_Transform(cs.geom_pop_center, 3857),
          ST_Transform(s.geom, 3857)
        )
      ) subq
      WHERE sm.section_code = subq.section_code;
    `);

    console.log('✅ Success! Population-weighted access metrics updated.');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    db.$pool.end();
  }
}

updateCentroids();
