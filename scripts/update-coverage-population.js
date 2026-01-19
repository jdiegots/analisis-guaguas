const { db } = require('./db-config');
const fs = require('fs');
const readline = require('readline');

const CSV_FILE = 'C:\\dev\\guaguas\\data\\Datos\\Malla de 250m-20220101 (1).csv';

async function updateCoverage() {
    console.log('🚀 Starting Population-Weighted Coverage Update...');

    try {
        if (!fs.existsSync(CSV_FILE)) {
            throw new Error(`CSV file not found: ${CSV_FILE}`);
        }

        // 1. Setup DB
        await db.none(`DROP TABLE IF EXISTS temp_grid_points;`);
        await db.none(`
      CREATE TEMP TABLE temp_grid_points (
        id SERIAL PRIMARY KEY,
        geom GEOMETRY(Point, 4326),
        population INTEGER
      );
      CREATE INDEX ON temp_grid_points USING GIST (geom);
    `);

        // 2. Load Grid
        console.log('📖 Stream-loading grid data...');
        const fileStream = fs.createReadStream(CSV_FILE);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let headers = null, idxPop = -1, idxGeom = -1;
        let batch = [];
        const BATCH_SIZE = 1000;
        let count = 0;

        for await (const line of rl) {
            if (!line.trim()) continue;
            if (!headers) {
                headers = line.split(',');
                idxPop = headers.findIndex(h => h.trim().toLowerCase() === 'poblacion');
                idxGeom = headers.findIndex(h => h.trim().toLowerCase() === 'geom');
                continue;
            }

            const row = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            if (row.length === 0) continue;

            let wkt = row[idxGeom] ? row[idxGeom].replace(/^"|"$/g, '') : null;
            let pop = row[idxPop] ? parseInt(row[idxPop].replace(/^"|"$/g, '')) : 0;

            if (wkt && pop > 0) {
                batch.push(`(ST_Centroid(ST_GeomFromText('${wkt}', 4326)), ${pop})`);
                count++;
            }

            if (batch.length >= BATCH_SIZE) {
                await db.none(`INSERT INTO temp_grid_points (geom, population) VALUES ${batch.join(',')}`);
                batch = [];
            }
        }
        if (batch.length > 0) await db.none(`INSERT INTO temp_grid_points (geom, population) VALUES ${batch.join(',')}`);
        console.log(`   -> Loaded ${count} grid cells.`);

        // 3. Update Coverage Metric
        console.log('🧮 Calculating Population Coverage per Section...');

        // We update section_metrics directly
        // Logic: 
        //   Total Pop = Sum of grid points in section
        //   Covered Pop = Sum of grid points within 300m of stops (using ST_DWithin against stops table directly is faster than creating buffers)

        // Note: ST_DWithin uses spheroid by default for geography, so we cast to geography.

        await db.none(`
      WITH coverage_stats AS (
        SELECT 
          cs.section_code,
          SUM(g.population) as total_pop,
          SUM(
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM stops s 
                WHERE ST_DWithin(g.geom::geography, s.geom::geography, 300)
              ) THEN g.population 
              ELSE 0 
            END
          ) as covered_pop
        FROM census_sections cs
        JOIN temp_grid_points g ON ST_Intersects(g.geom, cs.geom)
        GROUP BY cs.section_code
      )
      UPDATE section_metrics sm
      SET coverage_300_area_pct = CASE 
        WHEN cs.total_pop > 0 THEN (cs.covered_pop::float / cs.total_pop) * 100
        ELSE 0 
      END
      FROM coverage_stats cs
      WHERE sm.section_code = cs.section_code;
    `);

        console.log('✅ Coverage Updated! Now reflects % of people covered, not % of empty land.');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        db.$pool.end();
    }
}

updateCoverage();
