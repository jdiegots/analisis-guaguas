// Setup database: create tables and indexes
const fs = require('fs');
const path = require('path');
const { db } = require('./db-config');

async function setupDatabase() {
  try {
    console.log('📦 Setting up database...');

    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '..', 'database', 'schema.sql'),
      'utf-8'
    );

    await db.none(schemaSQL);

    console.log('✅ Database schema created successfully');
    console.log('✅ PostGIS extension enabled');
    console.log('✅ All tables, indexes, and functions created');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await db.$pool.end();
  }
}

setupDatabase();
