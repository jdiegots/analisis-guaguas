'use client';
import { useEffect, useState } from 'react';
interface SidePanelProps {
  selectedSection: string | null;
  selectedStop: string | null;
  timeSlot: string;
  metric: string;
  isCollapsed: boolean;
  onClose: () => void;
}
const METRIC_FORMULAS: Record<string, string> = {
  stops_count: 'Fórmula: COUNT(stops) WHERE ST_Within(stop.geom, section.geom)\nTablas: stops, census_sections',
  stops_per_km2: 'Fórmula: stops_count / area_km2\nTablas: section_metrics, census_sections',
  nearest_stop_meters: 'Fórmula: MIN(ST_Distance(ST_Centroid(section.geom), stop.geom))\nTablas: stops, census_sections',
  coverage_300_area_pct: 'Fórmula: area(ST_Intersection(section.geom, ST_Union(ST_Buffer(stops, 300m)))) / area(section.geom) * 100\nTablas: stops, census_sections',
  coverage_500_area_pct: 'Fórmula: area(ST_Intersection(section.geom, ST_Union(ST_Buffer(stops, 500m)))) / area(section.geom) * 100\nTablas: stops, census_sections',
  stop_time_events: 'Fórmula: COUNT(stop_times.trip_id) WHERE stop_id IN (stops de la sección) AND service_id IN (servicios activos) AND arrival_time IN (franja)\nTablas: stop_times, trips, calendar, calendar_dates, stops',
  unique_routes: 'Fórmula: COUNT(DISTINCT trips.route_id) WHERE stop_id IN (stops de la sección) AND service_id IN (servicios activos) AND arrival_time IN (franja)\nTablas: stop_times, trips, routes, stops',
  indicator_elderly_desert: 'Índice normalizado que combina alta población mayor de 65 años con baja cobertura de paradas a 300m',
  indicator_unemployment_trap: 'Índice normalizado que combina alto desempleo con baja frecuencia de servicio público',
  indicator_education_gap: 'Índice normalizado que combina bajo nivel educativo con mala accesibilidad al transporte',
};
export default function SidePanel({
  selectedSection,
  selectedStop,
  timeSlot,
  metric,
  isCollapsed,
  onClose,
}: SidePanelProps) {
  const [sectionData, setSectionData] = useState<any>(null);
  const [stopData, setStopData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isTopRoutesOpen, setIsTopRoutesOpen] = useState(false);
  const [isSectionStopsOpen, setIsSectionStopsOpen] = useState(false);
  useEffect(() => {
    if (selectedSection) {
      loadSectionData(selectedSection);
    } else {
      setSectionData(null);
    }
  }, [selectedSection]);
  useEffect(() => {
    if (selectedStop) {
      loadStopData(selectedStop);
    } else {
      setStopData(null);
    }
  }, [selectedStop]);
  const loadSectionData = async (code: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/section/${code}`);
      const data = await response.json();
      setSectionData(data);
    } catch (error) {
      console.error('Error loading section:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadStopData = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stop/${id}`);
      const data = await response.json();
      setStopData(data);
    } catch (error) {
      console.error('Error loading stop:', error);
    } finally {
      setLoading(false);
    }
  };
  const getTimeSlotLabel = () => {
    const labels: Record<string, string> = {
      all_day: 'Todo el día',
      morning: 'Mañana (06:00-10:00)',
      midday: 'Mediodía (12:00-16:00)',
      afternoon: 'Tarde (16:00-20:00)',
      night: 'Noche (20:00-24:00)',
    };
    return labels[timeSlot] || timeSlot;
  };
  const getMetricValue = (section: any, metricKey: string, slot: string) => {
    if (metricKey === 'stop_time_events_all_day' || metricKey === 'unique_routes_all_day') {
      const suffix = slot === 'all_day' ? '_all_day' : `_${slot}`;
      const key = metricKey.replace('_all_day', suffix);
      return section[key];
    }
    return section[metricKey];
  };
  if (isCollapsed) {
    return null;
  }
  return (
    <div className={`side-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {loading && (
        <div className="panel-content">
          <p>Cargando...</p>
        </div>
      )}
      {!loading && !selectedSection && !selectedStop && (
        <div>
          <div className="panel-header">
            <h2>Análisis Guaguas Municipales</h2>
            <p className="subtitle">Las Palmas de Gran Canaria</p>
          </div>
          <div className="panel-content">
            <p style={{ color: '#666', lineHeight: '1.6' }}>
              Haz clic en una <strong>sección censal</strong> para ver sus métricas de servicio,
              o en una <strong>parada</strong> para ver sus detalles y líneas.
            </p>
            <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Sobre las métricas</h3>
              <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: '1.5' }}>
                Todas las métricas se calculan a partir de datos GTFS reales y secciones censales del INE.
                Cada métrica tiene una fórmula transparente y verificable.
              </p>
            </div>
            <div style={{ marginTop: '15px', padding: '15px', background: '#fff7e6', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Alcance del análisis</h3>
              <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: '1.5' }}>
                Este análisis no incluye datos de aforo, validaciones ni puntualidad porque Guaguas
                Municipales y Las Palmas de Gran Canaria publican pocas o ninguna de estas mediciones en
                abierto, y las disponibles no permiten un estudio detallado de la demanda real ni de la
                calidad del servicio.
              </p>
              <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: '1.5', marginTop: '10px' }}>
                También se excluyen las secciones periféricas de Las Palmas de Gran Canaria que no cuentan
                con líneas de Guaguas Municipales; en esas zonas el servicio lo presta Global.
              </p>
            </div>
          </div>
        </div>
      )}
      {!loading && sectionData && sectionData.section && (
        <div>
          <div className="panel-header">
            <h2>Sección Censal</h2>
            <p className="subtitle">{sectionData.section.section_code}</p>
          </div>
          <div className="panel-content">
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '5px' }}>
                <strong>Nombre:</strong> {sectionData.section.name || 'Sin nombre'}
              </div>
              <div>
                <strong>Área:</strong> {sectionData.section.area_km2?.toFixed(3)} km²
              </div>
            </div>

            <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#2c3e50' }}>
              Paradas
            </h3>
            <div className="metric-card">
              <h3>Paradas en la Sección</h3>
              <div className="value">{sectionData.section.stops_count || 0}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', padding: '0 5px' }}>
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ color: '#666', fontWeight: 600 }}>Densidad</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{(sectionData.section.stops_per_km2 || 0).toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>p/km²</span></div>
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ color: '#666', fontWeight: 600 }}>Cercanía</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{(sectionData.section.nearest_stop_meters || 0).toFixed(0)} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>m</span></div>
                <div style={{ fontSize: '0.7rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sectionData.section.nearest_stop_name}</div>
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ color: '#666', fontWeight: 600 }}>Cobertura 300m</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{(sectionData.section.coverage_300_area_pct || 0).toFixed(1)}%</div>
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ color: '#666', fontWeight: 600 }}>Cobertura 500m</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{(sectionData.section.coverage_500_area_pct || 0).toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
              <h4 style={{ marginBottom: '15px', color: '#2c3e50', fontSize: '1rem' }}>
                Servicio: {getTimeSlotLabel()}
              </h4>
              <div className="metric-card">
                <h3>Eventos de Servicio</h3>
                <div className="value">
                  {getMetricValue(sectionData.section, 'stop_time_events_all_day', timeSlot) || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                  Un evento es cada paso individual de un guagua por cualquier parada de esta sección durante la franja horaria.
                </div>
              </div>
              <div className="metric-card">
                <h3>Líneas Únicas</h3>
                <div className="value">
                  {getMetricValue(sectionData.section, 'unique_routes_all_day', timeSlot) || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                  Representa el número de rutas distintas (ej. Línea 1, Línea 12) que dan servicio a este barrio.
                </div>
              </div>

              {/* Collapsible Top Routes */}
              {sectionData.topRoutes[timeSlot] && sectionData.topRoutes[timeSlot].length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <button
                    onClick={() => setIsTopRoutesOpen(!isTopRoutesOpen)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#f8f9fa',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#2c3e50'
                    }}
                  >
                    <span>{isTopRoutesOpen ? '▼' : '▶'} Top Líneas</span>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>{sectionData.topRoutes[timeSlot].length} líneas</span>
                  </button>
                  {isTopRoutesOpen && (
                    <ul className="route-list" style={{ marginTop: '10px', maxHeight: '250px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', padding: '10px' }}>
                      {sectionData.topRoutes[timeSlot].slice(0, 20).map((route: any, i: number) => (
                        <li key={i} className="route-item" style={{ fontSize: '0.85rem' }}>
                          <div>
                            <span className="route-badge">{route.route_short_name}</span>
                            <span className="route-name">{route.route_long_name}</span>
                          </div>
                          <span className="route-events" style={{ fontSize: '0.75rem' }}>{route.stop_time_events} ev.</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Collapsible Stops List */}
              {sectionData.stops && sectionData.stops.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    onClick={() => setIsSectionStopsOpen(!isSectionStopsOpen)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#f8f9fa',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#2c3e50'
                    }}
                  >
                    <span>{isSectionStopsOpen ? '▼' : '▶'} Lista de Paradas</span>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>{sectionData.stops.length} paradas</span>
                  </button>
                  {isSectionStopsOpen && (
                    <div className="stops-list" style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', padding: '10px' }}>
                      {sectionData.stops.map((stop: any) => (
                        <div key={stop.stop_id} className="stop-item" style={{ fontSize: '0.8rem', padding: '5px 0' }}>
                          {stop.stop_name} <span style={{ color: '#999', fontSize: '0.7rem' }}>({stop.stop_id})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
              <h4 style={{ marginBottom: '15px', color: '#2c3e50', fontSize: '1rem' }}>
                Equidad y Tarifas
              </h4>
              <div className="metric-card">
                <h3>Índice de Calidad</h3>
                <div className="value">
                  {(sectionData.section.service_value_index || 0).toFixed(3)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                  Calidad objetiva del servicio basada en frecuencia, cobertura y diversidad de rutas (0 a 1).
                </div>
              </div>
              <div className="metric-card">
                <h3>Precio Efectivo</h3>
                <div className="value">
                  {(sectionData.section.effective_price_single || 0).toFixed(2)}€
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                  Coste real por unidad de utilidad recibida (basado en billete simple de 1.40€).
                </div>
              </div>
              <div className="metric-card">
                <h3>"Impuesto" Geográfico</h3>
                <div className="value">
                  {(sectionData.section.geographic_tax_ratio || 0).toFixed(1)}x
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                  Factor de sobrecoste respecto a las zonas mejor servidas de la ciudad.
                </div>
              </div>
            </div>

            <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#2c3e50', borderBottom: '2px solid #FDB913', paddingBottom: '8px' }}>
              Indicadores
            </h3>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '15px', lineHeight: '1.5' }}>
              Relación entre vulnerabilidad social, turismo y calidad del transporte.
            </div>

            <div className="metric-card">
              <h3>Presión Turística</h3>
              <div className="value">
                {(sectionData.section.tourist_density || 0).toFixed(0)} <span style={{ fontSize: '1rem', fontWeight: 400 }}>plazas/km²</span>
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '8px', color: '#555' }}>
                {(sectionData.section.tourist_places_count || 0).toLocaleString()} plazas totales en la sección.
              </div>
            </div>

            <div className="metric-card">
              <h3>Desierto de Mayores</h3>
              <div className="value">
                {((sectionData.section.indicator_elderly_desert || 0) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '8px', color: '#555', fontStyle: 'italic' }}>
                Identifica zonas con alta densidad de personas mayores y baja cobertura de paradas, señalando puntos críticos de aislamiento poblacional.
              </div>
            </div>

            <div className="metric-card">
              <h3>Desconexión Laboral</h3>
              <div className="value">
                {((sectionData.section.indicator_worker_commute || 0) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '8px', color: '#555', fontStyle: 'italic' }}>
                Muestra la brecha entre las zonas de residencia de la clase trabajadora y el acceso a una red de transporte con frecuencias competitivas.
              </div>
            </div>
          </div>
        </div>
      )}
      {!loading && stopData && (
        <div>
          <div className="panel-header">
            <h2>Parada</h2>
            <p className="subtitle">{stopData.stop.stop_name}</p>
          </div>
          <div className="panel-content">
            {stopData.routes && stopData.routes.length > 0 && (
              <>
                <div className="metric-card">
                  <h3>Total Eventos de Servicio (Día)</h3>
                  <div className="value">
                    {stopData.routes.reduce((acc: number, curr: any) => acc + (parseInt(curr.trip_count) || 0), 0)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                    Suma total de pasos de guagua por esta parada en un día laborable tipo.
                  </div>
                </div>

                <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#2c3e50' }}>
                  Líneas ({stopData.routes.length})
                </h3>
                <ul className="route-list">
                  {stopData.routes.map((route: any) => (
                    <li key={route.route_id} className="route-item">
                      <div>
                        <span className="route-badge">{route.route_short_name}</span>
                        <span className="route-name">{route.route_long_name}</span>
                      </div>
                      <span className="route-events">{route.trip_count} viajes</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
