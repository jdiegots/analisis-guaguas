require('dotenv').config();
const { db } = require('./db-config');

async function main() {
  console.log('🎯 Building political indicators...\n');

  try {
    // Add political indicator columns to section_metrics
    console.log('Adding political indicator columns...');
    await db.none(`
      ALTER TABLE section_metrics
      ADD COLUMN IF NOT EXISTS indicator_elderly_desert DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS indicator_unemployment_trap DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS indicator_education_gap DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS indicator_working_class DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS income_median DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS prop_elderly DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS occ_services DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS occ_construction DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS occ_industry DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS occ_agriculture DOUBLE PRECISION
    `);
    console.log('✓ Columns added\n');

    // Calculate normalization stats (for z-scores)
    const statsRaw = await db.one(`
      SELECT
        AVG(cs.prop_elderly) as avg_elderly,
        STDDEV(cs.prop_elderly) as std_elderly,
        AVG(cs.unemployment_rate) as avg_unemployment,
        STDDEV(cs.unemployment_rate) as std_unemployment,
        AVG(cs.education_low_pct) as avg_low_education,
        STDDEV(cs.education_low_pct) as std_low_education,
        AVG(cs.working_class_pct) as avg_working_class,
        STDDEV(cs.working_class_pct) as std_working_class,
        AVG(sm.coverage_300_area_pct) as avg_coverage,
        STDDEV(sm.coverage_300_area_pct) as std_coverage,
        AVG(sm.stop_time_events_all_day) as avg_frequency,
        STDDEV(sm.stop_time_events_all_day) as std_frequency
      FROM census_sections cs
      LEFT JOIN section_metrics sm ON cs.section_code = sm.section_code
    `);

    // Convert strings to numbers
    const stats = {
      avg_elderly: parseFloat(statsRaw.avg_elderly) || 0,
      std_elderly: parseFloat(statsRaw.std_elderly) || 0.01,
      avg_unemployment: parseFloat(statsRaw.avg_unemployment) || 0,
      std_unemployment: parseFloat(statsRaw.std_unemployment) || 0.01,
      avg_low_education: parseFloat(statsRaw.avg_low_education) || 0,
      std_low_education: parseFloat(statsRaw.std_low_education) || 0.01,
      avg_working_class: parseFloat(statsRaw.avg_working_class) || 0,
      std_working_class: parseFloat(statsRaw.std_working_class) || 0.01,
      avg_coverage: parseFloat(statsRaw.avg_coverage) || 0,
      std_coverage: parseFloat(statsRaw.std_coverage) || 0.01,
      avg_frequency: parseFloat(statsRaw.avg_frequency) || 0,
      std_frequency: parseFloat(statsRaw.std_frequency) || 0.01,
    };

    console.log('📊 Normalization statistics:');
    console.log(`  Avg elderly: ${(stats.avg_elderly * 100).toFixed(1)}% (±${(stats.std_elderly * 100).toFixed(1)}%)`);
    console.log(`  Avg unemployment: ${(stats.avg_unemployment * 100).toFixed(1)}% (±${(stats.std_unemployment * 100).toFixed(1)}%)`);
    console.log(`  Avg low education: ${(stats.avg_low_education * 100).toFixed(1)}% (±${(stats.std_low_education * 100).toFixed(1)}%)`);
    console.log(`  Avg coverage 300m: ${stats.avg_coverage.toFixed(1)}% (±${stats.std_coverage.toFixed(1)}%)`);
    console.log(`  Avg daily frequency: ${stats.avg_frequency.toFixed(0)} (±${stats.std_frequency.toFixed(0)})\n`);

    // Build political indicators using z-scores
    console.log('Calculating political indicators...');

    await db.none(`
      UPDATE section_metrics sm
      SET
        -- Copy demographic data for visualization (valores absolutos)
        prop_elderly = cs.prop_elderly,
        income_median = NULL, -- No tenemos datos de renta por sección
        occ_services = CAST(cs.occ_services AS DOUBLE PRECISION),
        occ_construction = CAST(cs.occ_construction AS DOUBLE PRECISION),
        occ_industry = CAST(cs.occ_industry AS DOUBLE PRECISION),
        occ_agriculture = CAST(cs.occ_agriculture AS DOUBLE PRECISION),

        -- 1. DESIERTO PARA MAYORES
        -- Alta proporción de mayores (z > 0.5) + Baja cobertura 300m (z < -0.5)
        indicator_elderly_desert = GREATEST(0, LEAST(1,
          (
            -- z-score elderly (normalized to 0-1, higher is worse)
            CASE WHEN ${stats.std_elderly} > 0
              THEN ((cs.prop_elderly - ${stats.avg_elderly}) / ${stats.std_elderly} + 3) / 6
              ELSE 0.5
            END
            +
            -- z-score coverage (inverted, normalized to 0-1, lower coverage is worse)
            CASE WHEN ${stats.std_coverage} > 0
              THEN (-(sm.coverage_300_area_pct - ${stats.avg_coverage}) / ${stats.std_coverage} + 3) / 6
              ELSE 0.5
            END
          ) / 2
        )),

        -- 2. TRAMPA DEL PARO
        -- Alto desempleo (z > 0.5) + Baja frecuencia de servicio (z < -0.5)
        indicator_unemployment_trap = GREATEST(0, LEAST(1,
          (
            -- z-score unemployment (normalized to 0-1, higher is worse)
            CASE WHEN ${stats.std_unemployment} > 0
              THEN ((cs.unemployment_rate - ${stats.avg_unemployment}) / ${stats.std_unemployment} + 3) / 6
              ELSE 0.5
            END
            +
            -- z-score frequency (inverted, normalized to 0-1, lower frequency is worse)
            CASE WHEN ${stats.std_frequency} > 0
              THEN (-(sm.stop_time_events_all_day - ${stats.avg_frequency}) / ${stats.std_frequency} + 3) / 6
              ELSE 0.5
            END
          ) / 2
        )),

        -- 3. BRECHA EDUCATIVA
        -- Bajo nivel educativo (z > 0.5) + Baja cobertura (z < -0.5)
        indicator_education_gap = GREATEST(0, LEAST(1,
          (
            -- z-score low education (normalized to 0-1, higher is worse)
            CASE WHEN ${stats.std_low_education} > 0
              THEN ((cs.education_low_pct - ${stats.avg_low_education}) / ${stats.std_low_education} + 3) / 6
              ELSE 0.5
            END
            +
            -- z-score coverage (inverted, normalized to 0-1, lower coverage is worse)
            CASE WHEN ${stats.std_coverage} > 0
              THEN (-(sm.coverage_300_area_pct - ${stats.avg_coverage}) / ${stats.std_coverage} + 3) / 6
              ELSE 0.5
            END
          ) / 2
        )),

        -- 4. CLASE TRABAJADORA (para contexto)
        -- Mayor proporción en agricultura + industria + construcción
        indicator_working_class = CASE
          WHEN (cs.occ_agriculture + cs.occ_industry + cs.occ_construction + cs.occ_services) > 0
          THEN CAST(cs.occ_agriculture + cs.occ_industry + cs.occ_construction AS DOUBLE PRECISION) /
               (cs.occ_agriculture + cs.occ_industry + cs.occ_construction + cs.occ_services)
          ELSE 0
        END

      FROM census_sections cs
      WHERE sm.section_code = cs.section_code
    `);

    console.log('✓ Political indicators calculated\n');

    // Show top 10 worst sections for each indicator
    console.log('🔴 TOP 10 SECCIONES MÁS AFECTADAS:\n');

    console.log('═══ DESIERTO PARA MAYORES (Alta % mayores + Baja cobertura) ═══');
    const elderly = await db.any(`
      SELECT
        sm.section_code,
        cs.name,
        ROUND((cs.prop_elderly * 100)::numeric, 1) as pct_elderly,
        ROUND(sm.coverage_300_area_pct::numeric, 1) as coverage_300,
        ROUND((sm.indicator_elderly_desert * 100)::numeric, 1) as score
      FROM section_metrics sm
      JOIN census_sections cs ON sm.section_code = cs.section_code
      WHERE sm.indicator_elderly_desert IS NOT NULL
      ORDER BY sm.indicator_elderly_desert DESC
      LIMIT 10
    `);
    elderly.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.section_code} | ${row.pct_elderly}% mayores | ${row.coverage_300}% cobertura | Score: ${row.score}`);
    });

    console.log('\n═══ TRAMPA DEL PARO (Alto desempleo + Baja frecuencia) ═══');
    const unemployment = await db.any(`
      SELECT
        sm.section_code,
        cs.name,
        ROUND((cs.unemployment_rate * 100)::numeric, 1) as unemployment,
        sm.stop_time_events_all_day as daily_events,
        ROUND((sm.indicator_unemployment_trap * 100)::numeric, 1) as score
      FROM section_metrics sm
      JOIN census_sections cs ON sm.section_code = cs.section_code
      WHERE sm.indicator_unemployment_trap IS NOT NULL
      ORDER BY sm.indicator_unemployment_trap DESC
      LIMIT 10
    `);
    unemployment.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.section_code} | ${row.unemployment}% paro | ${row.daily_events} eventos/día | Score: ${row.score}`);
    });

    console.log('\n═══ BRECHA EDUCATIVA (Baja educación + Baja cobertura) ═══');
    const education = await db.any(`
      SELECT
        sm.section_code,
        cs.name,
        ROUND((cs.education_low_pct * 100)::numeric, 1) as low_education,
        ROUND(sm.coverage_300_area_pct::numeric, 1) as coverage_300,
        ROUND((sm.indicator_education_gap * 100)::numeric, 1) as score
      FROM section_metrics sm
      JOIN census_sections cs ON sm.section_code = cs.section_code
      WHERE sm.indicator_education_gap IS NOT NULL
      ORDER BY sm.indicator_education_gap DESC
      LIMIT 10
    `);
    education.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.section_code} | ${row.low_education}% educación baja | ${row.coverage_300}% cobertura | Score: ${row.score}`);
    });

    console.log('\n✅ Political indicators complete!');
    console.log('\n💡 Estos indicadores exponen desigualdades en el servicio de transporte público.');

  } catch (error) {
    console.error('Error building political indicators:', error);
    throw error;
  } finally {
    await db.$pool.end();
  }
}

main().catch(console.error);
