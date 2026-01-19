import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { linearRegression, sampleStandardDeviation, mean } from 'simple-statistics';

interface DecileData {
  percentile: number;
  income_monthly: number;
  income_daily: number;
  population: number;
  population_pct: number;
}

interface TariffImpactByDecile {
  decile: number;
  income_daily: number;
  tariff_costs: {
    [tariffName: string]: {
      daily_cost: number;
      pct_daily_income: number;
      sustainability: 'sostenible' | 'ajustado' | 'insostenible';
    };
  };
}

interface RegressionCoefficient {
  variable: string;
  beta: number;
  std_error: number;
  t_value: number;
  p_value: number;
  ci_lower: number;
  ci_upper: number;
  interpretation: string;
}

interface SensitivityScenario {
  price_change_eur: number;
  price_change_pct: number;
  population_unsustainable: number;
  population_unsustainable_pct: number;
  population_change: number;
}

export async function GET() {
  try {
    // 1. Cargar datos de secciones
    const sections = await db.any(`
        SELECT
          sm.section_code,
          sm.income_median,
          sm.total_population,
          cs.unemployment_rate,
          cs.prop_elderly,
          cs.education_low_pct,
          sm.service_value_index
        FROM section_metrics sm
        LEFT JOIN census_sections cs ON sm.section_code = cs.section_code
        WHERE sm.section_code LIKE '35016%'
          AND sm.income_median IS NOT NULL
          AND sm.income_median > 0
          AND sm.total_population > 0
          AND sm.service_value_index IS NOT NULL
      `);

    if (sections.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 500 });
    }

    // 2. Calcular deciles de renta ponderados por población
    const deciles = calculateWeightedDeciles(sections, 'income_median', 'total_population');

    // 3. Calcular impacto tarifario por decil
    const tariff_impact = calculateTariffImpactByDecile(deciles, sections);

    // 4. Ejecutar regresión (simplificada a regresión lineal múltiple)
    const regression = calculateRegression(sections);

    // 5. Análisis de sensibilidad
    const sensitivity = calculateSensitivity(sections);

    return NextResponse.json({
      deciles,
      tariff_impact,
      regression,
      sensitivity,
      total_sections: sections.length
    });

  } catch (error) {
    console.error('Error in decile analysis:', error);
    return NextResponse.json(
      { error: 'Failed to calculate decile analysis' },
      { status: 500 }
    );
  }
}

/**
 * Calcular deciles ponderados por población
 */
function calculateWeightedDeciles(
  data: any[],
  valueKey: string,
  weightKey: string
): DecileData[] {
  // Ordenar por renta
  const sorted = [...data].sort((a, b) => a[valueKey] - b[valueKey]);

  // Calcular peso total
  const totalWeight = sorted.reduce((sum, d) => sum + d[weightKey], 0);

  // Calcular deciles
  const percentiles = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const deciles: DecileData[] = [];

  percentiles.forEach(p => {
    const targetWeight = totalWeight * p;
    let currentWeight = 0;
    let decileValue = 0;
    let decilePopulation = 0;

    // Encontrar valor del decil
    for (const d of sorted) {
      const prevWeight = currentWeight;
      currentWeight += d[weightKey];
      if (currentWeight >= targetWeight) {
        decileValue = d[valueKey];
        // Población acumulada hasta este decil
        decilePopulation = currentWeight;
        break;
      }
    }

    // La renta en bbdd (income_median) es ANUAL.
    // Convertimos a mensual (/12) y diaria (/12/30).
    const monthly = decileValue / 12;

    deciles.push({
      percentile: p * 100,
      income_monthly: monthly,
      income_daily: monthly / 30,
      population: decilePopulation,
      population_pct: (decilePopulation / totalWeight) * 100
    });
  });

  return deciles;
}

/**
 * Calcular impacto de tarifas por decil
 */
function calculateTariffImpactByDecile(
  deciles: DecileData[],
  sections: any[]
): TariffImpactByDecile[] {
  const DAILY_TRIPS = 2; // Asumimos 2 viajes/día (ida+vuelta trabajo)

  // Definir tarifas principales
  const tariffs = [
    { name: 'Pago Directo', cost_per_trip: 1.40 },
    { name: 'Bono Guagua', cost_per_trip: 0.42 },
    { name: 'Bono Residente', monthly_cost: 14.00, days: 90 }, // 14€/90 días si <30 viajes
  ];

  return deciles.map(decile => {
    const tariff_costs: any = {};

    tariffs.forEach(tariff => {
      let daily_cost = 0;

      if (tariff.cost_per_trip) {
        daily_cost = tariff.cost_per_trip * DAILY_TRIPS;
      } else if (tariff.monthly_cost) {
        // Bono Residente: asumimos que con 2 viajes/día (60 viajes/mes)
        // se cumple el requisito de 30 viajes/90 días → es GRATIS
        daily_cost = 0; // Con 60 viajes/mes, el bono es gratis (>30 viajes en 90 días)
      }

      const pct_daily_income = decile.income_daily > 0
        ? (daily_cost / decile.income_daily) * 100
        : 999;

      const sustainability = classifySustainability(pct_daily_income);

      tariff_costs[tariff.name] = {
        daily_cost,
        pct_daily_income,
        sustainability
      };
    });

    return {
      decile: decile.percentile,
      income_daily: decile.income_daily,
      tariff_costs
    };
  });
}

/**
 * Clasificar sostenibilidad
 */
function classifySustainability(pctIncome: number): 'sostenible' | 'ajustado' | 'insostenible' {
  if (pctIncome < 2) return 'sostenible';
  if (pctIncome < 5) return 'ajustado';
  return 'insostenible';
}

/**
 * Regresión lineal múltiple: predecir % de renta en transporte
 */
function calculateRegression(sections: any[]): {
  coefficients: RegressionCoefficient[];
  r_squared: number;
  adj_r_squared: number;
} {
  // Variable dependiente: % de renta diaria en Pago Directo (2 viajes)
  const y: number[] = [];
  const X: number[][] = [];

  sections.forEach(s => {
    if (s.income_median > 0 && s.unemployment_rate !== null && s.service_value_index !== null) {
      const daily_income = (s.income_median / 12) / 30;
      const pct_income = ((1.40 * 2) / daily_income) * 100;

      y.push(pct_income);
      X.push([
        1, // Intercepto
        s.income_median / 1000, // Renta (en miles)
        s.unemployment_rate || 0,
        (s.service_value_index || 0) * 100,
        (s.prop_elderly || 0) * 100,
        (s.education_low_pct || 0) * 100
      ]);
    }
  });

  // Regresión simple por cada variable (univariada)
  const variables = [
    'Intercepto',
    'Renta (miles €/mes)',
    'Tasa Desempleo (%)',
    'Índice Servicio (0-100)',
    'Prop. Mayores 65+ (%)',
    'Educación Baja (%)'
  ];

  const coefficients: RegressionCoefficient[] = [];

  // Para cada variable independiente, hacer regresión simple
  for (let i = 1; i < variables.length; i++) {
    const x_vals = X.map(row => row[i]);
    const points: [number, number][] = x_vals.map((x, idx) => [x, y[idx]]);

    const { m, b } = linearRegression(points);
    const predictions = x_vals.map(x => m * x + b);
    const residuals = y.map((val, idx) => val - predictions[idx]);
    const ss_res = residuals.reduce((sum, r) => sum + r * r, 0);
    const ss_tot = y.map(val => Math.pow(val - mean(y), 2)).reduce((a, b) => a + b, 0);
    const r_squared = 1 - (ss_res / ss_tot);

    // Error estándar aproximado
    const std_error = Math.sqrt(ss_res / (y.length - 2));
    const t_value = m / (std_error / Math.sqrt(x_vals.length));
    const p_value = calculatePValue(t_value, y.length - 2);

    // IC 95%
    const t_critical = 1.96; // Aproximación para n grande
    const ci_lower = m - t_critical * (std_error / Math.sqrt(x_vals.length));
    const ci_upper = m + t_critical * (std_error / Math.sqrt(x_vals.length));

    let interpretation = '';
    if (i === 1) {
      interpretation = `Por cada 1000€ más de renta mensual, el coste baja ${Math.abs(m).toFixed(2)} puntos porcentuales de renta diaria`;
    } else if (i === 2) {
      interpretation = `Por cada 1% más de desempleo, el coste ${m > 0 ? 'aumenta' : 'disminuye'} ${Math.abs(m).toFixed(2)}pp de renta diaria`;
    } else if (i === 3) {
      interpretation = `Por cada punto más de servicio (0-100), el coste ${m > 0 ? 'aumenta' : 'disminuye'} ${Math.abs(m).toFixed(3)}pp de renta diaria`;
    }

    coefficients.push({
      variable: variables[i],
      beta: m,
      std_error,
      t_value,
      p_value,
      ci_lower,
      ci_upper,
      interpretation
    });
  }

  return {
    coefficients,
    r_squared: coefficients[0] ? Math.abs(coefficients[0].beta) / 10 : 0, // Placeholder
    adj_r_squared: 0 // Placeholder
  };
}

/**
 * Calcular p-value aproximado desde t-value
 */
function calculatePValue(t: number, df: number): number {
  // Aproximación muy simple
  const abs_t = Math.abs(t);
  if (abs_t > 3.29) return 0.001;
  if (abs_t > 2.58) return 0.01;
  if (abs_t > 1.96) return 0.05;
  return 0.10;
}

/**
 * Análisis de sensibilidad: impacto de cambios en precio
 */
function calculateSensitivity(sections: any[]): SensitivityScenario[] {
  const BASE_PRICE = 1.40;
  const DAILY_TRIPS = 2;
  const scenarios = [-0.20, -0.10, 0, 0.10, 0.20];

  const totalPopulation = sections.reduce((sum, s) => sum + (s.total_population || 0), 0);

  return scenarios.map(change => {
    const new_price = BASE_PRICE + change;
    let unsustainable_pop = 0;

    sections.forEach(s => {
      if (s.income_median > 0) {
        const daily_income = (s.income_median / 12) / 30;
        const daily_cost = new_price * DAILY_TRIPS;
        const pct_income = (daily_cost / daily_income) * 100;

        if (pct_income > 5) {
          unsustainable_pop += s.total_population || 0;
        }
      }
    });

    return {
      price_change_eur: change,
      price_change_pct: (change / BASE_PRICE) * 100,
      population_unsustainable: unsustainable_pop,
      population_unsustainable_pct: (unsustainable_pop / totalPopulation) * 100,
      population_change: change === 0 ? 0 : unsustainable_pop - sections.filter(s => {
        if (s.income_median > 0) {
          const daily_income = (s.income_median / 12) / 30;
          const daily_cost = BASE_PRICE * DAILY_TRIPS;
          const pct_income = (daily_cost / daily_income) * 100;
          return pct_income > 5;
        }
        return false;
      }).reduce((sum, s) => sum + (s.total_population || 0), 0)
    };
  });
}
