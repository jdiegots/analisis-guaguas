// Database connection for Next.js API routes
import pgPromise from 'pg-promise';

const pgp = pgPromise({});

const db = pgp(process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/dbname');

export { db, pgp };
