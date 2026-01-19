const { db } = require('./db-config');

async function checkIncome() {
    try {
        const result = await db.any('SELECT section_code, income_median, stops_count FROM section_metrics WHERE income_median > 0 AND stops_count > 0 LIMIT 10');
        console.log('Sample income+stops data:', result);

        const count = await db.one('SELECT COUNT(*) as count FROM section_metrics WHERE income_median > 0 AND stops_count > 0');
        console.log('Count of sections with income > 0 AND stops > 0:', count.count);
    } catch (error) {
        console.error(error);
    } finally {
        db.$pool.end();
    }
}

checkIncome();
