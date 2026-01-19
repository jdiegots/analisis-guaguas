require('dotenv').config();
const pgp = require('pg-promise')({});

const db = pgp(process.env.DATABASE_URL);

async function testApiLogic() {
    try {
        const sections = await db.manyOrNone(`
      SELECT
        sm.section_code,

        -- Service metrics
        COALESCE(sm.service_value_index, 0) as service_value_index,
        COALESCE(sm.service_percentile, 0) as service_percentile,
        COALESCE(sm.stop_time_events_all_day, 0) as stop_time_events_all_day,
        COALESCE(sm.unique_routes_all_day, 0) as unique_routes_all_day,
        COALESCE(sm.coverage_300_area_pct, 0) as coverage_300_area_pct,
        COALESCE(sm.nearest_stop_meters, 0) as nearest_stop_meters,

        -- Socioeconomic (from census_sections via import)
        cs.unemployment_rate,
        cs.prop_elderly,
        cs.education_low_pct,
        sm.income_median,
        COALESCE(sm.total_population, 0) as total_population

      FROM section_metrics sm
      LEFT JOIN census_sections cs ON sm.section_code = cs.section_code
      WHERE sm.section_code LIKE '35016%' AND sm.stops_count > 0
      ORDER BY sm.section_code
    `);

        console.log(`Fetched ${sections.length} sections.`);

        if (sections.length > 0) {
            console.log('First section:', sections[0]);
        }

    } catch (error) {
        console.error('Database error:', error);
    } finally {
        pgp.end();
    }
}

testApiLogic();
