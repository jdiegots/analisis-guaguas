
const { db } = require('./db-config');

async function checkCorrelations() {
    try {
        console.log('📊 Checking Correlations for "What is associated with service level?" tool...');

        // 1. Fetch Data
        const rows = await db.any(`
      SELECT
        sm.section_code,
        COALESCE(sm.service_value_index, 0.01) as service_value_index,
        COALESCE(sm.total_population, 0) as total_population,
        COALESCE(sm.coverage_300_area_pct, 0) as coverage_300_area_pct,
        COALESCE(sm.nearest_stop_meters, 0) as nearest_stop_meters,
        COALESCE(sm.unique_routes_all_day, 0) as unique_routes_all_day,
        COALESCE(cs.unemployment_rate, 0) as unemployment_rate,
        COALESCE(cs.prop_elderly, 0) as prop_elderly,
        COALESCE(sm.income_median, 0) as income_median
      FROM section_metrics sm
      LEFT JOIN census_sections cs ON sm.section_code = cs.section_code
      WHERE sm.section_code LIKE '35016%'
        AND sm.service_value_index > 0
        AND sm.income_median > 0
    `);

        console.log(`\nSample size: ${rows.length} valid sections.`);

        // DEBUG: Check Data Quality
        const stats = (key) => {
            const vals = rows.map(r => r[key]);
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            return { key, min, max, avg };
        };

        console.log('\n--- DATA STATS ---');
        console.table([
            stats('service_value_index'),
            stats('income_median'),
            stats('total_population'),
            stats('unemployment_rate'),
            stats('unique_routes_all_day')
        ]);

        console.log('\n--- FIRST 3 ROWS ---');
        console.log(rows.slice(0, 3));

        // 2. Define Regression Function (Simplified OLS)
        const performRegression = (data, yKey, xKeys) => {
            const n = data.length;
            if (n < xKeys.length + 2) return null;

            // Extract matrices
            const Y = data.map(d => d[yKey]);
            const X = data.map(d => [1, ...xKeys.map(k => d[k])]); // Add intercept [1, x1, x2...]

            // Matrix Math: Beta = (X'X)^-1 X'Y
            // Helper: Transpose
            const transpose = (m) => m[0].map((_, i) => m.map(row => row[i]));
            // Helper: Multiply
            const multiply = (A, B) => {
                const result = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
                return result.map((row, i) => row.map((_, j) =>
                    A[i].reduce((sum, elm, k) => sum + elm * B[k][j], 0)
                ));
            };
            // Helper: Invert (Gaussian elimination, simplified for minimal dependencies)
            // Since I can't import numeric.js easily here, I'll use a very simple solver or just standard deviation correlation for single variable if multivariable is too complex to implement from scratch reliably in one go.
            // ACTUALLY, sticking to 1 variable + maybe 1 control is safer to implement from scratch.
            // But the user asked if specific combinations work. I'll implement a basic Gaussian elimination for inversion.
            const invert = (M) => {
                // Clone
                const n = M.length;
                const A = M.map(row => [...row]);
                const I = Array(n).fill(0).map((_, i) => Array(n).fill(0).map((_, j) => i === j ? 1 : 0));

                for (let i = 0; i < n; i++) {
                    let pivot = A[i][i];
                    if (Math.abs(pivot) < 1e-10) return null; // Singular
                    for (let j = 0; j < n; j++) {
                        A[i][j] /= pivot;
                        I[i][j] /= pivot;
                    }
                    for (let k = 0; k < n; k++) {
                        if (k !== i) {
                            let factor = A[k][i];
                            for (let j = 0; j < n; j++) {
                                A[k][j] -= factor * A[i][j];
                                I[k][j] -= factor * I[i][j];
                            }
                        }
                    }
                }
                return I;
            };

            const Xt = transpose(X);
            const XtX = multiply(Xt, X);
            const XtX_inv = invert(XtX);

            if (!XtX_inv) return { r2: 0, coeffs: [] }; // Singular matrix

            const XtY = Array(Xt.length).fill(0).map((_, i) =>
                [Xt[i].reduce((sum, val, j) => sum + val * Y[j], 0)]
            ); // Vector as Nx1 matrix

            const Beta = multiply(XtX_inv, XtY).flat();

            // Calculate R2
            const yMean = Y.reduce((a, b) => a + b, 0) / n;
            const SST = Y.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
            const predicted = X.map(row => row.reduce((sum, x, i) => sum + x * Beta[i], 0));
            const SSR = predicted.reduce((sum, p) => sum + Math.pow(p - yMean, 2), 0);
            const r2 = SSR / SST;

            return { r2, coeffs: Beta.slice(1) }; // Remove intercept from reported coeffs
        };

        // 3. Test Combinations
        console.log('\n--- TESTING COMBINATIONS ---');

        const formatResult = (name, r2, coeffs) => {
            let stars = '';
            if (r2 > 0.5) stars = '⭐⭐⭐ (Strong)';
            else if (r2 > 0.25) stars = '⭐⭐ (Moderate)';
            else if (r2 > 0.1) stars = '⭐ (Weak)';
            else stars = '❌ (None)';

            console.log(`\nExperiment: ${name}`);
            console.log(`  R²: ${r2.toFixed(3)} ${stars}`);
            console.log(`  Coeffs: ${coeffs.map(c => c.toFixed(6) + (c > 0 ? ' (+)' : ' (-)')).join(', ')}`);
            return r2;
        };


        // Scenario A: Income driving Service?
        // Target: IVS, Factor: Income
        const resA = performRegression(rows, 'service_value_index', ['income_median']);
        formatResult('IVS ~ Income', resA.r2, resA.coeffs);

        // Scenario B: Income driving Service (controlling for Density/Pop)?
        // Target: IVS, Factor: Income, Context: Total Population
        const resB = performRegression(rows, 'service_value_index', ['income_median', 'total_population']);
        formatResult('IVS ~ Income + Pop', resB.r2, resB.coeffs);

        // Scenario C: Unemployment (Double Punishment)
        // Target: IVS, Factor: Unemployment
        const resC = performRegression(rows, 'service_value_index', ['unemployment_rate']);
        formatResult('IVS ~ Unemployment', resC.r2, resC.coeffs);

        // Scenario D: Elderly vs Distance (Accessibility)
        // Target: Nearest Stop, Factor: Elderly
        const resD = performRegression(rows, 'nearest_stop_meters', ['prop_elderly']);
        formatResult('DistToStop ~ Elderly', resD.r2, resD.coeffs);

        // Scenario E: Technical Baseline (Pop vs Routes)
        // Target: Unique Routes, Factor: Pop
        const resE = performRegression(rows, 'unique_routes_all_day', ['total_population']);
        formatResult('Routes ~ Population', resE.r2, resE.coeffs);

        // Scenario F: Price vs Income (Affordability/Equity)
        // Target: IVS (Inverse Price), Factor: Income
        // Note: If IVS correlates with Income, Effect Price correlates inversely.
        // Just checking IVS is enough to confirm the relationship exists.

        console.log('\n--------------------------');
        console.log('Analysis Complete.');

    } catch (error) {
        console.error('Error:', error);
    }
}

checkCorrelations();
