require('dotenv').config();
const pgp = require('pg-promise')({});

const db = pgp(process.env.DATABASE_URL);

async function checkStats() {
    try {
        const stats = await db.one(`
      SELECT 
        MIN(service_value_index) as min_val,
        MAX(service_value_index) as max_val,
        AVG(service_value_index) as avg_val,
        COUNT(*) FILTER (WHERE service_value_index > 0) as count_positive,
        COUNT(*) as total
      FROM section_metrics
      WHERE section_code LIKE '35016%' AND stops_count > 0
    `);

        console.log('Statistics:', stats);
    } catch (error) {
        console.error('Database error:', error);
    } finally {
        pgp.end();
    }
}

checkStats();
