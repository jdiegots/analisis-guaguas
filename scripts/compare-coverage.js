const { db } = require('./db-config');
const fs = require('fs');
const readline = require('readline');

const CSV_FILE = 'C:\\dev\\guaguas\\data\\Datos\\Malla de 250m-20220101 (1).csv';

async function compareCoverage() {
    console.log('🔍 Comparing Territorial vs Population Coverage...');

    try {
        if (!fs.existsSync(CSV_FILE)) {
            throw new Error(`CSV file not found: ${CSV_FILE}`);
        }

        // 1. Setup DB for calculation
        await db.none(`DROP TABLE IF EXISTS temp_grid_points;`);
        await db.none(`
      CREATE TEMP TABLE temp_grid_points (
        id SERIAL PRIMARY KEY,
        geom GEOMETRY(Point, 4326),
        population INTEGER
      );
      CREATE INDEX ON temp_grid_points USING GIST (geom);
    `);

        // 2. Load Grid Points (Fast Stream)
        console.log('📖 Loading grid for analysis (this takes a moment)...');
        const fileStream = fs.createReadStream(CSV_FILE);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let headers = null, idxPop = -1, idxGeom = -1;
        let batch = [];
        const BATCH_SIZE = 1000;

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
            }

            if (batch.length >= BATCH_SIZE) {
                await db.none(`INSERT INTO temp_grid_points (geom, population) VALUES ${batch.join(',')}`);
                batch = [];
            }
        }
        if (batch.length > 0) await db.none(`INSERT INTO temp_grid_points (geom, population) VALUES ${batch.join(',')}`);

        // 3. Perform Comparison
        console.log('📊 Calculating Population Coverage and comparing...');

        // We calculate pop coverage: Sum(Pop inside 300m buffer) / Sum(Total Pop)
        // We compare against existing coverage_300_area_pct
        const comparison = await db.manyOrNone(`
      WITH section_pop_stats AS (
        SELECT 
          cs.section_code,
          SUM(g.population) as total_pop,
          SUM(CASE WHEN ST_DWithin(g.geom::geography, s_buffer.geom::geography, 0) THEN g.population ELSE 0 END) as covered_pop
        FROM census_sections cs
        JOIN temp_grid_points g ON ST_Intersects(g.geom, cs.geom)
        -- Create a unified buffer of stops for the section to check coverage
        LEFT JOIN LATERAL (
          SELECT ST_Union(ST_Buffer(s.geom::geography, 300)::geometry) as geom
          FROM stops s
          WHERE ST_DWithin(s.geom::geography, cs.geom::geography, 300) -- Only relevant stops
        ) s_buffer ON true
        GROUP BY cs.section_code
      )
      SELECT 
        sps.section_code,
        sm.coverage_300_area_pct as territorial_coverage,
        (sps.covered_pop::float / NULLIF(sps.total_pop, 0) * 100) as population_coverage,
        ((sps.covered_pop::float / NULLIF(sps.total_pop, 0) * 100) - sm.coverage_300_area_pct) as diff
      FROM section_pop_stats sps
      JOIN section_metrics sm ON sps.section_code = sm.section_code
      WHERE sps.total_pop > 0
      ORDER BY diff DESC
      LIMIT 20;
    `);

        console.log('\n🏆 TOP 20 "WINNERS" (Sections that gain coverage with new method):');
        console.log('SectionCode | Territorial % | Population % | Gain');
        console.log('----------------------------------------------------');
        comparison.forEach(r => {
            console.log(`${r.section_code}  | ${r.territorial_coverage.toFixed(1)}%        | ${r.population_coverage.toFixed(1)}%       | +${r.diff.toFixed(1)}%`);
        });

        // Also check for losers (inverse)
        const losers = await db.manyOrNone(`
      WITH section_pop_stats AS (
        SELECT 
          cs.section_code,
          SUM(g.population) as total_pop,
          SUM(CASE WHEN ST_DWithin(g.geom::geography, s_buffer.geom::geography, 0) THEN g.population ELSE 0 END) as covered_pop
        FROM census_sections cs
        JOIN temp_grid_points g ON ST_Intersects(g.geom, cs.geom)
        LEFT JOIN LATERAL (
          SELECT ST_Union(ST_Buffer(s.geom::geography, 300)::geometry) as geom
          FROM stops s
          WHERE ST_DWithin(s.geom::geography, cs.geom::geography, 300)
        ) s_buffer ON true
        GROUP BY cs.section_code
      )
      SELECT 
        sps.section_code,
        sm.coverage_300_area_pct as territorial_coverage,
        (sps.covered_pop::float / NULLIF(sps.total_pop, 0) * 100) as population_coverage,
        (sm.coverage_300_area_pct - (sps.covered_pop::float / NULLIF(sps.total_pop, 0) * 100)) as loss
      FROM section_pop_stats sps
      JOIN section_metrics sm ON sps.section_code = sm.section_code
      WHERE sps.total_pop > 0
      ORDER BY loss DESC
      LIMIT 5;
    `);

        console.log('\n📉 TOP 5 "LOSERS" (Sections that lose coverage - rare but possible):');
        losers.forEach(r => {
            console.log(`${r.section_code}  | ${r.territorial_coverage.toFixed(1)}%        | ${r.population_coverage.toFixed(1)}%       | -${r.loss.toFixed(1)}%`);
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        db.$pool.end();
    }
}

compareCoverage();
