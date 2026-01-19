// Process tourist data and calculate income-related metrics
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/Datos/datos_turistas.csv');

async function processTouristData() {
  console.log('📊 Processing tourist data...');

  try {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    // Skip header
    const data = {};
    for (let i = 1; i < lines.length; i++) {
      const [metrica, valor] = lines[i].split(';');
      if (metrica && valor) {
        data[metrica.trim()] = parseFloat(valor.trim());
      }
    }

    console.log('\n📈 Tourist Data Loaded:');
    console.log(`   Total turistas: ${data['turistas_total']?.toLocaleString()}`);
    console.log(`   Estancia media general: ${data['estancia media de turistas']?.toFixed(2)} días`);

    // Tourist income brackets (annual income)
    const incomeEstimates = [
      { range: '≤25k', midpoint: 15000, stayDays: data['estancia media de turistas con nivel de ingresos de 25000 € o menos'] || 10.13 },
      { range: '25k-50k', midpoint: 37500, stayDays: data['estancia media de turistas con nivel de ingresos de 25000 € hasta 49999 €'] || 9.78 },
      { range: '50k-75k', midpoint: 62500, stayDays: data['estancia media de turistas con nivel de ingresos de 50000 € hasta 74999 €'] || 10.1 },
      { range: '≥75k', midpoint: 90000, stayDays: data['estancia media de turistas con nivel de ingresos de 75000 € o más'] || 9.44 },
    ];

    console.log('\n💰 Income Brackets (Annual):');
    incomeEstimates.forEach(bracket => {
      const monthlyMidpoint = bracket.midpoint / 12;
      console.log(`   ${bracket.range.padEnd(12)} → Midpoint: ${bracket.midpoint.toLocaleString()}€/año (${monthlyMidpoint.toFixed(0)}€/mes), Estancia: ${bracket.stayDays.toFixed(2)} días`);
    });

    // Tourist composition
    const totalTourists = data['turistas_total'] || 753629;
    const composition = {
      solos: { count: data['turistas_solos'] || 225884, pct: ((data['turistas_solos'] || 225884) / totalTourists * 100) },
      pareja: { count: data['turistas_pareja'] || 277994, pct: ((data['turistas_pareja'] || 277994) / totalTourists * 100) },
      hijos: { count: data['turistas_hijos'] || 63830, pct: ((data['turistas_hijos'] || 63830) / totalTourists * 100) },
      otros_familiares: { count: data['turistas_otros_familiares'] || 60570, pct: ((data['turistas_otros_familiares'] || 60570) / totalTourists * 100) },
      resto: { count: data['turistas_resto_acompañantes'] || 125350, pct: ((data['turistas_resto_acompañantes'] || 125350) / totalTourists * 100) },
    };

    console.log('\n👥 Tourist Composition:');
    Object.entries(composition).forEach(([tipo, stats]) => {
      console.log(`   ${tipo.padEnd(20)}: ${stats.count.toLocaleString().padStart(8)} (${stats.pct.toFixed(1)}%)`);
    });

    // Calcular la mediana de renta por unidad de consumo
    // Asumimos distribución normal con mediana en el rango 25k-50k
    const estimatedMedianAnnual = 37500; // Midpoint del rango más común
    const estimatedMedianMonthly = estimatedMedianAnnual / 12;

    console.log('\n🎯 Estimated Median Tourist Income (before adjustment):');
    console.log(`   Annual: ${estimatedMedianAnnual.toLocaleString()}€`);
    console.log(`   Monthly: ${estimatedMedianMonthly.toFixed(0)}€`);

    // CÁLCULO CORRECTO:
    // Para cada tipo de turista, calculamos su renta por unidad de consumo
    // Factores de la escala OCDE modificada:
    // - Solo: 1 persona → factor 1.0
    // - Pareja: 2 adultos → factor 1.5 (primer adulto=1.0, segundo=0.5)
    // - Con hijos: 2 adultos + niños → factor ~1.8 (asumiendo 1-2 niños menores)
    // - Otros familiares: grupo mixto → factor ~1.6
    // - Resto: grupo variable → factor ~1.3

    const consumptionFactors = {
      solos: 1.0,
      pareja: 1.5,
      hijos: 1.8,
      otros_familiares: 1.6,
      resto: 1.3
    };

    // Calculamos la renta por unidad de consumo para cada tipo
    // IMPORTANTE: La renta que trae el turista es INDIVIDUAL (su ingreso anual)
    // Por lo tanto, para parejas, la renta TOTAL del hogar es 2x la individual
    // Para familias con hijos, asumimos 2 adultos trabajando

    const incomePerConsumptionByType = {};
    let weightedSum = 0;

    Object.entries(composition).forEach(([tipo, stats]) => {
      let householdIncome = estimatedMedianMonthly;

      // Ajuste por composición del grupo:
      // - Solos: income individual
      // - Pareja: 2 × income individual (ambos trabajan, aproximación)
      // - Con hijos: 2 × income individual (padres)
      // - Otros familiares: 1.8 × income (grupo mixto)
      // - Resto: 1.5 × income (grupos variables)

      if (tipo === 'pareja') {
        householdIncome = estimatedMedianMonthly * 2;
      } else if (tipo === 'hijos') {
        householdIncome = estimatedMedianMonthly * 2;
      } else if (tipo === 'otros_familiares') {
        householdIncome = estimatedMedianMonthly * 1.8;
      } else if (tipo === 'resto') {
        householdIncome = estimatedMedianMonthly * 1.5;
      }

      const incomePerUnit = householdIncome / consumptionFactors[tipo];
      incomePerConsumptionByType[tipo] = incomePerUnit;
      weightedSum += (stats.pct / 100) * incomePerUnit;

      console.log(`\n   ${tipo}:`);
      console.log(`     Household income: ${householdIncome.toFixed(0)}€/mes`);
      console.log(`     Consumption factor: ${consumptionFactors[tipo]}`);
      console.log(`     Income per consumption unit: ${incomePerUnit.toFixed(0)}€/mes`);
    });

    // Media ponderada de renta por unidad de consumo
    const weightedMedianIncomePerConsumptionUnit = weightedSum;

    console.log('\n📊 RESULTADO FINAL - Renta por Unidad de Consumo:');
    console.log(`   Media ponderada turista: ${weightedMedianIncomePerConsumptionUnit.toFixed(0)}€/mes`);
    console.log('\n   Esto es comparable con la mediana de renta por unidad de consumo de residentes locales.');

    // Análisis de bonos turísticos
    const avgStay = data['estancia media de turistas'] || 9.83;
    const bono1Day = { name: 'Bono 1 Día', price: 4.00, days: 1, unlimited: true };
    const bono3Days = { name: 'Bono 3 Días', price: 10.00, days: 3, unlimited: true };

    console.log('\n🎫 Análisis Bonos Turísticos:');
    console.log(`   Estancia media: ${avgStay.toFixed(1)} días`);
    console.log(`\n   ${bono1Day.name}: ${bono1Day.price}€ (ilimitado)`);
    console.log(`     → ${(bono1Day.price / avgStay).toFixed(2)}€/día promedio estancia`);
    console.log(`     → ${((bono1Day.price / avgStay / weightedMedianIncomePerConsumptionUnit * 30) * 100).toFixed(3)}% de renta diaria`);

    console.log(`\n   ${bono3Days.name}: ${bono3Days.price}€ (ilimitado)`);
    console.log(`     → ${(bono3Days.price / avgStay).toFixed(2)}€/día promedio estancia`);
    console.log(`     → ${((bono3Days.price / avgStay / weightedMedianIncomePerConsumptionUnit * 30) * 100).toFixed(3)}% de renta diaria`);

    // Output summary for API consumption
    const summary = {
      total_tourists: totalTourists,
      avg_stay_days: avgStay,
      estimated_median_annual: estimatedMedianAnnual,
      estimated_median_monthly: estimatedMedianMonthly,
      weighted_median_income_per_consumption_unit: weightedMedianIncomePerConsumptionUnit,
      income_per_consumption_by_type: incomePerConsumptionByType,
      composition,
      consumption_factors: consumptionFactors,
      tourist_passes: {
        bono_1day: {
          price: bono1Day.price,
          days: bono1Day.days,
          cost_per_day_avg_stay: bono1Day.price / avgStay,
          pct_daily_income: (bono1Day.price / avgStay / weightedMedianIncomePerConsumptionUnit * 30) * 100
        },
        bono_3days: {
          price: bono3Days.price,
          days: bono3Days.days,
          cost_per_day_avg_stay: bono3Days.price / avgStay,
          pct_daily_income: (bono3Days.price / avgStay / weightedMedianIncomePerConsumptionUnit * 30) * 100
        }
      },
      income_brackets: incomeEstimates
    };

    // Write to JSON for API access
    const outputPath = path.join(__dirname, '../data/tourist-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`\n✅ Analysis saved to: ${outputPath}`);

    return summary;

  } catch (error) {
    console.error('❌ Error processing tourist data:', error);
    throw error;
  }
}

processTouristData()
  .then(() => {
    console.log('\n🎉 Tourist data processing complete!');
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
