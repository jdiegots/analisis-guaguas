// Database connection for Next.js API routes
import pgPromise from 'pg-promise';

const pgp = pgPromise({});

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/dbname';

// Neon requires SSL, local DB usually doesn't (unless specifically configured)
// If DATABASE_URL is set (even locally), we might want to check if it's a neon URL or similar, but simplify for now:
// If on Vercel (NODE_ENV=production), FORCE SSL.
const db = pgp({
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    max: 10 // Limit pool size to prevent connection exhaustion
});

export { db, pgp };
