'use client';

import { useState, useEffect } from 'react';
import './datos.css';

interface SectionData {
  section_code: string;

  // Demographics (7 fields)
  population_total: number;
  unemployment_rate: number;
  census_prop_elderly: number;
  education_low_pct: number;
  working_class_pct: number;
  income_median: number;
  metrics_prop_elderly: number;

  // Occupation sectors (4 fields)
  occ_agriculture: number;
  occ_industry: number;
  occ_construction: number;
  occ_services: number;

  // Transport basic (5 fields)
  stops_count: number;
  stops_per_km2: number;
  nearest_stop_meters: number;
  coverage_300_area_pct: number;
  coverage_500_area_pct: number;

  // Frequencies by time slot (5 fields)
  stop_time_events_all_day: number;
  stop_time_events_morning: number;
  stop_time_events_midday: number;
  stop_time_events_afternoon: number;
  stop_time_events_night: number;

  // Routes by time slot (5 fields)
  unique_routes_all_day: number;
  unique_routes_morning: number;
  unique_routes_midday: number;
  unique_routes_afternoon: number;
  unique_routes_night: number;

  // Service value indices (4 fields)
  service_value_index: number;
  service_percentile: number;
  events_per_1000: number;
  routes_per_10k: number;

  // Political indicators (9 fields)
  indicator_elderly_desert: number;
  indicator_mobility_inequality: number;
  indicator_working_class: number;
  indicator_education_gap: number;
  indicator_unemployment_trap: number;
  indicator_service_dependency: number;
  indicator_immigrant_segregation: number;
  indicator_student_access: number;
  indicator_worker_commute: number;
}

type CategoryFilter = 'all' | 'demographics' | 'transport' | 'service' | 'indicators';

export default function DatosSecciones() {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof SectionData>('section_code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await fetch('/api/sections-data');
      const data = await res.json();
      setSections(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }

  function handleSort(field: keyof SectionData) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const filteredSections = sections.filter(s =>
    s.section_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedSections = [...filteredSections].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  function exportCSV() {
    const headers = [
      'Codigo',
      // Demographics
      'PoblacionTotal', 'TasaDesempleo', 'PropMayores65Census', 'BajaEducacion', 'ClaseTrabajadora', 'MedianaRenta', 'PropMayores65Metrics',
      // Occupations
      'OcupAgric', 'OcupIndustria', 'OcupConstr', 'OcupServicios',
      // Transport
      'NumParadas', 'ParadasKm2', 'DistanciaParadaCercana', 'Cobertura300m', 'Cobertura500m',
      // Frequencies
      'EventosDia', 'EventosMañana', 'EventosMedioDia', 'EventosTarde', 'EventosNoche',
      // Routes
      'LineasDia', 'LineasMañana', 'LineasMedioDia', 'LineasTarde', 'LineasNoche',
      // Service Value
      'ValorServicio', 'Percentil', 'EventosPor1000', 'LineasPor10k',
      // Indicators
      'IndicDesiertMayores', 'IndicDesigMovilidad', 'IndicClaseTrabajadora', 'IndicBrechaEduc',
      'IndicTrampaDesempleo', 'IndicDepServicio', 'IndicSegregInmigr', 'IndicAccesoEstud', 'IndicCommuteTrab'
    ];

    const rows = sortedSections.map(s => [
      s.section_code,
      // Demographics
      s.population_total || 0,
      s.unemployment_rate ? (s.unemployment_rate * 100).toFixed(2) : '',
      s.census_prop_elderly ? (s.census_prop_elderly * 100).toFixed(2) : '',
      s.education_low_pct ? (s.education_low_pct * 100).toFixed(2) : '',
      s.working_class_pct ? (s.working_class_pct * 100).toFixed(2) : '',
      s.income_median || '',
      s.metrics_prop_elderly ? (s.metrics_prop_elderly * 100).toFixed(2) : '',
      // Occupations
      s.occ_agriculture || 0,
      s.occ_industry || 0,
      s.occ_construction || 0,
      s.occ_services || 0,
      // Transport
      s.stops_count || 0,
      s.stops_per_km2 ? s.stops_per_km2.toFixed(2) : '',
      s.nearest_stop_meters ? s.nearest_stop_meters.toFixed(0) : '',
      s.coverage_300_area_pct ? s.coverage_300_area_pct.toFixed(1) : '',
      s.coverage_500_area_pct ? s.coverage_500_area_pct.toFixed(1) : '',
      // Frequencies
      s.stop_time_events_all_day || 0,
      s.stop_time_events_morning || 0,
      s.stop_time_events_midday || 0,
      s.stop_time_events_afternoon || 0,
      s.stop_time_events_night || 0,
      // Routes
      s.unique_routes_all_day || 0,
      s.unique_routes_morning || 0,
      s.unique_routes_midday || 0,
      s.unique_routes_afternoon || 0,
      s.unique_routes_night || 0,
      // Service Value
      s.service_value_index ? s.service_value_index.toFixed(3) : '',
      s.service_percentile ? s.service_percentile.toFixed(0) : '',
      s.events_per_1000 ? s.events_per_1000.toFixed(1) : '',
      s.routes_per_10k ? s.routes_per_10k.toFixed(2) : '',
      // Indicators
      s.indicator_elderly_desert || 0,
      s.indicator_mobility_inequality || 0,
      s.indicator_working_class || 0,
      s.indicator_education_gap || 0,
      s.indicator_unemployment_trap || 0,
      s.indicator_service_dependency || 0,
      s.indicator_immigrant_segregation || 0,
      s.indicator_student_access || 0,
      s.indicator_worker_commute || 0
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'secciones-censales-todas-metricas.csv';
    a.click();
  }

  if (loading) {
    return <div className="loading">Cargando datos...</div>;
  }

  return (
    <div className="datos-container">
      <header className="datos-header">
        <h1>Datos Completos por Seccion Censal</h1>
        <p>TODAS las metricas (39 campos) - {sections.length} secciones censales</p>
        <div className="header-actions">
          <a href="/analisis-tarifas" className="back-link">Analisis Politico</a>
          <a href="/" className="back-link">Volver al Mapa</a>
        </div>
      </header>

      <div className="content">
        <div className="controls-bar">
          <input
            type="text"
            placeholder="Buscar por codigo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className="category-filter"
          >
            <option value="all">Todas las columnas (39)</option>
            <option value="demographics">Demografia (7)</option>
            <option value="transport">Transporte Basico (5)</option>
            <option value="service">Servicio y Frecuencias (14)</option>
            <option value="indicators">Indicadores Politicos (9)</option>
          </select>

          <button onClick={exportCSV} className="export-button-inline">
            Descargar CSV Completo
          </button>

          <span className="results-count">{sortedSections.length} secciones</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('section_code')} className="sortable sticky-col">
                  Codigo {sortField === 'section_code' && (sortDirection === 'asc' ? '▲' : '▼')}
                </th>

                {/* DEMOGRAPHICS */}
                {(categoryFilter === 'all' || categoryFilter === 'demographics') && (
                  <>
                    <th onClick={() => handleSort('population_total')} className="sortable">
                      Poblacion {sortField === 'population_total' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('unemployment_rate')} className="sortable">
                      Desempleo % {sortField === 'unemployment_rate' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('census_prop_elderly')} className="sortable">
                      Mayores 65+ % {sortField === 'census_prop_elderly' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('education_low_pct')} className="sortable">
                      Baja Educ % {sortField === 'education_low_pct' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('working_class_pct')} className="sortable">
                      Clase Trab % {sortField === 'working_class_pct' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('income_median')} className="sortable">
                      Renta Med {sortField === 'income_median' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('occ_agriculture')} className="sortable">
                      Agricult {sortField === 'occ_agriculture' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('occ_industry')} className="sortable">
                      Industria {sortField === 'occ_industry' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('occ_construction')} className="sortable">
                      Construc {sortField === 'occ_construction' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('occ_services')} className="sortable">
                      Servicios {sortField === 'occ_services' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                  </>
                )}

                {/* TRANSPORT BASIC */}
                {(categoryFilter === 'all' || categoryFilter === 'transport') && (
                  <>
                    <th onClick={() => handleSort('stops_count')} className="sortable">
                      Paradas {sortField === 'stops_count' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('stops_per_km2')} className="sortable">
                      Paradas/km2 {sortField === 'stops_per_km2' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('nearest_stop_meters')} className="sortable">
                      Dist Cercana m {sortField === 'nearest_stop_meters' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('coverage_300_area_pct')} className="sortable">
                      Cobert 300m % {sortField === 'coverage_300_area_pct' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('coverage_500_area_pct')} className="sortable">
                      Cobert 500m % {sortField === 'coverage_500_area_pct' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                  </>
                )}

                {/* SERVICE FREQUENCIES & ROUTES */}
                {(categoryFilter === 'all' || categoryFilter === 'service') && (
                  <>
                    <th onClick={() => handleSort('stop_time_events_all_day')} className="sortable">
                      Eventos Dia {sortField === 'stop_time_events_all_day' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('stop_time_events_morning')} className="sortable">
                      Eventos Mañana {sortField === 'stop_time_events_morning' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('stop_time_events_midday')} className="sortable">
                      Eventos Mediodia {sortField === 'stop_time_events_midday' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('stop_time_events_afternoon')} className="sortable">
                      Eventos Tarde {sortField === 'stop_time_events_afternoon' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('stop_time_events_night')} className="sortable">
                      Eventos Noche {sortField === 'stop_time_events_night' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('unique_routes_all_day')} className="sortable">
                      Lineas Dia {sortField === 'unique_routes_all_day' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('unique_routes_morning')} className="sortable">
                      Lineas Mañana {sortField === 'unique_routes_morning' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('unique_routes_midday')} className="sortable">
                      Lineas Mediodia {sortField === 'unique_routes_midday' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('unique_routes_afternoon')} className="sortable">
                      Lineas Tarde {sortField === 'unique_routes_afternoon' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('unique_routes_night')} className="sortable">
                      Lineas Noche {sortField === 'unique_routes_night' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('service_value_index')} className="sortable">
                      Valor Servicio {sortField === 'service_value_index' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('service_percentile')} className="sortable">
                      Percentil {sortField === 'service_percentile' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('events_per_1000')} className="sortable">
                      Eventos/1000 {sortField === 'events_per_1000' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('routes_per_10k')} className="sortable">
                      Lineas/10k {sortField === 'routes_per_10k' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                  </>
                )}

                {/* POLITICAL INDICATORS */}
                {(categoryFilter === 'all' || categoryFilter === 'indicators') && (
                  <>
                    <th onClick={() => handleSort('indicator_elderly_desert')} className="sortable">
                      Ind Desierto Mayores {sortField === 'indicator_elderly_desert' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('indicator_mobility_inequality')} className="sortable">
                      Ind Desig Movilidad {sortField === 'indicator_mobility_inequality' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('indicator_working_class')} className="sortable">
                      Ind Clase Trabajadora {sortField === 'indicator_working_class' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('indicator_education_gap')} className="sortable">
                      Ind Brecha Educ {sortField === 'indicator_education_gap' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('indicator_unemployment_trap')} className="sortable">
                      Ind Trampa Desempleo {sortField === 'indicator_unemployment_trap' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('indicator_service_dependency')} className="sortable">
                      Ind Depend Servicio {sortField === 'indicator_service_dependency' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('indicator_immigrant_segregation')} className="sortable">
                      Ind Segreg Inmigr {sortField === 'indicator_immigrant_segregation' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('indicator_student_access')} className="sortable">
                      Ind Acceso Estud {sortField === 'indicator_student_access' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('indicator_worker_commute')} className="sortable">
                      Ind Commute Trab {sortField === 'indicator_worker_commute' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedSections.map((section) => (
                <tr key={section.section_code}>
                  <td className="code-cell sticky-col">{section.section_code}</td>

                  {/* DEMOGRAPHICS */}
                  {(categoryFilter === 'all' || categoryFilter === 'demographics') && (
                    <>
                      <td className="number-cell">{section.population_total || 0}</td>
                      <td className="number-cell">{section.unemployment_rate ? (section.unemployment_rate * 100).toFixed(1) : '-'}</td>
                      <td className="number-cell">{section.census_prop_elderly ? (section.census_prop_elderly * 100).toFixed(1) : '-'}</td>
                      <td className="number-cell">{section.education_low_pct ? (section.education_low_pct * 100).toFixed(1) : '-'}</td>
                      <td className="number-cell">{section.working_class_pct ? (section.working_class_pct * 100).toFixed(1) : '-'}</td>
                      <td className="number-cell">{section.income_median || '-'}</td>
                      <td className="number-cell">{section.occ_agriculture || 0}</td>
                      <td className="number-cell">{section.occ_industry || 0}</td>
                      <td className="number-cell">{section.occ_construction || 0}</td>
                      <td className="number-cell">{section.occ_services || 0}</td>
                    </>
                  )}

                  {/* TRANSPORT BASIC */}
                  {(categoryFilter === 'all' || categoryFilter === 'transport') && (
                    <>
                      <td className="number-cell">{section.stops_count || 0}</td>
                      <td className="number-cell">{section.stops_per_km2 ? section.stops_per_km2.toFixed(2) : '-'}</td>
                      <td className="number-cell">{section.nearest_stop_meters ? section.nearest_stop_meters.toFixed(0) : '-'}</td>
                      <td className="number-cell">{section.coverage_300_area_pct ? section.coverage_300_area_pct.toFixed(1) : '-'}</td>
                      <td className="number-cell">{section.coverage_500_area_pct ? section.coverage_500_area_pct.toFixed(1) : '-'}</td>
                    </>
                  )}

                  {/* SERVICE FREQUENCIES & ROUTES */}
                  {(categoryFilter === 'all' || categoryFilter === 'service') && (
                    <>
                      <td className="number-cell">{section.stop_time_events_all_day || 0}</td>
                      <td className="number-cell">{section.stop_time_events_morning || 0}</td>
                      <td className="number-cell">{section.stop_time_events_midday || 0}</td>
                      <td className="number-cell">{section.stop_time_events_afternoon || 0}</td>
                      <td className="number-cell">{section.stop_time_events_night || 0}</td>
                      <td className="number-cell">{section.unique_routes_all_day || 0}</td>
                      <td className="number-cell">{section.unique_routes_morning || 0}</td>
                      <td className="number-cell">{section.unique_routes_midday || 0}</td>
                      <td className="number-cell">{section.unique_routes_afternoon || 0}</td>
                      <td className="number-cell">{section.unique_routes_night || 0}</td>
                      <td className="number-cell">{section.service_value_index ? section.service_value_index.toFixed(3) : '-'}</td>
                      <td className="number-cell">{section.service_percentile ? section.service_percentile.toFixed(0) : '-'}</td>
                      <td className="number-cell">{section.events_per_1000 ? section.events_per_1000.toFixed(1) : '-'}</td>
                      <td className="number-cell">{section.routes_per_10k ? section.routes_per_10k.toFixed(2) : '-'}</td>
                    </>
                  )}

                  {/* POLITICAL INDICATORS */}
                  {(categoryFilter === 'all' || categoryFilter === 'indicators') && (
                    <>
                      <td className="number-cell">{section.indicator_elderly_desert || 0}</td>
                      <td className="number-cell">{section.indicator_mobility_inequality || 0}</td>
                      <td className="number-cell">{section.indicator_working_class || 0}</td>
                      <td className="number-cell">{section.indicator_education_gap || 0}</td>
                      <td className="number-cell">{section.indicator_unemployment_trap || 0}</td>
                      <td className="number-cell">{section.indicator_service_dependency || 0}</td>
                      <td className="number-cell">{section.indicator_immigrant_segregation || 0}</td>
                      <td className="number-cell">{section.indicator_student_access || 0}</td>
                      <td className="number-cell">{section.indicator_worker_commute || 0}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
