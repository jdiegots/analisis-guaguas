require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db } = require('./db-config');

const DATA_DIR = 'C:/Users/jdieg/Downloads/Datos';

async function main() {
  console.log('📊 Importing socioeconomic data by census section...\n');

  try {
    // First, add columns to census_sections if they don't exist
    console.log('Adding socioeconomic columns to census_sections...');
    await db.none(`
      ALTER TABLE census_sections
      ADD COLUMN IF NOT EXISTS population_total INTEGER,
      ADD COLUMN IF NOT EXISTS population_65plus INTEGER,
      ADD COLUMN IF NOT EXISTS prop_elderly DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS population_active INTEGER,
      ADD COLUMN IF NOT EXISTS population_unemployed INTEGER,
      ADD COLUMN IF NOT EXISTS unemployment_rate DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS education_primary INTEGER,
      ADD COLUMN IF NOT EXISTS education_secondary_1 INTEGER,
      ADD COLUMN IF NOT EXISTS education_secondary_2 INTEGER,
      ADD COLUMN IF NOT EXISTS education_higher INTEGER,
      ADD COLUMN IF NOT EXISTS education_low_pct DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS occ_agriculture INTEGER,
      ADD COLUMN IF NOT EXISTS occ_industry INTEGER,
      ADD COLUMN IF NOT EXISTS occ_construction INTEGER,
      ADD COLUMN IF NOT EXISTS occ_services INTEGER,
      ADD COLUMN IF NOT EXISTS working_class_pct DOUBLE PRECISION
    `);
    console.log('✓ Columns added\n');

    // 1. Population Total
    console.log('1/6 Processing Poblacion_total.json...');
    const popTotalData = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'Poblacion_total.json'), 'utf8')
    );

    for (const record of popTotalData) {
      const secMeta = record.MetaData.find(m => m.T3_Variable === 'Secciones');
      if (!secMeta) continue;

      const sectionCode = secMeta.Codigo;
      const totalMeta = record.MetaData.find(m => m.T3_Variable === 'Totales de edad');
      if (!totalMeta || totalMeta.Nombre !== 'Todas las edades') continue;

      const sexoMeta = record.MetaData.find(m => m.T3_Variable === 'Sexo');
      if (!sexoMeta || sexoMeta.Nombre !== 'Total') continue;

      const value = record.Data?.[0]?.Valor;
      if (value == null) continue;

      await db.none(
        `UPDATE census_sections SET population_total = $1 WHERE section_code = $2`,
        [value, sectionCode]
      );
    }
    console.log('✓ Population total imported\n');

    // 2. Population 65+
    console.log('2/6 Processing Poblacion_65_o_mas.json...');
    const pop65Data = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'Poblacion_65_o_mas.json'), 'utf8')
    );

    // Group by section code and sum all age groups 65+
    const pop65BySection = {};

    for (const record of pop65Data) {
      const secMeta = record.MetaData.find(m => m.T3_Variable === 'Secciones');
      if (!secMeta) continue;

      const sectionCode = secMeta.Codigo;
      const sexoMeta = record.MetaData.find(m => m.T3_Variable === 'Sexo');
      if (!sexoMeta || sexoMeta.Nombre !== 'Total') continue;

      const value = record.Data?.[0]?.Valor;
      if (value == null) continue;

      pop65BySection[sectionCode] = (pop65BySection[sectionCode] || 0) + value;
    }

    for (const [sectionCode, total] of Object.entries(pop65BySection)) {
      await db.none(
        `UPDATE census_sections SET population_65plus = $1 WHERE section_code = $2`,
        [total, sectionCode]
      );
    }
    console.log('✓ Population 65+ imported\n');

    // 3. Employment status (active, unemployed)
    console.log('3/6 Processing poblacion_16_mas_anos_por_relacion_con_actividad.json...');
    const employmentData = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'poblacion_16_mas_anos_por_relacion_con_actividad.json'), 'utf8')
    );

    for (const record of employmentData) {
      const secMeta = record.MetaData.find(m => m.T3_Variable === 'Secciones');
      if (!secMeta) continue;

      const sectionCode = secMeta.Codigo;
      const sexoMeta = record.MetaData.find(m => m.T3_Variable === 'Sexo');
      if (!sexoMeta || sexoMeta.Nombre !== 'Total') continue;

      const activityMeta = record.MetaData.find(m => m.T3_Variable === 'Relación con la actividad');
      if (!activityMeta) continue;

      const value = record.Data?.[0]?.Valor;
      if (value == null) continue;

      if (activityMeta.Nombre === 'Ocupado/a') {
        await db.none(
          `UPDATE census_sections SET population_active = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      } else if (activityMeta.Nombre === 'Parado/a') {
        await db.none(
          `UPDATE census_sections SET population_unemployed = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      }
    }
    console.log('✓ Employment status imported\n');

    // 4. Education level
    console.log('4/6 Processing poblacion_15_mas_anos_por_pais_nacimiento_nivel_estudios.json...');
    const educationData = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'poblacion_15_mas_anos_por_pais_nacimiento_nivel_estudios.json'), 'utf8')
    );

    for (const record of educationData) {
      const secMeta = record.MetaData.find(m => m.T3_Variable === 'Secciones');
      if (!secMeta) continue;

      const sectionCode = secMeta.Codigo;
      const sexoMeta = record.MetaData.find(m => m.T3_Variable === 'Sexo');
      if (!sexoMeta || sexoMeta.Nombre !== 'Total') continue;

      const eduMeta = record.MetaData.find(m => m.T3_Variable === 'Nivel de formación alcanzado');
      if (!eduMeta) continue;

      const value = record.Data?.[0]?.Valor;
      if (value == null) continue;

      if (eduMeta.Nombre === 'Educación primaria e inferior') {
        await db.none(
          `UPDATE census_sections SET education_primary = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      } else if (eduMeta.Nombre === 'Primera etapa de Educación Secundaria y similar') {
        await db.none(
          `UPDATE census_sections SET education_secondary_1 = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      } else if (eduMeta.Nombre === 'Segunda etapa de Educación Secundaria y Educación Postsecundaria no Superior') {
        await db.none(
          `UPDATE census_sections SET education_secondary_2 = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      } else if (eduMeta.Nombre === 'Educación superior') {
        await db.none(
          `UPDATE census_sections SET education_higher = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      }
    }
    console.log('✓ Education level imported\n');

    // 5. Occupation sectors
    console.log('5/6 Processing ocupados_16_o_mas_anos_por_rama_de_actividad.json...');
    const occupationData = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'ocupados_16_o_mas_anos_por_rama_de_actividad.json'), 'utf8')
    );

    for (const record of occupationData) {
      const secMeta = record.MetaData.find(m => m.T3_Variable === 'Secciones');
      if (!secMeta) continue;

      const sectionCode = secMeta.Codigo;
      const sexoMeta = record.MetaData.find(m => m.T3_Variable === 'Sexo');
      if (!sexoMeta || sexoMeta.Nombre !== 'Total') continue;

      const activityMeta = record.MetaData.find(m => m.T3_Variable === 'Actividad económica (CNAE-09)');
      if (!activityMeta) continue;

      const value = record.Data?.[0]?.Valor;
      if (value == null) continue;

      if (activityMeta.Nombre === 'Agricultura, ganadería, silvicultura y pesca') {
        await db.none(
          `UPDATE census_sections SET occ_agriculture = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      } else if (activityMeta.Nombre === 'Industria' || activityMeta.Codigo === 'B-E') {
        await db.none(
          `UPDATE census_sections SET occ_industry = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      } else if (activityMeta.Nombre === 'Construcción') {
        await db.none(
          `UPDATE census_sections SET occ_construction = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      } else if (activityMeta.Nombre === 'Servicios' || activityMeta.Codigo === 'G__U') {
        await db.none(
          `UPDATE census_sections SET occ_services = $1 WHERE section_code = $2`,
          [value, sectionCode]
        );
      }
    }
    console.log('✓ Occupation sectors imported\n');

    // 6. Calculate derived percentages
    console.log('6/6 Calculating derived percentages...');
    await db.none(`
      UPDATE census_sections
      SET
        prop_elderly = CASE
          WHEN population_total > 0 THEN CAST(population_65plus AS DOUBLE PRECISION) / population_total
          ELSE 0
        END,
        unemployment_rate = CASE
          WHEN (population_active + population_unemployed) > 0
          THEN CAST(population_unemployed AS DOUBLE PRECISION) / (population_active + population_unemployed)
          ELSE 0
        END,
        education_low_pct = CASE
          WHEN (education_primary + education_secondary_1 + education_secondary_2 + education_higher) > 0
          THEN CAST(education_primary + education_secondary_1 AS DOUBLE PRECISION) /
               (education_primary + education_secondary_1 + education_secondary_2 + education_higher)
          ELSE 0
        END,
        working_class_pct = CASE
          WHEN (occ_agriculture + occ_industry + occ_construction + occ_services) > 0
          THEN CAST(occ_agriculture + occ_industry + occ_construction AS DOUBLE PRECISION) /
               (occ_agriculture + occ_industry + occ_construction + occ_services)
          ELSE 0
        END
    `);
    console.log('✓ Percentages calculated\n');

    // Show summary
    const stats = await db.one(`
      SELECT
        COUNT(*) as total_sections,
        COUNT(population_total) as sections_with_population,
        ROUND(AVG(prop_elderly)::numeric, 3) as avg_prop_elderly,
        ROUND(AVG(unemployment_rate)::numeric, 3) as avg_unemployment,
        ROUND(AVG(education_low_pct)::numeric, 3) as avg_low_education,
        ROUND(AVG(working_class_pct)::numeric, 3) as avg_working_class
      FROM census_sections
    `);

    console.log('📈 Summary Statistics:');
    console.log(`  Total sections: ${stats.total_sections}`);
    console.log(`  Sections with data: ${stats.sections_with_population}`);
    console.log(`  Avg % elderly (65+): ${(stats.avg_prop_elderly * 100).toFixed(1)}%`);
    console.log(`  Avg unemployment rate: ${(stats.avg_unemployment * 100).toFixed(1)}%`);
    console.log(`  Avg % low education: ${(stats.avg_low_education * 100).toFixed(1)}%`);
    console.log(`  Avg % working class: ${(stats.avg_working_class * 100).toFixed(1)}%`);

    console.log('\n✅ Socioeconomic data import complete!');

  } catch (error) {
    console.error('Error importing socioeconomic data:', error);
    throw error;
  } finally {
    await db.$pool.end();
  }
}

main().catch(console.error);
