const { db } = require('./db-config');
const fs = require('fs');
const path = require('path');

// File Configuration
const FILES = {
    RENT: 'Mediana_renta_ud_consumo.json',
    ELDERLY: 'Poblacion_65_o_mas.json',
    TOTAL_POP: 'Poblacion_total.json',
    OCCUPATION: 'ocupados_16_o_mas_anos_por_rama_de_actividad.json',
    EDUCATION: 'poblacion_15_mas_anos_por_pais_nacimiento_nivel_estudios.json',
    UNEMPLOYMENT: 'poblacion_16_mas_anos_por_relacion_con_actividad.json'
};

const DATA_DIR = 'C:\\Users\\jdieg\\Downloads\\Datos';

async function main() {
    console.log('🚀 Starting Political Indicators Import (JS Version)...');

    try {
        // -------------------------------------------------------------
        // 1. ENSURE DB COLUMNS EXIST
        // -------------------------------------------------------------
        console.log('🔧 Verifying DB Schema...');
        await db.none(`
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS income_median INTEGER;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS prop_elderly FLOAT;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS indicator_elderly_desert FLOAT;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS indicator_mobility_inequality FLOAT;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS indicator_working_class FLOAT; 
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS indicator_education_gap FLOAT;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS indicator_unemployment_trap FLOAT;
      
      -- New Sector Columns
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS occ_services FLOAT;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS occ_construction FLOAT;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS occ_industry FLOAT;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS occ_agriculture FLOAT;
    `);
        console.log('   -> Schema OK.');

        // -------------------------------------------------------------
        // 2. GET TARGET SECTIONS
        // -------------------------------------------------------------
        const dbSections = await db.manyOrNone("SELECT section_code FROM census_sections WHERE section_code LIKE '35016%'");
        const dbCodes = new Set(dbSections.map(s => s.section_code));
        console.log(`🎯 Loaded ${dbCodes.size} Las Palmas sections from DB.`);

        // -------------------------------------------------------------
        // 3. READ DATA HELPER
        // -------------------------------------------------------------
        const readIneFile = (filename, metricType) => {
            const fullPath = path.join(DATA_DIR, filename);
            if (!fs.existsSync(fullPath)) return null;

            console.log(`📖 Reading ${filename}...`);

            let json;
            try {
                const raw = fs.readFileSync(fullPath, 'utf8');
                json = JSON.parse(raw);
            } catch (e) { return null; }

            const dataArray = Array.isArray(json) ? json : [json];
            const metricsMap = new Map(); // Code -> { total: number, categories: { [name: string]: number } }

            let matchedCount = 0;

            for (const item of dataArray) {
                if (!item.MetaData || !Array.isArray(item.MetaData)) continue;

                const codeMeta = item.MetaData.find(m => m.Codigo && m.Codigo.toString().startsWith('35016') && m.Codigo.toString().length === 10);
                if (!codeMeta) continue;

                const sectionCode = codeMeta.Codigo;

                // Validate against DB
                if (!dbCodes.has(sectionCode)) continue;

                if (!item.Data || !Array.isArray(item.Data)) continue;

                // Get Category Name/Type
                // Usually in T3_Variable or just the Item "Nombre"
                const variableMeta = item.MetaData.find(m => m.T3_Variable !== 'Distritos' && m.T3_Variable !== 'Secciones' && m.T3_Variable !== 'Municipios' && m.T3_Variable !== 'Tipo de dato' && m.T3_Variable !== 'Periodo');
                const catName = variableMeta ? variableMeta.Nombre : item.Nombre;

                // Get latest value
                let relevantData = item.Data.sort((a, b) => (b.Anyo || 0) - (a.Anyo || 0));
                const latest = relevantData[0];

                if (latest) {
                    if (!metricsMap.has(sectionCode)) {
                        metricsMap.set(sectionCode, { totalAccumulated: 0, byCategory: {} });
                        matchedCount++;
                    }
                    const entry = metricsMap.get(sectionCode);

                    entry.byCategory[catName] = latest.Valor;
                    entry.totalAccumulated += latest.Valor;
                }
            }
            console.log(`   -> Matched ${matchedCount} sections (with data).`);
            return metricsMap;
        };

        // -------------------------------------------------------------
        // 4. LOAD & PROCESS
        // -------------------------------------------------------------

        const incomeMap = readIneFile(FILES.RENT, 'INCOME');
        const elderlyMap = readIneFile(FILES.ELDERLY, 'ELDERLY');
        const totalPopMap = readIneFile(FILES.TOTAL_POP, 'TOTAL');
        const occupationMap = readIneFile(FILES.OCCUPATION, 'BUSY');

        // Unemployment File is "Relacion con actividad" -> "Parados", "Ocupados", "Inactivos"
        const unemploymentMap = readIneFile(FILES.UNEMPLOYMENT, 'RELATION');
        const educationMap = readIneFile(FILES.EDUCATION, 'EDUCATION');

        // -------------------------------------------------------------
        // 5. UPDATE DB
        // -------------------------------------------------------------
        console.log('💾 Updating Database...');
        const updates = [];

        for (const code of dbCodes) {
            // INCOME
            let income = null;
            if (incomeMap && incomeMap.has(code)) {
                const d = incomeMap.get(code).byCategory;
                // Income usually doesn't have Sex split, or if it does, check for Total.
                // Keys: "Renta...". 
                // We take the first one that matches "unidad de consumo". 
                const keyUnit = Object.keys(d).find(k => k.includes('unidad de consumo'));
                income = keyUnit ? d[keyUnit] : Object.values(d)[0];
            }

            // ELDERLY
            let elderlyCount = 0;
            let totalPopFromElderlyFile = 0;
            if (elderlyMap && elderlyMap.has(code)) {
                const cats = elderlyMap.get(code).byCategory;
                // Filter for ". Total." or "Ambos sexos" if applicable.
                // If file has ". Total." in name, use only those.
                const totalKeys = Object.keys(cats).filter(k => k.includes('. Total.') || k.includes('Ambos sexos') || (!k.includes('Hombres') && !k.includes('Mujeres') && !k.includes('Total')));

                // If we have "Total" keys, sum those. If no distinction, sum all.
                const keysToUse = totalKeys.length > 0 ? totalKeys : Object.keys(cats);

                keysToUse.forEach(k => {
                    elderlyCount += cats[k];
                });
            }

            // TOTAL POP (Main Denominator)
            let total = 1;
            if (totalPopMap && totalPopMap.has(code)) {
                const cats = totalPopMap.get(code).byCategory;
                // Look for "Total" key
                const keyTotal = Object.keys(cats).find(k => k.includes('. Total.') && k.includes('Total'));
                if (keyTotal) {
                    total = cats[keyTotal];
                } else {
                    // Fallback: Sum "Total" breakdown keys
                    const validKeys = Object.keys(cats).filter(k => k.includes('. Total.') || (!k.includes('Hombres') && !k.includes('Mujeres') && !k.includes('Total')));
                    let sum = 0;
                    validKeys.forEach(k => sum += cats[k]);
                    if (sum > 0) total = sum;
                }
            }
            if (total === 0) total = 1;

            const prop_elderly = elderlyCount / total;

            // WORKING CLASS (Redefined: Split by Sectors)
            let occ_services = 0;
            let occ_construction = 0;
            let occ_industry = 0;
            let occ_agriculture = 0;

            let workingClassScore = 0;

            if (occupationMap && occupationMap.has(code)) {
                const cats = occupationMap.get(code).byCategory;

                const validKeys = Object.keys(cats).filter(k => k.includes('. Total.') || (!k.includes('Hombres') && !k.includes('Mujeres')));

                // Total Occupied
                const keyTotalCNAE = validKeys.find(k => k.includes('Total CNAE'));
                let totalOccupied = keyTotalCNAE ? cats[keyTotalCNAE] : 0;
                if (total > 0) workingClassScore = totalOccupied / total;

                // Sectors
                let val_serv = 0;
                let val_cons = 0;
                let val_ind = 0;
                let val_agr = 0;

                validKeys.forEach(k => {
                    const v = cats[k];
                    const kl = k.toLowerCase();
                    // Exclude totals from sector sums if they are mixed
                    if (kl.includes('total')) return;

                    if (kl.includes('agricultura')) val_agr += v;
                    else if (kl.includes('construcción')) val_cons += v;
                    else if (kl.includes('industria')) val_ind += v;
                    else if (kl.includes('comercio') || kl.includes('hostelería') || kl.includes('servicios') || kl.includes('actividades')) val_serv += v;
                });

                if (total > 0) {
                    occ_services = val_serv / total;
                    occ_construction = val_cons / total;
                    occ_industry = val_ind / total;
                    occ_agriculture = val_agr / total;
                }
            }

            // UNEMPLOYMENT TRAP
            let unemploymentRate = 0;
            if (unemploymentMap && unemploymentMap.has(code)) {
                const cats = unemploymentMap.get(code).byCategory;
                const validKeys = Object.keys(cats).filter(k => k.includes('. Total.') || (!k.includes('Hombres') && !k.includes('Mujeres') && !k.includes('Total')));

                const paradosKey = validKeys.find(k => k.includes('Parados'));
                const ocupadosKey = validKeys.find(k => k.includes('Ocupados'));

                const parados = paradosKey ? cats[paradosKey] : 0;
                const ocupados = ocupadosKey ? cats[ocupadosKey] : 0;
                const activos = parados + ocupados;

                if (activos > 0) unemploymentRate = parados / activos;
            }

            // EDUCATION GAP
            let lowEducationProp = 0;
            if (educationMap && educationMap.has(code)) {
                const cats = educationMap.get(code).byCategory;
                const validKeys = Object.keys(cats).filter(k => k.includes('. Total.') || (!k.includes('Hombres') && !k.includes('Mujeres') && !k.includes('Total')));

                const totalEduKey = validKeys.find(k => k.toLowerCase().includes('total'));
                let totalEdu = 0;
                let low = 0;

                if (totalEduKey) {
                    totalEdu = cats[totalEduKey];
                } else {
                    validKeys.forEach(k => { if (!k.toLowerCase().includes('total')) totalEdu += cats[k]; });
                }

                validKeys.forEach(k => {
                    const v = cats[k];
                    const kl = k.toLowerCase();
                    if (kl.includes('analfabet') || kl.includes('sin estudio') || kl.includes('primari') || kl.includes('inferior')) {
                        low += v;
                    }
                });

                if (totalEdu > 0) lowEducationProp = low / totalEdu;
            }

            updates.push(db.none(`
            UPDATE section_metrics 
            SET income_median = $2, 
                prop_elderly = $3,
                indicator_working_class = $4,
                indicator_unemployment_trap = $5,
                indicator_education_gap = $6,
                indicator_elderly_desert = $3,
                occ_services = $7,
                occ_construction = $8,
                occ_industry = $9,
                occ_agriculture = $10
            WHERE section_code = $1
        `, [code, income, prop_elderly, workingClassScore, unemploymentRate, lowEducationProp,
                occ_services, occ_construction, occ_industry, occ_agriculture]));
            // Note: indicator_elderly_desert is temporarily just prop_elderly. 
            // We will combine with Coverage in SQL or MapView style.
            // Actually, let's keep it consistent. MapView expects [0-1].
        }

        await db.tx(t => t.batch(updates));
        console.log('✅ Import Completed Successfully.');

    } catch (error) {
        console.error('❌ FATAL ERROR:', error);
    } finally {
        db.$pool.end();
    }
}

main();
