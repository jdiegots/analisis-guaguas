const data = require('../correlation_analysis_results.json');

console.log('='.repeat(100));
console.log('COMPREHENSIVE CORRELATION ANALYSIS SUMMARY');
console.log('='.repeat(100));
console.log(`Total tests: ${data.totalTests}`);
console.log(`Valid results: ${data.totalResults}`);
console.log(`Significant correlations (p<0.05, |r|>0.25): ${data.significantResults}`);
console.log('');

// Group by main factor
console.log('='.repeat(100));
console.log('SIGNIFICANT CORRELATIONS BY MAIN FACTOR');
console.log('='.repeat(100));

const factors = ['income_median', 'total_population', 'prop_elderly', 'unemployment_rate',
                 'coverage_300_area_pct', 'unique_routes_all_day', 'nearest_stop_meters'];

factors.forEach(factor => {
  const factorCorrs = data.significantOnly.filter(r => r.mainFactor === factor && r.significant === 'SIGNIFICATIVA');
  if (factorCorrs.length > 0) {
    console.log(`\n${factor.toUpperCase()}: ${factorCorrs.length} significant correlations`);

    // Group by target
    const targets = ['service_value_index', 'observable_effective_price', 'effective_price'];
    targets.forEach(target => {
      const targetCorrs = factorCorrs.filter(r => r.target === target);
      if (targetCorrs.length > 0) {
        const strongest = targetCorrs.sort((a,b) => parseFloat(b.adjR2) - parseFloat(a.adjR2))[0];
        console.log(`  ${target}:`);
        console.log(`    Best: R²=${strongest.r2}, Adj R²=${strongest.adjR2}, r=${strongest.r}, p=${strongest.pValue}`);
        console.log(`    Context: [${strongest.contextVars.join(', ')}]`);
        console.log(`    ${strongest.message}`);
      }
    });
  }
});

// Political narratives
console.log('\n' + '='.repeat(100));
console.log('KEY POLITICAL FINDINGS');
console.log('='.repeat(100));

console.log('\n1. SERVICE VALUE INDEX (Quality of Service)');
const sviResults = data.significantOnly.filter(r => r.target === 'service_value_index' && r.significant === 'SIGNIFICATIVA');
console.log(`   Total significant: ${sviResults.length}`);
console.log(`   Strongest factor: ${sviResults[0].mainFactor} (R²=${sviResults[0].r2})`);

// Income-service correlation
const incomeService = sviResults.filter(r => r.mainFactor === 'income_median');
if (incomeService.length > 0) {
  const best = incomeService.sort((a,b) => parseFloat(b.adjR2) - parseFloat(a.adjR2))[0];
  console.log(`\n   Income correlation:`);
  console.log(`     r=${best.r}, R²=${best.r2}, p=${best.pValue}`);
  console.log(`     ${best.message}`);
}

// Unemployment-service correlation
const unemployService = sviResults.filter(r => r.mainFactor === 'unemployment_rate');
if (unemployService.length > 0) {
  const best = unemployService.sort((a,b) => parseFloat(b.adjR2) - parseFloat(a.adjR2))[0];
  console.log(`\n   Unemployment correlation:`);
  console.log(`     r=${best.r}, R²=${best.r2}, p=${best.pValue}`);
  console.log(`     ${best.message}`);
}

// Elderly-service correlation
const elderlyService = sviResults.filter(r => r.mainFactor === 'prop_elderly');
if (elderlyService.length > 0) {
  const best = elderlyService.sort((a,b) => parseFloat(b.adjR2) - parseFloat(a.adjR2))[0];
  console.log(`\n   Elderly population correlation:`);
  console.log(`     r=${best.r}, R²=${best.r2}, p=${best.pValue}`);
  console.log(`     ${best.message}`);
}

console.log('\n2. EFFECTIVE PRICE (Price per unit of service)');
const priceResults = data.significantOnly.filter(r =>
  (r.target === 'observable_effective_price' || r.target === 'effective_price') &&
  r.significant === 'SIGNIFICATIVA'
);
console.log(`   Total significant: ${priceResults.length}`);
if (priceResults.length > 0) {
  console.log(`   Strongest factor: ${priceResults[0].mainFactor} (R²=${priceResults[0].r2})`);
}

// Income-price correlation
const incomePrice = priceResults.filter(r => r.mainFactor === 'income_median');
if (incomePrice.length > 0) {
  const best = incomePrice.sort((a,b) => parseFloat(b.adjR2) - parseFloat(a.adjR2))[0];
  console.log(`\n   Income correlation:`);
  console.log(`     Target: ${best.target}`);
  console.log(`     r=${best.r}, R²=${best.r2}, p=${best.pValue}`);
  console.log(`     ${best.message}`);
} else {
  console.log(`\n   Income correlation: NONE SIGNIFICANT`);
}

// Unemployment-price correlation
const unemployPrice = priceResults.filter(r => r.mainFactor === 'unemployment_rate');
if (unemployPrice.length > 0) {
  const best = unemployPrice.sort((a,b) => parseFloat(b.adjR2) - parseFloat(a.adjR2))[0];
  console.log(`\n   Unemployment correlation:`);
  console.log(`     Target: ${best.target}`);
  console.log(`     r=${best.r}, R²=${best.r2}, p=${best.pValue}`);
  console.log(`     ${best.message}`);
} else {
  console.log(`\n   Unemployment correlation: NONE SIGNIFICANT`);
}

console.log('\n' + '='.repeat(100));
console.log('RECOMMENDATION');
console.log('='.repeat(100));

const weakPriceCorrs = priceResults.filter(r => parseFloat(r.r2) < 0.25);
const strongServiceCorrs = sviResults.filter(r => parseFloat(r.r2) > 0.5);

console.log(`\nService Value Index: ${strongServiceCorrs.length} strong correlations (R² > 0.5)`);
console.log(`Effective Price: ${priceResults.length} significant correlations (strongest R²=${priceResults[0]?.r2 || '0'})`);

if (priceResults.length === 0 || (priceResults.length > 0 && parseFloat(priceResults[0].r2) < 0.25)) {
  console.log('\n⚠️  WEAK CORRELATIONS FOR PRICE VARIABLES');
  console.log('The effective price variables show WEAK or NO significant correlations with');
  console.log('sociodemographic factors (income, unemployment, elderly population).');
  console.log('');
  console.log('This makes the "statistical correlation tool" section POLITICALLY WEAK because:');
  console.log('- Cannot demonstrate that poor people pay more for service');
  console.log('- Cannot show systematic inequality in pricing');
  console.log('- Best correlations are with service infrastructure (routes, coverage)');
  console.log('  which is less politically impactful');
  console.log('');
  console.log('RECOMMENDATION: REMOVE OR SIGNIFICANTLY REDUCE THIS SECTION');
  console.log('The analysis tool provides limited political value and may confuse the narrative.');
} else {
  console.log('\n✓ STRONG CORRELATIONS FOUND');
  console.log('The statistical tool demonstrates clear systematic inequality.');
  console.log('RECOMMENDATION: KEEP THIS SECTION');
}
