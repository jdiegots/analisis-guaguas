'use client';

import { useState, useEffect, useMemo } from 'react';
import './tarifas.css';
import './tarifas-extra.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import LoginForm from '@/components/LoginForm';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Fare {
  id: number;
  name: string;
  description: string;
  price_eur: number;
  validity_days: number;
  max_trips: number;
  is_social_fare: boolean;
  requirements: string;
  cost_per_trip?: number;
}

interface EffectivePriceData {
  sections: any[];
  geographic_tax: {
    p10_service_value: number;
    p25_service_value: number;
    p50_service_value: number;
    p75_service_value: number;
    p90_service_value: number;
    max_service_value: number; // Added
    observable_reference_value: number; // Added
    tax_ratio_p90_p10: number;
    tax_ratio_p75_p25: number;
    nominal_price_standard: number;
    effective_price_p10: number;
    effective_price_p50: number;
    effective_price_p90: number;
    observable_effective_price_p10: number; // Added
    observable_effective_price_p50: number; // Added
    observable_effective_price_p90: number; // Added
    observable_effective_price_max: number; // Added
    high_need_low_service_count: number;
    avg_gap_vulnerable_areas: number;
  };
  tariffs: any[];
}

interface FareAnalysisStats {
  summary: {
    total_sections: number;
    avg_unemployment: number;
    avg_elderly: number;
    avg_low_education: number;
  };
  contrasts: Array<{
    key: string;
    thresholds: {
      p25: number;
      p75: number;
    };
    sections: {
      high: number;
      low: number;
    };
    averages: {
      high_coverage_300: number;
      low_coverage_300: number;
      high_freq_day: number;
      low_freq_day: number;
      high_stops_density: number;
      low_stops_density: number;
    };
    gaps: {
      coverage_300: number;
      freq_day: number;
      stops_density: number;
    };
    correlations: {
      coverage_300: number;
      freq_day: number;
      stops_density: number;
    };
  }>;
}

interface CorrelationResult {
  var_x: string;
  var_x_label: string;
  var_y: string;
  var_y_label: string;
  n: number;
  r: number;
  r2: number;
  p_value: number;
  interpretation: string;
  political_message: string;
  strength: 'very_strong' | 'strong' | 'moderate' | 'weak' | 'very_weak';
}

interface RegressionModel {
  dependent: string;
  dependent_label: string;
  independents: string[];
  independent_labels: string[];
  r2: number;
  adj_r2: number;
  coefficients: { [key: string]: number };
  interpretation: string;
  political_message: string;
}

interface CorrelationsData {
  correlations: CorrelationResult[];
  regression_model: RegressionModel | null;
  summary: {
    total_sections: number;
    significant_correlations: number;
    strong_correlations: number;
  };
}

interface TouristIncomeData {
  total_tourists: number;
  avg_stay_days: number;
  income_brackets: Array<{
    range: string;
    midpoint: number;
    stayDays: number;
  }>;
  estimated_median_annual: number;
  estimated_median_monthly: number;
  weighted_median_income_per_consumption_unit: number;
  income_per_consumption_by_type: {
    [key: string]: number;
  };
  composition: {
    [key: string]: {
      count: number;
      pct: number;
    };
  };
  consumption_factors: {
    [key: string]: number;
  };
  tourist_passes: {
    bono_1day: {
      price: number;
      days: number;
      cost_per_day_avg_stay: number;
      pct_daily_income: number;
    };
    bono_3days: {
      price: number;
      days: number;
      cost_per_day_avg_stay: number;
      pct_daily_income: number;
    };
  };
}

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

interface DecileAnalysisData {
  deciles: DecileData[];
  tariff_impact: TariffImpactByDecile[];
  regression: {
    coefficients: RegressionCoefficient[];
    r_squared: number;
    adj_r_squared: number;
  };
  sensitivity: SensitivityScenario[];
  total_sections: number;
}

export default function AnalisisTarifas() {
  const [fares, setFares] = useState<Fare[]>([]);
  const [stats, setStats] = useState<FareAnalysisStats | null>(null);
  const [effectiveData, setEffectiveData] = useState<EffectivePriceData | null>(null);
  const [correlationsData, setCorrelationsData] = useState<CorrelationsData | null>(null);
  const [touristData, setTouristData] = useState<TouristIncomeData | null>(null);
  const [decileData, setDecileData] = useState<DecileAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTariff, setSelectedTariff] = useState('Pago_Directo');

  // State for Custom Weights (Create your own index feature)
  // These weights are used to recalculate the Service Value Index dynamically
  const [customWeights, setCustomWeights] = useState({
    frequency: 0.35,
    connectivity: 0.25,
    coverage: 0.25,
    proximity: 0.15
  });

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [showAllFares, setShowAllFares] = useState(false);
  // State for Section 2 Comparador de Tarifas
  const [rentabilityScenario, setRentabilityScenario] = useState<{ trips: number }>({ trips: 60 });
  const [rentabilityTouristScenario, setRentabilityTouristScenario] = useState<{ tripsPerDay: number }>({ tripsPerDay: 6 });
  const [selectedTariffForExplanation, setSelectedTariffForExplanation] = useState<string>('Residente_Canario');

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/check');
      const data = await response.json();
      setIsAuthenticated(data.isAuthenticated);
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };




  // Function to perform multiple linear regression


  // Hardcoded logic for tariffs to ensure "defensible" calculation
  // independent of API "eur_per_trip" which might be static.
  const calculateNominalCost = (tariffName: string, tripsMonth: number, tripsDay: number) => {
    // Normalization: remove underscores, lowercase, remove accents
    const normalize = (s: string) => s.replace(/_/g, ' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const name = normalize(tariffName);

    // 1. Per Trip Tariffs (Fixed cost)
    if (name === 'pago directo') return 1.40;
    if (name === 'bono-2' || name === 'bono 2') return 1.20;
    if (name.includes('bono guagua') && !name.includes('bonificado') && !name.includes('compartido')) return 0.85;
    if (name.includes('bono guagua') && name.includes('bonificado')) return 0.42;

    // 2. Monthly Flat Rates with Free Condition (30 trips in 90 days)
    // For Wawa Joven, Bono Residente, and Bono Oro:
    // - If user does >= 10 trips/month (>= 30 trips in 90 days), future recharges are FREE
    // - We model this as: initial cost amortized over a long period (e.g., 12 months)
    // - This reflects that after the first paid recharge, subsequent ones are free
    const tMonth = Math.max(tripsMonth, 1);
    const tripsIn90Days = tMonth * 3; // trips in 90 days
    const qualifiesForFree = tripsIn90Days >= 30; // meets the 30 trips condition

    // Wawa Joven: 10€/90 days
    if (name.includes('wawa')) {
      if (qualifiesForFree) {
        // User qualifies for free recharges after first payment
        // Amortize initial 10€ over 12 months (4 recharges) of use
        // This gives a very low cost per trip that reflects long-term free use
        const totalTripsOver12Months = tMonth * 12;
        return 10.00 / totalTripsOver12Months;
      } else {
        // User doesn't qualify for free recharges, pays 10€ every 90 days
        return 10.00 / tMonth;
      }
    }

    // Bono Residente: 14€/90 days
    if (name.includes('residente') || name.includes('residencia')) {
      if (qualifiesForFree) {
        // User qualifies for free recharges after first payment
        // Amortize initial 14€ over 12 months (4 recharges) of use
        const totalTripsOver12Months = tMonth * 12;
        return 14.00 / totalTripsOver12Months;
      } else {
        // User doesn't qualify for free recharges, pays 14€ every 90 days
        return 14.00 / tMonth;
      }
    }

    // Bono Oro: 10€/90 days
    if (name.includes('bono oro')) {
      if (qualifiesForFree) {
        // User qualifies for free recharges after first payment
        // Amortize initial 10€ over 12 months (4 recharges) of use
        const totalTripsOver12Months = tMonth * 12;
        return 10.00 / totalTripsOver12Months;
      } else {
        // User doesn't qualify for free recharges, pays 10€ every 90 days
        return 10.00 / tMonth;
      }
    }

    // Other monthly flat rates (no free condition)
    if (name.includes('solidario')) return 5.00 / tMonth;
    if (name.includes('estudiante')) return 14.00 / tMonth;
    if (name.includes('fam') && name.includes('num')) return 10.00 / tMonth;

    // 3. Tourist / Daily Flat Rates (Cost = Price / (TripsDay * Days))
    // CRITICAL: This MUST use tripsDay, NOT tripsMonth.
    const tDay = Math.max(tripsDay, 1);
    // "tarjeta 1 dia"
    if (name.includes('tarjeta') && name.includes('1') && (name.includes('dia') || name.includes('day'))) return 5.00 / (tDay * 1);
    // "tarjeta 3 dias"
    if (name.includes('tarjeta') && name.includes('3') && (name.includes('dia') || name.includes('day'))) return 12.00 / (tDay * 3);

    // Default fallback from API if available, else 1.40
    const tariffData = tariffs?.find(t => normalize(t.name) === name);
    return tariffData?.eur_per_trip || 1.40;
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  async function loadData() {
    try {
      const [fareRes, statsRes, effectiveRes, correlationsRes, touristRes, decileRes] = await Promise.all([
        fetch('/api/fares'),
        fetch('/api/fare-analysis'),
        fetch('/api/effective-pricing'),
        fetch('/api/correlations'),
        fetch('/api/tourist-income'),
        fetch('/api/decile-analysis'),
      ]);

      const fareData = await fareRes.json();
      const statsData = await statsRes.json();
      const effectiveJson = effectiveRes.ok ? await effectiveRes.json() : null;
      const correlationsJson = correlationsRes.ok ? await correlationsRes.json() : null;
      const touristJson = touristRes.ok ? await touristRes.json() : null;
      const decileJson = decileRes.ok ? await decileRes.json() : null;

      setFares(fareData);
      setStats(statsData);
      setEffectiveData(effectiveJson);
      setCorrelationsData(correlationsJson);
      setTouristData(touristJson);
      setDecileData(decileJson);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }


  // Helper function to calculate effective data based on weights
  const calculateEffectiveData = (baseData: any, weights: any) => {
    if (!baseData || !baseData.sections) {
      return baseData;
    }

    // Always recalculate to ensure observable fields exist
    // clone data to avoid mutating original
    const newSections = baseData.sections.map((s: any) => ({ ...s }));
    const originalTax = baseData.geographic_tax;

    // 1. Calculate raw metrics for all sections (per capita if possible)
    const hasPopulation = newSections.some((s: any) => (s.total_population || 0) > 0);

    const metrics = newSections.map((s: any) => {
      const pop = s.total_population || 0;
      return {
        events: hasPopulation ? (pop > 0 ? ((s.stop_time_events_all_day || 0) / pop) * 1000 : 0) : (s.stop_time_events_all_day || 0),
        routes: hasPopulation ? (pop > 0 ? ((s.unique_routes_all_day || 0) / pop) * 10000 : 0) : (s.unique_routes_all_day || 0),
        coverage: s.coverage_300_area_pct || 0,
        distance: s.nearest_stop_meters || 0
      };
    });

    // 2. Calculate thresholds (P10, P90)
    const getP = (values: number[], p: number) => {
      const sorted = [...values].sort((a, b) => a - b);
      const idx = Math.ceil(sorted.length * p) - 1;
      return sorted[Math.max(0, idx)];
    };

    const eventsArr = metrics.map((m: any) => m.events);
    const routesArr = metrics.map((m: any) => m.routes);
    const covArr = metrics.map((m: any) => m.coverage);
    const distArr = metrics.map((m: any) => m.distance);

    const stats = {
      events: { p10: getP(eventsArr, 0.1), p90: getP(eventsArr, 0.9) },
      routes: { p10: getP(routesArr, 0.1), p90: getP(routesArr, 0.9) },
      cov: { p10: getP(covArr, 0.1), p90: getP(covArr, 0.9) },
      dist: { p10: getP(distArr, 0.1), p90: getP(distArr, 0.9) }
    };

    const ranges = {
      events: (stats.events.p90 - stats.events.p10) || 1,
      routes: (stats.routes.p90 - stats.routes.p10) || 1,
      cov: (stats.cov.p90 - stats.cov.p10) || 1,
      dist: (stats.dist.p90 - stats.dist.p10) || 1
    };

    // 3. Recalculate Service Value Index
    newSections.forEach((s: any, idx: number) => {
      const m = metrics[idx];

      const normEvents = m.events <= stats.events.p10 ? 0 : (m.events >= stats.events.p90 ? 1 : (m.events - stats.events.p10) / ranges.events);
      const normRoutes = m.routes <= stats.routes.p10 ? 0 : (m.routes >= stats.routes.p90 ? 1 : (m.routes - stats.routes.p10) / ranges.routes);
      const normCov = m.coverage <= stats.cov.p10 ? 0 : (m.coverage >= stats.cov.p90 ? 1 : (m.coverage - stats.cov.p10) / ranges.cov);

      // Distance is inverted: Closer (<= p10) is Better (1.0)
      const normDist = m.distance >= stats.dist.p90 ? 0 : (m.distance <= stats.dist.p10 ? 1 : 1 - ((m.distance - stats.dist.p10) / ranges.dist));

      // Calculate Weighted Index
      let newIndex =
        (normEvents * weights.frequency) +
        (normRoutes * weights.connectivity) +
        (normCov * weights.coverage) +
        (normDist * weights.proximity);

      const totalWeight = weights.frequency + weights.connectivity + weights.coverage + weights.proximity;
      if (totalWeight > 0) newIndex = newIndex / totalWeight;

      s.service_value_index = newIndex;
    });

    // 4. Update Distributions (P10, P50, P90 of Service Value)
    const sortedSections = [...newSections].sort((a: any, b: any) => a.service_value_index - b.service_value_index);
    const totalPop = sortedSections.reduce((sum: number, s: any) => sum + (s.total_population || 100), 0);

    // Population Weighted (Social Reality - used for Chart/People)
    const getWeightedP = (pct: number) => {
      let accum = 0;
      const target = totalPop * pct;
      for (const s of sortedSections) {
        accum += (s.total_population || 100);
        if (accum >= target) return s.service_value_index;
      }
      return sortedSections[sortedSections.length - 1].service_value_index;
    };

    // Unweighted (Territorial Reality - used for Summary Cards/Infrastructure)
    const getUnweightedP = (pct: number) => {
      const idx = Math.floor(sortedSections.length * pct);
      return sortedSections[Math.min(idx, sortedSections.length - 1)].service_value_index;
    };

    // We use UNWEIGHTED (Territorial) for the "Geographic Tax" cards to show the structural deficit of the city layout
    const p10_sv = getUnweightedP(0.1);
    const p25_sv = getUnweightedP(0.25);
    const p50_sv = getUnweightedP(0.50);
    const p75_sv = getUnweightedP(0.75);
    const p90_sv = getUnweightedP(0.9);
    const max_sv = sortedSections[sortedSections.length - 1].service_value_index;

    // 5. Update Effective Prices
    const observableReference = p90_sv;
    const nominalStandard = 1.40;

    newSections.forEach((s: any) => {
      const sv = Math.max(s.service_value_index, 0.01);

      const newPrices: any = {};
      baseData.tariffs.forEach((t: any) => {
        const nominal = t.eur_per_trip;
        const effective = nominal / sv;
        const observable = nominal * (observableReference / sv);
        newPrices[t.name] = {
          ...s.effective_prices[t.name],
          effective_eur_per_trip: effective,
          observable_effective_eur_per_trip: observable,
        };
      });
      s.effective_prices = newPrices;

      if (s.need_index !== undefined) {
        s.service_gap = s.need_index - s.service_value_index;
      }
    });

    // 6. Update Geographic Tax Stats (Using Territorial/Unweighted values)
    const getRatio = (high: number, low: number) => {
      const costHigh = nominalStandard / high;
      const costLow = nominalStandard / low;
      return costLow / (costHigh || 1);
    }

    const newGeoTax = {
      ...originalTax,
      p10_service_value: p10_sv,
      p25_service_value: p25_sv,
      p50_service_value: p50_sv,
      p75_service_value: p75_sv,
      p90_service_value: p90_sv,
      max_service_value: max_sv,
      observable_reference_value: observableReference,

      tax_ratio_p90_p10: getRatio(p90_sv, p10_sv),

      // Effective Prices (Territorial)
      effective_price_p10: nominalStandard / p10_sv,
      effective_price_p50: nominalStandard / p50_sv,
      effective_price_p90: nominalStandard / p90_sv,

      // Observable Effective Prices (Territorial)
      observable_effective_price_p10: nominalStandard * (observableReference / p10_sv),
      observable_effective_price_p50: nominalStandard * (observableReference / p50_sv),
      observable_effective_price_p90: nominalStandard * (observableReference / p90_sv),
      observable_effective_price_max: nominalStandard * (observableReference / max_sv),
    };

    return {
      ...baseData,
      sections: newSections,
      geographic_tax: newGeoTax
    };
  };

  const staticDisplayData = useMemo(() => {
    return calculateEffectiveData(effectiveData, { frequency: 0.35, connectivity: 0.25, coverage: 0.25, proximity: 0.15 });
  }, [effectiveData]);

  const customDisplayData = useMemo(() => {
    return calculateEffectiveData(effectiveData, customWeights);
  }, [effectiveData, customWeights]);


  if (isAuthChecking) {
    return <div className="loading">Verificando acceso...</div>;
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (loading) {
    return <div className="loading">Cargando analisis...</div>;
  }

  if (!effectiveData || !effectiveData.tariffs || !effectiveData.sections) {
    return (
      <div className="analisis-container">
        <header className="analisis-header">
          <h1>Analisis de Precio Efectivo</h1>
          <div className="header-links">
            <a href="/datos-secciones" className="data-link">Tabla de Datos</a>
            <a href="/" className="back-link">Volver al Mapa</a>
          </div>
        </header>
        <div className="content">
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <h2 style={{ color: '#e74c3c', marginBottom: '20px' }}>⚠️ Indices de Servicio No Calculados</h2>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '20px' }}>
              Para ver el analisis de precio efectivo, primero debes calcular los indices de valor del servicio.
            </p>
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '15px' }}>Pasos a seguir:</h3>
              <ol style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
                <li style={{ marginBottom: '10px' }}>
                  Asegurate de tener datos de poblacion importados:
                  <pre style={{ background: '#2c3e50', color: '#ecf0f1', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
                    node scripts/import-political-indicators.js
                  </pre>
                </li>
                <li style={{ marginBottom: '10px' }}>
                  Calcula los indices de valor del servicio:
                  <pre style={{ background: '#2c3e50', color: '#ecf0f1', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
                    npm run build:service-value
                  </pre>
                </li>
                <li>
                  Recarga esta pagina
                </li>
              </ol>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Este proceso toma aproximadamente 5-10 segundos y solo necesitas hacerlo una vez
              (o cuando actualices los datos de GTFS/censo).
            </p>
          </div>
        </div>
      </div>
    );
  }








  const { geographic_tax, sections, tariffs } = staticDisplayData || effectiveData || {};
  const { sections: customSections } = customDisplayData || effectiveData || {};


  // Calculate statistics
  const avgCostGeneral = fares
    .filter(f => !f.is_social_fare && f.cost_per_trip)
    .reduce((sum, f) => sum + (f.cost_per_trip || 0), 0) /
    (fares.filter(f => !f.is_social_fare && f.cost_per_trip).length || 1);

  const avgCostSocial = fares
    .filter(f => f.is_social_fare && f.cost_per_trip)
    .reduce((sum, f) => sum + (f.cost_per_trip || 0), 0) /
    (fares.filter(f => f.is_social_fare && f.cost_per_trip).length || 1);

  const bonoSolidario = fares.find(f => f.name.includes('Bono Solidario') && !f.name.includes('Compartido'));
  const unemploymentContrast = stats?.contrasts.find(c => c.key === 'unemployment');

  // Helper to calculate population-weighted percentile
  const calculateWeightedPercentile = (data: any[], percentile: number, valueKey: string = 'income_median', weightKey: string = 'total_population') => {
    const valid = data
      .filter(d => (d[valueKey] || 0) > 0 && (d[weightKey] || 0) > 0)
      .sort((a, b) => (a[valueKey] || 0) - (b[valueKey] || 0));

    if (valid.length === 0) return 0;

    const totalWeight = valid.reduce((sum, d) => sum + (d[weightKey] || 0), 0);
    const targetWeight = totalWeight * percentile;

    let currentWeight = 0;
    for (const d of valid) {
      currentWeight += (d[weightKey] || 0);
      if (currentWeight >= targetWeight) {
        return (d[valueKey] || 0) / 12; // Monthly
      }
    }
    return (valid[valid.length - 1][valueKey] || 0) / 12;
  };

  // Effective pricing calculations
  const getTariffStats = (tariffName: string, sectionsList: any[]) => {
    const data = tariffs.find(t => t.name === tariffName);
    const nominal = data?.eur_per_trip || 1.40;

    const validItems = sectionsList
      .filter(s => s.effective_prices[tariffName]?.effective_eur_per_trip !== undefined)
      .map(s => ({
        eff: s.effective_prices[tariffName].effective_eur_per_trip,
        obs: s.effective_prices[tariffName].observable_effective_eur_per_trip,
        pop: s.total_population || 100
      }));

    const totalPop = validItems.reduce((acc, item) => acc + item.pop, 0);

    const getWP = (key: 'eff' | 'obs', pct: number) => {
      if (validItems.length === 0) return 0;
      const sorted = [...validItems].sort((a, b) => (a[key] || 0) - (b[key] || 0));
      let accum = 0;
      const target = totalPop * pct;
      for (const item of sorted) {
        accum += item.pop;
        if (accum >= target) return item[key];
      }
      return sorted[sorted.length - 1][key];
    };

    const p10 = getWP('eff', 0.1);
    const p50 = getWP('eff', 0.5);
    const p90 = getWP('eff', 0.9);
    const obsP10 = getWP('obs', 0.1);
    const obsP50 = getWP('obs', 0.5);
    const obsP90 = getWP('obs', 0.9);

    return {
      name: tariffName,
      nominal,
      p10,
      p50,
      p90,
      obsP10,
      obsP50,
      obsP90,
      ratio: (p90 || 0) / (p10 || 1),
      capacity10: nominal > 0 ? (10 / nominal) : 999
    };
  };

  // Static stats for global page logic
  const t1Stats = getTariffStats(selectedTariff, sections);

  // Custom stats for the specific interactive block
  // Fallback to static sections if customSections not ready
  const t1StatsCustom = getTariffStats(selectedTariff, customSections || sections);

  const nominalPrice = t1Stats.nominal;
  const effectiveP10 = t1Stats.p10; // Static
  const effectiveP50 = t1Stats.p50; // Static
  const effectiveP90 = t1Stats.p90; // Static
  const observableP10 = t1Stats.obsP10; // Static - Population weighted
  const observableP50 = t1Stats.obsP50; // Static - Population weighted
  const observableP90 = t1Stats.obsP90; // Static - Population weighted
  const geographicTaxRatio = t1Stats.ratio; // Static

  // Custom variables for the dynamic stats block
  const customEffectiveP10 = t1StatsCustom.p10;
  const customEffectiveP50 = t1StatsCustom.p50;
  const customEffectiveP90 = t1StatsCustom.p90;
  const customObservableP10 = t1StatsCustom.obsP10;
  const customObservableP50 = t1StatsCustom.obsP50;
  const customObservableP90 = t1StatsCustom.obsP90;

  const doublePunishmentSections = sections.filter(
    s => s.need_index > 0.5 && s.service_gap > 0.1
  );

  const bonoSolidarioEffective = (sections || [])
    .filter(s => s.effective_prices && s.effective_prices['Bono_Solidario'])
    .map(s => {
      const nominal = s.effective_prices['Bono_Solidario']?.nominal_eur_per_trip || 0;
      const effSol = s.effective_prices['Bono_Solidario']?.effective_eur_per_trip || 0;
      const effDir = s.effective_prices['Pago_Directo']?.effective_eur_per_trip || 1;
      return {
        ...s,
        discount_pct: nominalPrice ? ((nominalPrice - nominal) / nominalPrice) * 100 : 0,
        effective_benefit: effDir ? ((effDir - effSol) / effDir) * 100 : 0
      };
    });

  const avgDiscountNominal = 0;
  const avgEffectiveBenefit = 0;

  return (
    <div className="analisis-container">
      <header className="analisis-header">
        <h1>Análisis</h1>
        <p>Guaguas Municipales</p>
        <div className="header-links">
          <a href="/" className="back-link" style={{ background: '#3498db' }}>Volver al Mapa</a>

        </div>
      </header>

      <div className="content">

        {/* SCOPE AND LIMITATIONS */}
        <section className="card" style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', border: 'none' }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '1.5rem', borderBottom: '3px solid #3498db', paddingBottom: '10px' }}>
              Alcance y límites del análisis
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div style={{ background: '#e8f4f8', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #3498db' }}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1.1rem', color: '#2c3e50' }}>
                  Alcance
                </h3>
                <ul style={{ marginBottom: 0, paddingLeft: '20px', lineHeight: '1.7' }}>
                  <li><strong>Precio efectivo por unidad de servicio:</strong> Cuánto cuesta realmente el transporte ajustado por el nivel de servicio estructural recibido.</li>
                  <li><strong>Desigualdad territorial:</strong> Diferencias sistemáticas en el nivel de servicio estructural según la zona geográfica.</li>
                  <li><strong>Asequibilidad por deciles de renta:</strong> Impacto económico de las tarifas según el nivel de ingresos de los hogares.</li>
                  <li><strong>Doble castigo:</strong> Zonas donde coinciden alta vulnerabilidad social y bajo nivel de servicio.</li>
                  <li><strong>Equidad turistas-residentes:</strong> Comparación de asequibilidad entre visitantes y población local.</li>
                </ul>
              </div>

              <div style={{ background: '#fee', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #e74c3c' }}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1.1rem', color: '#2c3e50' }}>
                  Limitaciones
                </h3>
                <ul style={{ marginBottom: 0, paddingLeft: '20px', lineHeight: '1.7' }}>
                  <li><strong>Costes operativos reales:</strong> No se evalúan si las tarifas cubren los costes del servicio ni la sostenibilidad financiera.</li>
                  <li><strong>Alternativas de transporte:</strong> No se considera la disponibilidad de coche privado, moto, bici, o movilidad a pie.</li>
                  <li><strong>Patrones de movilidad real:</strong> No se analizan datos de validaciones, viajes origen-destino, ni comportamiento de usuarios.</li>
                  <li><strong>Tráfico y aforo completo:</strong> No se considera el impacto del tráfico y el aforo.</li>
                </ul>
              </div>
            </div>

            <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #f39c12' }}>
              <p style={{ marginBottom: '8px', lineHeight: '1.7', color: '#555' }}>
                El fin de este análisis es intentar explicar que en Las Palmas de Gran Canaria <strong>el transporte público se cobra como si fuera el mismo para todos, pero se entrega como productos distintos según el barrio.</strong>
                <br />
                <br />
                <strong>El precio es el que pagas:</strong> un billete, un bono, una tarifa plana. <strong>El servicio tiene dos partes.</strong> Una es lo que la red declara ofrecer por diseño: frecuencia,
                líneas, cobertura y acceso a paradas. La otra es lo que ocurre en la calle: puntualidad, regularidad y si puedes subir o vas con aforo completo. Este análisis
                mide la primera parte, <strong>porque es la única que puede reconstruirse con datos públicos granulares hoy.</strong>
                <br />
                <br />
                Cuando se juntan <i>precio</i> y <i>nivel de servicio estructural ofrecido</i>, no es solo que haya barrios con peor transporte; es que <strong>esos barrios están pagando
                  el mismo precio por una utilidad mucho menor.</strong> Eso es lo que voy a llamar <i>"impuesto" geográfico</i>: <strong>una penalización económica invisible asociada a vivir en una
                    zona mal conectada.</strong>
                <br />
                <br />
                El <i>índice de valor del servicio</i> se construye con variables que buscan describir la libertad real de movimiento (frecuencia, conectividad, cobertura y proximidad),
                para contestar a una pregunta concreta: <i><b>¿cuánta movilidad me diseñó este sistema en este punto de la ciudad?</b></i> Si en un barrio el índice da calidad de servicio
                es alto, <strong>tu euro compra un mejor diseño de movilidad</strong> que en un barrio donde el índice de valor del servicio es bajo, donde hay una movilidad más pobre, más limitada, más dependiente de
                horarios y, por tanto, más frágil.
                <br />
                <br />
                <strong>La desigualdad existe por diseño</strong> incluso antes de hablar de retrasos, saturación o mala gestión. Aunque el sistema funcionara perfecto, la propia distribución de la oferta ya crea
                un mapa de ganadores y perdedores. Las tarifas sociales pueden reducir el precio, pero no corrigen la causa. Un bono barato en una zona donde pasa una guagua cada hora sigue siendo una
                mala solución para la movilidad. <strong>Bajar el precio ayuda, pero no reemplaza el servicio.</strong> Aunque el vehículo vaya vacío y "a su hora", si pasa cada 40-60 minutos y te obliga a transbordar o
                a dar rodeos, tu libertad de movimiento sigue siendo baja. Un retraso de 10 minutos en una línea cada 8 minutos se amortigua; <strong>en una línea cada 45 destroza el viaje.</strong>
                <br />
                <br />
                La diferencia del <i>precio efectivo</i> no afirma que el usuario <i>viva</i> exactamente esos costes, sino que cuantifica el <b>sobrecoste estructural mínimo</b> asociado
                a la oferta. La capa operativa (ocupación, puntualidad, regularidad real) puede amortiguar o empeorar ese mínimo. Y, en un sistema tensionado, lo que es habitual es que la operación empeore
                justo donde hay más demanda, pero eso no convierte automáticamente a los barrios peores conectados en "mejor servicio". Lo que convierte es a los barrios <i><s>mejor</s></i> conectados en servicios
                más incómodos, <strong>mientras que los barrios peor conectados siguen teniendo menos opciones y menos frecuencia.</strong>
                <br />
                <br />
                Este análisis se centra exclusivamente en <strong>medir la equidad territorial y económica</strong> del sistema tarifario actual.
                Se evalúa si el precio que pagan los ciudadanos es proporcional al servicio que el sistema declara ofrecer, y cómo esta relación varía según:
              </p>
              <ul style={{ marginBottom: 0, paddingLeft: '20px', lineHeight: '1.7', color: '#555' }}>
                <li>La <strong>ubicación geográfica</strong> (nivel de servicio estructural del servicio por zona)</li>
                <li>El <strong>nivel de renta</strong> de los hogares (capacidad de pago)</li>
                <li>La <strong>vulnerabilidad social</strong> (desempleo, edad, educación)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* EXECUTIVE SUMMARY */}
        <section className="executive-summary">
          {/* <h2>Resumen Ejecutivo: El Precio Real del Transporte</h2> -> REMOVED per user request */}
          <div className="summary-grid">
            <div className="summary-fact critical">
              <div className="fact-number">x {geographicTaxRatio.toFixed(1)}</div>
              <div className="fact-label">Impuesto geográfico</div>
              <div className="fact-detail" style={{ color: '#333' }}>
                El mismo billete cuesta {geographicTaxRatio.toFixed(1)} veces mas (por <span className="term-tooltip dark-text" data-tooltip="Medida compuesta que integra la frecuencia, diversidad de rutas, cobertura espacial y cercanía a paradas. Representa el nivel de servicio estructural del producto.">unidad de servicio</span>)
                en <span className="term-tooltip dark-text" data-tooltip="Zonas con índice de valor del servicio inferior (P10). Se caracterizan por baja frecuencia de paso, escasa diversidad de lineas y mayor distancia a las paradas.">barrios mal conectados</span> vs <span className="term-tooltip dark-text" data-tooltip="Zonas con índice de valor del servicio superior (P90). Disponen de alta frecuencia, multiples conexiones directas y densidad optima de paradas.">bien conectados</span>.
              </div>
            </div>

            <div className="summary-fact">
              <div className="fact-number">{nominalPrice.toFixed(2)}€</div>
              <div className="fact-label">Precio nominal (precio de la tarifa 'pago directo')</div>
            </div>

            <div className="summary-fact">
              <div className="fact-number" style={{ fontSize: '2rem' }}>
                {geographic_tax?.effective_price_p90 ? geographic_tax.effective_price_p90.toFixed(2) : '0.00'}€ - {geographic_tax?.effective_price_p10 ? geographic_tax.effective_price_p10.toFixed(2) : '0.00'}€
              </div>
              <div className="fact-label">
                <span className="term-tooltip dark-text" data-tooltip="Coste real ajustado por el índice de valor del servicio. Se calcula dividiendo el precio nominal entre el índice de valor del servicio. Muestra la disparidad de lo que se paga por la misma utilidad.">
                  Precio efectivo (rango P10-P90)
                </span>
              </div>
              <div className="fact-detail" style={{ color: '#333' }}>
                Lo que realmente pagas por <span className="term-tooltip dark-text" data-tooltip="Medida compuesta que integra la frecuencia, diversidad de rutas, cobertura espacial y cercanía a paradas. Representa el nivel de servicio estructural del producto.">unidad de servicio</span>.
              </div>
            </div>

            <div className="summary-fact">
              <div className="fact-number" style={{ fontSize: '2rem' }}>
                {observableP10.toFixed(2)}€ - {observableP90.toFixed(2)}€
              </div>
              <div className="fact-label">
                <span className="term-tooltip dark-text" data-tooltip="Precio ajustado comparando con el estándar real de los barrios bien conectados (P90). Rango poblacional: del P10 (mejor servicio) al P90 (peor servicio).">
                  Precio efectivo observable (Rango Poblacional)
                </span>
              </div>
              <div className="fact-detail" style={{ color: '#333' }}>
                Rango del 10% mejor conectado al 10% peor conectado. Mediana poblacional: {observableP50.toFixed(2)}€
              </div>
            </div>

            {doublePunishmentSections.length > 0 && (
              <div className="summary-fact critical">
                <div className="fact-number">{doublePunishmentSections.length}</div>
                <div className="fact-label">
                  Secciones con <span className="term-tooltip dark-text" data-tooltip="Fenomeno donde un barrio tiene alta vulnerabilidad social (bajos ingresos/paro) y bajo nivel de servicio. Quienes mas lo necesitan reciben lo peor.">Doble Castigo</span>
                </div>
                <div className="fact-detail" style={{ color: '#333' }}>Alta vulnerabilidad + Servicio deficiente</div>
              </div>
            )}
          </div>


          <div style={{ marginTop: '25px', background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #3498db', color: '#ecf0f1', fontSize: '0.9rem' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Índice de valor del servicio:</strong> Cálculo combinado de frecuencia (viajes/hora), diversidad de líneas, cobertura espacial (% area a &lt;300m) y cercanía a paradas para medir el nivel de servicio estructural del transporte.
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Rango P10 (Mal conectados):</strong> El 10% de los barrios con nivel de servicio estructural ofrecido más bajo (baja densidad de servicio, cobertura penalizada).
            </div>
            <div>
              <strong>Rango P90 (Bien conectados):</strong> El 10% de los barrios con nivel de servicio estructural ofrecido más alto (alta densidad de servicio y conectividad, cobertura total).
            </div>
          </div>
        </section>

        {/* QUESTION 1: THE CONCEPT */}
        <section className="card question">
          <h2>1. EL PRECIO EFECTIVO Y EL <i>IMPUESTO</i> GEOGRÁFICO</h2>

          <div className="answer">
            <p style={{ fontSize: '1.1rem', lineHeight: '1.8' }}>
              <strong>1 viaje, por pago directo, es de {nominalPrice.toFixed(2)}€</strong>
            </p>
          </div>

          <div className="comparison-table" style={{ marginTop: '20px' }}>
            <table>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ verticalAlign: 'middle' }}>Zona</th>
                  <th rowSpan={2} style={{ verticalAlign: 'middle' }}>Precio nominal</th>
                  <th colSpan={3} style={{ textAlign: 'center', borderBottom: '1px solid #ddd' }}>Valor del servicio</th>
                  <th rowSpan={2} style={{ verticalAlign: 'middle' }}>Precio Efectivo</th>
                </tr>
                <tr>
                  <th>Frecuencia</th>
                  <th>Líneas</th>
                  <th>Cobertura</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Barrio bien conectado (P90)</strong></td>
                  <td>{nominalPrice.toFixed(2)}€</td>
                  <td>Alta (P90)</td>
                  <td>Alta</td>
                  <td>100%</td>
                  <td style={{ color: '#27ae60', fontWeight: 700 }}>
                    {effectiveP10.toFixed(2)}€
                    <div style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#666' }}>(Base 1.0x)</div>
                  </td>
                </tr>
                <tr>
                  <td><strong>Barrio mal conectado (P10)</strong></td>
                  <td>{nominalPrice.toFixed(2)}€</td>
                  <td>Baja (P10)</td>
                  <td>Baja</td>
                  <td>~78%</td>
                  <td className="negative">
                    {effectiveP90.toFixed(2)}€
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#c0392b' }}>
                      ({(effectiveP90 / effectiveP10).toFixed(1)}x más caro)
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '15px', marginBottom: '25px', textAlign: 'center', fontWeight: 'bold', color: '#2c3e50' }}>
            El billete sale <span style={{ color: '#c0392b', fontSize: '1.2em' }}>{geographicTaxRatio.toFixed(1)} veces más caro</span> en términos reales para los barrios peores conectados.
          </div>

          <div className="service-gap" style={{ background: '#f8f9fa', borderLeft: '5px solid #3498db', padding: '20px', borderRadius: '8px', margin: '25px 0' }}>
            <h3 style={{ color: '#2c3e50', marginTop: 0 }}>¿Cómo se calcula el precio efectivo?</h3>

            <p style={{ fontSize: '1.1rem', marginBottom: '20px' }}>
              <strong>Precio efectivo = Precio nominal / Índice de valor del servicio</strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #27ae60' }}>
                <strong style={{ display: 'block', color: '#27ae60', marginBottom: '8px' }}>Barrio A (Barrio bien conectado)</strong>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Indice P90 ({geographic_tax.p90_service_value.toFixed(2)})</p>
                <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginTop: '8px', fontStyle: 'italic' }}>
                  En un hipotético barrio con nivel de servicio estructural alto:
                </p>
                <p style={{ marginTop: '5px', fontSize: '1.1rem' }}>
                  {nominalPrice.toFixed(2)}€ / {geographic_tax.p90_service_value.toFixed(2)} = <strong>{(nominalPrice / geographic_tax.p90_service_value).toFixed(2)}€</strong> / unidad
                </p>
              </div>

              <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #e74c3c' }}>
                <strong style={{ display: 'block', color: '#e74c3c', marginBottom: '8px' }}>Barrio B (Barrio mal conectado)</strong>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Indice P10 ({geographic_tax.p10_service_value.toFixed(2)})</p>
                <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginTop: '8px', fontStyle: 'italic' }}>
                  En un hipotético barrio con nivel de servicio estructural bajo:
                </p>
                <p style={{ marginTop: '5px', fontSize: '1.1rem' }}>
                  {nominalPrice.toFixed(2)}€ / {geographic_tax.p10_service_value.toFixed(2)} = <strong>{(nominalPrice / geographic_tax.p10_service_value).toFixed(2)}€</strong> / unidad
                </p>
              </div>
            </div>

            <div style={{ marginTop: '20px', fontSize: '0.95rem', color: '#555', background: '#fff', padding: '15px', border: '1px solid #ddd', borderRadius: '6px' }}>
              <p style={{ margin: 0 }}>
                Estos ejemplos muestran lo que sucede en la realidad de la ciudad: aunque ambos ciudadanos pagan 1.40€, el valor que se plantea recibir es radicalmente distinto. El usuario del Barrio B está pagando un "sobreprecio invisible" porque su euro compra mucha menos libertad de movimiento, frecuencia y accesibilidad que el euro del usuario del Barrio A.
              </p>
            </div>

            <div style={{ marginTop: '25px', color: '#555', lineHeight: '1.6', fontSize: '0.95rem', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
              <p style={{ marginBottom: '10px' }}>
                <strong>¿Por qué este cálculo?</strong> Cuando pagamos una tarifa (1.40€), asumimos que recibimos el mismo servicio (viajar de A a B). Sin embargo, si en un barrio la guagua pasa cada 10 min y en otro cada hora, <strong>la utilidad recibida por el mismo dinero es radicalmente distinta</strong>. La utilidad no es solo el viaje físico, sino la disponibilidad, el tiempo ahorrado y la libertad de movimiento. Quien recibe un servicio con menor frecuencia y conectividad esta asumiendo mayores costes de tiempo y oportunidad por el mismo precio nominal.
              </p>
              <div style={{ background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #eee', marginTop: '15px' }}>
                <p style={{ marginBottom: '10px', fontWeight: 'bold', color: '#2c3e50' }}>
                  ¿Cómo se construye el <b>índice de valor del servicio</b>?
                </p>
                <p style={{ marginBottom: '10px' }}>
                  El índice es una media ponderada de 4 factores clave, calculada para cada sección censal:
                </p>
                <div style={{ fontFamily: 'monospace', background: '#f4f4f4', padding: '10px', borderRadius: '4px', marginBottom: '10px', fontSize: '0.9rem', textAlign: 'center' }}>
                  Índice = (0.35 × Frecuencia) + (0.25 × Conectividad) + (0.25 × Cobertura) + (0.15 × Proximidad)
                </div>
                <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                  <li><strong>1. Normalización (0-1):</strong> Cada variable se normaliza por habitante (densidad) y se escala relativa al máximo. Si el mejor barrio tiene 50 eventos/1000 hab (valor 1.0), uno con 5 tiene 0.1. Esto evita sesgos por tamaño y densidad.</li>
                  <li><strong>2. Ponderación:</strong> Se prioriza la <strong>Frecuencia (35%)</strong>, seguida de <strong>Conectividad (25%)</strong> y <strong>Cobertura (25%)</strong>. La proximidad (15%) tiene el menor peso relativo.</li>
                </ul>
                <p style={{ marginBottom: '10px' }}>
                  Un barrio puede tener una parada cerca (buena proximidad) pero si solo pasa un bus cada hora (mala frecuencia), el servicio real es pobre. Al integrar las cuatro dimensiones, se busca obtener una "nota final" robusta de la calidad del servicio recibido.
                </p>
              </div>

              {/* Distribution Stats Chart */}
              <div style={{ marginTop: '20px', padding: '15px', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
                {(() => {
                  const getDeciles = (tariffName: string, sectionsList: any[]) => {
                    const validItems = sectionsList
                      .filter(s => s.effective_prices[tariffName]?.effective_eur_per_trip !== undefined)
                      .map(s => ({
                        val: s.effective_prices[tariffName].effective_eur_per_trip,
                        pop: s.total_population || 100
                      }));

                    const totalPop = validItems.reduce((acc, item) => acc + item.pop, 0);
                    const sorted = [...validItems].sort((a, b) => a.val - b.val);

                    const dataPoints = [];
                    const labels = [];

                    for (let p = 10; p <= 90; p += 10) {
                      let accum = 0;
                      const target = totalPop * (p / 100);
                      let val = 0;
                      for (const item of sorted) {
                        accum += item.pop;
                        if (accum >= target) {
                          val = item.val;
                          break;
                        }
                      }
                      // Fallback if not found (should not happen if totalPop matches)
                      if (val === 0 && sorted.length > 0) val = sorted[sorted.length - 1].val;

                      dataPoints.push(val);
                      labels.push(`P${p}`);
                    }
                    return { values: dataPoints, labels };
                  };

                  const { values, labels } = getDeciles(selectedTariff, sections || []);

                  const chartData = {
                    labels,
                    datasets: [
                      {
                        label: 'Precio Efectivo (€)',
                        data: values,
                        backgroundColor: values.map(v => v > nominalPrice * 1.5 ? 'rgba(231, 76, 60, 0.7)' : (v < nominalPrice * 1.05 ? 'rgba(39, 174, 96, 0.7)' : 'rgba(243, 156, 18, 0.7)')),
                        borderColor: values.map(v => v > nominalPrice * 1.5 ? '#c0392b' : (v < nominalPrice * 1.05 ? '#27ae60' : '#f39c12')),
                        borderWidth: 1
                      }
                    ]
                  };

                  const chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      title: {
                        display: true,
                        text: `Distribución del Precio Efectivo por Percentiles (P10-P90)`,
                        color: '#2c3e50',
                        font: { size: 14 }
                      },
                      tooltip: {
                        callbacks: {
                          label: (context: any) => `${context.parsed.y.toFixed(2)}€`
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Precio Efectivo (€)' }
                      }
                    }
                  };

                  return (
                    <div>
                      <div style={{ height: '350px' }}>
                        <Bar data={chartData} options={chartOptions as any} />
                      </div>
                      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#7f8c8d', marginTop: '10px' }}>
                        Precio efectivo que paga cada percentil de la población (del 10% mejor conectado al 10% peor conectado).
                        <br />
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Custom Index Builder UI */}
              <div style={{ marginTop: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Crea tu propio índice
                  </h4>
                  <button
                    onClick={() => {
                      setCustomWeights({ frequency: 0.35, connectivity: 0.25, coverage: 0.25, proximity: 0.15 });
                      setIsCustomizing(false);
                    }}
                    style={{
                      background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem'
                    }}
                  >
                    ⟲ Restaurar valores por defecto
                  </button>
                </div>

                <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px', lineHeight: '1.4' }}>
                  ¿Qué importancia le das a cada variable? Ajusta los pesos de cada variable y observa cómo cambian los números de la desigualdad (precio efectivo, impuesto geográfico, etc.) en tiempo real.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {([
                    ['frequency', 'Frecuencia', 'Número total de expediciones diarias por habitante'],
                    ['connectivity', 'Conectividad', 'Número de líneas únicas distintas que paran en la sección'],
                    ['coverage', 'Cobertura', '% del área de la sección cubierta por un radio de 300m desde las paradas'],
                    ['proximity', 'Proximidad', 'Distancia media en metros desde el centroide poblacional a la parada más cercana']
                  ] as const).map(([key, label, description]) => (
                    <div key={key} style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#34495e', cursor: 'help' }} title={description}>{label}</label>
                        <span style={{ fontWeight: 'bold', color: '#3498db', fontSize: '0.9rem' }}>
                          {(customWeights[key] * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={customWeights[key]}
                        onChange={(e) => {
                          const newValue = parseFloat(e.target.value);
                          setCustomWeights((prev: any) => {
                            const clamp = (n: number) => Math.max(0, Math.min(1, n));
                            const safeValue = clamp(newValue);
                            const delta = safeValue - prev[key];

                            // If no change, return
                            if (Math.abs(delta) < 0.0001) return prev;

                            const next = { ...prev };
                            next[key] = safeValue;

                            const otherKeys = (Object.keys(prev) as (keyof typeof customWeights)[]).filter(k => k !== key);
                            const sumOthers = otherKeys.reduce((s, k) => s + prev[k], 0);

                            if (sumOthers > 0.0001) {
                              // Distribute drag delta inversely
                              otherKeys.forEach(k => {
                                // We want total to be 1.0. 
                                // New sum of others must be 1.0 - safeValue.
                                // Scale them by (targetSumOthers / currentSumOthers)
                                next[k] = prev[k] * ((1.0 - safeValue) / sumOthers);
                              });
                            } else {
                              // If others were 0, distribute equally
                              const split = (1.0 - safeValue) / otherKeys.length;
                              otherKeys.forEach(k => next[k] = split);
                            }
                            return next;
                          });
                          setIsCustomizing(true);
                        }}
                        style={{ width: '100%', cursor: 'pointer', marginBottom: '5px' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#7f8c8d', lineHeight: '1.2' }}>
                        {description}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="stats-block" style={{ marginTop: '25px', paddingTop: '20px', borderTop: '2px solid #eee' }}>
                  <h3 style={{ fontSize: '1rem', color: '#2c3e50', marginBottom: '15px' }}>
                    Impacto en precios efectivos (Billete simple {nominalPrice.toFixed(2)}€)
                  </h3>
                  <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
                    <div className="stat-item" style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #eee' }}>
                      <span className="stat-label" style={{ fontSize: '0.8rem', color: '#7f8c8d', display: 'block', marginBottom: '5px' }}>Zonas P90 (Mejor conectadas)</span>
                      <span className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#27ae60' }}>{customEffectiveP10.toFixed(2)}€</span>
                    </div>
                    <div className="stat-item" style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #eee' }}>
                      <span className="stat-label" style={{ fontSize: '0.8rem', color: '#7f8c8d', display: 'block', marginBottom: '5px' }}>Mediana (P50)</span>
                      <span className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f39c12' }}>{customEffectiveP50.toFixed(2)}€</span>
                    </div>
                    <div className="stat-item" style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #eee' }}>
                      <span className="stat-label" style={{ fontSize: '0.8rem', color: '#7f8c8d', display: 'block', marginBottom: '5px' }}>Zonas P10 (Peor conectadas)</span>
                      <span className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#c0392b' }}>{customEffectiveP90.toFixed(2)}€</span>
                    </div>
                    <div className="stat-item" style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #eee' }}>
                      <span className="stat-label" style={{ fontSize: '0.8rem', color: '#7f8c8d', display: 'block', marginBottom: '5px' }}>Disparidad (P90-P10)</span>
                      <span className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2c3e50' }}>{(customEffectiveP90 - customEffectiveP10).toFixed(2)}€</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="service-gap" style={{ textAlign: 'center', marginTop: '30px' }}>
            <h3 style={{ marginTop: 0, color: '#2c3e50' }}>El <i>impuesto</i> geográfico</h3>
            <p style={{ fontSize: '1.1rem', marginBottom: '15px' }}>
              La disparidad en el precio efectivo (<span style={{ color: '#c0392b', fontWeight: 'bold' }}>{geographicTaxRatio.toFixed(1)}x</span>) cuantifica la ineficiencia distributiva del modelo de tarifa plana.
            </p>
            <p style={{ marginBottom: '15px' }}>
              Técnicamente, actúa como un <strong>subsidio cruzado regresivo</strong>. Al mantener un precio nominal fijo (1.40€) independientemente del nivel de servicio, el coste marginal por unidad de utilidad se dispara en las zonas mal conectadas. Esto genera una transferencia de valor desde los usuarios peor conectados (que pagan más por unidad de servicio) hacia los usuarios centrales, agravando la brecha de accesibilidad.
            </p>
            <div style={{ display: 'inline-block', background: '#fff', padding: '10px 20px', border: '2px solid #34495e', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem', color: '#2c3e50' }}>
              Sobrecoste real: <span style={{ color: '#c0392b' }}>+{((geographicTaxRatio - 1) * 100).toFixed(0)}%</span>
            </div>
            <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#555', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
              Es el <i>impuesto</i> geográfico expresado en procentaje. Indica el porcentaje adicional que paga un usuario mal conectado por recibir la misma utilidad que uno bien conectado.
            </p>
            <div style={{ fontFamily: 'monospace', background: '#f4f4f4', padding: '10px 15px', borderRadius: '4px', margin: '10px auto', fontSize: '0.9rem', textAlign: 'center', width: 'fit-content' }}>
              Sobrecoste = (Ratio - 1.0) × 100
            </div>
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '10px' }}>
              Donde <strong>Ratio</strong> = Impuesto geográfico ({geographicTaxRatio.toFixed(2)}) y <strong>1.0</strong> = Coste Base (usuario bien conectado).<br />
              El ratio está compuesto por el coste base (1) + el coste extra ({(geographicTaxRatio - 1).toFixed(2)}) que paga de más el usuario en una zona mal conectada.
            </p>
          </div>

          {/* PRECIO EFECTIVO OBSERVABLE */}
          <div className="service-gap" style={{ background: '#fff9e6', borderLeft: '5px solid #f39c12', padding: '20px', borderRadius: '8px', margin: '30px 0' }}>
            <h3 style={{ color: '#2c3e50', marginTop: 0 }}>Precio efectivo observable</h3>

            <div style={{ background: '#fffbf0', padding: '15px', borderRadius: '6px', marginBottom: '20px', borderLeft: '4px solid #e67e22' }}>
              <p style={{ marginBottom: '10px', fontWeight: 'bold', color: '#d35400' }}>
                Problema con el precio efectivo estándar:
              </p>
              <p style={{ marginBottom: '10px', fontSize: '0.95rem', lineHeight: '1.6' }}>
                Para obtener un <strong>precio efectivo = nominal (1.40€)</strong>, una zona debería tener un <strong>índice del valor del servicio = 1.0</strong>. Esto exige ser, simultáneamente, la mejor de toda la ciudad en las cuatro métricas (Frecuencia, Conectividad, Cobertura y Proximidad).
              </p>
              <p style={{ marginBottom: '10px', fontSize: '0.95rem', lineHeight: '1.6' }}>
                Esto en la práctica del diseño de redes de transporte, es estadísticamente improbable por la existencia de <span className="term-tooltip dark-text" data-tooltip="Compromisos: situaciones donde mejorar una característica implica necesariamente empeorar otra"><a href="https://onlinepubs.trb.org/onlinepubs/tcrp/tcrp_rpt_30-c.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#2980b9', textDecoration: 'underline' }}>trade-offs</a></span> de red bajo restricciones de flota, presupuesto y tiempos de ciclo. Mejorar la proximidad o la cobertura suele requerir más capilaridad (más paradas, desvíos,
                y ramales), lo que incrementa el tiempo de recorrido, reduce la velocidad comercial y eleva los recursos necesarios para sostener la misma frecuencia. En términos operativos esa expansión tiende a degradar la frecuencia y, a menudo, la conectividad directa.
                A la inversa, maximizar la frecuencia y la conectividad empujaría a concentrar la oferta en corredores troncales y nodos de alta demanda, lo que mejora la eficiencia y el número de combinaciones posibles, pero normalmente implica mayores distancias de acceso para parte
                de la población y una peor cobertura capilar. <b><i>Básicamente, si quieres que una guagua pase mucho, conecte bien y además te quede una parada pegada a casa en todas partes, <a href="https://www.scipedia.com/wd/images/4/4c/Draft_Content_677003950-beopen265-5362-document.pdf" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>necesitas multiplicar recursos</a>; si no, alguna de esas cuatro cosas cae.</i></b>
              </p>
            </div>

            <p style={{ fontSize: '1.05rem', marginBottom: '20px', lineHeight: '1.7' }}>
              En lugar de comparar contra un servicio perfecto teórico (1.0 del precio efectivo), anclamos la comparación
              a un <strong>estándar observable y alcanzable</strong> dentro de la propia ciudad: el <strong>P90</strong> del índice
              de valor del servicio (es decir, el índice de valor del servicio del 10% de las zonas con mejor diseño estructural ofrecido: IVS = {geographic_tax.observable_reference_value.toFixed(3)}).
            </p>

            <p style={{ marginTop: '-10px', marginBottom: '20px', fontSize: '0.95rem', background: '#eafaf1', padding: '15px', borderRadius: '4px', borderLeft: '3px solid #27ae60', color: '#2c3e50', lineHeight: '1.6' }}>
              <strong>¿Por qué el P90?</strong> Porque representa el "excelente real" (el top 10% de mejores zonas). A diferencia del 1.0 (un 10 en todo) que quizás no exista, el P90 es un nivel de servicio estructural que la ciudad <em>ya está ofreciendo</em> hoy mismo a algunos ciudadanos. Usarlo como vara de medir implica decir: "no señalamos la ineficiencia respecto a una utopía técnica, sino respecto a la <s>mejor</s> realidad que <em>Las Palmas de Gran Canaria demuestra que es posible dar</em> en esta misma red".
            </p>

            <div style={{ background: 'white', padding: '15px', borderRadius: '6px', border: '1px solid #f39c12', marginBottom: '20px' }}>
              <p style={{ fontFamily: 'monospace', textAlign: 'center', fontSize: '1.1rem', marginBottom: '15px', color: '#2c3e50' }}>
                <strong>Precio efectivo observable = precio nominal × (IVS P90 / IVS de la sección censal)</strong>
              </p>
              <p style={{ marginBottom: 0, fontSize: '0.9rem', color: '#555', textAlign: 'center' }}>
                Donde IVS P90 = {geographic_tax.observable_reference_value.toFixed(3)} = El mejor servicio estructural que la ciudad <em>demuestra</em> que puede ofrecer
              </p>
            </div>

            {(() => {
              const activeSections = customSections || sections;
              const validItems = activeSections
                .filter(s => s.effective_prices[selectedTariff]?.observable_effective_eur_per_trip !== undefined)
                .map(s => ({
                  price: s.effective_prices[selectedTariff].observable_effective_eur_per_trip,
                  pop: s.total_population || 100
                }));

              const totalPop = validItems.reduce((acc, item) => acc + item.pop, 0);

              const getPopWeightedPercentile = (pct: number) => {
                if (validItems.length === 0) return nominalPrice;
                const sorted = [...validItems].sort((a, b) => a.price - b.price);
                let accum = 0;
                const target = totalPop * pct;
                for (const item of sorted) {
                  accum += item.pop;
                  if (accum >= target) return item.price;
                }
                return sorted[sorted.length - 1].price;
              };

              const popP10 = getPopWeightedPercentile(0.1);
              const popP50 = getPopWeightedPercentile(0.5);
              const popP90 = getPopWeightedPercentile(0.9);

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '0px' }}>
                  <div style={{ background: '#d4edda', padding: '15px', borderRadius: '6px', textAlign: 'center', border: '2px solid #28a745' }}>
                    <div style={{ fontSize: '0.85rem', color: '#155724', marginBottom: '5px', fontWeight: 600 }}>Población P10 (Mejor servicio)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#28a745' }}>{popP10.toFixed(2)}€</div>
                    <div style={{ fontSize: '0.8rem', color: '#155724', marginTop: '5px' }}>
                      {((popP10 / nominalPrice - 1) * 100).toFixed(0)}% {popP10 < nominalPrice ? 'Subsidio' : 'Sobrecoste'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#155724', marginTop: '8px', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '5px' }}>
                      El 10% mejor conectado paga este precio efectivo.
                    </div>
                  </div>

                  <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '6px', textAlign: 'center', border: '2px solid #ffc107' }}>
                    <div style={{ fontSize: '0.85rem', color: '#856404', marginBottom: '5px', fontWeight: 600 }}>Población P50 (Mediana)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#856404' }}>{popP50.toFixed(2)}€</div>
                    <div style={{ fontSize: '0.8rem', color: '#856404', marginTop: '5px' }}>
                      {((popP50 / nominalPrice - 1) * 100).toFixed(0)}% {popP50 < nominalPrice ? 'Subsidio' : 'Sobrecoste'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#856404', marginTop: '8px', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '5px' }}>
                      La persona mediana (50% de la población) paga este precio efectivo.
                    </div>
                  </div>

                  <div style={{ background: '#f8d7da', padding: '15px', borderRadius: '6px', textAlign: 'center', border: '2px solid #dc3545' }}>
                    <div style={{ fontSize: '0.85rem', color: '#721c24', marginBottom: '5px', fontWeight: 600 }}>Población P90 (Peor servicio)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#721c24' }}>{popP90.toFixed(2)}€</div>
                    <div style={{ fontSize: '0.8rem', color: '#721c24', marginTop: '5px' }}>
                      +{((popP90 / nominalPrice - 1) * 100).toFixed(0)}% Sobrecoste
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#721c24', marginTop: '8px', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '5px' }}>
                      El 10% peor conectado paga este precio efectivo.
                    </div>
                  </div>

                  <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '6px', textAlign: 'center', border: '2px solid #2196f3' }}>
                    <div style={{ fontSize: '0.85rem', color: '#0d47a1', marginBottom: '5px', fontWeight: 600 }}>Precio Nominal</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0d47a1' }}>{nominalPrice.toFixed(2)}€</div>
                    <div style={{ fontSize: '0.8rem', color: '#0d47a1', marginTop: '5px' }}>
                      = Referencia
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#0d47a1', marginTop: '8px', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '5px' }}>
                      Precio que todos pagan en el billete (antes de ajustar por servicio real).
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Lorenz Curve Chart placed here */}
            {(() => {
              // Prepare data for the Lorenz-like curve - POPULATION WEIGHTED
              const activeSections = customSections || sections;
              const validItems = activeSections
                .filter(s => s.effective_prices[selectedTariff]?.observable_effective_eur_per_trip !== undefined)
                .map(s => ({
                  price: s.effective_prices[selectedTariff].observable_effective_eur_per_trip,
                  pop: s.total_population || 100
                }));

              const totalPop = validItems.reduce((acc, item) => acc + item.pop, 0) || 1;

              // Function to get population-weighted percentile
              const getPopWeightedPercentile = (pct: number) => {
                if (validItems.length === 0) return nominalPrice;
                const sorted = [...validItems].sort((a, b) => a.price - b.price);
                let accum = 0;
                const target = totalPop * pct;
                for (const item of sorted) {
                  accum += item.pop;
                  if (accum >= target) return item.price;
                }
                return sorted[sorted.length - 1].price;
              };

              // Build chart data points using the SAME logic as the cards
              const chartDataPoints = [];
              for (let i = 0; i <= 100; i++) {
                const price = getPopWeightedPercentile(i / 100);
                chartDataPoints.push({ x: i, y: price });
              }

              // 3. Chart Configuration
              const chartData = {
                labels: chartDataPoints.map(p => `${p.x}%`),
                datasets: [
                  {
                    label: 'Precio Efectivo Observable',
                    data: chartDataPoints.map(p => p.y),
                    borderColor: '#c0392b',
                    backgroundColor: 'rgba(192, 57, 43, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    fill: 'start', // Fill area under curve to show "Injustice Volume"
                    tension: 0.4 // Smooth curve
                  },
                  {
                    label: 'Equidad Perfecta (Precio Nominal)',
                    data: new Array(101).fill(nominalPrice),
                    borderColor: '#27ae60',
                    borderWidth: 2,
                    pointRadius: 0,
                    borderDash: [5, 5], // Dashed line
                    fill: false
                  }
                ]
              };

              const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                plugins: {
                  title: {
                    display: true,
                    text: 'Curva de Distribución del Precio Efectivo Observable (Lorenz Invertida)',
                    font: { size: 16 },
                    color: '#2c3e50',
                    padding: { bottom: 20 }
                  },
                  tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#2c3e50',
                    bodyColor: '#2c3e50',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                      title: (items: any) => {
                        const pct = parseInt(items[0].label);
                        const numPeople = Math.round((totalPop * pct) / 100);
                        return `Población Acumulada: ${items[0].label} (${numPeople.toLocaleString()} habitantes)`;
                      },
                      label: (item: any) => `${item.dataset.label}: ${item.raw.toFixed(2)}€`
                    }
                  },
                  legend: {
                    position: 'bottom'
                  }
                },
                scales: {
                  x: {
                    title: { display: true, text: '% Población (De Mejor a Peor Servicio) - Ponderado Poblacionalmente' },
                    ticks: { maxTicksLimit: 10, callback: (val: any) => `${val}%` },
                    grid: { display: false }
                  },
                  y: {
                    title: { display: true, text: 'Precio Efectivo Observable (€)' },
                    min: 0,
                    suggestedMax: 5 // Keep reasonable max even if outliers exist
                  }
                }
              };

              return (
                <div style={{ marginTop: '20px', padding: '0 10px' }}>
                  <div style={{ height: '350px' }}>
                    <Line data={chartData} options={chartOptions as any} />
                  </div>


                  <div style={{
                    background: '#fff3cd',
                    padding: '15px',
                    borderRadius: '6px',
                    marginTop: '15px',
                    fontSize: '0.85rem',
                    border: '1px solid #ffc107',
                    borderLeft: '4px solid #ff9800'
                  }}>
                    <strong>⚠️ Sobre los valores extremos:</strong> En los percentiles más altos (95%-100%), pueden aparecer saltos abruptos en el precio efectivo observable (ej: de 8.74€ al 95% a 39.89€ al 96%, o incluso 115.51€ al 99%).
                    <br /><br />
                    <strong>¿Por qué ocurre esto?</strong> Estos valores extremos corresponden a secciones censales con:
                    <ul style={{ marginTop: '8px', marginBottom: '8px', paddingLeft: '20px', lineHeight: '1.6' }}>
                      <li><strong>IVS extremadamente bajo</strong> (nivel de servicio estructural muy deficiente): Zonas con muy baja frecuencia, escasa conectividad, cobertura limitada o paradas muy lejanas.</li>
                      <li><strong>Población pequeña</strong>: Estas zonas suelen tener poca población, por lo que representan un pequeño porcentaje del total de habitantes.</li>
                      <li><strong>Fórmula observable</strong>: Precio Observable = 1.40€ × (IVS_P90 / IVS_sección). Cuando IVS_sección es muy bajo (ej: 0.01), el precio se dispara (ej: 1.40 × 0.9 / 0.01 = 126€).</li>
                    </ul>
                    Estos valores extremos reflejan la realidad de zonas completamente aisladas del sistema de transporte, aunque afectan a muy pocos habitantes (últimos 1%-5% de la población).
                  </div>


                </div>
              );
            })()}


          </div>

        </section>

        {/* QUESTION 3: DOUBLE PUNISHMENT */}
        {
          doublePunishmentSections.length > 0 && (
            <section className="card question">
              <h2>EL DOBLE CASTIGO: Alta Necesidad + Bajo Servicio</h2>

              <div className="answer">
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div className="answer-highlight critical">
                    <div className="big-number">{doublePunishmentSections.length}</div>
                    <div className="big-label">Secciones con<br />Doble Castigo</div>
                  </div>

                  <div className="answer-highlight critical">
                    <div className="big-number">{(geographic_tax.avg_gap_vulnerable_areas * 100).toFixed(0)}%</div>
                    <div className="big-label">Brecha Media<br />Need - Service</div>
                  </div>
                </div>
              </div>

              <div className="service-gap">
                <h3>Que es el Doble Castigo?</h3>
                <p>
                  Se produce cuando un barrio tiene:
                </p>
                <ul>
                  <li><strong>Alta necesidad:</strong> Desempleo alto, bajos ingresos, educacion baja, poblacion mayor</li>
                  <li><strong>Bajo servicio:</strong> Pocas lineas, baja frecuencia, cobertura deficiente</li>
                </ul>
                <p style={{ marginTop: '15px' }}>
                  Estas son las personas que MAS necesitan transporte publico (no tienen coche, necesitan movilidad para empleo)
                  pero reciben el PEOR servicio.
                </p>
                <div className="critical-note">
                  Resultado: Pagan mas en terminos efectivos por un producto peor, justo cuando menos pueden permitirselo.
                </div>
              </div>

              {doublePunishmentSections.length > 0 && (
                <div className="stats-detail">
                  <h3>Barrios mas afectados por Doble Castigo (Top 10)</h3>
                  <ul>
                    {doublePunishmentSections
                      .sort((a, b) => b.service_gap - a.service_gap)
                      .slice(0, 10)
                      .map(s => (
                        <li key={s.section_code}>
                          <strong>{s.section_code}</strong>:
                          Necesidad = {((s.need_index || 0) * 100).toFixed(0)}%,
                          Valor Servicio = {(s.service_value_index || 0).toFixed(2)},
                          Brecha = {((s.service_gap || 0) * 100).toFixed(0)}%
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </section>
          )
        }



        {/* TOURIST VS LOCAL INCOME COMPARISON */}
        {
          touristData && (
            <section className="card">
              <h2>2. EQUIDAD: TURISTAS VS RESIDENTES</h2>

              <div style={{ marginBottom: '25px', padding: '15px', background: '#f8f9fa', borderLeft: '5px solid #e67e22', borderRadius: '4px' }}>
                <p style={{ marginTop: 0, fontSize: '1.05rem', lineHeight: '1.7' }}>
                  <strong>La tarifa del transporte no tiene la misma carga para todos.</strong> Para un residente la guagua podría ser considerada movilidad cotidiana: ir a trabajar,
                  estudiar, cuidar, llegar a una cita. Para un visitante suele ser una opción cómoda y barata dentro de un presupuesto de viaje mucho más alto.
                  Cuando el sistema fija precios y bonos pensando en "usuarios promedio" sin mirar quiénes son y cuánto les supone, acaba pasando lo de siempre:
                  <strong> a quien depende del servicio para vivir le cuesta más en esfuerzo relativo y a quien viene con mayor capacidad de pago le cuesta menos.</strong>
                  <br />
                  <br />
                  En una ciudad con salarios bajos y un transporte ya tensionado, diseñar incentivos de movilidad que facilitan un uso intensivo a quien tiene más
                  renta empuja demanda extra sobre una red que no crece al mismo ritmo. El resultado podría ser que el residente cargue con <strong>más esfuerzo económico </strong>
                  y, además, con <strong>una peor experiencia de servicio cuando el sistema se satura.</strong>
                  <br />
                  <br />
                  <strong>El precio sí mueve el comportamiento.</strong> La <a href="https://www.trl.co.uk/uploads/trl/documents/TRL593%20-%20The%20Demand%20for%20Public%20Transport.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#2980b9', textDecoration: 'underline' }}>evidencia</a> sobre demanda de transporte público muestra que cambios en tarifas y gratuidades alteran el número
                  de viajes y el reparto modal (cuánta gente usa guagua frente a otras opciones). En destinos donde se incluyen <i>guest cards</i> con transporte público
                  gratuito, los gestores observan <a href="https://onlinelibrary.wiley.com/doi/full/10.1002/jtr.2791" target="_blank" rel="noopener noreferrer" style={{ color: '#2980b9', textDecoration: 'underline' }}>aumentos de uso por parte de los visitantes</a>, precisamente porque el incentivo funciona. Si el turista dejara de ir en
                  guagua por una subida de precio, una parte cambiaría a taxi o a coche de alquiler (empeorando tráfico y espacio viario), mientras que otra parte probablemente
                  seguiría igual porque el coste extra, comparado con su presupuesto total, puede ser irrelevante. Lo que no es irrelevante es el efecto agregado sobre una red
                  limitada cuando <strong><a href="https://www.econstor.eu/bitstream/10419/306088/1/JTR_JTR2791.pdf" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>el incentivo actual empuja a usar más porque sale regalado.</a></strong>
                </p>
              </div>

              {/* Summary Stats */}
              <div className="stats-block">
                <h3 style={{ color: '#2c3e50' }}>2.1. Comparación de renta por unidad de consumo</h3>
                <div className="stats-grid">
                  <div className="stat-item" style={{ borderLeft: '4px solid #3498db' }}>
                    <span className="stat-label">Turista mediano</span>
                    <span className="stat-value">{touristData.weighted_median_income_per_consumption_unit.toFixed(0)}€/mes</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#7f8c8d', marginTop: '4px' }}>
                      Renta por unidad de consumo (media ponderada)
                    </span>
                  </div>
                  <div className="stat-item" style={{ borderLeft: '4px solid #e74c3c' }}>
                    <span className="stat-label">Mediana residente local (P50)</span>
                    <span className="stat-value">
                      {decileData?.deciles?.[4]?.income_monthly
                        ? decileData.deciles[4].income_monthly.toFixed(0)
                        : '-'}€/mes
                    </span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#7f8c8d', marginTop: '4px' }}>
                      Renta por unidad de consumo (dato censal)
                    </span>
                  </div>
                  <div className="stat-item" style={{ borderLeft: '4px solid #27ae60' }}>
                    <span className="stat-label">Brecha turista vs local</span>
                    <span className="stat-value">
                      {decileData?.deciles?.[4]?.income_monthly
                        ? (touristData.weighted_median_income_per_consumption_unit - decileData.deciles[4].income_monthly).toFixed(0)
                        : '-'}€
                    </span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#7f8c8d', marginTop: '4px' }}>
                      Diferencia Renta Mensual
                    </span>
                  </div>
                  <div className="stat-item" style={{ borderLeft: '4px solid #9b59b6' }}>
                    <span className="stat-label">Estancia media</span>
                    <span className="stat-value">{touristData.avg_stay_days.toFixed(1)} dias</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#7f8c8d', marginTop: '4px' }}>
                      Total turistas: {touristData.total_tourists.toLocaleString()}
                      <br />(2024)
                    </span>
                  </div>
                </div>
              </div>

              {/* Methodological note */}
              <div style={{ background: '#e8f4f8', padding: '12px 15px', borderRadius: '6px', marginTop: '15px', marginBottom: '30px', borderLeft: '4px solid #3498db', fontSize: '0.9rem' }}>
                <p style={{ marginBottom: 0, lineHeight: '1.6', color: '#34495e' }}>
                  La <strong>renta mediana turística de {touristData.weighted_median_income_per_consumption_unit.toFixed(0)}€/mes por unidad de consumo</strong> se calcula a partir de:
                </p>
                <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px', lineHeight: '1.7', color: '#34495e' }}>
                  <li><strong>Renta base individual:</strong> 37.500€/año (3.125€/mes), mediana del rango de renta más frecuente (25.000-50.000€/año) según los datos de la <a href="https://www3.gobiernodecanarias.org/istac/statistical-visualizer/visualizer/collection.html?resourceType=collection&agencyId=ISTAC&resourceId=C00028A_000006" target="_blank" rel="noopener noreferrer" style={{ color: '#2980b9', textDecoration: 'underline' }}>Encuesta de Gasto Turístico que recoge el ISTAC</a>.</li>
                  <li><strong>Estimación de ingresos del hogar:</strong> Para grupos (parejas, familias) se asume la suma de ingresos de múltiples perceptores (ej. Pareja = 2 ingresos = 6.250€/mes).</li>
                  <li><strong>Ajuste por unidades de consumo (Escala OCDE):</strong> Se divide la renta total del grupo entre sus unidades de consumo equivalente para hacerla comparable (ej. Pareja = factor 1.5 → 6.250€ / 1.5 = 4.166€/mes por UC).</li>
                  <li><strong>Media ponderada:</strong> El valor final pondera estos resultados según la composición real de visitantes (37% parejas, 30% solos, etc.).</li>
                </ul>
              </div>

              {/* Affordability Analysis */}
              <div style={{ marginTop: '30px' }}>
                <h3 style={{ color: '#2c3e50' }}>2.2. Asequibilidad del pago directo (1.40€)</h3>

                {(() => {
                  const touristIncome = touristData?.weighted_median_income_per_consumption_unit || 0;
                  const localIncome = decileData?.deciles?.[4]?.income_monthly || 0; // P50 from API

                  const touristDailyIncome = touristIncome / 30;
                  const localDailyIncome = localIncome / 30;

                  const touristTicketPct = touristDailyIncome > 0 ? (nominalPrice / touristDailyIncome) * 100 : 0;
                  const localTicketPct = localDailyIncome > 0 ? (nominalPrice / localDailyIncome) * 100 : 0;

                  const affordabilityGap = touristTicketPct > 0 ? localTicketPct / touristTicketPct : 0;

                  return (
                    <>
                      <div className="comparison-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Grupo</th>
                              <th>Renta por ud. de consumo</th>
                              <th>Renta diaria</th>
                              <th>Coste</th>
                              <th>% Renta diaria</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ background: 'rgba(52, 152, 219, 0.05)' }}>
                              <td><strong>Turista (P50)</strong></td>
                              <td>{(touristIncome || 0).toFixed(0)}€/mes</td>
                              <td>{touristDailyIncome.toFixed(2)}€</td>
                              <td>{nominalPrice.toFixed(2)}€</td>
                              <td style={{ color: '#27ae60', fontWeight: 'bold' }}>{touristTicketPct.toFixed(2)}%</td>
                            </tr>
                            <tr style={{ background: 'rgba(231, 76, 60, 0.05)' }}>
                              <td><strong>Residente local (P50)</strong></td>
                              <td>{localIncome.toFixed(0)}€/mes</td>
                              <td>{localDailyIncome.toFixed(2)}€</td>
                              <td>{nominalPrice.toFixed(2)}€</td>
                              <td style={{ color: '#e74c3c', fontWeight: 'bold' }}>{localTicketPct.toFixed(2)}%</td>
                            </tr>
                            <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                              <td colSpan={4}><strong>Ratio de impacto (local/turista)</strong></td>
                              <td style={{ color: affordabilityGap > 1.5 ? '#c0392b' : '#e67e22', fontSize: '1.1rem' }}>
                                {affordabilityGap.toFixed(2)}x
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="verdict critical" style={{ marginTop: '20px' }}>
                        <p>
                          <strong>El mismo billete de 1.40€ representa {isFinite(affordabilityGap) ? affordabilityGap.toFixed(2) : '-'} veces más peso económico para el residente mediano que para el turista mediano.</strong>
                          {' '}Para el turista, el billete supone el {(touristTicketPct || 0).toFixed(2)}% de su renta diaria. Para el residente local, supone el {(localTicketPct || 0).toFixed(2)}%.
                        </p>
                      </div>

                      {/* Detailed Income Impact Analysis */}
                      {(() => {
                        // Use API data for P10 and P90
                        const p10Income = decileData?.deciles?.[0]?.income_monthly || 0;
                        const p90Income = decileData?.deciles?.[8]?.income_monthly || 0;

                        const p10DailyIncome = p10Income / 30;
                        const p10TicketPct = p10Income > 0 ? (nominalPrice / p10DailyIncome) * 100 : 0;
                        const p10VsTourist = p10TicketPct / touristTicketPct;

                        const p90DailyIncome = p90Income / 30;
                        const p90TicketPct = p90Income > 0 ? (nominalPrice / p90DailyIncome) * 100 : 0;

                        return p10Income > 0 ? (
                          <div className="stats-detail" style={{ marginTop: '25px' }}>
                            <h3 style={{ color: '#2c3e50' }}>Esfuerzo relativo: residentes vs turista</h3>
                            <div className="comparison-table">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Grupo</th>
                                    <th>Renta mensual</th>
                                    <th>% Renta diaria (sobre pago directo)</th>
                                    <th>Ratio vs turista</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr style={{ background: 'rgba(52, 152, 219, 0.1)' }}>
                                    <td><strong>Turista (P50)</strong></td>
                                    <td>{(touristIncome || 0).toFixed(0)}€</td>
                                    <td style={{ color: '#27ae60', fontWeight: 'bold' }}>{(touristTicketPct || 0).toFixed(2)}%</td>
                                    <td>1.0x (Base)</td>
                                  </tr>
                                  <tr style={{ background: 'rgba(231, 76, 60, 0.1)' }}>
                                    <td><strong>Residente renta baja (P10)</strong></td>
                                    <td>{p10Income.toFixed(0)}€</td>
                                    <td style={{ color: '#c0392b', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                      {p10TicketPct.toFixed(2)}%
                                    </td>
                                    <td style={{ color: '#c0392b', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                      {isFinite(p10VsTourist) ? p10VsTourist.toFixed(1) : '-'}x
                                    </td>
                                  </tr>
                                  <tr>
                                    <td><strong>Residente renta media (P50)</strong></td>
                                    <td>{localIncome.toFixed(0)}€</td>
                                    <td>{localTicketPct.toFixed(2)}%</td>
                                    <td>{(localTicketPct / touristTicketPct).toFixed(1)}x</td>
                                  </tr>
                                  <tr style={{ background: 'rgba(46, 204, 113, 0.05)' }}>
                                    <td><strong>Residente renta alta (P90)</strong></td>
                                    <td>{p90Income.toFixed(0)}€</td>
                                    <td style={{ color: '#27ae60', fontWeight: 'bold' }}>
                                      {p90TicketPct.toFixed(2)}%
                                    </td>
                                    <td>{(p90TicketPct / touristTicketPct).toFixed(1)}x</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <div className="critical-note" style={{ marginTop: '15px' }}>
                              El pago directo castiga por esfuerzo relativo justo a quien menos margen tiene. El turista mediano dedica
                              un {(touristTicketPct || 0).toFixed(2)}% de su renta diaria al billete, mientras que un residente de renta
                              baja se va al {p10TicketPct.toFixed(2)}% ({p10VsTourist.toFixed(1)} veces mayor). Incluso los residentes
                              de renta alta pagan proporcionalmente más ({isFinite(p90TicketPct / touristTicketPct) ? (p90TicketPct / touristTicketPct).toFixed(1) : '-'}x) que el turista promedio.
                            </div>
                          </div >
                        ) : null;
                      })()}
                    </>
                  );
                })()}
              </div>

              {/* Tourist Passes Analysis: Complete Comparison with All Resident Fares */}
              {(() => {
                const touristIncome = touristData?.weighted_median_income_per_consumption_unit || 0;
                const localIncome = decileData?.deciles?.[4]?.income_monthly || 0; // P50
                const p10Income = decileData?.deciles?.[0]?.income_monthly || 0; // P10
                const p90Income = decileData?.deciles?.[8]?.income_monthly || 0; // P90

                // Daily incomes
                const touristDailyIncome = touristIncome / 30;
                const localDailyIncome = localIncome / 30;
                const p10DailyIncome = p10Income / 30;
                const p90DailyIncome = p90Income / 30;

                // Tourist passes
                const pass1Day = 5.00;
                const pass3Days = 12.00;
                const pass1PctTourist = (pass1Day / touristDailyIncome) * 100;
                const pass3PctTourist = ((pass3Days / 3) / touristDailyIncome) * 100;

                // Resident fares (cost per trip)
                const residentFares = [
                  { name: 'Pago Directo', price: 1.40, trips: 1, type: 'regular' },
                  { name: 'Bono-2', price: 2.40, trips: 2, type: 'regular' },
                  { name: 'Bono Guagua', price: 0.42, trips: 1, type: 'regular' },
                  { name: 'Bono Compartido (20 viajes)', price: 8.50, trips: 20, type: 'regular' },
                  { name: 'Bono Estudiante (80 viajes)', price: 14.00, trips: 80, type: 'social' },
                  { name: 'Bono Solidario (40 viajes/mes)', price: 5.00, trips: 40, type: 'social' },
                ];

                return (
                  <div style={{ marginTop: '30px' }}>
                    <h3 style={{ color: '#2c3e50' }}>2.4. Tarjetas turísticas vs tarifas residentes</h3>



                    <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '6px', marginBottom: '20px', borderLeft: '4px solid #ff9800' }}>
                      <p style={{ marginBottom: '10px', fontWeight: 'bold', color: '#d68000' }}>
                        ¿Quién hace más esfuerzo económico para usar el transporte público?
                      </p>
                      <p style={{ marginBottom: 0, fontSize: '0.95rem', lineHeight: '1.6' }}>
                        Un turista con renta de <strong>{touristIncome.toFixed(0)}€/mes</strong> paga <strong>5.00€ por movilidad ilimitada durante 24 horas</strong>.
                        Un residente mediano con renta de <strong>{localIncome.toFixed(0)}€/mes</strong> tiene múltiples opciones de tarifas,
                        pero <strong>incluso con las tarifas sociales más baratas</strong>, el esfuerzo relativo es desproporcionado.
                      </p>
                    </div>

                    {/* Table 1: Tourist passes as reference */}
                    <div className="comparison-table" style={{ marginBottom: '25px' }}>
                      <h4 style={{ marginBottom: '12px', fontSize: '1rem', color: '#34495e' }}>
                        Tarjetas turísticas: turista mediano (P50)
                      </h4>
                      <table>
                        <thead>
                          <tr>
                            <th>Tarifa</th>
                            <th>Precio</th>
                            <th>Cobertura</th>
                            <th>Renta Turista (P50)</th>
                            <th>% Renta Diaria</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: 'rgba(52, 152, 219, 0.08)' }}>
                            <td><strong>Tarjeta 1 Día</strong></td>
                            <td>{pass1Day.toFixed(2)}€</td>
                            <td>Ilimitado 24h</td>
                            <td>{touristIncome.toFixed(0)}€/mes ({touristDailyIncome.toFixed(2)}€/día)</td>
                            <td style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '1.05rem' }}>{pass1PctTourist.toFixed(2)}%</td>
                          </tr>
                          <tr style={{ background: 'rgba(52, 152, 219, 0.08)' }}>
                            <td><strong>Tarjeta 3 Días</strong></td>
                            <td>{pass3Days.toFixed(2)}€ ({(pass3Days / 3).toFixed(2)}€/día)</td>
                            <td>Ilimitado 72h</td>
                            <td>{touristIncome.toFixed(0)}€/mes ({touristDailyIncome.toFixed(2)}€/día)</td>
                            <td style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '1.05rem' }}>{pass3PctTourist.toFixed(2)}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 1B: Tourist income brackets */}
                    {(() => {
                      // Tourist income brackets (from tourist-analysis.json)
                      const touristBrackets = touristData?.income_brackets || [
                        { range: '≤25k', midpoint: 15000, stayDays: 10.13 },
                        { range: '25k-50k', midpoint: 37500, stayDays: 9.78 },
                        { range: '50k-75k', midpoint: 62500, stayDays: 10.1 },
                        { range: '≥75k', midpoint: 90000, stayDays: 9.44 },
                      ];

                      return (
                        <div className="comparison-table" style={{ marginBottom: '25px' }}>
                          <h4 style={{ marginBottom: '12px', fontSize: '1rem', color: '#34495e' }}>
                            Esfuerzo económico por rango de renta turística
                          </h4>
                          <table>
                            <thead>
                              <tr>
                                <th>Rango Renta Anual</th>
                                <th>Renta Mensual</th>
                                <th>Renta Diaria</th>
                                <th>Tarjeta 1D<br />(% renta diaria)</th>
                                <th>Tarjeta 3D<br />(% renta diaria)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {touristBrackets.map((bracket, index) => {
                                const monthlyIncome = bracket.midpoint / 12;
                                const dailyIncome = monthlyIncome / 30;
                                const pass1Pct = (pass1Day / dailyIncome) * 100;
                                const pass3DayPct = ((pass3Days / 3) / dailyIncome) * 100;

                                const getBgColor = () => {
                                  if (index === 0) return 'rgba(231, 76, 60, 0.08)'; // Red for low income
                                  if (index === 1) return 'rgba(52, 152, 219, 0.08)'; // Blue for median
                                  if (index === 2) return 'rgba(46, 204, 113, 0.08)'; // Green for high
                                  return 'rgba(155, 89, 182, 0.08)'; // Purple for very high
                                };

                                const getTextColor = () => {
                                  if (index === 0) return '#e74c3c';
                                  if (index === 1) return '#3498db';
                                  if (index === 2) return '#27ae60';
                                  return '#9b59b6';
                                };

                                return (
                                  <tr key={index} style={{ background: getBgColor() }}>
                                    <td><strong>{bracket.range}</strong></td>
                                    <td>{monthlyIncome.toFixed(0)}€/mes</td>
                                    <td>{dailyIncome.toFixed(2)}€/día</td>
                                    <td style={{ color: getTextColor(), fontWeight: 'bold' }}>
                                      {pass1Pct.toFixed(2)}%
                                    </td>
                                    <td style={{ color: getTextColor(), fontWeight: 'bold' }}>
                                      {pass3DayPct.toFixed(2)}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div style={{ marginTop: '12px', padding: '10px', background: '#f8f9fa', borderRadius: '4px', fontSize: '0.9rem', color: '#555' }}>
                            Incluso el turista de menor renta (≤25k/año) hace un esfuerzo económico menor que el residente mediano de Las Palmas para usar el transporte público con movilidad ilimitada.
                          </div>
                        </div>
                      );
                    })()}

                    {/* Table 2: Resident fares comparison */}
                    <div className="comparison-table" style={{ marginBottom: '25px' }}>
                      <h4 style={{ marginBottom: '12px', fontSize: '1rem', color: '#34495e' }}>
                        Tarifas residentes: esfuerzo económico comparado
                      </h4>
                      <table>
                        <thead>
                          <tr>
                            <th>Tarifa Residente</th>
                            <th>Precio Total</th>
                            <th>€/Viaje</th>
                            <th>Renta P50</th>
                            <th>% Renta Diaria<br />(1 viaje)</th>
                            <th>Ratio vs<br />Tarjeta 1D</th>
                          </tr>
                        </thead>
                        <tbody>
                          {residentFares.map((fare, index) => {
                            const costPerTrip = fare.price / fare.trips;
                            const pctDailyIncomeP50 = (costPerTrip / localDailyIncome) * 100;
                            const ratio1Day = pctDailyIncomeP50 / pass1PctTourist;
                            const isSocial = fare.type === 'social';

                            return (
                              <tr key={index} style={{
                                background: isSocial ? 'rgba(46, 204, 113, 0.08)' : 'rgba(231, 76, 60, 0.08)',
                                borderTop: index === 0 ? '2px solid #e74c3c' : (isSocial && residentFares[index - 1].type !== 'social' ? '2px solid #27ae60' : 'none')
                              }}>
                                <td>
                                  <strong>{fare.name}</strong>
                                  {isSocial && <br />}
                                  {isSocial && <span style={{ fontSize: '0.8rem', color: '#27ae60', fontStyle: 'italic' }}>Tarifa social</span>}
                                </td>
                                <td>{fare.price.toFixed(2)}€</td>
                                <td><strong>{costPerTrip.toFixed(3)}€</strong></td>
                                <td>{localIncome.toFixed(0)}€/mes<br /><span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>({localDailyIncome.toFixed(2)}€/día)</span></td>
                                <td style={{
                                  color: isSocial ? '#27ae60' : '#e74c3c',
                                  fontWeight: 'bold',
                                  fontSize: '1.02rem'
                                }}>{pctDailyIncomeP50.toFixed(3)}%</td>
                                <td style={{
                                  color: ratio1Day > 1.5 ? '#c0392b' : (isSocial ? '#27ae60' : '#e67e22'),
                                  fontWeight: 'bold'
                                }}>{ratio1Day.toFixed(2)}x</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Table 3: Resident P10 comparison (most vulnerable) */}
                    <div className="comparison-table" style={{ marginBottom: '25px' }}>
                      <h4 style={{ marginBottom: '12px', fontSize: '1rem', color: '#c0392b' }}>
                        Residentes renta baja (P10)
                      </h4>
                      <table>
                        <thead>
                          <tr>
                            <th>Tarifa</th>
                            <th>€/Viaje</th>
                            <th>Renta P10</th>
                            <th>% Renta Diaria</th>
                            <th>Ratio vs Turista<br />Tarjeta 1D</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: 'rgba(192, 57, 43, 0.15)' }}>
                            <td><strong>Pago Directo</strong></td>
                            <td>1.40€</td>
                            <td rowSpan={3}>{p10Income.toFixed(0)}€/mes<br /><span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>({p10DailyIncome.toFixed(2)}€/día)</span></td>
                            <td style={{ color: '#c0392b', fontWeight: 'bold', fontSize: '1.1rem' }}>
                              {((1.40 / p10DailyIncome) * 100).toFixed(2)}%
                            </td>
                            <td style={{ color: '#8b0000', fontWeight: 'bold', fontSize: '1.05rem' }}>
                              {(((1.40 / p10DailyIncome) * 100) / pass1PctTourist).toFixed(1)}x
                            </td>
                          </tr>
                          <tr style={{ background: 'rgba(192, 57, 43, 0.12)' }}>
                            <td><strong>Bono Guagua</strong></td>
                            <td>0.42€</td>
                            <td style={{ color: '#c0392b', fontWeight: 'bold', fontSize: '1.05rem' }}>
                              {((0.42 / p10DailyIncome) * 100).toFixed(3)}%
                            </td>
                            <td style={{ color: '#c0392b', fontWeight: 'bold' }}>
                              {(((0.42 / p10DailyIncome) * 100) / pass1PctTourist).toFixed(2)}x
                            </td>
                          </tr>
                          <tr style={{ background: 'rgba(46, 204, 113, 0.12)' }}>
                            <td><strong>Bono Solidario</strong><br /><span style={{ fontSize: '0.8rem', color: '#27ae60', fontStyle: 'italic' }}>Tarifa social</span></td>
                            <td>0.125€</td>
                            <td style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '1.05rem' }}>
                              {((0.125 / p10DailyIncome) * 100).toFixed(3)}%
                            </td>
                            <td style={{ color: '#27ae60', fontWeight: 'bold' }}>
                              {(((0.125 / p10DailyIncome) * 100) / pass1PctTourist).toFixed(2)}x
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="critical-note" style={{ marginTop: '20px', background: '#ffebee', borderLeft: '5px solid #c0392b', padding: '18px', borderRadius: '6px' }}>
                      <ul style={{ marginBottom: 0, lineHeight: '1.8', fontSize: '0.95rem' }}>
                        <li>
                          <strong>Turista:</strong> Paga 5.00€ por movilidad <strong>ilimitada 24h</strong> = {pass1PctTourist.toFixed(2)}% de su renta diaria ({touristIncome.toFixed(0)}€/mes).
                        </li>
                        <li>
                          <strong>Residente P50 con Pago Directo:</strong> Paga 1.40€ por <strong>1 solo viaje</strong> = {((1.40 / localDailyIncome) * 100).toFixed(2)}% de su renta diaria →
                          <strong style={{ color: '#c0392b' }}> {(((1.40 / localDailyIncome) * 100) / pass1PctTourist).toFixed(1)}x más esfuerzo</strong> que el turista.
                        </li>
                        <li>
                          <strong>Residente P10 (renta baja) con Bono Guagua (0.42€/viaje):</strong> Hace <strong style={{ color: '#c0392b' }}>
                            {(((0.42 / p10DailyIncome) * 100) / pass1PctTourist).toFixed(1)}x más esfuerzo</strong> que el turista para un solo viaje.
                        </li>
                        <li style={{ marginTop: '10px', fontWeight: 'bold', color: '#8b0000', fontSize: '1.02rem' }}>
                          → Incluso con <strong>tarifas sociales</strong>, un residente de renta baja (P10) hace {(((0.125 / p10DailyIncome) * 100) / pass1PctTourist).toFixed(1)}x más esfuerzo
                          que un turista para costear un solo viaje (Bono Solidario 0.125€/viaje vs Tarjeta 1D ilimitada).
                        </li>
                      </ul>
                    </div>

                    <div className="verdict" style={{ marginTop: '20px', background: '#fff9e6', borderLeft: '4px solid #f39c12', padding: '15px', borderRadius: '6px' }}>
                      <p style={{ marginBottom: 0, lineHeight: '1.7' }}>
                        La estructura tarifaria favorece abrumadoramente a los turistas.
                        Un turista con renta de {touristIncome.toFixed(0)}€/mes paga {pass1PctTourist.toFixed(2)}% de su renta diaria
                        por <strong>movilidad ilimitada</strong>, mientras que un residente mediano ({localIncome.toFixed(0)}€/mes)
                        paga {((1.40 / localDailyIncome) * 100).toFixed(2)}% por <strong>un solo viaje</strong> con billete simple.
                        <br /><br />
                        Incluso las <strong>tarifas sociales</strong> (Bono Solidario, Bono Estudiante) no corrigen esta desigualdad:
                        un residente de renta baja hace entre {(((0.42 / p10DailyIncome) * 100) / pass1PctTourist).toFixed(1)}x
                        y {(((1.40 / p10DailyIncome) * 100) / pass1PctTourist).toFixed(1)}x más esfuerzo económico relativo que el turista
                        para usar el transporte público, dependiendo de la tarifa que utilice.
                        Esta estructura castiga sistemáticamente a los residentes que dependen del transporte para actividades esenciales.
                      </p>
                    </div>

                    {/* NEW SUBSECTION 2.5: Capacidad Económica Desigual */}
                    <div style={{ marginTop: '40px' }}>
                      <h3 style={{ color: '#2c3e50' }}>2.5. El esfuerzo relativo</h3>

                      {/* Box intro con datos clave */}
                      <div style={{ background: '#e8f4f8', padding: '20px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #3498db' }}>
                        <p style={{ marginTop: 0, fontSize: '1.05rem', lineHeight: '1.7', marginBottom: 0 }}>
                          Para el mismo período de uso (<strong>{touristData.avg_stay_days.toFixed(1)} días</strong> - estancia media turística),
                          el <strong>turista mediano ({touristDailyIncome.toFixed(2)}€/día)</strong> hace un esfuerzo del <strong>{((36 / (touristDailyIncome * touristData.avg_stay_days)) * 100).toFixed(2)}%</strong> de su renta,
                          mientras el <strong>residente vulnerable P10 ({p10DailyIncome.toFixed(2)}€/día)</strong> hace un esfuerzo del <strong>{((10 / (p10DailyIncome * touristData.avg_stay_days)) * 100).toFixed(2)}%</strong>.
                          <br /><br />
                          El residente con <strong>{(touristDailyIncome / p10DailyIncome).toFixed(1)}x menos renta</strong> hace <strong>{(((10 / (p10DailyIncome * touristData.avg_stay_days)) / (36 / (touristDailyIncome * touristData.avg_stay_days)))).toFixed(2)}x MÁS esfuerzo</strong>.
                        </p>
                      </div>

                      {/* Tabla 1: Brecha de renta */}
                      <div className="comparison-table" style={{ marginBottom: '25px' }}>
                        <h4 style={{ marginBottom: '12px', fontSize: '1rem', color: '#2c3e50' }}>
                          Brecha de capacidad económica
                        </h4>
                        <table>
                          <thead>
                            <tr>
                              <th>Perfil</th>
                              <th>Renta Mensual</th>
                              <th>Renta Diaria</th>
                              <th>Ratio vs Residente P10</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ background: 'rgba(231, 76, 60, 0.08)' }}>
                              <td><strong>Turista P50</strong></td>
                              <td>{touristIncome.toFixed(0)}€/mes</td>
                              <td style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e74c3c' }}>{touristDailyIncome.toFixed(2)}€/día</td>
                              <td style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#c0392b' }}>{(touristDailyIncome / p10DailyIncome).toFixed(2)}x más</td>
                            </tr>
                            <tr>
                              <td><strong>Residente P50</strong></td>
                              <td>{localIncome.toFixed(0)}€/mes</td>
                              <td>{localDailyIncome.toFixed(2)}€/día</td>
                              <td style={{ color: '#e67e22' }}>{(localDailyIncome / p10DailyIncome).toFixed(2)}x más</td>
                            </tr>
                            <tr style={{ background: 'rgba(192, 57, 43, 0.08)' }}>
                              <td><strong>Residente P10 (vulnerable)</strong></td>
                              <td>{p10Income.toFixed(0)}€/mes</td>
                              <td style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#27ae60' }}>{p10DailyIncome.toFixed(2)}€/día</td>
                              <td>1x (base)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Tabla 2: Tarifas Residentes - Todas las opciones */}
                      <div className="comparison-table" style={{ marginBottom: '25px' }}>
                        <h4 style={{ marginBottom: '12px', fontSize: '1rem', color: '#2c3e50' }}>
                          Esfuerzo económico comparado
                        </h4>
                        <table>
                          <thead>
                            <tr>
                              <th>Perfil</th>
                              <th>Renta/día</th>
                              <th>Tarifa</th>
                              <th>Coste 90 días</th>
                              <th>Coste {touristData.avg_stay_days.toFixed(1)} días*</th>
                              <th>% Renta {touristData.avg_stay_days.toFixed(1)}d</th>
                              <th>Ratio vs Turista</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ background: 'rgba(52, 152, 219, 0.08)' }}>
                              <td><strong>Turista P50</strong></td>
                              <td>{touristDailyIncome.toFixed(2)}€</td>
                              <td>3× Tarjeta 3D</td>
                              <td>36€</td>
                              <td>36€</td>
                              <td style={{ fontSize: '1.05rem', color: '#27ae60' }}>{((36 / (touristDailyIncome * touristData.avg_stay_days)) * 100).toFixed(2)}%</td>
                              <td>1x (base)</td>
                            </tr>
                            <tr>
                              <td><strong>Residente P50</strong></td>
                              <td>{localDailyIncome.toFixed(2)}€</td>
                              <td>Bono Residente</td>
                              <td>14€</td>
                              <td>{((14 / 90) * touristData.avg_stay_days).toFixed(2)}€</td>
                              <td style={{ color: '#e67e22' }}>{(((14 / 90) * touristData.avg_stay_days / (localDailyIncome * touristData.avg_stay_days)) * 100).toFixed(2)}%</td>
                              <td style={{ color: '#e67e22' }}>{((((14 / 90) * touristData.avg_stay_days / (localDailyIncome * touristData.avg_stay_days)) / (36 / (touristDailyIncome * touristData.avg_stay_days)))).toFixed(2)}x</td>
                            </tr>
                            <tr style={{ background: 'rgba(192, 57, 43, 0.08)' }}>
                              <td><strong>Residente P10 joven</strong></td>
                              <td>{p10DailyIncome.toFixed(2)}€</td>
                              <td>Wawa Joven**</td>
                              <td>10€</td>
                              <td>{((10 / 90) * touristData.avg_stay_days).toFixed(2)}€</td>
                              <td style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#c0392b' }}>{(((10 / 90) * touristData.avg_stay_days / (p10DailyIncome * touristData.avg_stay_days)) * 100).toFixed(2)}%</td>
                              <td style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#c0392b' }}>{((((10 / 90) * touristData.avg_stay_days / (p10DailyIncome * touristData.avg_stay_days)) / (36 / (touristDailyIncome * touristData.avg_stay_days)))).toFixed(2)}x MÁS</td>
                            </tr>
                            <tr style={{ background: 'rgba(192, 57, 43, 0.12)' }}>
                              <td><strong>Residente P10 vulnerable</strong></td>
                              <td>{p10DailyIncome.toFixed(2)}€</td>
                              <td>Bono Oro**</td>
                              <td>10€</td>
                              <td>{((10 / 90) * touristData.avg_stay_days).toFixed(2)}€</td>
                              <td style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#c0392b' }}>{(((10 / 90) * touristData.avg_stay_days / (p10DailyIncome * touristData.avg_stay_days)) * 100).toFixed(2)}%</td>
                              <td style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#c0392b' }}>{((((10 / 90) * touristData.avg_stay_days / (p10DailyIncome * touristData.avg_stay_days)) / (36 / (touristDailyIncome * touristData.avg_stay_days)))).toFixed(2)}x MÁS</td>
                            </tr>
                          </tbody>
                        </table>
                        <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#7f8c8d', lineHeight: '1.6' }}>
                          <p style={{ marginBottom: '5px' }}>*Coste prorrateado para {touristData.avg_stay_days.toFixed(1)} días (estancia media turística) desde tarifa de 90 días.</p>
                          <p style={{ marginBottom: 0 }}>**Wawa Joven: &lt;28 años. Bono Oro: &gt;65 años o renta familiar &lt;14.000€/año.</p>
                        </div>
                      </div>

                      {/* Bloque sobre condicionalidad */}
                      <div style={{ background: '#fff9e6', padding: '18px', borderRadius: '6px', marginBottom: '25px', borderLeft: '4px solid #f39c12' }}>
                        <p style={{ marginTop: 0, fontWeight: 'bold', color: '#f39c12', fontSize: '1.05rem' }}>
                          Sobre la condicionalidad de las tarifas residentes
                        </p>
                        <p style={{ marginBottom: 0, lineHeight: '1.7' }}>
                          Las tarifas Wawa Joven, Bono Residente y Bono Oro pueden ser <strong>gratuitas en recargas futuras</strong> si el residente realiza <strong>30 viajes en 90 días</strong>.
                          Sin embargo, esta gratuidad es <strong>futura y condicionada</strong>. El coste inicial siempre existe.
                          <br /><br />
                          <strong>La pregunta clave no es si los residentes deben cumplir condiciones</strong>, sino: <strong>¿Por qué no redistribuir un esfuerzo ínfimo desde el turismo (que tiene {(touristDailyIncome / p10DailyIncome).toFixed(1)}x más renta que el residente vulnerable) para hacer estas tarifas directamente gratuitas sin condiciones?</strong>
                        </p>
                      </div>

                      {/* Box crítico */}
                      <div style={{ background: '#ffebee', padding: '18px', borderRadius: '6px', marginBottom: '25px', borderLeft: '4px solid #c0392b' }}>
                        <p style={{ marginTop: 0, fontWeight: 'bold', color: '#c0392b', fontSize: '1.05rem' }}>
                          Esfuerzo inverso a la capacidad
                        </p>
                        <p style={{ marginBottom: 0, lineHeight: '1.7' }}>
                          El turista con <strong>{(touristDailyIncome / p10DailyIncome).toFixed(1)}x más renta</strong> ({touristDailyIncome.toFixed(2)}€/día vs {p10DailyIncome.toFixed(2)}€/día) hace un esfuerzo
                          <strong> {((((10 / 90) * touristData.avg_stay_days / (p10DailyIncome * touristData.avg_stay_days)) / (36 / (touristDailyIncome * touristData.avg_stay_days)))).toFixed(2)}x MENOR</strong> ({((36 / (touristDailyIncome * touristData.avg_stay_days)) * 100).toFixed(2)}% vs {(((10 / 90) * touristData.avg_stay_days / (p10DailyIncome * touristData.avg_stay_days)) * 100).toFixed(2)}%) para el mismo servicio de movilidad ilimitada.
                          <br /><br />
                          El sistema está diseñado <strong>inversamente proporcional a la necesidad</strong>:
                          quien más puede pagar hace menos esfuerzo, quien menos puede pagar hace más esfuerzo.
                        </p>
                      </div>

                      {/* Tabla 3: Escenarios redistributivos con penetración */}
                      {(() => {
                        const penetrationRates = [0.30, 0.40, 0.50];
                        const dailyIncrements = [0.5, 1.0, 2.0];

                        return (
                          <div className="comparison-table" style={{ marginBottom: '25px' }}>
                            <h4 style={{ marginBottom: '12px', fontSize: '1rem', color: '#2c3e50' }}>
                              Recaudación potencial: escenarios de penetración y esfuerzo del turista
                            </h4>
                            <table>
                              <thead>
                                <tr>
                                  <th>Penetración TP*</th>
                                  <th>Turistas usando TP</th>
                                  <th>+0.50€/día</th>
                                  <th>+1.00€/día</th>
                                  <th>+2.00€/día</th>
                                </tr>
                              </thead>
                              <tbody>
                                {penetrationRates.map((rate, idx) => {
                                  const touristsUsing = Math.floor(touristData.total_tourists * rate);
                                  return (
                                    <tr key={rate} style={{ background: idx === 1 ? 'rgba(52, 152, 219, 0.08)' : 'transparent' }}>
                                      <td><strong>{(rate * 100).toFixed(0)}%</strong></td>
                                      <td>{touristsUsing.toLocaleString()}</td>
                                      <td>{((touristsUsing * touristData.avg_stay_days * 0.5) / 1000000).toFixed(2)}M€</td>
                                      <td style={{ fontWeight: idx === 1 ? 'bold' : 'normal' }}>
                                        {((touristsUsing * touristData.avg_stay_days * 1.0) / 1000000).toFixed(2)}M€
                                      </td>
                                      <td>{((touristsUsing * touristData.avg_stay_days * 2.0) / 1000000).toFixed(2)}M€</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#7f8c8d', lineHeight: '1.6' }}>
                              <p style={{ marginBottom: '5px' }}>
                                *TP = Transporte Público. Estimación conservadora: no todos los turistas usan transporte público.
                              </p>
                              <p style={{ marginBottom: '5px' }}>
                                <strong>Escenario base (40% penetración)</strong>: {Math.floor(touristData.total_tourists * 0.40).toLocaleString()} turistas usan TP de {touristData.total_tourists.toLocaleString()} totales.
                              </p>
                              <p style={{ marginBottom: 0 }}>
                                <strong>Esfuerzo turista con +1€/día</strong>: +{((((36 + 1 * touristData.avg_stay_days) / (touristDailyIncome * touristData.avg_stay_days)) - (36 / (touristDailyIncome * touristData.avg_stay_days))) * 100).toFixed(2)}% de su renta (prácticamente imperceptible).
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Box impacto redistributivo */}
                      {(() => {
                        const penetration = 0.40;
                        const touristsUsing = Math.floor(touristData.total_tourists * penetration);
                        const revenueWith1Euro = (touristsUsing * touristData.avg_stay_days * 1) / 1000000;

                        return (
                          <div style={{ background: '#e8f5e9', padding: '18px', borderRadius: '6px', borderLeft: '4px solid #27ae60' }}>
                            <p style={{ marginBottom: '12px', lineHeight: '1.7' }}>
                              Un incremento de <strong>1€/día para el turista</strong> (asumiendo 40% penetración TP):
                            </p>
                            <ul style={{ marginBottom: '12px', paddingLeft: '20px', lineHeight: '1.7' }}>
                              <li>Esfuerzo adicional: <strong>+{((((36 + 1 * touristData.avg_stay_days) / (touristDailyIncome * touristData.avg_stay_days)) - (36 / (touristDailyIncome * touristData.avg_stay_days))) * 100).toFixed(2)}%</strong> (prácticamente imperceptible)</li>
                              <li>Coste por estancia: <strong>{touristData.avg_stay_days.toFixed(1)}€</strong> (menos de un café diario)</li>
                              <li>Recaudación anual: <strong>{revenueWith1Euro.toFixed(2)} millones €</strong></li>
                            </ul>
                            <p style={{ marginBottom: 0, lineHeight: '1.7', fontWeight: 'bold' }}>
                              Con {revenueWith1Euro.toFixed(2)}M€ se podría:
                              <br />
                              - Subsidiar completamente Wawa Joven para <strong>{Math.floor((revenueWith1Euro * 1000000) / 10 / 4).toLocaleString()} jóvenes residentes/año</strong>
                              <br />
                              - Eliminar el coste de Bono Residente para <strong>{Math.floor((revenueWith1Euro * 1000000) / 14 / 4).toLocaleString()} residentes/año</strong>
                              <br />
                              - Reducir el esfuerzo del residente P10 del {(((10 / 90) * touristData.avg_stay_days / (p10DailyIncome * touristData.avg_stay_days)) * 100).toFixed(2)}% al <strong>0%</strong>
                            </p>
                          </div>
                        );
                      })()}
                      {(() => {
                        const penetration = 0.40;
                        const touristsUsing = Math.floor(touristData.total_tourists * penetration);
                        const revenueWith1Euro = (touristsUsing * touristData.avg_stay_days * 1) / 1000000;
                        const p10EffortPct = (((10 / 90) * touristData.avg_stay_days / (p10DailyIncome * touristData.avg_stay_days)) * 100);
                        const touristEffortPct = ((36 / (touristDailyIncome * touristData.avg_stay_days)) * 100);

                        return (
                          <>
                            <br></br>
                            <p style={{ marginBottom: 0, lineHeight: '1.8' }}>
                              El turista mediano tiene <strong>{(touristDailyIncome / p10DailyIncome).toFixed(1)}x más renta</strong> que el residente vulnerable ({touristDailyIncome.toFixed(2)}€/día vs {p10DailyIncome.toFixed(2)}€/día),
                              pero hace <strong>{(p10EffortPct / touristEffortPct).toFixed(2)}x MENOS esfuerzo</strong> económico ({touristEffortPct.toFixed(2)}% vs {p10EffortPct.toFixed(2)}%) para movilidad ilimitada durante el mismo período.
                              <br /><br />
                              Un esfuerzo adicional de <strong>1€/día para el turista</strong> (+{((((36 + 1 * touristData.avg_stay_days) / (touristDailyIncome * touristData.avg_stay_days)) - (36 / (touristDailyIncome * touristData.avg_stay_days))) * 100).toFixed(2)}%, imperceptible) generaría, con penetración conservadora del 40% ({touristsUsing.toLocaleString()} turistas),
                              <strong> {revenueWith1Euro.toFixed(2)} millones €/año</strong>, suficiente para subsidiar completamente el transporte de <strong>{Math.floor((revenueWith1Euro * 1000000) / 10 / 4).toLocaleString()} jóvenes residentes </strong>
                              durante todo el año, eliminando su esfuerzo económico.
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}
            </section>
          )
        }


        {/* AN\u00c1LISIS POR DECILES DE RENTA */}
        {
          decileData?.deciles && touristData && (
            <section className="card" style={{ borderTop: '5px solid #8e44ad' }}>
              <h2>3. ASEQUIBILIDAD POR DECILES DE RENTA</h2>
              <p style={{ marginBottom: '20px', fontSize: '1.05rem', lineHeight: '1.7' }}>
                Este análisis desglosa el impacto de las tarifas del transporte público en <strong>cada nivel de renta</strong> de la población residente de Las Palmas de Gran Canaria, desde el decil más vulnerable (P10) hasta el más acomodado (P90).
                <br /><br />
                La segmentación por deciles permite identificar con precisión <strong>qué segmentos de la población enfrentan barreras de acceso</strong> al transporte público debido al coste relativo de las tarifas. Se evalúa la sostenibilidad económica considerando el porcentaje de renta diaria que representa el uso cotidiano del transporte (2 viajes/día: ida y vuelta al trabajo/estudios).
                <br /><br />
                Además, se compara la capacidad económica de los residentes con la de los turistas que visitan la ciudad, revelando brechas significativas que explican la estructura tarifaria actual y sus implicaciones para la equidad social.
              </p>

              {/* 5.1: Distribución de Renta por Deciles */}
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ color: '#2c3e50' }}>3.1. Distribución de renta por deciles</h3>
                <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '15px' }}>
                  Distribución de la población por niveles de renta mensual por unidad de consumo.
                </p>

                <div className="comparison-table">
                  <table className="decile-table">
                    <thead>
                      <tr>
                        <th>Decil</th>
                        <th>Renta Mensual</th>
                        <th>Renta Diaria</th>
                        <th>Rango de Renta</th>
                        <th>Población<br />Decil</th>
                        <th>% Población</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decileData.deciles.map((d, idx) => {
                        // Calcular población del decil (no acumulada)
                        const prevPopulation = idx > 0 ? decileData.deciles[idx - 1].population : 0;
                        const decilePopulation = d.population - prevPopulation;
                        const decilePopulationPct = idx > 0
                          ? d.population_pct - decileData.deciles[idx - 1].population_pct
                          : d.population_pct;

                        // Rango de renta
                        const prevIncome = idx > 0 ? decileData.deciles[idx - 1].income_monthly : 0;
                        const rangeText = idx === 0
                          ? `≤ ${d.income_monthly.toFixed(0)}€`
                          : idx === 9
                            ? `> ${prevIncome.toFixed(0)}€`
                            : `${prevIncome.toFixed(0)} - ${d.income_monthly.toFixed(0)}€`;

                        return (
                          <tr key={d.percentile} className={`decile-row-${d.percentile}`}>
                            <td><strong>P{d.percentile}</strong></td>
                            <td>{d.income_monthly.toFixed(0)}€/mes</td>
                            <td>{d.income_daily.toFixed(2)}€/día</td>
                            <td style={{ fontSize: '0.9rem', color: '#555' }}>{rangeText}</td>
                            <td>{decilePopulation.toLocaleString()} hab</td>
                            <td>{decilePopulationPct.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="correlation-note" style={{ marginTop: '15px' }}>
                  <p>La tabla muestra la distribución real de renta en la ciudad por deciles.
                    Cada decil representa aproximadamente el 10% de la población. El P10 marca el límite superior del 10% más pobre (≤{decileData.deciles[0]?.income_monthly.toFixed(0)}€/mes),
                    mientras que el P90 marca el límite del 10% más rico ({'>'}{decileData.deciles[8]?.income_monthly.toFixed(0)}€/mes).
                    La mediana (P50) es {decileData.deciles[4]?.income_monthly.toFixed(0)}€/mes, lo que significa que el 50% de la población gana menos de esa cantidad.</p>
                </div>

                {/* Tourist vs Resident Income Comparison */}
                {(() => {
                  const touristMedian = touristData?.weighted_median_income_per_consumption_unit || 3650;
                  const touristBrackets = touristData?.income_brackets || [];
                  const residentMedian = decileData.deciles[4]?.income_monthly || 0;
                  const residentP10 = decileData.deciles[0]?.income_monthly || 0;
                  const residentP90 = decileData.deciles[8]?.income_monthly || 0;

                  return (
                    <div style={{ marginTop: '30px' }}>
                      <h4 style={{ marginBottom: '12px', fontSize: '1rem', color: '#2c3e50' }}>
                        Turistas vs residentes por renta
                      </h4>

                      <div className="comparison-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Grupo</th>
                              <th>Renta Mensual<br />por ud. consumo</th>
                              <th>Posición vs<br />Residentes</th>
                              <th>Observación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Tourist brackets */}
                            <tr style={{ background: 'rgba(231, 76, 60, 0.08)' }}>
                              <td><strong>Turista renta baja</strong><br /><span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>≤25k/año</span></td>
                              <td>{(touristBrackets[0]?.midpoint / 12 || 1250).toFixed(0)}€/mes</td>
                              <td style={{ fontWeight: 'bold', color: '#e67e22' }}>
                                Entre P{(() => {
                                  const income = touristBrackets[0]?.midpoint / 12 || 1250;
                                  for (let i = 0; i < decileData.deciles.length - 1; i++) {
                                    if (income >= decileData.deciles[i].income_monthly && income < decileData.deciles[i + 1].income_monthly) {
                                      return `${decileData.deciles[i].percentile}-P${decileData.deciles[i + 1].percentile}`;
                                    }
                                  }
                                  return '90+';
                                })()}
                              </td>
                              <td style={{ fontSize: '0.9rem', color: '#555' }}>Supera al 10-15% más pobre de residentes</td>
                            </tr>
                            <tr style={{ background: 'rgba(52, 152, 219, 0.12)' }}>
                              <td><strong>Turista mediano</strong><br /><span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>25k-50k/año</span></td>
                              <td style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{touristMedian.toFixed(0)}€/mes</td>
                              <td style={{ fontWeight: 'bold', color: '#c0392b', fontSize: '1.05rem' }}>
                                {'>'} P90
                              </td>
                              <td style={{ fontSize: '0.9rem', color: '#c0392b', fontWeight: 'bold' }}>Supera al 90% de residentes</td>
                            </tr>
                            <tr style={{ background: 'rgba(46, 204, 113, 0.08)' }}>
                              <td><strong>Turista renta alta</strong><br /><span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>50k-75k/año</span></td>
                              <td>{(touristBrackets[2]?.midpoint / 12 || 5208).toFixed(0)}€/mes</td>
                              <td style={{ fontWeight: 'bold', color: '#8b0000', fontSize: '1.05rem' }}>
                                {'>>'} P90
                              </td>
                              <td style={{ fontSize: '0.9rem', color: '#8b0000', fontWeight: 'bold' }}>
                                {((touristBrackets[2]?.midpoint / 12 || 5208) / residentP90).toFixed(1)}x la renta P90 residente
                              </td>
                            </tr>
                            <tr style={{ background: 'rgba(155, 89, 182, 0.08)' }}>
                              <td><strong>Turista renta muy alta</strong><br /><span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>≥75k/año</span></td>
                              <td>{(touristBrackets[3]?.midpoint / 12 || 7500).toFixed(0)}€/mes</td>
                              <td style={{ fontWeight: 'bold', color: '#8b0000', fontSize: '1.05rem' }}>
                                {'>>'} P90
                              </td>
                              <td style={{ fontSize: '0.9rem', color: '#8b0000', fontWeight: 'bold' }}>
                                {((touristBrackets[3]?.midpoint / 12 || 7500) / residentP90).toFixed(1)}x la renta P90 residente
                              </td>
                            </tr>
                            <tr style={{ borderTop: '2px solid #7f8c8d' }}>
                              <td colSpan={4} style={{ padding: '12px', background: '#f8f9fa', fontSize: '0.9rem', color: '#555', lineHeight: '1.6' }}>
                                El <strong>turista mediano</strong> ({touristMedian.toFixed(0)}€/mes) tiene una renta superior al <strong>90% de los residentes</strong> locales.
                                Incluso el turista de renta baja (≤25k/año) se sitúa entre P10-P20, superando solo al 10-20% más pobre de la población local, lo que indica que la gran mayoría de turistas tiene una capacidad económica significativamente superior a la de los residentes.
                                Las tarjetas turísticas deberían estar calibradas para una capacidad de pago que supera ampliamente la de la mayoría de residentes.
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 5.2: Impacto tarifario por decil */}
              <div style={{ marginTop: '40px' }}>
                <h3 style={{ color: '#2c3e50' }}>3.2. Impacto de tarifas por nivel de renta</h3>
                <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '15px' }}>
                  Análisis de sostenibilidad económica asumiendo <strong>2 viajes/día</strong> (ida+vuelta trabajo).
                  Clasificación: <span style={{ color: '#27ae60' }}>Verde &lt;2%</span>, <span style={{ color: '#f39c12' }}>Amarillo 2-5%</span>, <span style={{ color: '#c0392b' }}>Rojo &gt;5%</span> de renta diaria.
                </p>

                <div className="comparison-table">
                  <table style={{ fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>Decil</th>
                        <th>Renta€/día</th>
                        <th>Pago Directo (1.40€×2)</th>
                        <th>Bono Guagua (0.42€×2)</th>
                        <th>Wawa Joven (10€/90d)*</th>
                        <th>Bono Oro (10€/90d)*</th>
                        <th>Bono Residente (14€/90d)*</th>
                        <th>Turista P50</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decileData.tariff_impact.map((impact) => {
                        const touristIncome = touristData.weighted_median_income_per_consumption_unit;
                        const touristDailyIncome = touristIncome / 30;
                        const touristPct = ((1.40 * 2) / touristDailyIncome) * 100;

                        // Calculate initial cost percentages for subscription-based tariffs
                        // Formula: (initial_cost / 90 days) / daily_income * 100
                        // We assume 2 trips/day, so daily cost = (cost/90) for comparison
                        const wawaJovenPct = ((10 / 90) / impact.income_daily) * 100;
                        const bonoOroPct = ((10 / 90) / impact.income_daily) * 100;
                        const bonoResidentePct = ((14 / 90) / impact.income_daily) * 100;

                        // Classify sustainability for these tariffs
                        const classifySustainability = (pct: number) => {
                          if (pct < 2) return 'sostenible';
                          if (pct < 5) return 'ajustado';
                          return 'insostenible';
                        };

                        return (
                          <tr key={impact.decile} className={`decile-row-${impact.decile}`}>
                            <td><strong>P{impact.decile}</strong></td>
                            <td>{impact.income_daily.toFixed(2)}€</td>
                            <td>
                              <span className={`sustainability-badge sustainability-${impact.tariff_costs['Pago Directo'].sustainability}`}>
                                {impact.tariff_costs['Pago Directo'].pct_daily_income.toFixed(2)}%
                              </span>
                            </td>
                            <td>
                              <span className={`sustainability-badge sustainability-${impact.tariff_costs['Bono Guagua'].sustainability}`}>
                                {impact.tariff_costs['Bono Guagua'].pct_daily_income.toFixed(2)}%
                              </span>
                            </td>
                            <td>
                              <span className={`sustainability-badge sustainability-${classifySustainability(wawaJovenPct)}`}>
                                {wawaJovenPct.toFixed(2)}%
                              </span>
                            </td>
                            <td>
                              <span className={`sustainability-badge sustainability-${classifySustainability(bonoOroPct)}`}>
                                {bonoOroPct.toFixed(2)}%
                              </span>
                            </td>
                            <td>
                              <span className={`sustainability-badge sustainability-${classifySustainability(bonoResidentePct)}`}>
                                {bonoResidentePct.toFixed(2)}%
                              </span>
                            </td>
                            <td>
                              <span className="sustainability-badge sustainability-sostenible">
                                {touristPct.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '15px', fontSize: '0.85rem', color: '#7f8c8d', lineHeight: '1.6' }}>
                  *<strong>Wawa Joven</strong> (&lt;28 años), <strong>Bono Oro</strong> (&gt;65 años o renta familiar &lt;14k€/año) y <strong>Bono Residente Canario</strong> requieren un <strong>pago inicial</strong> (10€, 10€ y 14€ respectivamente para 90 días).
                  <br />
                  Sin embargo, tienen el <strong>potencial de ser gratuitos en recargas futuras</strong> si el usuario realiza un <strong>mínimo de 30 viajes en 90 días</strong>.
                  <br />
                  Con <strong>2 viajes/día</strong> (ida y vuelta al trabajo/estudios), se alcanzan <strong>60 viajes/mes</strong>, cumpliendo holgadamente el requisito de gratuidad para las siguientes recargas.
                </div>


              </div>

              {/* 5.3: Análisis de Sensibilidad */}
              <div style={{ marginTop: '40px' }}>
                <h3 style={{ color: '#2c3e50' }}>3.3. Análisis de sensibilidad sobre el pago directo</h3>
                <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '15px' }}>
                  Impacto de variaciones en el precio del pago directo sobre la población en situación de insostenibilidad (&gt;5% renta diaria).
                </p>

                <div className="comparison-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Escenario</th>
                        <th>Precio Billete</th>
                        <th>Cambio %</th>
                        <th>Población Insostenible</th>
                        <th>% Población</th>
                        <th>Δ Habitantes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decileData.sensitivity.map((scenario, idx) => {
                        const isBaseline = scenario.price_change_eur === 0;
                        const newPrice = 1.40 + scenario.price_change_eur;

                        return (
                          <tr key={idx} style={{
                            background: isBaseline ? 'rgba(52, 152, 219, 0.1)' :
                              scenario.price_change_eur < 0 ? 'rgba(46, 204, 113, 0.05)' :
                                'rgba(231, 76, 60, 0.05)',
                            fontWeight: isBaseline ? 'bold' : 'normal'
                          }}>
                            <td>{isBaseline ? 'ACTUAL' : scenario.price_change_eur > 0 ? `Subida ${scenario.price_change_eur.toFixed(2)}€` : `Bajada ${Math.abs(scenario.price_change_eur).toFixed(2)}€`}</td>
                            <td>{newPrice.toFixed(2)}€</td>
                            <td style={{ color: scenario.price_change_eur > 0 ? '#e74c3c' : scenario.price_change_eur < 0 ? '#27ae60' : '#3498db' }}>
                              {scenario.price_change_pct > 0 ? '+' : ''}{scenario.price_change_pct.toFixed(1)}%
                            </td>
                            <td>{scenario.population_unsustainable.toLocaleString()} hab</td>
                            <td style={{
                              fontWeight: 'bold',
                              color: scenario.population_unsustainable_pct > 30 ? '#c0392b' :
                                scenario.population_unsustainable_pct > 20 ? '#e74c3c' :
                                  scenario.population_unsustainable_pct > 10 ? '#f39c12' : '#27ae60'
                            }}>
                              {scenario.population_unsustainable_pct.toFixed(1)}%
                            </td>
                            <td style={{ color: scenario.population_change > 0 ? '#e74c3c' : scenario.population_change < 0 ? '#27ae60' : '#7f8c8d' }}>
                              {scenario.population_change > 0 ? '+' : ''}{scenario.population_change.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const baseline = decileData.sensitivity.find(s => s.price_change_eur === 0);
                  const increase01 = decileData.sensitivity.find(s => s.price_change_eur === 0.10);
                  const decrease01 = decileData.sensitivity.find(s => s.price_change_eur === -0.10);

                  if (!baseline || !increase01 || !decrease01) return null;

                  const elasticityUp = ((increase01.population_unsustainable_pct - baseline.population_unsustainable_pct) / baseline.population_unsustainable_pct) / (increase01.price_change_pct / 100);
                  // const elasticityDown = ((decrease01.population_unsustainable_pct - baseline.population_unsustainable_pct) / baseline.population_unsustainable_pct) / (decrease01.price_change_pct / 100);

                  return (
                    <div className="verdict critical" style={{ marginTop: '20px' }}>
                      <p><strong>Análisis de elasticidad:</strong></p>
                      <ul style={{ marginTop: '10px', lineHeight: '1.8' }}>
                        <li>Por cada <strong>1% de aumento</strong> en el precio, la población insostenible crece aproximadamente <strong>{(elasticityUp * 1).toFixed(1)}%</strong> (elasticidad: {elasticityUp.toFixed(2)}).</li>
                        <li>Una <strong>subida de 0.10€</strong> (+7.1%) añadiría <strong>{increase01.population_change.toLocaleString()} habitantes</strong> a situación de insostenibilidad.</li>
                        <li>Una <strong>bajada de 0.10€</strong> (-7.1%) sacaría de insostenibilidad a <strong>{Math.abs(decrease01.population_change).toLocaleString()} habitantes</strong>.</li>
                      </ul>
                      <p style={{ marginTop: '15px' }}>
                        El precio del pago directo tiene un impacto directo y medible.
                        Pequeñas variaciones generan cambios significativos en la accesibilidad para decenas de miles de personas.
                      </p>
                    </div>
                  );
                })()}
              </div>

            </section>
          )
        }



        {/* SECTION 2: TARIFF COMPARATIVE ANALYSIS */}
        <section className="card">
          <h2>4. TARIFAS</h2>
          <p style={{ marginTop: '15px', marginBottom: '25px', lineHeight: '1.6', color: '#555', fontSize: '0.95rem', textAlign: 'justify' }}>
            El sistema tarifario actual se compone de una variedad de títulos de transporte diferenciados por el perfil de usuario y la frecuencia de uso. La oferta abarca desde modalidades de pago único para usuarios ocasionales hasta bonos temporales para residentes, así como tarifas específicas para distintos colectivos como estudiantes, jubilados, desempleados o familias numerosas. A continuación se presenta el desglose de los títulos vigentes, sus costes y condiciones de aplicación.
          </p>

          <div className="tarifas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px', marginBottom: '40px' }}>

            {(() => {
              const allFares = [
                { name: 'Pago Directo', price: '1,40€', desc: 'Pago a bordo. Un solo viaje.', color: '#34495e', bg: '#ecf0f1', visible: true },
                { name: 'Bono-2', price: '2,40€', desc: '2 viajes (1,20€/viaje). Sin contacto.', color: '#34495e', bg: '#ecf0f1' },
                { name: 'Bono Guagua', price: '0,42€ / viaje', desc: 'Recarga mín. 8,50€. Transbordos gratuitos.', color: '#d35400', bg: '#fef5e7', visible: true },
                { name: 'Bono Compartido', price: 'Uso mixto', desc: 'Válido en Global. Recarga mín. 8,50€.', color: '#d35400', bg: '#fef5e7' },
                { name: 'Residente Canario', price: '14€ / mes', desc: 'Ilimitado. Gratis si >15 viajes/mes.', color: '#27ae60', bg: '#e8f8f5', visible: true },
                { name: 'Wawa Joven', price: '10€ / mes', desc: '<28 años. Ilimitado. Gratis con uso.', color: '#27ae60', bg: '#e8f8f5', visible: true },
                { name: 'Bono Oro', price: '10€ / mes', desc: 'Ilimitado. Subvencionado o Gratis.', color: '#27ae60', bg: '#e8f8f5' },
                { name: 'Bono Estudiante', price: '14€ / mes', desc: '80 viajes/mes. <26 años.', color: '#8e44ad', bg: '#f4ecf7' },
                { name: 'Bono Solidario', price: '5€ / mes', desc: 'Desempleados. 40 viajes/mes.', color: '#8e44ad', bg: '#f4ecf7', visible: true },
                { name: 'Bono Jubilado', price: 'GRATIS', desc: 'Rentas bajas. 100 viajes/mes.', color: '#8e44ad', bg: '#f4ecf7' },
                { name: 'Fam. Num. General', price: '10€', desc: '72 viajes / 90 días.', color: '#c0392b', bg: '#fdedec' },
                { name: 'Fam. Num. Especial', price: '10€', desc: '94 viajes / 90 días.', color: '#c0392b', bg: '#fdedec' },
                { name: 'Tarjeta 1 Día', price: '5,00€', desc: 'Viajes ilimitados 24h.', color: '#2980b9', bg: '#ebf5fb', visible: true },
                { name: 'Tarjeta 3 Días', price: '12,00€', desc: 'Viajes ilimitados 72h.', color: '#2980b9', bg: '#ebf5fb', visible: true },
              ];

              const visibleFares = allFares.filter(f => f.visible);
              const hiddenFares = allFares.filter(f => !f.visible);
              const faresToShow = showAllFares ? [...visibleFares, ...hiddenFares] : visibleFares;

              return (
                <>
                  {faresToShow.map((fare, idx) => (
                    <div key={idx} style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <strong style={{ color: fare.color, fontSize: '0.95rem' }}>{fare.name}</strong>
                        <span style={{ background: fare.bg, color: fare.color, padding: '3px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {fare.price}
                        </span>
                      </div>
                      <p style={{ margin: 'auto 0 0 0', fontSize: '0.85rem', color: '#7f8c8d', lineHeight: '1.4' }}>
                        {fare.desc}
                      </p>
                    </div>
                  ))}

                  {!showAllFares && hiddenFares.length > 0 && (
                    <div
                      onClick={() => setShowAllFares(true)}
                      style={{
                        cursor: 'pointer',
                        background: '#f8f9fa',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '2px dashed #bdc3c7',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        color: '#7f8c8d',
                        transition: 'all 0.2s ease',
                        minHeight: '100px'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', marginBottom: '5px' }}>+</span>
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Ver todos los títulos ({hiddenFares.length} más)</span>
                    </div>
                  )}
                  {showAllFares && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '10px' }}>
                      <button
                        onClick={() => setShowAllFares(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3498db',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontSize: '0.9rem'
                        }}
                      >
                        Ver menos
                      </button>
                    </div>
                  )}
                </>
              );
            })()}

          </div>

          <h2 style={{ marginTop: '30px', color: '#2c3e50' }}>4.1. COMPARADOR DE TARIFAS</h2>
          <p style={{ marginBottom: '20px', lineHeight: '1.6', color: '#555', fontSize: '0.95rem' }}>
            Comparativa de todas las tarifas disponibles ordenadas por rentabilidad.
            Ajusta los escenarios de uso para ver cómo cambia el coste por viaje de las tarifas planas (abonos mensuales y tarjetas de días).
          </p>

          {/* Scenario Configuration */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #dfe6e9', marginBottom: '25px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '1.1rem' }}>
              Configurar Escenario de Uso
            </h3>

            {/* Resident scenario */}
            <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #eee' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '12px', color: '#34495e', fontSize: '0.95rem' }}>
                🏠 Un residente que hace...
              </label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {[20, 40, 60, 90, 120].map(val => (
                  <button
                    key={val}
                    onClick={() => setRentabilityScenario({ trips: val })}
                    style={{
                      padding: '8px 16px',
                      background: rentabilityScenario.trips === val ? '#3498db' : '#f1f2f6',
                      color: rentabilityScenario.trips === val ? 'white' : '#7f8c8d',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {val} viajes/mes
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="range" min="10" max="150" step="5"
                  value={rentabilityScenario.trips}
                  onChange={(e) => setRentabilityScenario({ trips: parseInt(e.target.value) })}
                  style={{ flex: 1, cursor: 'pointer' }}
                />
                <span style={{ minWidth: '100px', textAlign: 'right', fontWeight: 'bold', color: '#2980b9', fontSize: '1.1rem' }}>
                  {rentabilityScenario.trips} viajes/mes
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginTop: '10px', fontStyle: 'italic' }}>
                Ejemplo: una persona que va al trabajo ida y vuelta (2 viajes/día × 5 días) hace ~40 viajes/mes
              </p>
            </div>

            {/* Tourist scenario */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '12px', color: '#34495e', fontSize: '0.95rem' }}>
                ✈️ Un turista que hace...
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[3, 6, 9, 12, 15].map(val => (
                  <button
                    key={val}
                    onClick={() => setRentabilityTouristScenario({ tripsPerDay: val })}
                    style={{
                      padding: '8px 16px',
                      background: rentabilityTouristScenario.tripsPerDay === val ? '#e67e22' : '#f1f2f6',
                      color: rentabilityTouristScenario.tripsPerDay === val ? 'white' : '#7f8c8d',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {val} viajes/día
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginTop: '10px', fontStyle: 'italic' }}>
                Ejemplo: un turista que visita 3 lugares (ida y vuelta a cada uno) hace ~6 viajes/día
              </p>
            </div>
          </div>

          <div className="comparison-table">
            <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <thead>
                <tr style={{ background: '#ecf0f1', color: '#2c3e50' }}>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Tarifa</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>Coste / Viaje</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>Ahorro vs Pago Directo</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>Viajes con 10€</th>
                </tr>
              </thead>
              <tbody>
                {tariffs.map((t: any) => ({
                  ...t,
                  calculated_cost: calculateNominalCost(t.name, rentabilityScenario.trips, rentabilityTouristScenario.tripsPerDay)
                }))
                  .sort((a: any, b: any) => a.calculated_cost - b.calculated_cost)
                  .map((t: any) => {
                    const costPerTrip = t.calculated_cost;
                    const tripsPer10 = costPerTrip > 0 ? (10 / costPerTrip) : 999;
                    const pagoDirecto = 1.40;
                    const savingsPerTrip = pagoDirecto - costPerTrip;
                    const savingsPercent = ((savingsPerTrip / pagoDirecto) * 100);
                    const name = t.name.replace(/_/g, ' ');

                    // Check if tariff cost depends on scenario (Unlimited or Time-based)
                    const isDependent = ['Residente Canario', 'Bono Residente', 'Wawa Joven', 'Bono Oro', 'Tarjeta 1 Día', 'Tarjeta 3 Días'].some(d => name.includes(d));

                    // Check if it is a subsidized/package fare for label
                    const isSubsidized = ['Wawa Joven', 'Bono Residente', 'Bono Oro', 'Bono Solidario', 'Fam. Num.'].some(k => name.includes(k));

                    return (
                      <tr key={t.name} style={{ borderBottom: '1px solid #eee', background: savingsPercent > 50 ? '#f0fff4' : 'white' }}>
                        <td style={{ padding: '12px' }}>
                          <strong style={{ color: '#2c3e50' }}>{name}</strong>
                          {isSubsidized && (
                            <span style={{ display: 'inline-block', marginLeft: '8px', fontSize: '0.75rem', background: '#f39c12', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Subvencionado</span>
                          )}
                          {name.includes('Jubilado') && (
                            <span style={{ display: 'inline-block', marginLeft: '8px', fontSize: '0.75rem', background: '#8e44ad', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Gratis</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{costPerTrip.toFixed(2)}€</span>
                          {isDependent && <span style={{ fontSize: '0.8em', color: '#95a5a6', marginLeft: '5px', display: 'block' }}>(según escenario)</span>}
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px' }}>
                          {savingsPerTrip > 0 ? (
                            <div>
                              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#27ae60' }}>
                                {savingsPerTrip.toFixed(2)}€
                              </span>
                              <span style={{ fontSize: '0.85rem', color: '#27ae60', display: 'block' }}>
                                ({savingsPercent.toFixed(0)}% ahorro)
                              </span>
                            </div>
                          ) : savingsPerTrip === 0 ? (
                            <span style={{ color: '#7f8c8d' }}>-</span>
                          ) : (
                            <div>
                              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#e74c3c' }}>
                                +{Math.abs(savingsPerTrip).toFixed(2)}€
                              </span>
                              <span style={{ fontSize: '0.85rem', color: '#e74c3c', display: 'block' }}>
                                ({Math.abs(savingsPercent).toFixed(0)}% más caro)
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px' }}>
                          {tripsPer10 > 100 ?
                            <span style={{ color: '#27ae60', fontWeight: 'bold' }}>∞</span> :
                            <span style={{ fontWeight: 600 }}>{tripsPer10.toFixed(1)}</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

        </section >




      </div >
    </div >
  );
}
