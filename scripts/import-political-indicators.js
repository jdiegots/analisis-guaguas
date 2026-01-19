const { db } = require('./db-config');
const fs = require('fs');
const path = require('path');

const DATA_DIR = 'C:\\dev\\guaguas\\data\\Datos';

// CSV Filenames
const FILES = {
    RENT: 'Mediana_renta_ud_consumo.csv',
    OCCUPATION: 'ocupados_16_o_mas_anos_por_rama_de_actividad.csv',
    OCCUPATION_TYPE: 'ocupados_16_o_mas_por_ocupacion.csv',
    EDUCATION: 'poblacion_15_mas_anos_por_pais_nacimiento_nivel_estudios.csv',
    ACTIVITY: 'poblacion_16_mas_anos_por_relacion_con_actividad.json.csv',
    POP_TOTAL_65: 'poblacion_total_y_65.csv'
};

// Helper: Read CSV and return Map<SectionCode, Object>
function readCsv(filename) {
    const fullPath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ Warning: File not found: ${filename}`);
        return new Map();
    }

    console.log(`📖 Reading ${filename}...`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const map = new Map();

    if (lines.length < 2) return map;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(';');
        const sectionCode = parts[0] ? parts[0].trim() : null;

        if (sectionCode && sectionCode.startsWith('35016')) {
            // Parse all other parts as numbers/strings
            map.set(sectionCode, parts.slice(1));
        }
    }

    console.log(`   -> Loaded ${map.size} sections.`);
    return map;
}

function parseNum(val) {
    if (!val) return 0;
    const clean = val.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

async function main() {
    console.log('🚀 Starting Political Indicators Import (CSV Only)...');

    try {
        // 1. VERIFY SCHEMA
        console.log('🔧 Verifying DB Schema...');
        await db.none(`
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS income_median INTEGER;
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS prop_elderly FLOAT;
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS indicator_elderly_desert FLOAT;
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS indicator_mobility_inequality FLOAT;
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS working_class_pct FLOAT; 
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS indicator_education_gap FLOAT;
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS indicator_unemployment_trap FLOAT;
            
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS occ_services FLOAT;
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS occ_construction FLOAT;
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS occ_industry FLOAT;
            ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS occ_agriculture FLOAT;
        `);
        console.log('   -> Schema OK.');

        // 2. LOAD DATA
        const rentData = readCsv(FILES.RENT);
        const occData = readCsv(FILES.OCCUPATION);
        const occTypeData = readCsv(FILES.OCCUPATION_TYPE);
        const eduData = readCsv(FILES.EDUCATION);
        const activityData = readCsv(FILES.ACTIVITY);
        const popData = readCsv(FILES.POP_TOTAL_65);

        // 3. TARGET SECTIONS
        const dbSections = await db.manyOrNone("SELECT section_code FROM census_sections WHERE section_code LIKE '35016%'");
        const dbCodes = new Set(dbSections.map(s => s.section_code));
        console.log(`🎯 Updating ${dbCodes.size} sections in DB...`);

        const updates = [];

        for (const code of dbCodes) {

            // --- A. POPULATION & ELDERLY ---
            let totalPop = 1;
            let propElderly = 0;
            if (popData.has(code)) {
                const row = popData.get(code);
                totalPop = parseNum(row[0]);
                const elderly = parseNum(row[1]);
                if (totalPop === 0) totalPop = 1;
                propElderly = elderly / totalPop;
            }

            // --- B. INCOME ---
            let income = null;
            if (rentData.has(code)) {
                const row = rentData.get(code);
                const val = parseNum(row[0]);
                if (val > 0) income = val;
            }

            // --- C. OCCUPATION (SECTORS) ---
            let occ_services = 0, occ_construction = 0, occ_industry = 0, occ_agriculture = 0;
            if (occData.has(code)) {
                const row = occData.get(code);
                const totalWorkers = parseNum(row[0]);
                if (totalWorkers > 0) {
                    occ_agriculture = parseNum(row[1]) / totalWorkers;
                    occ_industry = parseNum(row[2]) / totalWorkers;
                    occ_construction = parseNum(row[3]) / totalWorkers;
                    occ_services = parseNum(row[4]) / totalWorkers;
                }
            }

            // --- D. ACTIVITY (Unemployment, by relation) ---
            let rate_unemployed = 0;
            let density_students = 0;

            if (activityData.has(code)) {
                const row = activityData.get(code);
                const busy = parseNum(row[1]);
                const unemployed = parseNum(row[2]);
                const students = parseNum(row[5]);

                const activePop = busy + unemployed;
                if (activePop > 0) rate_unemployed = unemployed / activePop;
                if (totalPop > 0) density_students = students / totalPop;
            }

            // --- E. EDUCATION ---
            let lowEducationProp = 0;
            if (eduData.has(code)) {
                const row = eduData.get(code);
                const totalEdu = parseNum(row[0]);
                const prim = parseNum(row[1]);
                const sec1 = parseNum(row[2]);

                if (totalEdu > 0) {
                    lowEducationProp = (prim + sec1) / totalEdu;
                }
            }

            // --- F. WORKING CLASS (Occupational Class) ---
            // Cols: [0]=Total, [1]=Directors/Prof, [2]=Skilled workers, [3]=Elementary, [4]=No data
            let working_class_pct = 0;
            if (occTypeData.has(code)) {
                const row = occTypeData.get(code);
                const totalWorkers = parseNum(row[0]);
                const skilled = parseNum(row[2]);
                const elementary = parseNum(row[3]);

                if (totalWorkers > 0) {
                    working_class_pct = (skilled + elementary) / totalWorkers;
                }
            }

            // PUSH UPDATE
            updates.push(db.none(`
                UPDATE section_metrics
                SET income_median = $2,
                    prop_elderly = $3,
                    total_population = $4,
    
                    occ_services = $5,
                    occ_construction = $6,
                    occ_industry = $7,
                    occ_agriculture = $8,
    
                    indicator_unemployment_trap = $9, 
                    indicator_education_gap = $10,     
                    indicator_student_access = $11,   
                    working_class_pct = $12 
    
                WHERE section_code = $1
            `, [
                code, income, propElderly, totalPop,
                occ_services, occ_construction, occ_industry, occ_agriculture,
                rate_unemployed, lowEducationProp, density_students, working_class_pct
            ]));
        }

        // 4. EXECUTE BATCH
        console.log('💾 Saving to database...');
        await db.tx(t => t.batch(updates));
        console.log('✅ Base Socio-metrics updated.');

        // 5. RECALCULATE COMPOSITES
        console.log('🔄 Calculating Composite Political Indicators...');
        await db.none(`
            UPDATE section_metrics
            SET
                indicator_elderly_desert = prop_elderly * (1 - COALESCE(coverage_300_area_pct, 0)/100.0),
                indicator_unemployment_trap = indicator_unemployment_trap / NULLIF(stop_time_events_morning + 1, 0) * 1000,
                indicator_service_dependency = occ_services / NULLIF(stop_time_events_morning + 1, 0) * 1000,
                indicator_worker_commute = (occ_construction + occ_industry) * COALESCE(nearest_stop_meters, 1000) / 1000.0,
                indicator_education_gap = (indicator_education_gap::float / NULLIF(stops_per_km2 + 0.1, 0))::float,
                indicator_student_access = (indicator_student_access::float / NULLIF(stops_per_km2 + 0.1, 0))::float
        `);

        // Clean up nulls
        await db.none(`
            UPDATE section_metrics SET
                indicator_elderly_desert = COALESCE(indicator_elderly_desert, 0),
                indicator_unemployment_trap = COALESCE(indicator_unemployment_trap, 0),
                indicator_service_dependency = COALESCE(indicator_service_dependency, 0),
                indicator_worker_commute = COALESCE(indicator_worker_commute, 0),
                working_class_pct = COALESCE(working_class_pct, 0)
        `);

        console.log('✅ Import Completed Successfully.');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        db.$pool.end();
    }
}

main();
