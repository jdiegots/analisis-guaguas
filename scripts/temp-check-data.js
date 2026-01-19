const { db } = require('./db-config');

async function checkData() {
    try {
        const withData = await db.manyOrNone('SELECT section_code, unemployment_rate, income_median FROM census_sections WHERE unemployment_rate IS NOT NULL LIMIT 5');
        console.log('With Data:', withData);

        const nullCount = await db.one('SELECT COUNT(*) FROM census_sections WHERE unemployment_rate IS NULL');
        console.log('Null count:', nullCount.count);
    } catch (err) {
        console.error(err);
    } finally {
        db.$pool.end();
    }
}

checkData();
