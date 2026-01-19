// Database connection for Next.js API routes
import pgPromise from 'pg-promise';

const pgp = pgPromise({});

const db = pgp({
    connectionString: process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/dbname',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export { db, pgp };
