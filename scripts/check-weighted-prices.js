
require('dotenv').config();
const pgp = require('pg-promise')({});

const db = pgp(process.env.DATABASE_URL);

async function calculateWeightedPrices() {
    try {
        const sections = await db.any(`
      SELECT 
        total_population,
        service_value_index
      FROM section_metrics
      WHERE section_code LIKE '35016%' AND service_value_index > 0
    `);

        // 1. Calculate Effective Prices
        // Nominal standard = 1.40
        // Effective = 1.40 / ServiceValueIndex

        const nominalPrice = 1.40;

        const data = sections.map(s => {
            const sv = Math.max(s.service_value_index, 0.001); // Prevent div by zero
            return {
                population: s.total_population || 100, // Fallback if 0 to maintain consistent weighting
                service_value: sv,
                effective_price: nominalPrice / sv
            };
        });

        // Sort by Effective Price (Ascending: Best/Cheap -> Worst/Expensive)
        data.sort((a, b) => a.effective_price - b.effective_price);

        const totalPop = data.reduce((sum, item) => sum + item.population, 0);

        // Function to get price at percentile
        const getPriceAtPercentile = (pct) => {
            let accum = 0;
            const target = totalPop * pct;

            for (const item of data) {
                accum += item.population;
                if (accum >= target) return item.effective_price;
            }
            return data[data.length - 1].effective_price;
        };

        const p10_price = getPriceAtPercentile(0.10); // Best 10% (Low price)
        const p50_price = getPriceAtPercentile(0.50); // Median
        const p90_price = getPriceAtPercentile(0.90); // Worst 10% (High price)

        console.log('----------------------------------------------------');
        console.log('CALCULO DE PRECIOS EFECTIVOS PONDERADOS POR POBLACION');
        console.log('----------------------------------------------------');
        console.log(`Total Population Considered: ${totalPop}`);
        console.log(`P10 (10% Mejor Conectado): ${p10_price.toFixed(2)}€`);
        console.log(`P50 (Mediana):             ${p50_price.toFixed(2)}€`);
        console.log(`P90 (10% Peor Conectado):  ${p90_price.toFixed(2)}€`);
        console.log('----------------------------------------------------');

        // Also calculate Territorial (Unweighted) for comparison
        // To match how it is likely calculated in the "cards" (Territorial)
        // Sort by effective price as well
        const unweightedData = [...data]; // It is already sorted by price

        // P10 Territorial is index 10%
        const p10_idx = Math.floor(unweightedData.length * 0.10);
        const p90_idx = Math.floor(unweightedData.length * 0.90);

        const p10_terr = unweightedData[p10_idx].effective_price;
        const p90_terr = unweightedData[p90_idx].effective_price;

        console.log('COMPARATIVA TERRITORIAL (SIN PONDERAR)');
        console.log(`P10 Territorial: ${p10_terr.toFixed(2)}€`);
        console.log(`P90 Territorial: ${p90_terr.toFixed(2)}€`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        pgp.end();
    }
}

calculateWeightedPrices();
