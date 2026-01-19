require('dotenv').config();
const pgp = require('pg-promise')({});

const db = pgp(process.env.DATABASE_URL);

async function testmath() {
    try {
        const sections = await db.manyOrNone(`
      SELECT
        sm.section_code,
        COALESCE(sm.service_value_index, 0) as service_value_index,
        sm.income_median
      FROM section_metrics sm
      WHERE sm.section_code LIKE '35016%' AND sm.stops_count > 0
    `);

        const tariff = { name: 'Pago_Directo', eur_per_trip: 1.40 };

        const prices = sections
            .map(section => {
                const service_value = Math.max(section.service_value_index, 0.01);
                return tariff.eur_per_trip / service_value;
            })
            .sort((a, b) => a - b);

        console.log('Prices count:', prices.length);
        console.log('First 5 prices (Lowest - P10 area? No, lowest price = Best Service):', prices.slice(0, 5));
        console.log('Last 5 prices (Highest - P90 area? Worst service):', prices.slice(-5));

        const p10 = prices[Math.floor(prices.length * 0.1)] || 0;
        const p90 = prices[Math.floor(prices.length * 0.9)] || 0;

        console.log('P10 Price (Best Served):', p10);
        console.log('P90 Price (Worst Served):', p90);

        const ratio = p90 / (p10 || 1);
        console.log('Ratio:', ratio);

    } catch (error) {
        console.error('Database error:', error);
    } finally {
        pgp.end();
    }
}

testmath();
