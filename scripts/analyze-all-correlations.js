/**
 * Comprehensive Correlation Analysis Tool
 *
 * Tests ALL possible combinations of:
 * - Target variables: service_value_index, observable_effective_price, effective_price
 * - Main factors: income_median, total_population, prop_elderly, unemployment_rate, coverage_300_area_pct, unique_routes_all_day, nearest_stop_meters
 * - Context variables: any combination of the above (up to 3)
 *
 * For each combination, calculates:
 * - Pearson correlation coefficient (r)
 * - R² value
 * - Adjusted R²
 * - Statistical significance assessment
 * - Political interpretation
 */

const fs = require('fs');
const path = require('path');

// Read sections data from the local file
async function fetchSectionsData() {
  const dataFile = path.join(__dirname, 'sections_data.json');
  const data = fs.readFileSync(dataFile, 'utf-8');
  return JSON.parse(data);
}

// Calculate effective prices directly from section data
function calculateEffectivePrices(sections) {
  const BILLETE_SIMPLE_PRICE = 1.40;

  // Find max service_value_index for observable effective price
  const maxServiceValue = Math.max(...sections.map(s => s.service_value_index || 0));

  return sections.map(section => {
    const svi = section.service_value_index || 0.01;

    // Effective price: cost relative to perfect service
    const effective_price = svi > 0 ? BILLETE_SIMPLE_PRICE / svi : 999;

    // Observable effective price: cost relative to best service in the city
    const observable_effective_price = maxServiceValue > 0 ? BILLETE_SIMPLE_PRICE / svi : 999;

    return {
      ...section,
      effective_price,
      observable_effective_price
    };
  });
}

// Perform multiple linear regression using normal equations
function performRegression(data, yVar, xVars) {
  const validData = data.filter(d => {
    const yVal = d[yVar];
    if (!yVal || yVal === 0) return false;
    for (const xVar of xVars) {
      const xVal = d[xVar];
      if (xVal === null || xVal === undefined) return false;
    }
    return true;
  });

  const n = validData.length;
  if (n < xVars.length + 2) return null;

  const Y = validData.map(d => d[yVar]);
  const X = validData.map(d => xVars.map(xVar => d[xVar]));
  const XWithIntercept = X.map(row => [1, ...row]);
  const k = XWithIntercept[0].length;

  // Calculate X'X
  const XtX = Array(k).fill(0).map(() => Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      let sum = 0;
      for (let row = 0; row < n; row++) {
        sum += XWithIntercept[row][i] * XWithIntercept[row][j];
      }
      XtX[i][j] = sum;
    }
  }

  // Calculate X'Y
  const XtY = Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    let sum = 0;
    for (let row = 0; row < n; row++) {
      sum += XWithIntercept[row][i] * Y[row];
    }
    XtY[i] = sum;
  }

  // Solve using Gaussian elimination
  const augmented = XtX.map((row, i) => [...row, XtY[i]]);

  for (let i = 0; i < k; i++) {
    let maxRow = i;
    for (let j = i + 1; j < k; j++) {
      if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = j;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    for (let j = i + 1; j < k; j++) {
      const factor = augmented[j][i] / augmented[i][i];
      for (let col = i; col <= k; col++) {
        augmented[j][col] -= factor * augmented[i][col];
      }
    }
  }

  const coefficients = Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    coefficients[i] = augmented[i][k];
    for (let j = i + 1; j < k; j++) {
      coefficients[i] -= augmented[i][j] * coefficients[j];
    }
    coefficients[i] /= augmented[i][i];
  }

  // Calculate R² and adjusted R²
  const yMean = Y.reduce((a, b) => a + b, 0) / n;
  const predictions = XWithIntercept.map(row =>
    row.reduce((sum, val, idx) => sum + val * coefficients[idx], 0)
  );

  const SST = Y.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const SSR = predictions.reduce((sum, pred, i) => sum + Math.pow(pred - yMean, 2), 0);
  const rSquared = SSR / SST;
  const adjustedR2 = 1 - ((1 - rSquared) * (n - 1) / (n - k));

  // Calculate correlation coefficient for main factor (first x variable)
  const xMean = validData.map(d => d[xVars[0]]).reduce((a, b) => a + b, 0) / n;
  let numerator = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = validData[i][xVars[0]] - xMean;
    const dy = Y[i] - yMean;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const r = denomX === 0 || denomY === 0 ? 0 : numerator / Math.sqrt(denomX * denomY);

  return {
    coefficients: coefficients.slice(1),
    intercept: coefficients[0],
    rSquared,
    adjustedR2,
    n,
    r,
    validData
  };
}

// Calculate statistical significance (approximate)
function calculateSignificance(r, n) {
  if (n < 3) return { pValue: 1, significant: false };
  const t = r * Math.sqrt((n - 2) / (1 - r * r));

  // Approximate p-value
  let pValue;
  if (Math.abs(t) > 2.576) pValue = 0.01;
  else if (Math.abs(t) > 1.96) pValue = 0.05;
  else if (Math.abs(t) > 1.645) pValue = 0.10;
  else pValue = 0.20;

  return {
    pValue,
    tStatistic: t,
    significant: pValue < 0.05
  };
}

// Get political interpretation
function getPoliticalInterpretation(targetVar, mainFactor, r, r2, pValue, contextVars) {
  const strength = r2 > 0.5 ? 'FUERTE' : r2 > 0.25 ? 'MODERADA' : r2 > 0.1 ? 'DÉBIL' : 'MUY DÉBIL';
  const direction = r > 0 ? 'positiva' : 'negativa';
  const significant = pValue < 0.05 ? 'SIGNIFICATIVA' : 'NO SIGNIFICATIVA';

  let message = '';

  // Service value index correlations
  if (targetVar === 'service_value_index') {
    if (mainFactor === 'income_median') {
      if (r > 0.3 && pValue < 0.05) {
        message = '⚠️ DESIGUALDAD CONFIRMADA: Los barrios ricos reciben MEJOR servicio de transporte público';
      } else if (r < -0.3 && pValue < 0.05) {
        message = '✓ JUSTICIA SOCIAL: Los barrios pobres reciben MEJOR servicio';
      } else {
        message = '○ No hay evidencia clara de sesgo por renta en la distribución del servicio';
      }
    } else if (mainFactor === 'unemployment_rate') {
      if (r < -0.3 && pValue < 0.05) {
        message = '⚠️ DOBLE CASTIGO: Quienes MÁS necesitan movilidad (desempleados) reciben PEOR servicio';
      } else {
        message = '○ No hay evidencia de castigo sistemático a barrios con desempleo';
      }
    } else if (mainFactor === 'prop_elderly') {
      if (r < -0.25 && pValue < 0.05) {
        message = '⚠️ ABANDONO DE MAYORES: Los barrios envejecidos sufren aislamiento por mal servicio';
      } else {
        message = '○ No hay evidencia de abandono sistemático de barrios con población mayor';
      }
    }
  }

  // Effective price correlations
  if (targetVar === 'observable_effective_price' || targetVar === 'effective_price') {
    if (mainFactor === 'income_median') {
      if (r < -0.4 && pValue < 0.05) {
        message = '⚠️ IMPUESTO REGRESIVO: Los POBRES pagan MÁS por unidad de servicio';
      } else {
        message = '○ No hay evidencia de impuesto regresivo por renta';
      }
    } else if (mainFactor === 'unemployment_rate') {
      if (r > 0.3 && pValue < 0.05) {
        message = '⚠️ Los desempleados pagan MÁS en términos efectivos';
      } else {
        message = '○ El precio efectivo no varía significativamente con desempleo';
      }
    }
  }

  return {
    strength,
    direction,
    significant,
    message: message || `Correlación ${strength} (${direction}), ${significant}`,
    percentageExplained: (r2 * 100).toFixed(1)
  };
}

// Get all combinations of context variables (up to maxContext)
function getCombinations(array, size) {
  if (size === 0) return [[]];
  if (array.length === 0) return [];

  const [first, ...rest] = array;
  const withoutFirst = getCombinations(rest, size);
  const withFirst = getCombinations(rest, size - 1).map(combo => [first, ...combo]);

  return [...withoutFirst, ...withFirst];
}

async function main() {
  console.log('Fetching data...');
  const sections = await fetchSectionsData();

  // Calculate effective prices directly
  const enrichedSections = calculateEffectivePrices(sections);

  console.log(`Loaded ${enrichedSections.length} sections`);

  // Debug: check what price data looks like
  const withPrices = enrichedSections.filter(s => s.observable_effective_price > 0 && s.observable_effective_price < 999);
  console.log(`Sections with valid observable_effective_price: ${withPrices.length}`);
  if (withPrices.length > 0) {
    console.log(`Sample: svi=${withPrices[0].service_value_index.toFixed(3)}, obs_price=${withPrices[0].observable_effective_price.toFixed(2)}, eff_price=${withPrices[0].effective_price.toFixed(2)}`);
    console.log(`Price range: obs ${Math.min(...withPrices.map(s => s.observable_effective_price)).toFixed(2)} - ${Math.max(...withPrices.map(s => s.observable_effective_price)).toFixed(2)}`);
  }

  const targetOptions = [
    'service_value_index',
    'observable_effective_price',
    'effective_price'
  ];

  const factorOptions = [
    'income_median',
    'total_population',
    'prop_elderly',
    'unemployment_rate',
    'coverage_300_area_pct',
    'unique_routes_all_day',
    'nearest_stop_meters'
  ];

  const results = [];
  let totalTests = 0;

  // Test all combinations
  for (const targetVar of targetOptions) {
    for (const mainFactor of factorOptions) {
      const availableContext = factorOptions.filter(f => f !== mainFactor);

      // Test with no context variables
      totalTests++;
      const result0 = performRegression(enrichedSections, targetVar, [mainFactor]);
      if (result0) {
        const sig = calculateSignificance(result0.r, result0.n);
        const pol = getPoliticalInterpretation(targetVar, mainFactor, result0.r, result0.rSquared, sig.pValue, []);
        results.push({
          target: targetVar,
          mainFactor,
          contextVars: [],
          n: result0.n,
          r: result0.r.toFixed(4),
          r2: result0.rSquared.toFixed(4),
          adjR2: result0.adjustedR2.toFixed(4),
          pValue: sig.pValue,
          tStatistic: sig.tStatistic.toFixed(3),
          significant: sig.significant,
          ...pol
        });
      }

      // Test with 1 context variable
      for (const contextVar of availableContext) {
        totalTests++;
        const result1 = performRegression(enrichedSections, targetVar, [mainFactor, contextVar]);
        if (result1) {
          const sig = calculateSignificance(result1.r, result1.n);
          const pol = getPoliticalInterpretation(targetVar, mainFactor, result1.r, result1.rSquared, sig.pValue, [contextVar]);
          results.push({
            target: targetVar,
            mainFactor,
            contextVars: [contextVar],
            n: result1.n,
            r: result1.r.toFixed(4),
            r2: result1.rSquared.toFixed(4),
            adjR2: result1.adjustedR2.toFixed(4),
            pValue: sig.pValue,
            tStatistic: sig.tStatistic.toFixed(3),
            significant: sig.significant,
            ...pol
          });
        }
      }

      // Test with 2 context variables
      const contextCombos2 = getCombinations(availableContext, 2);
      for (const contextVars of contextCombos2) {
        totalTests++;
        const result2 = performRegression(enrichedSections, targetVar, [mainFactor, ...contextVars]);
        if (result2) {
          const sig = calculateSignificance(result2.r, result2.n);
          const pol = getPoliticalInterpretation(targetVar, mainFactor, result2.r, result2.rSquared, sig.pValue, contextVars);
          results.push({
            target: targetVar,
            mainFactor,
            contextVars,
            n: result2.n,
            r: result2.r.toFixed(4),
            r2: result2.rSquared.toFixed(4),
            adjR2: result2.adjustedR2.toFixed(4),
            pValue: sig.pValue,
            tStatistic: sig.tStatistic.toFixed(3),
            significant: sig.significant,
            ...pol
          });
        }
      }

      // Test with 3 context variables
      const contextCombos3 = getCombinations(availableContext, 3);
      for (const contextVars of contextCombos3) {
        totalTests++;
        const result3 = performRegression(enrichedSections, targetVar, [mainFactor, ...contextVars]);
        if (result3) {
          const sig = calculateSignificance(result3.r, result3.n);
          const pol = getPoliticalInterpretation(targetVar, mainFactor, result3.r, result3.rSquared, sig.pValue, contextVars);
          results.push({
            target: targetVar,
            mainFactor,
            contextVars,
            n: result3.n,
            r: result3.r.toFixed(4),
            r2: result3.rSquared.toFixed(4),
            adjR2: result3.adjustedR2.toFixed(4),
            pValue: sig.pValue,
            tStatistic: sig.tStatistic.toFixed(3),
            significant: sig.significant,
            ...pol
          });
        }
      }
    }
  }

  console.log(`\nTested ${totalTests} combinations, ${results.length} valid results\n`);

  // Filter and sort by significance and strength
  const significantResults = results.filter(r => r.significant && Math.abs(parseFloat(r.r)) > 0.25);
  const sortedResults = significantResults.sort((a, b) => parseFloat(b.adjR2) - parseFloat(a.adjR2));

  console.log('='.repeat(120));
  console.log('SIGNIFICANT CORRELATIONS (p < 0.05, |r| > 0.25)');
  console.log('='.repeat(120));
  console.log(`Found ${sortedResults.length} significant correlations out of ${results.length} total tests\n`);

  sortedResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.target} ~ ${result.mainFactor}${result.contextVars.length > 0 ? ' + ' + result.contextVars.join(' + ') : ''}`);
    console.log(`   r = ${result.r}, R² = ${result.r2}, Adj R² = ${result.adjR2}, p = ${result.pValue}, n = ${result.n}`);
    console.log(`   Fuerza: ${result.strength}, Explicación: ${result.percentageExplained}%`);
    console.log(`   ${result.message}`);
    console.log('');
  });

  // Summary by target variable
  console.log('='.repeat(120));
  console.log('SUMMARY BY TARGET VARIABLE');
  console.log('='.repeat(120));

  for (const target of targetOptions) {
    const targetResults = sortedResults.filter(r => r.target === target);
    console.log(`\n${target.toUpperCase()}: ${targetResults.length} significant correlations`);

    if (targetResults.length > 0) {
      console.log(`  Strongest: ${targetResults[0].mainFactor} (R² = ${targetResults[0].r2})`);
      console.log(`  ${targetResults[0].message}`);
    }
  }

  // Save full results to JSON
  fs.writeFileSync('correlation_analysis_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTests,
    totalResults: results.length,
    significantResults: sortedResults.length,
    allResults: results,
    significantOnly: sortedResults
  }, null, 2));

  console.log(`\n\nFull results saved to correlation_analysis_results.json`);
}

main().catch(console.error);
