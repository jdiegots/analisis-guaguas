// Import GTFS files into PostgreSQL
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { db, pgp } = require('./db-config');

const GTFS_DIR = path.join(__dirname, '..', 'gtfs', 'extracted');

// GTFS file definitions with their columns
const GTFS_FILES = {
  agency: ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang', 'agency_phone'],
  routes: ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_desc', 'route_type', 'route_url', 'route_color', 'route_text_color'],
  calendar: ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
  calendar_dates: ['service_id', 'date', 'exception_type'],
  stops: ['stop_id', 'stop_code', 'stop_name', 'stop_desc', 'stop_lat', 'stop_lon', 'zone_id', 'stop_url', 'location_type', 'parent_station', 'stop_timezone', 'wheelchair_boarding'],
  trips: ['trip_id', 'route_id', 'service_id', 'trip_headsign', 'trip_short_name', 'direction_id', 'block_id', 'shape_id', 'wheelchair_accessible', 'bikes_allowed'],
  stop_times: ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence', 'stop_headsign', 'pickup_type', 'drop_off_type', 'shape_dist_traveled', 'timepoint'],
  shapes: ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence', 'shape_dist_traveled']
};

async function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relaxColumnCount: true
  });
  return records;
}

async function importTable(tableName, columns) {
  const filePath = path.join(GTFS_DIR, `${tableName}.csv`);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${tableName}.csv, skipping...`);
    return 0;
  }

  console.log(`\n📥 Importing ${tableName}...`);

  const records = await readCSV(filePath);

  if (records.length === 0) {
    console.log(`  ℹ️  No records found in ${tableName}.csv`);
    return 0;
  }

  // Truncate table first
  await db.none(`TRUNCATE TABLE ${tableName} CASCADE`);

  // Build column set for pg-promise
  const cs = new pgp.helpers.ColumnSet(columns, { table: tableName });

  // Prepare records (ensure all columns exist, fill with null if missing)
  const preparedRecords = records.map(record => {
    const prepared = {};
    columns.forEach(col => {
      const value = record[col];
      // Convert empty strings to null
      prepared[col] = value === '' || value === undefined ? null : value;
    });
    return prepared;
  });

  // Batch insert
  const query = pgp.helpers.insert(preparedRecords, cs);
  await db.none(query);

  console.log(`  ✅ Imported ${records.length} records into ${tableName}`);
  return records.length;
}

async function importGTFS() {
  try {
    console.log('🚌 Starting GTFS import...');
    console.log(`📂 GTFS directory: ${GTFS_DIR}`);

    let totalRecords = 0;

    // Import in order (respecting foreign keys)
    const importOrder = ['agency', 'routes', 'calendar', 'calendar_dates', 'stops', 'shapes', 'trips', 'stop_times'];

    for (const tableName of importOrder) {
      const count = await importTable(tableName, GTFS_FILES[tableName]);
      totalRecords += count;
    }

    // Check if PostGIS is available
    const postgisCheck = await db.oneOrNone(`
      SELECT installed_version
      FROM pg_available_extensions
      WHERE name = 'postgis'
    `);

    if (postgisCheck) {
      console.log('\n🔧 Building geometries...');

      // Update stops geometry from lat/lon
      console.log('  📍 Creating POINT geometries for stops...');
      await db.none(`SELECT update_stops_geometry()`);
      const stopsCount = await db.one('SELECT COUNT(*) as count FROM stops WHERE geom IS NOT NULL');
      console.log(`  ✅ Created geometries for ${stopsCount.count} stops`);

      // Build shape geometries (LINESTRING)
      console.log('  🛣️  Creating LINESTRING geometries for shapes...');
      await db.none(`SELECT build_shape_geometries()`);
      const shapesCount = await db.one('SELECT COUNT(*) as count FROM shape_geometries');
      console.log(`  ✅ Created ${shapesCount.count} shape geometries`);
    } else {
      console.log('\n⚠️  PostGIS not available - skipping geometry creation');
      console.log('   Install PostGIS and re-run import to enable spatial features');
    }

    console.log('\n✅ GTFS import completed successfully!');
    console.log(`📊 Total records imported: ${totalRecords}`);

    // Show summary
    console.log('\n📈 Import Summary:');
    const summary = await db.multi(`
      SELECT 'routes' as table_name, COUNT(*)::int as count FROM routes
      UNION ALL
      SELECT 'stops', COUNT(*)::int FROM stops
      UNION ALL
      SELECT 'trips', COUNT(*)::int FROM trips
      UNION ALL
      SELECT 'stop_times', COUNT(*)::int FROM stop_times
      UNION ALL
      SELECT 'shapes', COUNT(*)::int FROM shapes
      UNION ALL
      SELECT 'calendar', COUNT(*)::int FROM calendar
      UNION ALL
      SELECT 'calendar_dates', COUNT(*)::int FROM calendar_dates
    `);

    summary.forEach(batch => {
      batch.forEach(row => {
        console.log(`  ${row.table_name.padEnd(15)}: ${row.count.toLocaleString()}`);
      });
    });

  } catch (error) {
    console.error('❌ Error importing GTFS:', error);
    process.exit(1);
  } finally {
    await db.$pool.end();
  }
}

importGTFS();
