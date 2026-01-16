// Database configuration
require('dotenv').config();
const pgPromise = require('pg-promise');

const pgp = pgPromise({
  // Initialization options
});

const db = pgp(process.env.DATABASE_URL);

module.exports = { db, pgp };
