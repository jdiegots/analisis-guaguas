// Calculate service value index and effective pricing metrics
const { db } = require('./db-config');

/**
 * Service Value Index Calculation
 *
 * This creates a normalized 0-1 index measuring the quality/quantity of transit service
 * per census section, combining multiple dimensions:
 * - Service frequency (events per capita OR absolute events if no population data)
 * - Route diversity (routes per capita OR absolute routes if no population data)
 * - Coverage (% area within 300m of stops)
 * - Access distance (inverse of distance to nearest stop)
 */

async function calculateServiceValue() {
  console.log('🔨 Calculating Service Value Indices...');

  try {
    // First, ensure columns exist
    console.log('🔧 Ensuring schema columns exist...');
    await db.none(`
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS total_population INTEGER DEFAULT 0;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS events_per_1000 DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS routes_per_10k DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS service_value_index DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE section_metrics ADD COLUMN IF NOT EXISTS service_percentile DOUBLE PRECISION DEFAULT 0;
    `);

    // Check if we have population data
    console.log('📊 Checking population data...');
    const popCheck = await db.one(`
      SELECT COUNT(*) as with_pop
      FROM section_metrics
      WHERE section_code LIKE '35016%' AND total_population > 0
    `);

    const hasPopulation = popCheck.with_pop > 0;
    console.log(`   Population data available: ${hasPopulation ? 'YES' : 'NO'}`);

    if (!hasPopulation) {
      console.log('   ⚠️  No population data found. Using absolute metrics instead of per-capita.');
      console.log('   💡 Run "node scripts/import-political-indicators.js" to get population data for better analysis.');
    }

    // Calculate metrics (per-capita if available, absolute otherwise)
    console.log('📈 Calculating service metrics...');

    if (hasPopulation) {
      // Events per 1000 population
      await db.none(`
        UPDATE section_metrics
        SET events_per_1000 = CASE
          WHEN total_population > 0 THEN (stop_time_events_all_day::float / total_population) * 1000
          ELSE 0
        END
        WHERE section_code LIKE '35016%'
      `);

      // Routes per 10k population
      await db.none(`
        UPDATE section_metrics
        SET routes_per_10k = CASE
          WHEN total_population > 0 THEN (unique_routes_all_day::float / total_population) * 10000
          ELSE 0
        END
        WHERE section_code LIKE '35016%'
      `);
    } else {
      // Use absolute values as proxy
      await db.none(`
        UPDATE section_metrics
        SET events_per_1000 = stop_time_events_all_day::float,
            routes_per_10k = unique_routes_all_day::float
        WHERE section_code LIKE '35016%'
      `);
    }

    // Calculate percentiles for normalization
    console.log('📊 Calculating percentiles...');

    const stats = await db.one(`
      SELECT
        -- Events (per 1000 or absolute)
        PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY events_per_1000) as events_p10,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY events_per_1000) as events_p50,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY events_per_1000) as events_p90,

        -- Routes (per 10k or absolute)
        PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY routes_per_10k) as routes_p10,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY routes_per_10k) as routes_p50,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY routes_per_10k) as routes_p90,

        -- Coverage 300m
        PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY coverage_300_area_pct) as coverage_p10,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY coverage_300_area_pct) as coverage_p50,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY coverage_300_area_pct) as coverage_p90,

        -- Nearest stop (inverse for quality - closer is better)
        PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY nearest_stop_meters) as distance_p10,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY nearest_stop_meters) as distance_p50,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY nearest_stop_meters) as distance_p90
      FROM section_metrics
      WHERE section_code LIKE '35016%' AND stops_count > 0
    `);

    console.log('   Percentiles calculated (excluding sections without stops):');
    console.log(`     Events P10/P50/P90: ${(stats.events_p10 || 0).toFixed(1)} / ${(stats.events_p50 || 0).toFixed(1)} / ${(stats.events_p90 || 0).toFixed(1)}`);
    console.log(`     Routes P10/P50/P90: ${(stats.routes_p10 || 0).toFixed(2)} / ${(stats.routes_p50 || 0).toFixed(2)} / ${(stats.routes_p90 || 0).toFixed(2)}`);
    console.log(`     Coverage P10/P50/P90: ${(stats.coverage_p10 || 0).toFixed(1)}% / ${(stats.coverage_p50 || 0).toFixed(1)}% / ${(stats.coverage_p90 || 0).toFixed(1)}%`);
    console.log(`     Distance P10/P50/P90: ${(stats.distance_p10 || 0).toFixed(0)}m / ${(stats.distance_p50 || 0).toFixed(0)}m / ${(stats.distance_p90 || 0).toFixed(0)}m`);

    // Avoid division by zero in percentile ranges
    const eventsRange = (stats.events_p90 - stats.events_p10) || 1;
    const routesRange = (stats.routes_p90 - stats.routes_p10) || 1;
    const coverageRange = (stats.coverage_p90 - stats.coverage_p10) || 1;
    const distanceRange = (stats.distance_p90 - stats.distance_p10) || 1;

    // Calculate composite service value index (0-1 scale)
    console.log('🎯 Calculating composite service value index...');

    // First reset all service values to 0 (or NULL if you prefer to exclude them explicitly)
    await db.none("UPDATE section_metrics SET service_value_index = 0, service_percentile = 0 WHERE section_code LIKE '35016%'");

    await db.none(`
      UPDATE section_metrics
      SET service_value_index = (
        -- Normalize each component to 0-1 using percentile ranges
        CASE
          WHEN events_per_1000 <= ${stats.events_p10} THEN 0.0
          WHEN events_per_1000 >= ${stats.events_p90} THEN 1.0
          ELSE (events_per_1000 - ${stats.events_p10}) / ${eventsRange}
        END * 0.35 +  -- 35% weight to frequency

        CASE
          WHEN routes_per_10k <= ${stats.routes_p10} THEN 0.0
          WHEN routes_per_10k >= ${stats.routes_p90} THEN 1.0
          ELSE (routes_per_10k - ${stats.routes_p10}) / ${routesRange}
        END * 0.25 +  -- 25% weight to route diversity

        CASE
          WHEN coverage_300_area_pct <= ${stats.coverage_p10} THEN 0.0
          WHEN coverage_300_area_pct >= ${stats.coverage_p90} THEN 1.0
          ELSE (coverage_300_area_pct - ${stats.coverage_p10}) / ${coverageRange}
        END * 0.25 +  -- 25% weight to coverage

        CASE
          WHEN nearest_stop_meters >= ${stats.distance_p90} THEN 0.0
          WHEN nearest_stop_meters <= ${stats.distance_p10} THEN 1.0
          ELSE 1.0 - ((nearest_stop_meters - ${stats.distance_p10}) / ${distanceRange})
        END * 0.15  -- 15% weight to access distance (inverted)
      )
      WHERE section_code LIKE '35016%' AND stops_count > 0
    `);

    // Calculate percentile ranking for each section
    await db.none(`
      UPDATE section_metrics sm
      SET service_percentile = subq.percentile
      FROM (
        SELECT
          section_code,
          PERCENT_RANK() OVER (ORDER BY service_value_index) * 100 as percentile
        FROM section_metrics
        WHERE section_code LIKE '35016%' AND stops_count > 0
      ) subq
      WHERE sm.section_code = subq.section_code
    `);

    // Show summary statistics
    const summary = await db.one(`
      SELECT
        COUNT(*) as total_sections,
        ROUND(AVG(service_value_index)::numeric, 3) as avg_value,
        ROUND(MIN(service_value_index)::numeric, 3) as min_value,
        ROUND(MAX(service_value_index)::numeric, 3) as max_value,
        ROUND(STDDEV(service_value_index)::numeric, 3) as stddev_value
      FROM section_metrics
      WHERE section_code LIKE '35016%'
    `);

    console.log('\n📈 Service Value Index Summary:');
    console.log(`   Total sections: ${summary.total_sections}`);
    console.log(`   Average value: ${summary.avg_value}`);
    console.log(`   Min value: ${summary.min_value}`);
    console.log(`   Max value: ${summary.max_value}`);
    console.log(`   Std deviation: ${summary.stddev_value}`);

    // Show best and worst sections
    const best = await db.manyOrNone(`
      SELECT section_code,
             ROUND(service_value_index::numeric, 3) as value,
             stop_time_events_all_day as events,
             unique_routes_all_day as routes,
             ROUND(coverage_300_area_pct::numeric, 1) as coverage
      FROM section_metrics
      WHERE section_code LIKE '35016%'
      ORDER BY service_value_index DESC
      LIMIT 5
    `);

    const worst = await db.manyOrNone(`
      SELECT section_code,
             ROUND(service_value_index::numeric, 3) as value,
             stop_time_events_all_day as events,
             unique_routes_all_day as routes,
             ROUND(coverage_300_area_pct::numeric, 1) as coverage
      FROM section_metrics
      WHERE section_code LIKE '35016%'
      ORDER BY service_value_index ASC
      LIMIT 5
    `);

    console.log('\n🥇 Best served sections:');
    best.forEach(s => {
      console.log(`   ${s.section_code}: value=${s.value}, events=${s.events}, routes=${s.routes}, coverage=${s.coverage}%`);
    });

    console.log('\n🥉 Worst served sections:');
    worst.forEach(s => {
      console.log(`   ${s.section_code}: value=${s.value}, events=${s.events}, routes=${s.routes}, coverage=${s.coverage}%`);
    });

    console.log('\n✅ Service value calculation complete!');

    if (!hasPopulation) {
      console.log('\n💡 TIP: For more accurate per-capita analysis, run:');
      console.log('   node scripts/import-political-indicators.js');
      console.log('   npm run build:service-value');
    }

  } catch (error) {
    console.error('❌ Error calculating service value:', error);
    throw error;
  }
}

async function main() {
  try {
    await calculateServiceValue();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await db.$pool.end();
  }
}

main();
