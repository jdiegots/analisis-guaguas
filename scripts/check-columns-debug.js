
const { db } = require('./db-config');
const fs = require('fs');

async function checkColumns() {
  try {
    const cols = await db.any(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'section_metrics';
    `);

    const csCols = await db.any(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'census_sections';
    `);

    fs.writeFileSync('columns_debug.txt',
      'Columns in section_metrics:\n' + cols.map(c => c.column_name).join('\n') +
      '\n\nColumns in census_sections:\n' + csCols.map(c => c.column_name).join('\n')
    );
    console.log("Done writing to columns_debug.txt");

  } catch (err) {
    console.error(err);
  } finally {
    db.$pool.end();
  }
}

checkColumns();
