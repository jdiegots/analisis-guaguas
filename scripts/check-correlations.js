const { db } = require('./db-config');

async function checkCorrelations() {
    try {
        console.log('📊 Analyzing correlations betwen Socio-economic status and Service Quality...\n');

        // 1. Unemployment vs Service Frequency
        console.log('--- 1. Unemployment vs Frequency (Morning) ---');
        const unemployment = await db.any(`
      WITH Quintiles AS (
        SELECT 
          section_code,
          indicator_unemployment_trap as unemp_rate,
          ntile(5) OVER (ORDER BY indicator_unemployment_trap) as quintile,
          stop_time_events_morning
        FROM section_metrics
        WHERE indicator_unemployment_trap IS NOT NULL
      )
      SELECT 
        quintile,
        ROUND(AVG(unemp_rate)::numeric, 4) as avg_unemployment,
        ROUND(AVG(stop_time_events_morning)::numeric, 0) as avg_morning_events
      FROM Quintiles
      GROUP BY quintile
      ORDER BY quintile;
    `);
        console.table(unemployment);

        // 2. Income vs Coverage
        console.log('\n--- 2. Income vs Coverage (300m) ---');
        const income = await db.any(`
      WITH Quintiles AS (
        SELECT 
          section_code,
          income_median,
          ntile(5) OVER (ORDER BY income_median) as quintile,
          coverage_300_area_pct
        FROM section_metrics
        WHERE income_median IS NOT NULL
      )
      SELECT 
        quintile,
        ROUND(AVG(income_median)::numeric, 0) as avg_income,
        ROUND(AVG(coverage_300_area_pct)::numeric, 1) as avg_coverage
      FROM Quintiles
      GROUP BY quintile
      ORDER BY quintile;
    `);
        console.table(income);

        // 3. Vulnerability vs Access (The "Trap")
        // High Unemployment (>25%) AND Poor Service (< average)
        console.log('\n--- 3. The "Unemployment Trap" Scale ---');
        const avgEvents = await db.one('SELECT AVG(stop_time_events_morning) FROM section_metrics');

        // Using indicator_unemployment_trap as the raw rate (temporary mapping)
        const trapStats = await db.one(`
      SELECT 
        COUNT(*) as total_high_unemployment_sections,
        COUNT(*) FILTER (WHERE sm.stop_time_events_morning < $1) as poorly_served_high_unemployment
      FROM section_metrics sm
      WHERE sm.indicator_unemployment_trap > 0.25
    `, [avgEvents.avg]);

        console.log(`High Unemployment Sections (>25%): ${trapStats.total_high_unemployment_sections}`);
        console.log(`...with below-average service: ${trapStats.poorly_served_high_unemployment}`);
        console.log(`pct_trapped: ${Math.round(trapStats.poorly_served_high_unemployment / trapStats.total_high_unemployment_sections * 100)}%`);

    } catch (err) {
        console.error(err);
    } finally {
        db.$pool.end();
    }
}

checkCorrelations();
