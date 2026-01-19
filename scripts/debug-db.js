require('dotenv').config();
const pgp = require('pg-promise')({});

const db = pgp(process.env.DATABASE_URL);

async function checkData() {
    try {
        console.log('Connecting to:', process.env.DATABASE_URL);
        const count = await db.one('SELECT count(*) FROM section_metrics');
        console.log('Total sections:', count.count);

        const withStops = await db.one("SELECT count(*) FROM section_metrics WHERE stops_count > 0 AND section_code LIKE '35016%'");
        console.log('Sections with stops (Las Palmas):', withStops.count);

        const withServiceValue = await db.one("SELECT count(*) FROM section_metrics WHERE service_value_index > 0");
        console.log('Sections with service_value_index > 0:', withServiceValue.count);

        // Check if total_population column exists and has data
        try {
            const withPop = await db.one("SELECT count(*) FROM section_metrics WHERE total_population > 0");
            console.log('Sections with total_population > 0:', withPop.count);
        } catch (e) {
            console.log('Error checking total_population (maybe column missing):', e.message);
        }

    } catch (error) {
        console.error('Database error:', error);
    } finally {
        pgp.end();
    }
}

checkData();
