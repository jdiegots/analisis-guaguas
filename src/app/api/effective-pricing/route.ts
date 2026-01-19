import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';


/**
 * Effective Pricing Analysis API
 *
 * This endpoint calculates "effective price" - the real cost of transit
 * when accounting for service quality differences across the city.
 *
 * Key concept: Same nominal price, but different "product value"
 * - In well-served areas: High service_value_index → Low effective_price
 * - In poorly-served areas: Low service_value_index → High effective_price
 */

interface EffectivePricing {
  section_code: string;

  // Service metrics
  service_value_index: number;
  service_percentile: number;
  stop_time_events_all_day: number;
  unique_routes_all_day: number;
  coverage_300_area_pct: number;
  nearest_stop_meters: number;

  // Socioeconomic indicators
  unemployment_rate?: number;
  prop_elderly?: number;
  education_low_pct?: number;
  income_median?: number;
  total_population?: number;

  // Effective pricing (calculated for each tariff)
  effective_prices: {
    [tariffName: string]: {
      nominal_eur_per_trip: number;
      effective_eur_per_trip: number;
      observable_effective_eur_per_trip: number; // Using P90 as reference
      effective_monthly_40_trips: number;
      observable_effective_monthly_40_trips: number;
      affordability_pct_income?: number;
      observable_affordability_pct_income?: number;
    };
  };

  // Need vs Service gap (double punishment index)
  need_index?: number;
  service_gap?: number;
}

interface GeographicTaxStats {
  p10_service_value: number;
  p25_service_value: number;
  p50_service_value: number;
  p75_service_value: number;
  p90_service_value: number;
  p95_service_value: number;
  p99_service_value: number;
  max_service_value: number;

  // Geographic tax ratios
  tax_ratio_p90_p10: number;
  tax_ratio_p75_p25: number;

  // Effective price ranges for standard tariff
  nominal_price_standard: number;
  effective_price_p10: number;
  effective_price_p50: number;
  effective_price_p90: number;

  // Observable effective pricing (using P90 as reference)
  observable_reference_value: number; // P90 by default
  observable_effective_price_p10: number;
  observable_effective_price_p50: number;
  observable_effective_price_p90: number;
  observable_effective_price_max: number;

  // Double punishment stats
  high_need_low_service_count: number;
  avg_gap_vulnerable_areas: number;
}

export async function GET() {
  try {
    // Get all sections with service value and socioeconomic data
    const sections = await db.manyOrNone<EffectivePricing>(`
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

    // Define standard tariffs (nominal prices)
    // Define standard tariffs (nominal prices) based on PRECIOS.txt
    // For unlimited cards, we assume 40 trips per month for cost calculation
    const tariffs = [
      { name: 'Pago_Directo', eur_per_trip: 1.40, type: 'single' },
      { name: 'Bono_2', trips_included: 2, price: 2.40, eur_per_trip: 1.20, type: 'multi' },
      { name: 'Bono_Guagua', eur_per_trip: 0.42, type: 'rechargeable' },
      { name: 'Bono_Compartido', trips_included: 20, price: 8.50, eur_per_trip: 0.425, type: 'rechargeable' },
      { name: 'Bono_Estudiante', trips_included: 80, price: 14.00, eur_per_trip: 0.175, type: 'social' },
      { name: 'Bono_Jubilado', trips_included: 100, price: 0.00, eur_per_trip: 0.00, type: 'social' },
      { name: 'Bono_Familia_General', trips_included: 72, price: 10.00, eur_per_trip: 0.139, type: 'social' },
      { name: 'Bono_Familia_Especial', trips_included: 94, price: 10.00, eur_per_trip: 0.106, type: 'social' },
      { name: 'Bono_Solidario', trips_included: 40, price: 5.00, eur_per_trip: 0.125, type: 'social' },
      // Unlimited cards (90 days validity). Assumes 40 trips/month * 3 months = 120 trips per period
      // If condition met (>30 trips), it's free. We use the nominal price for the conservative calculation.
      { name: 'Wawa_Joven', price: 10.00, eur_per_trip: 10.00 / 120, type: 'unlimited', can_be_free: true },
      { name: 'Bono_Residente', price: 14.00, eur_per_trip: 14.00 / 120, type: 'unlimited', can_be_free: true },
      { name: 'Bono_Oro', price: 10.00, eur_per_trip: 10.00 / 120, type: 'unlimited', can_be_free: true },
      { name: 'Tarjeta_Turistica_1_Dia', price: 5.00, eur_per_trip: 5.00 / 6, type: 'tourist' }, // Assumes 6 trips/day
      { name: 'Tarjeta_Turistica_3_Dias', price: 12.00, eur_per_trip: 12.00 / 18, type: 'tourist' }, // Assumes 18 trips (6/day)
    ];

    // Calculate population-weighted percentiles for observable reference
    // Create array of {value, population} pairs, sorted by service value
    const weightedServiceValues = sections
      .filter(s => s.service_value_index > 0)
      .map(s => ({ value: s.service_value_index, pop: s.total_population || 100 }))
      .sort((a, b) => a.value - b.value);

    const totalPop = weightedServiceValues.reduce((sum, item) => sum + item.pop, 0) || 1;

    // Population-weighted percentile calculation
    const getWeightedPercentile = (items: Array<{value: number, pop: number}>, p: number) => {
      const targetPop = totalPop * p;
      let accumPop = 0;

      for (let i = 0; i < items.length; i++) {
        accumPop += items[i].pop;
        if (accumPop >= targetPop) {
          return items[i].value;
        }
      }
      return items[items.length - 1].value;
    };

    const p90_preliminary = getWeightedPercentile(weightedServiceValues, 0.90);
    const observableReference = p90_preliminary; // Use P90 as achievable standard

    // Calculate effective pricing for each section
    const sectionsWithPricing = sections.map(section => {
      const effective_prices: any = {};

      // Avoid division by zero
      const service_value = Math.max(section.service_value_index, 0.01);

      tariffs.forEach(tariff => {
        const nominal = tariff.eur_per_trip;

        // Standard effective price (nominal / service_value)
        const effective = nominal / service_value;
        const monthly_40 = effective * 40; // 40 trips/month = 2 trips/workday

        // Observable effective price (nominal * reference / service_value)
        const observable_effective = nominal * (observableReference / service_value);
        const observable_monthly_40 = observable_effective * 40;

        effective_prices[tariff.name] = {
          nominal_eur_per_trip: parseFloat(nominal.toFixed(3)),
          effective_eur_per_trip: parseFloat(effective.toFixed(3)),
          observable_effective_eur_per_trip: parseFloat(observable_effective.toFixed(3)),
          effective_monthly_40_trips: parseFloat(monthly_40.toFixed(2)),
          observable_effective_monthly_40_trips: parseFloat(observable_monthly_40.toFixed(2)),
          affordability_pct_income: section.income_median
            ? parseFloat(((monthly_40 / section.income_median) * 100).toFixed(2))
            : undefined,
          observable_affordability_pct_income: section.income_median
            ? parseFloat(((observable_monthly_40 / section.income_median) * 100).toFixed(2))
            : undefined,
        };
      });

      // Calculate need index (0-1, higher = more vulnerable)
      const need_components = [
        section.unemployment_rate || 0,
        section.prop_elderly || 0,
        section.education_low_pct || 0,
        section.income_median ? (1 - Math.min(section.income_median / 30000, 1)) : 0.5, // Normalize income
      ];
      const need_index = need_components.reduce((a, b) => a + b, 0) / need_components.length;

      // Service gap = need - service (positive = double punishment)
      const service_gap = need_index - service_value;

      return {
        ...section,
        effective_prices,
        need_index: parseFloat(need_index.toFixed(3)),
        service_gap: parseFloat(service_gap.toFixed(3)),
      };
    });

    // Calculate all population-weighted percentiles for geographic tax statistics
    const p10 = getWeightedPercentile(weightedServiceValues, 0.10);
    const p25 = getWeightedPercentile(weightedServiceValues, 0.25);
    const p50 = getWeightedPercentile(weightedServiceValues, 0.50);
    const p75 = getWeightedPercentile(weightedServiceValues, 0.75);
    const p90 = p90_preliminary; // Already calculated
    const p95 = getWeightedPercentile(weightedServiceValues, 0.95);
    const p99 = getWeightedPercentile(weightedServiceValues, 0.99);
    const max_service = weightedServiceValues[weightedServiceValues.length - 1].value;

    // Standard tariff (Billete Simple)
    const nominalStandard = 1.40;

    const geographicTax: GeographicTaxStats = {
      p10_service_value: parseFloat(p10.toFixed(3)),
      p25_service_value: parseFloat(p25.toFixed(3)),
      p50_service_value: parseFloat(p50.toFixed(3)),
      p75_service_value: parseFloat(p75.toFixed(3)),
      p90_service_value: parseFloat(p90.toFixed(3)),
      p95_service_value: parseFloat(p95.toFixed(3)),
      p99_service_value: parseFloat(p99.toFixed(3)),
      max_service_value: parseFloat(max_service.toFixed(3)),

      // Tax ratios (how many times more expensive for worst vs best)
      tax_ratio_p90_p10: parseFloat(((nominalStandard / p10) / (nominalStandard / p90)).toFixed(2)),
      tax_ratio_p75_p25: parseFloat(((nominalStandard / p25) / (nominalStandard / p75)).toFixed(2)),

      // Effective price distribution (standard: nominal / service_value)
      nominal_price_standard: nominalStandard,
      effective_price_p10: parseFloat((nominalStandard / p10).toFixed(3)),
      effective_price_p50: parseFloat((nominalStandard / p50).toFixed(3)),
      effective_price_p90: parseFloat((nominalStandard / p90).toFixed(3)),

      // Observable effective pricing (using P90 as reference)
      observable_reference_value: parseFloat(observableReference.toFixed(3)),
      observable_effective_price_p10: parseFloat((nominalStandard * (observableReference / p10)).toFixed(3)),
      observable_effective_price_p50: parseFloat((nominalStandard * (observableReference / p50)).toFixed(3)),
      observable_effective_price_p90: parseFloat((nominalStandard * (observableReference / p90)).toFixed(3)), // Should equal nominal
      observable_effective_price_max: parseFloat((nominalStandard * (observableReference / max_service)).toFixed(3)),

      // Double punishment (high need + low service)
      high_need_low_service_count: sectionsWithPricing.filter(
        s => s.need_index && s.need_index > 0.5 && s.service_gap && s.service_gap > 0.1
      ).length,

      avg_gap_vulnerable_areas: parseFloat(
        (sectionsWithPricing
          .filter(s => s.need_index && s.need_index > 0.5)
          .reduce((sum, s) => sum + (s.service_gap || 0), 0) /
          sectionsWithPricing.filter(s => s.need_index && s.need_index > 0.5).length
        ).toFixed(3)
      ) || 0,
    };

    return NextResponse.json({
      sections: sectionsWithPricing,
      geographic_tax: geographicTax,
      tariffs: tariffs,
    });

  } catch (error) {
    console.error('Error fetching effective pricing:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}
