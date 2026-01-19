const fs = require('fs');
const parse = require('csv-parse/sync').parse;
const XLSX = require('xlsx');
const pgp = require('pg-promise')();
require('dotenv').config({ path: 'c:\\dev\\guaguas\\.env' });

const db = pgp(process.env.DATABASE_URL);


// --- CONFIG ---
const HOTELS_CSV_PATH = 'c:\\dev\\guaguas\\data\\Datos\\establecimientos-hoteleros-inscritos-en-el-registro-general-turistico-de-canarias.csv';
const VV_XLSX_PATH = 'c:\\dev\\guaguas\\data\\Datos\\establecimientos-extrahoteleros-de-tipologia-vivienda-vacacional.xlsx';
const MUNICIPALITY_FILTER = 'Las Palmas De Gran Canaria'; // Note: CSV uses this casing, verify XLSX
const SRID = 4326;

async function importTouristAccommodations() {
    try {
        console.log('📦 Starting Tourist Accommodations Import...');

        // 1. Initialize DB Table
        await db.none(`
      CREATE TABLE IF NOT EXISTS tourist_accommodations (
        id SERIAL PRIMARY KEY,
        external_id TEXT,
        name TEXT,
        type TEXT, -- 'Hotel', 'Vivienda Vacacional', etc.
        subtype TEXT, -- '5 Estrellas', etc.
        places INTEGER, -- Plazas/Capacity
        municipality TEXT,
        geom GEOMETRY(Point, 4326)
      );
      CREATE INDEX IF NOT EXISTS tourist_accommodations_geom_idx ON tourist_accommodations USING GIST (geom);
    `);

        // Clear existing data for this municipality to avoid duplicates if re-running
        await db.none('DELETE FROM tourist_accommodations WHERE municipality = $1', [MUNICIPALITY_FILTER]);

        // 2. Process Hotels CSV
        console.log(`📄 Reading Hotels CSV: ${HOTELS_CSV_PATH}`);
        const csvContent = fs.readFileSync(HOTELS_CSV_PATH, 'utf8');
        const hotels = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            delimiter: ';'
        });

        let hotelCount = 0;
        for (const h of hotels) {
            // Normalize municipality check (case insensitive trim)
            if (h.direcion_municipio_nombre?.trim().toLowerCase() === MUNICIPALITY_FILTER.toLowerCase()) {
                const lat = parseFloat(h.latitud.replace(',', '.'));
                const lon = parseFloat(h.longitud.replace(',', '.'));

                if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
                    await db.none(`
            INSERT INTO tourist_accommodations (external_id, name, type, subtype, places, municipality, geom)
            VALUES ($1, $2, 'Hotel', $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326))
          `, [
                        h.establecimiento_id,
                        h.establecimiento_nombre_comercial,
                        h.establecimiento_tipologia + ' ' + h.establecimiento_clasificacion,
                        parseInt(h.plazas) || 0,
                        MUNICIPALITY_FILTER,
                        lon,
                        lat
                    ]);
                    hotelCount++;
                }
            }
        }
        console.log(`✅ Imported ${hotelCount} hotels.`);

        // 3. Process Vacation Rentals (VV) XLSX
        console.log(`📄 Reading VV XLSX: ${VV_XLSX_PATH}`);
        const workbook = XLSX.readFile(VV_XLSX_PATH);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const vvs = XLSX.utils.sheet_to_json(sheet);

        let vvCount = 0;
        // Inspect first row to determine column names if needed. Assuming common names based on CSV or similar.
        // Usually: 'LATITUD', 'LONGITUD', 'MUNICIPIO'
        // Let's print keys of first item to be safe if debugging, but here we'll try standard guesses.

        if (vvs.length > 0) {
            const keys = Object.keys(vvs[0]);
            console.log('Sample XLSX Keys:', keys.slice(0, 5));

            // Map keys dynamically
            const muniKey = keys.find(k => k.toLowerCase().includes('municipio')) || 'MUNICIPIO';
            const latKey = keys.find(k => k.toLowerCase().includes('latitud')) || 'LATITUD';
            const lonKey = keys.find(k => k.toLowerCase().includes('longitud')) || 'LONGITUD';
            const nameKey = keys.find(k => k.toLowerCase().includes('nombre') || k.toLowerCase().includes('rótulo')) || 'NOMBRE';
            const plazasKey = keys.find(k => k.toLowerCase().includes('plazas')) || 'PLAZAS';
            const modalKey = keys.find(k => k.toLowerCase().includes('modalidad')) || 'MODALIDAD';

            for (const v of vvs) {
                const muni = v[muniKey];
                if (muni && muni.toString().trim().toLowerCase() === MUNICIPALITY_FILTER.toLowerCase()) {
                    const lat = parseFloat(v[latKey]);
                    const lon = parseFloat(v[lonKey]);

                    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
                        await db.none(`
                        INSERT INTO tourist_accommodations (external_id, name, type, subtype, places, municipality, geom)
                        VALUES ($1, $2, 'Vivienda Vacacional', $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326))
                    `, [
                            'VV-' + vvCount, // No ID usually in these lists?
                            v[nameKey] || 'VV',
                            v[modalKey] || 'VV',
                            parseInt(v[plazasKey]) || 0,
                            MUNICIPALITY_FILTER,
                            lon,
                            lat
                        ]);
                        vvCount++;
                    }
                }
            }
        }
        console.log(`✅ Imported ${vvCount} vacation rentals.`);


        // 4. Calculate correlation metrics
        console.log('🔄 Calculating Tourist Metrics per Section...');

        // Add columns to census_sections if not exist
        await db.none(`
      ALTER TABLE census_sections ADD COLUMN IF NOT EXISTS tourist_spots_count INTEGER DEFAULT 0;
      ALTER TABLE census_sections ADD COLUMN IF NOT EXISTS tourist_places_count INTEGER DEFAULT 0; -- Plazas/Camas totales
      ALTER TABLE census_sections ADD COLUMN IF NOT EXISTS tourist_density FLOAT DEFAULT 0;
    `);

        // Update counts via Spatial Join
        await db.none(`
      WITH counts AS (
        SELECT 
          cs.section_code,
          COUNT(t.id) as spot_count,
          COALESCE(SUM(t.places), 0) as places_sum
        FROM census_sections cs
        LEFT JOIN tourist_accommodations t ON ST_Within(t.geom, cs.geom)
        GROUP BY cs.section_code
      )
      UPDATE census_sections cs
      SET 
        tourist_spots_count = c.spot_count,
        tourist_places_count = c.places_sum,
        tourist_density = (c.places_sum::float / NULLIF(cs.area_km2, 0))
      FROM counts c
      WHERE cs.section_code = c.section_code;
    `);

        console.log('✅ Metrics updated in census_sections.');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit();
    }
}

importTouristAccommodations();
