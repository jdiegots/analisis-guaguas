// Database connection for Next.js API routes
import pgPromise from 'pg-promise';

const pgp = pgPromise({});

const isProduction = process.env.NODE_ENV === 'production';
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.NEON_DATABASE_URL ||
  (isProduction ? undefined : 'postgres://user:pass@localhost:5432/dbname');

if (!connectionString) {
  throw new Error(
    'Missing database connection string. Set DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or NEON_DATABASE_URL.'
  );
}

// Neon requires SSL, local DB usually doesn't (unless specifically configured)
// If DATABASE_URL is set (even locally), we might want to check if it's a neon URL or similar, but simplify for now:
// If on Vercel (NODE_ENV=production), FORCE SSL.
const db = pgp({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 10 // Limit pool size to prevent connection exhaustion
});

export { db, pgp };
