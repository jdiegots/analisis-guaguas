'use client';

import { useState, useEffect } from 'react';
import './tarifas.css';

interface Fare {
  name: string;
  type: string;
  price_euros: number;
  trips_included: number;
  validity_days: number;
  cost_per_trip: number | null;
  requirements: string;
  target_group: string;
  is_social_fare: boolean;
}

interface FareAnalysisSummary {
  avg_unemployment: number;
  avg_elderly_prop: number;
  avg_low_education: number;
  avg_working_class: number;
  avg_services_share: number;
  total_sections: number;
  median_coverage_300: number;
  median_nearest_stop: number;
}

interface FareAnalysisBus {
  avg_stops_count: number;
  avg_stops_density: number;
  avg_nearest_stop_dist: number;
  avg_coverage_300: number;
  avg_coverage_500: number;
  avg_freq_day: number;
  avg_freq_morning: number;
  avg_freq_midday: number;
  avg_freq_afternoon: number;
  avg_freq_night: number;
}

interface FareAnalysisContrast {
  key: string;
  label: string;
  unit: '%' | 'ratio';
  description: string;
  thresholds: {
    p25: number;
    p75: number;
  };
  sections: {
    high: number;
    low: number;
  };
  averages: {
    high_value: number;
    low_value: number;
    high_coverage_300: number;
    low_coverage_300: number;
    high_coverage_500: number;
    low_coverage_500: number;
    high_nearest_stop: number;
    low_nearest_stop: number;
    high_stops_count: number;
    low_stops_count: number;
    high_stops_density: number;
    low_stops_density: number;
    high_freq_day: number;
    low_freq_day: number;
    high_penalty: number;
    low_penalty: number;
  };
  gaps: {
    coverage_300: number;
    coverage_500: number;
    nearest_stop: number;
    stops_density: number;
    stops_count: number;
    freq_day: number;
    penalty_index: number;
  };
  correlations: {
    coverage_300: number;
    coverage_500: number;
    nearest_stop: number;
    stops_density: number;
    freq_day: number;
  };
}

interface FareAnalysisStats {
  summary: FareAnalysisSummary;
  bus: FareAnalysisBus;
  contrasts: FareAnalysisContrast[];
}

const formatPercent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const formatCoverage = (value: number) => `${value.toFixed(1)}%`;
const formatNumber = (value: number, digits = 1) => value.toFixed(digits);

const formatMetricValue = (value: number, unit: '%' | 'ratio') => {
  if (unit === '%') {
    return formatPercent(value);
  }
  return formatNumber(value, 2);
};

export default function AnalisisTarifas() {
  const [fares, setFares] = useState<Fare[]>([]);
  const [stats, setStats] = useState<FareAnalysisStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const faresRes = await fetch('/api/fares');
      const faresData = await faresRes.json();
      setFares(faresData);

      const statsRes = await fetch('/api/fare-analysis');
      const statsData = await statsRes.json();
      setStats(statsData);

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando análisis de tarifas...</div>;
  }

  const faresByTarget = fares.reduce((acc, fare) => {
    if (!acc[fare.target_group]) acc[fare.target_group] = [];
    acc[fare.target_group].push(fare);
    return acc;
  }, {} as Record<string, Fare[]>);

  const targetGroupNames: Record<string, string> = {
    general: 'Población General',
    students: 'Estudiantes',
    elderly: 'Jubilados/Mayores 65+',
    families: 'Familias Numerosas',
    unemployed: 'Desempleados',
    tourists: 'Turistas',
    youth: 'Jóvenes (<28 años)',
    residents: 'Residentes Canarios',
    elderly_low_income: 'Mayores 65+ / Renta Baja'
  };

  const avgCostGeneral = faresByTarget.general
    ?.filter(f => f.cost_per_trip)
    .reduce((sum, f) => sum + (f.cost_per_trip || 0), 0) / faresByTarget.general?.filter(f => f.cost_per_trip).length || 0;

  const avgCostSocial = fares
    .filter(f => f.is_social_fare && f.cost_per_trip)
    .reduce((sum, f) => sum + (f.cost_per_trip || 0), 0) / fares.filter(f => f.is_social_fare && f.cost_per_trip).length || 0;

  return (
    <div className="analisis-container">
      <header className="analisis-header">
        <h1>Análisis de Equidad Tarifaria</h1>
        <p>Evaluación de la relación entre tarifas de transporte e indicadores socioeconómicos</p>
        <a href="/" className="back-link">← Volver al mapa</a>
      </header>

      <div className="content">
        <section className="card">
          <h2>Resumen Ejecutivo</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-value">€{avgCostGeneral.toFixed(3)}</div>
              <div className="summary-label">Coste medio/viaje (tarifa general)</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">€{avgCostSocial.toFixed(3)}</div>
              <div className="summary-label">Coste medio/viaje (tarifa social)</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{((avgCostGeneral / avgCostSocial - 1) * 100).toFixed(0)}%</div>
              <div className="summary-label">Diferencia tarifa general vs social</div>
            </div>
            <div className="summary-item">
              <div className="summary-value">{fares.filter(f => f.is_social_fare).length}</div>
              <div className="summary-label">Tarifas sociales disponibles</div>
            </div>
          </div>
        </section>

        {stats && (
          <>
            <section className="card critical">
              <h2>Contexto Socioeconómico (promedios municipales)</h2>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-value">{formatPercent(stats.summary.avg_unemployment)}</div>
                  <div className="stat-label">Tasa media de desempleo</div>
                  <div className="stat-detail">Secciones analizadas: {stats.summary.total_sections}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatPercent(stats.summary.avg_elderly_prop)}</div>
                  <div className="stat-label">Población mayor de 65 años</div>
                  <div className="stat-detail">Presión de envejecimiento en la demanda</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatPercent(stats.summary.avg_low_education)}</div>
                  <div className="stat-label">Baja formación</div>
                  <div className="stat-detail">Primaria + Secundaria 1ª etapa</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatPercent(stats.summary.avg_working_class)}</div>
                  <div className="stat-label">Clase trabajadora</div>
                  <div className="stat-detail">Agricultura + industria + construcción</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatPercent(stats.summary.avg_services_share)}</div>
                  <div className="stat-label">Empleo en servicios</div>
                  <div className="stat-detail">Dependencia de sectores terciarios</div>
                </div>
              </div>
            </section>

            <section className="card">
              <h2>Oferta de Guaguas (todas las métricas)</h2>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-value">{formatNumber(stats.bus.avg_stops_count, 0)}</div>
                  <div className="stat-label">Paradas por sección</div>
                  <div className="stat-detail">Conteo promedio dentro de la sección</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatNumber(stats.bus.avg_stops_density, 1)}</div>
                  <div className="stat-label">Paradas por km²</div>
                  <div className="stat-detail">Densidad física de la red</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatNumber(stats.bus.avg_nearest_stop_dist, 0)}m</div>
                  <div className="stat-label">Parada más cercana</div>
                  <div className="stat-detail">Mediana: {formatNumber(stats.summary.median_nearest_stop, 0)}m</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatCoverage(stats.bus.avg_coverage_300)}</div>
                  <div className="stat-label">Cobertura 300m</div>
                  <div className="stat-detail">Mediana: {formatCoverage(stats.summary.median_coverage_300)}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatCoverage(stats.bus.avg_coverage_500)}</div>
                  <div className="stat-label">Cobertura 500m</div>
                  <div className="stat-detail">Acceso caminable extendido</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatNumber(stats.bus.avg_freq_day, 0)}</div>
                  <div className="stat-label">Frecuencia diaria</div>
                  <div className="stat-detail">Eventos en paradas (todo el día)</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatNumber(stats.bus.avg_freq_morning, 0)}</div>
                  <div className="stat-label">Frecuencia mañana</div>
                  <div className="stat-detail">06:00-10:00</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatNumber(stats.bus.avg_freq_midday, 0)}</div>
                  <div className="stat-label">Frecuencia mediodía</div>
                  <div className="stat-detail">12:00-16:00</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatNumber(stats.bus.avg_freq_afternoon, 0)}</div>
                  <div className="stat-label">Frecuencia tarde</div>
                  <div className="stat-detail">16:00-20:00</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{formatNumber(stats.bus.avg_freq_night, 0)}</div>
                  <div className="stat-label">Frecuencia noche</div>
                  <div className="stat-detail">20:00-24:00</div>
                </div>
              </div>
            </section>

            <section className="card">
              <h2>Indicadores avanzados: brechas socioeconómicas vs guaguas</h2>
              <p>
                Se comparan las secciones del cuartil alto (P75) frente al cuartil bajo (P25) de cada indicador.
                La brecha positiva en cobertura implica mejor servicio en el cuartil alto; la brecha positiva
                en distancia a parada indica peor acceso.
              </p>
              <div className="stats-grid">
                {stats.contrasts.map(metric => (
                  <div key={metric.key} className="stat-box">
                    <div className="stat-value">{metric.label}</div>
                    <div className="stat-label">{metric.description}</div>
                    <div className="stat-detail">
                      P25: {formatMetricValue(metric.thresholds.p25, metric.unit)} · P75: {formatMetricValue(metric.thresholds.p75, metric.unit)}
                    </div>
                    <div className="stat-detail">
                      Secciones: {metric.sections.low} (bajo) / {metric.sections.high} (alto)
                    </div>
                    <div className="stat-detail">
                      Cobertura 300m: {formatCoverage(metric.averages.low_coverage_300)} → {formatCoverage(metric.averages.high_coverage_300)}
                    </div>
                    <div className="stat-detail">
                      Cobertura 500m: {formatCoverage(metric.averages.low_coverage_500)} → {formatCoverage(metric.averages.high_coverage_500)}
                    </div>
                    <div className="stat-detail">
                      Parada más cercana: {formatNumber(metric.averages.low_nearest_stop, 0)}m → {formatNumber(metric.averages.high_nearest_stop, 0)}m
                    </div>
                    <div className="stat-detail">
                      Paradas/km²: {formatNumber(metric.averages.low_stops_density, 1)} → {formatNumber(metric.averages.high_stops_density, 1)}
                    </div>
                    <div className="stat-detail">
                      Frecuencia diaria: {formatNumber(metric.averages.low_freq_day, 0)} → {formatNumber(metric.averages.high_freq_day, 0)}
                    </div>
                    <div className="stat-detail">
                      Índice penalización guagua: {formatNumber(metric.averages.low_penalty, 2)} → {formatNumber(metric.averages.high_penalty, 2)}
                    </div>
                    <div className="stat-detail">
                      Brecha cobertura 300m: {formatCoverage(metric.gaps.coverage_300)} · Brecha distancia: {formatNumber(metric.gaps.nearest_stop, 0)}m
                    </div>
                    <div className="stat-detail">
                      Corr(guagua, {metric.label.toLowerCase()}):
                      {' '}Cob300 {formatNumber(metric.correlations.coverage_300, 2)},
                      {' '}Cob500 {formatNumber(metric.correlations.coverage_500, 2)},
                      {' '}Dist {formatNumber(metric.correlations.nearest_stop, 2)},
                      {' '}Dens {formatNumber(metric.correlations.stops_density, 2)},
                      {' '}Freq {formatNumber(metric.correlations.freq_day, 2)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="card">
          <h2>Análisis de Tarifas por Grupo Objetivo</h2>

          {Object.entries(faresByTarget).map(([target, targetFares]) => {
            const avgCost = targetFares
              .filter(f => f.cost_per_trip)
              .reduce((sum, f) => sum + (f.cost_per_trip || 0), 0) / targetFares.filter(f => f.cost_per_trip).length || 0;

            return (
              <div key={target} className="target-group">
                <h3>
                  {targetGroupNames[target] || target}
                  {targetFares[0]?.is_social_fare && <span className="badge social">Tarifa Social</span>}
                </h3>
                <div className="target-summary">
                  Coste medio por viaje: <strong>€{avgCost.toFixed(3)}</strong>
                </div>
                <div className="fares-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Tarifa</th>
                        <th>Precio</th>
                        <th>Viajes</th>
                        <th>Validez</th>
                        <th>€/Viaje</th>
                        <th>Requisitos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetFares.map((fare, idx) => (
                        <tr key={idx}>
                          <td><strong>{fare.name}</strong></td>
                          <td>€{fare.price_euros.toFixed(2)}</td>
                          <td>{fare.trips_included > 100 ? 'Ilimitado' : fare.trips_included}</td>
                          <td>{fare.validity_days} días</td>
                          <td>{fare.cost_per_trip ? `€${fare.cost_per_trip.toFixed(3)}` : '-'}</td>
                          <td className="requirements">{fare.requirements}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </section>

        <section className="card">
          <h2>Conclusiones Principales</h2>
          <div className="conclusions">
            <div className="conclusion">
              <h3>1. Contraste social obligatorio</h3>
              <p>
                El análisis ahora cruza cada indicador socioeconómico con métricas concretas de guaguas
                (paradas, densidad, cobertura 300m/500m, parada más cercana y frecuencia horaria).
                Así se puede medir si las tarifas sociales se aplican donde la oferta es peor.
              </p>
            </div>
            <div className="conclusion">
              <h3>2. Brechas territoriales cuantificadas</h3>
              <p>
                Las brechas P75 vs P25 muestran si las zonas más vulnerables reciben menos cobertura o
                mayores distancias a paradas. La correlación resume el sesgo estructural entre renta social
                y acceso real a la guagua.
              </p>
            </div>
            <div className="conclusion">
              <h3>3. Índice de penalización</h3>
              <p>
                El índice de penalización combina cobertura, distancia, densidad y frecuencia para
                detectar dónde el servicio es más insuficiente respecto a la media urbana.
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Recomendaciones de Política Tarifaria</h2>
          <div className="recommendations">
            <div className="recommendation urgent">
              <h3>Prioridad: Tarifas + oferta</h3>
              <p>Las tarifas sociales deben concentrarse en secciones con alta penalización de guaguas, no solo en renta.</p>
            </div>
            <div className="recommendation">
              <h3>Tarifas modulares por cobertura</h3>
              <p>Descuento adicional en barrios con baja cobertura 300m y poca frecuencia, para compensar la mala accesibilidad.</p>
            </div>
            <div className="recommendation">
              <h3>Plan de mejora por brechas</h3>
              <p>Fijar metas de cierre de brechas: elevar cobertura 300m y densidad de paradas en los P75 de desempleo y baja formación.</p>
            </div>
          </div>
        </section>

        <section className="card methodology">
          <h2>Metodología</h2>
          <p>
            Los indicadores socioeconómicos se contrastan con métricas de guaguas calculadas por sección.
            Se comparan cuartiles (P25 vs P75) y se calcula un índice de penalización usando z-scores de
            cobertura (300m y 500m), distancia a parada, densidad y frecuencia diaria. Las correlaciones
            se calculan con Pearson para detectar sesgos estructurales.
          </p>
        </section>
      </div>

      <footer className="analisis-footer">
        <p>Análisis basado en datos de tarifas, socioeconomía y cobertura de transporte público</p>
      </footer>
    </div>
  );
}
