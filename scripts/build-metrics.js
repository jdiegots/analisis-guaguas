// Build metrics: calculate all metrics for census sections
const { db } = require('./db-config');

// Reference date for calculations (typical Tuesday)
const REFERENCE_DATE = '20250107'; // 2025-01-07 (Tuesday)

// Time slot definitions (HH:MM format)
const TIME_SLOTS = {
  morning: { start: '06:00:00', end: '10:00:00', name: 'Mañana (06:00-10:00)' },
  midday: { start: '12:00:00', end: '16:00:00', name: 'Mediodía (12:00-16:00)' },
  afternoon: { start: '16:00:00', end: '20:00:00', name: 'Tarde (16:00-20:00)' },
  night: { start: '20:00:00', end: '24:00:00', name: 'Noche (20:00-24:00)' }
};

async function getActiveServices() {
  console.log(`\n📅 Finding active services for reference date: ${REFERENCE_DATE}`);

  // Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  const refDate = new Date(
    parseInt(REFERENCE_DATE.substr(0, 4)),
    parseInt(REFERENCE_DATE.substr(4, 2)) - 1,
    parseInt(REFERENCE_DATE.substr(6, 2))
  );
  const dayOfWeek = refDate.getDay();
  const dayNames = ['sunday', 'saturday', 'friday', 'thursday', 'wednesday', 'tuesday', 'monday'];
  const dayColumn = dayNames[dayOfWeek];

  console.log(`  Day of week: ${dayColumn}`);

  // Get services active on this day from calendar
  const services = await db.manyOrNone(`
    SELECT service_id
    FROM calendar
    WHERE ${dayColumn} = 1
      AND start_date <= $1
      AND end_date >= $1
  `, [REFERENCE_DATE]);

  // Check for exceptions in calendar_dates
  const exceptions = await db.manyOrNone(`
    SELECT service_id, exception_type
    FROM calendar_dates
    WHERE date = $1
  `, [REFERENCE_DATE]);

  const activeServices = new Set(services.map(s => s.service_id));

  // Apply exceptions: exception_type 1 = service added, 2 = service removed
  exceptions.forEach(ex => {
    if (ex.exception_type === 1) {
      activeServices.add(ex.service_id);
    } else if (ex.exception_type === 2) {
      activeServices.delete(ex.service_id);
    }
  });

  console.log(`  ✅ Found ${activeServices.size} active services`);

  return Array.from(activeServices);
}

async function calculateBasicMetrics() {
  console.log('\n📊 Calculating basic metrics...');

  // Initialize section_metrics table
  await db.none('TRUNCATE TABLE section_metrics CASCADE');
  await db.none(`
    INSERT INTO section_metrics (section_code, reference_date)
    SELECT section_code, $1
    FROM census_sections
  `, [REFERENCE_DATE]);

  console.log('  ✅ Initialized section_metrics table');

  // 1. Stops count per section
  console.log('  🚏 Calculating stops_count...');
  await db.none(`
    UPDATE section_metrics sm
    SET stops_count = subq.count
    FROM (
      SELECT cs.section_code, COUNT(s.stop_id)::int as count
      FROM census_sections cs
      LEFT JOIN stops s ON ST_Within(s.geom, cs.geom)
      GROUP BY cs.section_code
    ) subq
    WHERE sm.section_code = subq.section_code
  `);

  // 2. Stops per km²
  console.log('  📏 Calculating stops_per_km2...');
  await db.none(`
    UPDATE section_metrics sm
    SET stops_per_km2 = CASE
      WHEN cs.area_km2 > 0 THEN sm.stops_count / cs.area_km2
      ELSE 0
    END
    FROM census_sections cs
    WHERE sm.section_code = cs.section_code
  `);

  // 3. Nearest stop distance
  console.log('  🎯 Calculating nearest_stop_meters...');
  await db.none(`
    UPDATE section_metrics sm
    SET
      nearest_stop_meters = subq.distance,
      nearest_stop_id = subq.stop_id,
      nearest_stop_name = subq.stop_name
    FROM (
      SELECT DISTINCT ON (cs.section_code)
        cs.section_code,
        s.stop_id,
        s.stop_name,
        ST_Distance(
          ST_Transform(ST_Centroid(cs.geom), 3857),
          ST_Transform(s.geom, 3857)
        ) as distance
      FROM census_sections cs
      CROSS JOIN stops s
      ORDER BY cs.section_code, ST_Distance(
        ST_Transform(ST_Centroid(cs.geom), 3857),
        ST_Transform(s.geom, 3857)
      )
    ) subq
    WHERE sm.section_code = subq.section_code
  `);

  console.log('  ✅ Basic metrics calculated');
}

async function calculateCoverage() {
  console.log('\n🗺️  Calculating coverage metrics...');

  // Coverage 300m
  console.log('  📍 Calculating coverage_300_area_pct...');
  await db.none(`
    UPDATE section_metrics sm
    SET coverage_300_area_pct = subq.coverage_pct
    FROM (
      SELECT
        cs.section_code,
        CASE
          WHEN cs.area_km2 > 0 THEN
            (ST_Area(
              ST_Intersection(
                cs.geom,
                ST_Union(ST_Buffer(s.geom::geography, 300)::geometry)
              )
            ) / ST_Area(cs.geom)) * 100
          ELSE 0
        END as coverage_pct
      FROM census_sections cs
      LEFT JOIN stops s ON ST_DWithin(s.geom::geography, cs.geom::geography, 300)
      GROUP BY cs.section_code, cs.geom, cs.area_km2
    ) subq
    WHERE sm.section_code = subq.section_code
  `);

  // Coverage 500m
  console.log('  📍 Calculating coverage_500_area_pct...');
  await db.none(`
    UPDATE section_metrics sm
    SET coverage_500_area_pct = subq.coverage_pct
    FROM (
      SELECT
        cs.section_code,
        CASE
          WHEN cs.area_km2 > 0 THEN
            (ST_Area(
              ST_Intersection(
                cs.geom,
                ST_Union(ST_Buffer(s.geom::geography, 500)::geometry)
              )
            ) / ST_Area(cs.geom)) * 100
          ELSE 0
        END as coverage_pct
      FROM census_sections cs
      LEFT JOIN stops s ON ST_DWithin(s.geom::geography, cs.geom::geography, 500)
      GROUP BY cs.section_code, cs.geom, cs.area_km2
    ) subq
    WHERE sm.section_code = subq.section_code
  `);

  console.log('  ✅ Coverage metrics calculated');
}

async function calculateServiceMetrics(activeServices) {
  console.log('\n🚌 Calculating service metrics...');

  const serviceList = activeServices.map(s => `'${s}'`).join(',');

  if (activeServices.length === 0) {
    console.log('  ⚠️  No active services found, skipping service metrics');
    return;
  }

  // All day metrics
  console.log('  🕐 Calculating all-day service metrics...');
  await db.none(`
    UPDATE section_metrics sm
    SET
      stop_time_events_all_day = COALESCE(subq.events, 0),
      unique_routes_all_day = COALESCE(subq.routes, 0)
    FROM (
      SELECT
        cs.section_code,
        COUNT(st.trip_id)::int as events,
        COUNT(DISTINCT t.route_id)::int as routes
      FROM census_sections cs
      LEFT JOIN stops s ON ST_Within(s.geom, cs.geom)
      LEFT JOIN stop_times st ON s.stop_id = st.stop_id
      LEFT JOIN trips t ON st.trip_id = t.trip_id
      WHERE t.service_id IN (${serviceList})
      GROUP BY cs.section_code
    ) subq
    WHERE sm.section_code = subq.section_code
  `);

  // Time slot metrics
  for (const [slot, times] of Object.entries(TIME_SLOTS)) {
    console.log(`  🕐 Calculating ${times.name}...`);

    await db.none(`
      UPDATE section_metrics sm
      SET
        stop_time_events_${slot} = COALESCE(subq.events, 0),
        unique_routes_${slot} = COALESCE(subq.routes, 0)
      FROM (
        SELECT
          cs.section_code,
          COUNT(st.trip_id)::int as events,
          COUNT(DISTINCT t.route_id)::int as routes
        FROM census_sections cs
        LEFT JOIN stops s ON ST_Within(s.geom, cs.geom)
        LEFT JOIN stop_times st ON s.stop_id = st.stop_id
        LEFT JOIN trips t ON st.trip_id = t.trip_id
        WHERE t.service_id IN (${serviceList})
          AND st.arrival_time >= '${times.start}'
          AND st.arrival_time < '${times.end}'
        GROUP BY cs.section_code
      ) subq
      WHERE sm.section_code = subq.section_code
    `);
  }

  console.log('  ✅ Service metrics calculated');
}

async function calculateTopRoutes(activeServices) {
  console.log('\n🏆 Calculating top routes per section...');

  const serviceList = activeServices.map(s => `'${s}'`).join(',');

  if (activeServices.length === 0) {
    console.log('  ⚠️  No active services found, skipping top routes');
    return;
  }

  await db.none('TRUNCATE TABLE section_top_routes');

  // All day
  console.log('  📊 All day top routes...');
  await db.none(`
    INSERT INTO section_top_routes (section_code, time_slot, route_id, route_short_name, route_long_name, stop_time_events, rank)
    SELECT
      section_code,
      'all_day' as time_slot,
      route_id,
      route_short_name,
      route_long_name,
      events,
      rank
    FROM (
      SELECT
        cs.section_code,
        r.route_id,
        r.route_short_name,
        r.route_long_name,
        COUNT(st.trip_id)::int as events,
        ROW_NUMBER() OVER (PARTITION BY cs.section_code ORDER BY COUNT(st.trip_id) DESC) as rank
      FROM census_sections cs
      LEFT JOIN stops s ON ST_Within(s.geom, cs.geom)
      LEFT JOIN stop_times st ON s.stop_id = st.stop_id
      LEFT JOIN trips t ON st.trip_id = t.trip_id
      LEFT JOIN routes r ON t.route_id = r.route_id
      WHERE t.service_id IN (${serviceList})
      GROUP BY cs.section_code, r.route_id, r.route_short_name, r.route_long_name
    ) ranked
    WHERE rank <= 10
  `);

  // Time slots
  for (const [slot, times] of Object.entries(TIME_SLOTS)) {
    console.log(`  📊 ${times.name} top routes...`);

    await db.none(`
      INSERT INTO section_top_routes (section_code, time_slot, route_id, route_short_name, route_long_name, stop_time_events, rank)
      SELECT
        section_code,
        '${slot}' as time_slot,
        route_id,
        route_short_name,
        route_long_name,
        events,
        rank
      FROM (
        SELECT
          cs.section_code,
          r.route_id,
          r.route_short_name,
          r.route_long_name,
          COUNT(st.trip_id)::int as events,
          ROW_NUMBER() OVER (PARTITION BY cs.section_code ORDER BY COUNT(st.trip_id) DESC) as rank
        FROM census_sections cs
        LEFT JOIN stops s ON ST_Within(s.geom, cs.geom)
        LEFT JOIN stop_times st ON s.stop_id = st.stop_id
        LEFT JOIN trips t ON st.trip_id = t.trip_id
        LEFT JOIN routes r ON t.route_id = r.route_id
        WHERE t.service_id IN (${serviceList})
          AND st.arrival_time >= '${times.start}'
          AND st.arrival_time < '${times.end}'
        GROUP BY cs.section_code, r.route_id, r.route_short_name, r.route_long_name
      ) ranked
      WHERE rank <= 10
    `);
  }

  const topRoutesCount = await db.one('SELECT COUNT(*) as count FROM section_top_routes');
  console.log(`  ✅ Calculated ${topRoutesCount.count} top route entries`);
}

async function showSummary() {
  console.log('\n📈 Metrics Summary:');

  const summary = await db.one(`
    SELECT
      COUNT(*) as sections,
      ROUND(AVG(stops_count)::numeric, 1) as avg_stops,
      ROUND(AVG(stops_per_km2)::numeric, 2) as avg_stops_per_km2,
      ROUND(AVG(nearest_stop_meters)::numeric, 0) as avg_nearest_stop_m,
      ROUND(AVG(coverage_300_area_pct)::numeric, 1) as avg_coverage_300,
      ROUND(AVG(coverage_500_area_pct)::numeric, 1) as avg_coverage_500,
      ROUND(AVG(stop_time_events_all_day)::numeric, 0) as avg_events_day
    FROM section_metrics
  `);

  console.log(`  Total sections: ${summary.sections}`);
  console.log(`  Avg stops per section: ${summary.avg_stops}`);
  console.log(`  Avg stops per km²: ${summary.avg_stops_per_km2}`);
  console.log(`  Avg distance to nearest stop: ${summary.avg_nearest_stop_m}m`);
  console.log(`  Avg coverage 300m: ${summary.avg_coverage_300}%`);
  console.log(`  Avg coverage 500m: ${summary.avg_coverage_500}%`);
  console.log(`  Avg stop events per day: ${summary.avg_events_day}`);

  // Find sections with best/worst service
  const best = await db.one(`
    SELECT section_code, stop_time_events_all_day
    FROM section_metrics
    ORDER BY stop_time_events_all_day DESC
    LIMIT 1
  `);

  const worst = await db.one(`
    SELECT section_code, stop_time_events_all_day
    FROM section_metrics
    WHERE stops_count > 0
    ORDER BY stop_time_events_all_day ASC
    LIMIT 1
  `);

  console.log(`\n  🥇 Best served section: ${best.section_code} (${best.stop_time_events_all_day} events/day)`);
  console.log(`  🥉 Worst served section: ${worst.section_code} (${worst.stop_time_events_all_day} events/day)`);
}

async function buildMetrics() {
  try {
    console.log('🔨 Building metrics for census sections...');

    // Check if we have data
    const sectionsCount = await db.one('SELECT COUNT(*) as count FROM census_sections');
    const stopsCount = await db.one('SELECT COUNT(*) as count FROM stops');

    if (sectionsCount.count === 0) {
      console.error('❌ No census sections found. Run: npm run import:sections');
      process.exit(1);
    }

    if (stopsCount.count === 0) {
      console.error('❌ No stops found. Run: npm run import:gtfs');
      process.exit(1);
    }

    console.log(`  ℹ️  Census sections: ${sectionsCount.count}`);
    console.log(`  ℹ️  Stops: ${stopsCount.count}`);

    // Get active services
    const activeServices = await getActiveServices();

    // Calculate metrics
    await calculateBasicMetrics();
    await calculateCoverage();
    await calculateServiceMetrics(activeServices);
    await calculateTopRoutes(activeServices);

    // Show summary
    await showSummary();

    console.log('\n✅ Metrics build completed successfully!');

  } catch (error) {
    console.error('❌ Error building metrics:', error);
    process.exit(1);
  } finally {
    await db.$pool.end();
  }
}

buildMetrics();
