const { db } = require('./db-config');

async function checkSchema() {
    try {
        const cols = await db.any(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'section_metrics'
      ORDER BY column_name
    `);
        console.log(cols.map(c => c.column_name).join('\n'));
    } catch (err) {
        console.error(err);
    } finally {
        db.$pool.end();
    }
}

checkSchema();
