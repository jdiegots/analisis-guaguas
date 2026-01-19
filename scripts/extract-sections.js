const { db } = require('../src/lib/db');
const fs = require('fs');

async function extractSections() {
  const sections = await db.manyOrNone(`
    SELECT
      sm.section_code,
      cs.population_total,
      cs.unemployment_rate,
      cs.census_prop_elderly as prop_elderly,
      sm.coverage_300_area_pct,
      sm.unique_routes_all_day,
      sm.nearest_stop_meters,
      sm.income_median,
      sm.service_value_index
    FROM section_metrics sm
    LEFT JOIN census_sections cs ON sm.section_code = cs.section_code
    WHERE sm.section_code LIKE '35016%'
      AND sm.service_value_index > 0
      AND sm.service_value_index IS NOT NULL
  `);

  fs.writeFileSync('scripts/sections_data.json', JSON.stringify(sections, null, 2));
  console.log(`Wrote ${sections.length} sections`);
  process.exit(0);
}

extractSections().catch(console.error);
