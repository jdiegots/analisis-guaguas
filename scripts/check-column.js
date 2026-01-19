const { db } = require('./db-config');

async function checkColumn() {
    try {
        const result = await db.oneOrNone("SELECT column_name FROM information_schema.columns WHERE table_name = 'section_metrics' AND column_name = 'total_population'");
        console.log('Column exists:', !!result);
    } catch (err) {
        console.error(err);
    } finally {
        db.$pool.end();
    }
}

checkColumn();
