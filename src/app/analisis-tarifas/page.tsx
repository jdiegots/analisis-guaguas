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

interface SocioeconomicStats {
  avg_unemployment: number;
  avg_elderly_prop: number;
  avg_low_education: number;
  sections_high_unemployment: number;
  sections_high_elderly: number;
  sections_poor_coverage: number;
  total_sections: number;
  // Bus Metrics
  avg_stops_density: number;
  avg_nearest_stop_dist: number;
  avg_coverage_300: number;
  avg_freq_day: number;
  avg_freq_morning: number;
}

export default function AnalisisTarifas() {
  const [fares, setFares] = useState<Fare[]>([]);
  const [stats, setStats] = useState<SocioeconomicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load fares
      const faresRes = await fetch('/api/fares');
      const faresData = await faresRes.json();
      setFares(faresData);

      // Load socioeconomic stats
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

  // Group fares by target
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

  // Calculate average costs
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
        {/* Executive Summary */}
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

        {/* Socioeconomic Context */}
        {stats && (
          <>
            <section className="card critical">
              <h2>Contexto Socioeconómico de Las Palmas de Gran Canaria</h2>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-value">{(stats.avg_unemployment * 100).toFixed(1)}%</div>
                  <div className="stat-label">Tasa de desempleo media</div>
                  <div className="stat-detail">{stats.sections_high_unemployment} secciones con desempleo &gt;25%</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{(stats.avg_elderly_prop * 100).toFixed(1)}%</div>
                  <div className="stat-label">Población mayor de 65 años</div>
                  <div className="stat-detail">{stats.sections_high_elderly} secciones con &gt;25% mayores</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{(stats.avg_low_education * 100).toFixed(1)}%</div>
                  <div className="stat-label">Población con educación básica</div>
                  <div className="stat-detail">Primaria + Secundaria 1ª etapa</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.sections_poor_coverage}</div>
                  <div className="stat-label">Secciones con cobertura &lt;50%</div>
                  <div className="stat-detail">De {stats.total_sections} secciones totales</div>
                </div>
              </div>
            </section>

            {/* Service Quality Indicators */}
            <section className="card">
              <h2>Indicadores de Calidad del Servicio</h2>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-value">{stats.avg_coverage_300.toFixed(1)}%</div>
                  <div className="stat-label">Cobertura a 300m</div>
                  <div className="stat-detail">Área urbana cubierta por paradas</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.avg_nearest_stop_dist.toFixed(0)}m</div>
                  <div className="stat-label">Distancia media a parada</div>
                  <div className="stat-detail">Accesibilidad peatonal promedio</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.avg_stops_density.toFixed(1)}</div>
                  <div className="stat-label">Paradas por km²</div>
                  <div className="stat-detail">Densidad de la red</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{stats.avg_freq_morning.toFixed(0)}</div>
                  <div className="stat-label">Frecuencia Matutina</div>
                  <div className="stat-detail">Eventos promedio (06:00-10:00)</div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Fare Analysis by Target Group */}
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

        {/* Critical Analysis */}
        <section className="card critical">
          <h2>Análisis Crítico: Barreras de Acceso</h2>

          <div className="analysis-section">
            <h3>1. Desempleo y Acceso al Bono Solidario</h3>
            <div className="analysis-content">
              <div className="problem">
                <strong>Problema:</strong> El Bono Solidario (€5/mes, 40 viajes) requiere estar desempleado 6+ meses ininterrumpidos.
              </div>
              <div className="impact">
                <strong>Impacto:</strong> Con {stats && (stats.avg_unemployment * 100).toFixed(1)}% de desempleo medio y {stats?.sections_high_unemployment} secciones con &gt;25% desempleo,
                muchas personas en búsqueda activa de empleo quedan excluidas si no cumplen los 6 meses.
              </div>
              <div className="inequity">
                <strong>Inequidad:</strong> Las personas desempleadas que no califican pagan €0.42-1.40/viaje (tarifa general),
                hasta <strong>{((0.42 / 0.125 - 1) * 100).toFixed(0)}% más caro</strong> que el Bono Solidario.
              </div>
            </div>
          </div>

          <div className="analysis-section">
            <h3>2. Población Mayor y Barreras de Renta</h3>
            <div className="analysis-content">
              <div className="problem">
                <strong>Problema:</strong> El Bono Jubilado (gratuito) requiere renta familiar &lt;€1,256.60/mes (€17,592/año).
              </div>
              <div className="impact">
                <strong>Impacto:</strong> Con {stats && (stats.avg_elderly_prop * 100).toFixed(1)}% de población 65+ y {stats?.sections_high_elderly} secciones con concentración alta,
                muchos mayores con pensiones modestas pero superiores al umbral quedan excluidos.
              </div>
              <div className="inequity">
                <strong>Inequidad:</strong> Mayores que no califican deben usar Bono Oro (€10/90 días) o tarifa general.
                Si no hacen 30 viajes/90 días, pagan la recarga completa.
              </div>
            </div>
          </div>

          <div className="analysis-section">
            <h3>3. Estudiantes y Edad Límite</h3>
            <div className="analysis-content">
              <div className="problem">
                <strong>Problema:</strong> Bono Estudiante (€14/mes, 80 viajes) solo para menores de 26 años al 1 de enero del curso.
              </div>
              <div className="impact">
                <strong>Impacto:</strong> Estudiantes mayores de 26 años (másteres, segundos grados, FP superior) pagan tarifa general.
              </div>
              <div className="inequity">
                <strong>Inequidad:</strong> Coste €0.175/viaje (estudiante) vs €0.42/viaje (general) = <strong>+140% más caro</strong>.
              </div>
            </div>
          </div>

          <div className="analysis-section">
            <h3>4. Zonas con Pobre Cobertura y Alta Vulnerabilidad</h3>
            <div className="analysis-content">
              <div className="problem">
                <strong>Problema:</strong> {stats?.sections_poor_coverage} secciones tienen cobertura &lt;50%, muchas con alta vulnerabilidad socioeconómica.
              </div>
              <div className="impact">
                <strong>Impacto:</strong> Residentes deben caminar largas distancias o usar múltiples transbordos, reduciendo el valor de bonos limitados.
              </div>
              <div className="inequity">
                <strong>Inequidad:</strong> Las tarifas sociales no compensan la mala cobertura. Pagar menos por viaje no ayuda si no hay servicio cercano.
              </div>
            </div>
          </div>
        </section>

        {/* Recommendations */}
        <section className="card recommendations">
          <h2>Recomendaciones Políticas</h2>
          <ol className="recommendations-list">
            <li>
              <strong>Eliminar el requisito de 6 meses para el Bono Solidario</strong>
              <p>Permitir acceso inmediato a desempleados inscritos en el SCE. El desempleo es una barrera de movilidad independiente de su duración.</p>
            </li>
            <li>
              <strong>Ampliar el umbral de renta para Bono Jubilado</strong>
              <p>El umbral actual (€1,256/mes) excluye pensiones modestas. Aumentar a €1,500-1,800/mes cubriría más población vulnerable.</p>
            </li>
            <li>
              <strong>Eliminar límite de edad para Bono Estudiante</strong>
              <p>Validar solo con matrícula en centro oficial, sin restricción de edad. Educación continua no debe penalizarse.</p>
            </li>
            <li>
              <strong>Crear Bono Social por Zona Geográfica</strong>
              <p>Tarifas reducidas para residentes en las {stats?.sections_poor_coverage} secciones con cobertura &lt;50%, compensando mala accesibilidad.</p>
            </li>
            <li>
              <strong>Eliminar condición de "30 viajes" para bonos gratuitos</strong>
              <p>Los bonos Wawa Joven, Residente Canario y Oro exigen 30 viajes/90 días para siguiente recarga gratis. Esto excluye a quienes no pueden viajar tanto (movilidad reducida, trabajo desde casa, etc.).</p>
            </li>
            <li>
              <strong>Transparencia en coste real por viaje</strong>
              <p>Publicar claramente el coste/viaje de cada tarifa. Muchos usuarios no saben que pagar €1.40 directo es 233% más caro que Bono Guagua (€0.42).</p>
            </li>
          </ol>
        </section>

        {/* Methodology */}
        <section className="card methodology">
          <h2>Metodología</h2>
          <p>
            Este análisis combina datos oficiales de:
          </p>
          <ul>
            <li><strong>Tarifas:</strong> Información pública de Guaguas Municipales (2025)</li>
            <li><strong>Datos socioeconómicos:</strong> INE, Censo 2023 (279 secciones censales)</li>
            <li><strong>Métricas de servicio:</strong> GTFS de Guaguas Municipales (fecha ref. 2025-01-07)</li>
            <li><strong>Indicadores calculados:</strong> Exclusión Laboral, Aislamiento Población Mayor, Inequidad Educativa</li>
          </ul>
          <p>
            Los cálculos de coste por viaje asumen uso completo del bono en el periodo de validez.
            No se incluyen bonos turísticos en el análisis de equidad social.
          </p>
        </section>
      </div>

      <footer className="analisis-footer">
        <p>Análisis generado con datos públicos oficiales • {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
