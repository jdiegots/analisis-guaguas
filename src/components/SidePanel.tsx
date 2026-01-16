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
  indicator_service_dependency: 'Índice normalizado que combina alta dependencia del empleo en servicios con baja frecuencia de guaguas',
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
              <h3 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>📊 Sobre las métricas</h3>
              <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: '1.5' }}>
                Todas las métricas se calculan a partir de datos GTFS reales y secciones censales del INE.
                Cada métrica tiene una fórmula transparente y verificable.
              </p>
            </div>
            <div style={{ marginTop: '15px', padding: '15px', background: '#fff7e6', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>ℹ️ Alcance del análisis</h3>
              <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: '1.5' }}>
                Este análisis excluye todo lo que tiene que ver con datos de aforo, validaciones o
                puntualidad debido a que Guaguas Municipales y Las Palmas de Gran Canaria ofrece en abierto
                pocas o ninguna de estas mediciones, y las que hay son pobres como para hacer un análisis
                minucioso sobre las zonas donde falla, impidiendo medir la demanda real y la calidad del
                viaje.
              </p>
              <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: '1.5', marginTop: '10px' }}>
                Se excluye del análisis aquellas secciones de Las Palmas de Gran Canaria que no tienen
                líneas cubiertas por Guaguas Municipales, que son las periféricas. Ahí sí que tienen
                guaguas de Global.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && sectionData && (
        <div>
          <div className="panel-header">
            <h2>Sección Censal</h2>
            <p className="subtitle">{sectionData.section.section_code}</p>
          </div>
          <div className="panel-content">
            <div className="metric-card">
              <h3>Nombre</h3>
              <div className="value" style={{ fontSize: '1.2rem' }}>
                {sectionData.section.name || 'Sin nombre'}
              </div>
            </div>

            <div className="metric-card">
              <h3>Área</h3>
              <div className="value">{sectionData.section.area_km2?.toFixed(3)} km²</div>
            </div>

            <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#2c3e50' }}>
              Métricas Básicas
            </h3>

            <div className="metric-card">
              <h3>Paradas en la Sección</h3>
              <div className="value">{sectionData.section.stops_count || 0}</div>
              <div className="formula">{METRIC_FORMULAS.stops_count}</div>
            </div>

            <div className="metric-card">
              <h3>Densidad de Paradas</h3>
              <div className="value">
                {(sectionData.section.stops_per_km2 || 0).toFixed(2)} paradas/km²
              </div>
              <div className="formula">{METRIC_FORMULAS.stops_per_km2}</div>
            </div>

            <div className="metric-card">
              <h3>Parada Más Cercana</h3>
              <div className="value">
                {(sectionData.section.nearest_stop_meters || 0).toFixed(0)} metros
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '5px', color: '#555' }}>
                {sectionData.section.nearest_stop_name}
              </div>
              <div className="formula">{METRIC_FORMULAS.nearest_stop_meters}</div>
            </div>

            <div className="metric-card">
              <h3>Cobertura 300m</h3>
              <div className="value">
                {(sectionData.section.coverage_300_area_pct || 0).toFixed(1)}%
              </div>
              <div className="formula">{METRIC_FORMULAS.coverage_300_area_pct}</div>
            </div>

            <div className="metric-card">
              <h3>Cobertura 500m</h3>
              <div className="value">
                {(sectionData.section.coverage_500_area_pct || 0).toFixed(1)}%
              </div>
              <div className="formula">{METRIC_FORMULAS.coverage_500_area_pct}</div>
            </div>

            <h3 style={{ marginTop: '25px', marginBottom: '15px', color: '#2c3e50', borderBottom: '2px solid #FDB913', paddingBottom: '8px' }}>
              Indicadores de Desigualdad
            </h3>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '15px', lineHeight: '1.5' }}>
              Índices que combinan variables socioeconómicas con accesibilidad al transporte público.
            </div>

            <div className="metric-card">
              <h3>Exclusión Laboral</h3>
              <div className="value">
                {((sectionData.section.indicator_unemployment_trap || 0) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '5px', color: '#555' }}>
                Alto desempleo combinado con baja frecuencia de servicio
              </div>
              <div className="formula">{METRIC_FORMULAS.indicator_unemployment_trap}</div>
            </div>

            <div className="metric-card">
              <h3>Aislamiento de Población Mayor</h3>
              <div className="value">
                {((sectionData.section.indicator_elderly_desert || 0) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '5px', color: '#555' }}>
                Alta población 65+ combinada con baja cobertura de paradas
              </div>
              <div className="formula">{METRIC_FORMULAS.indicator_elderly_desert}</div>
            </div>

            <div className="metric-card">
              <h3>Inequidad Educativa</h3>
              <div className="value">
                {((sectionData.section.indicator_education_gap || 0) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '5px', color: '#555' }}>
                Bajo nivel formativo combinado con mala accesibilidad
              </div>
              <div className="formula">{METRIC_FORMULAS.indicator_education_gap}</div>
            </div>

            <div className="metric-card">
              <h3>Dependencia de Servicios</h3>
              <div className="value">
                {((sectionData.section.indicator_service_dependency || 0) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '5px', color: '#555' }}>
                Alto empleo en servicios combinado con baja frecuencia
              </div>
              <div className="formula">{METRIC_FORMULAS.indicator_service_dependency}</div>
            </div>

            <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#2c3e50' }}>
              Servicio: {getTimeSlotLabel()}
            </h3>

            <div className="metric-card">
              <h3>Eventos de Servicio</h3>
              <div className="value">
                {getMetricValue(sectionData.section, 'stop_time_events_all_day', timeSlot) || 0}
              </div>
              <div className="formula">{METRIC_FORMULAS.stop_time_events}</div>
            </div>

            <div className="metric-card">
              <h3>Líneas Únicas</h3>
              <div className="value">
                {getMetricValue(sectionData.section, 'unique_routes_all_day', timeSlot) || 0}
              </div>
              <div className="formula">{METRIC_FORMULAS.unique_routes}</div>
            </div>

            {sectionData.topRoutes[timeSlot] && sectionData.topRoutes[timeSlot].length > 0 && (
              <>
                <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#2c3e50' }}>
                  Top Líneas
                </h3>
                <ul className="route-list">
                  {sectionData.topRoutes[timeSlot].slice(0, 10).map((route: any, i: number) => (
                    <li key={i} className="route-item">
                      <div>
                        <span className="route-badge">{route.route_short_name}</span>
                        <span className="route-name">{route.route_long_name}</span>
                      </div>
                      <span className="route-events">{route.stop_time_events} eventos</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {sectionData.stops && sectionData.stops.length > 0 && (
              <>
                <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#2c3e50' }}>
                  Paradas ({sectionData.stops.length})
                </h3>
                <div className="stops-list">
                  {sectionData.stops.map((stop: any) => (
                    <div key={stop.stop_id} className="stop-item">
                      {stop.stop_name}
                    </div>
                  ))}
                </div>
              </>
            )}
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
            <div className="metric-card">
              <h3>ID de Parada</h3>
              <div className="value" style={{ fontSize: '1.2rem' }}>{stopData.stop.stop_id}</div>
            </div>

            {stopData.stop.section_name && (
              <div className="metric-card">
                <h3>Sección Censal</h3>
                <div className="value" style={{ fontSize: '1rem' }}>
                  {stopData.stop.section_name}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px' }}>
                  {stopData.stop.section_code}
                </div>
              </div>
            )}

            <div className="metric-card">
              <h3>Coordenadas</h3>
              <div style={{ fontSize: '0.9rem', color: '#555' }}>
                Lat: {stopData.stop.stop_lat?.toFixed(6)}
                <br />
                Lon: {stopData.stop.stop_lon?.toFixed(6)}
              </div>
            </div>

            {stopData.routes && stopData.routes.length > 0 && (
              <>
                <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#2c3e50' }}>
                  Líneas que pasan ({stopData.routes.length})
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

            {stopData.stopTimes && stopData.stopTimes.length > 0 && (
              <>
                <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#2c3e50' }}>
                  Horarios de Ejemplo (primeros 20)
                </h3>
                <div style={{ fontSize: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {stopData.stopTimes.map((st: any, i: number) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                      <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                        {st.arrival_time} - Línea {st.route_short_name}
                      </div>
                      <div style={{ color: '#666', marginTop: '2px' }}>
                        {st.trip_headsign || st.route_long_name}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
