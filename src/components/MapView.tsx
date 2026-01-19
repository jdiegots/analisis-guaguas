'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Map, { Source, Layer, MapRef } from 'react-map-gl';
import type { FillLayer, CircleLayer, FillExtrusionLayer, MapLayerMouseEvent } from 'react-map-gl';
import SidePanel from './SidePanel';
import MapControls from './MapControls';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || '';

// Las Palmas de Gran Canaria center
const INITIAL_VIEW = {
  longitude: -15.43,
  latitude: 28.12,
  zoom: 12
};

// Unified blue scale for standard metrics
const UNIFIED_BLUE_SCALE = [
  { value: 0, color: '#f7fbff' },
  { value: 0.2, color: '#deebf7' },
  { value: 0.4, color: '#c6dbef' },
  { value: 0.6, color: '#9ecae1' },
  { value: 0.8, color: '#6baed6' },
  { value: 1.0, color: '#08519c' },
];

// Special scales for specific metrics
const RED_SCALE = [
  { value: 0, color: '#fff5f0' },
  { value: 0.2, color: '#fee0d2' },
  { value: 0.4, color: '#fcbba1' },
  { value: 0.6, color: '#fc9272' },
  { value: 0.8, color: '#fb6a4a' },
  { value: 1.0, color: '#cb181d' },
];

const GREEN_SCALE = [
  { value: 0, color: '#f7fcf5' },
  { value: 0.2, color: '#e5f5e0' },
  { value: 0.4, color: '#c7e9c0' },
  { value: 0.6, color: '#a1d99b' },
  { value: 0.8, color: '#74c476' },
  { value: 1.0, color: '#238b45' },
];

// Definition of min/max values for scaling (Empirical quantiles from data)
// These "max" values represent the ~95th percentile to avoid outliers flattening the map
const SCALES = {
  // Service
  events: 1000,
  routes: 10,
  coverage: 100,
  density: 20,

  // Advanced Fare Analysis
  service_index: 1.0,
  effective_price: 15.0, // Max reasonable price per unit (outliers go up to 140€)
  geo_tax: 10.0, // Ratio 10x

  // Demographics
  income: 30000, // Cap at 30k for visualization contrast
  elderly: 0.40, // 40% elderly population cap

  // Inequality
  inequality_index: 1000, // Normalized metric

  // Employment
  sector_share: 0.40, // 40% of workforce in a sector
};

const COLOR_SCALES = {
  // === SERVICE ===
  stop_time_events_all_day: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * SCALES.events })),
  stop_time_events_morning: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * (SCALES.events * 0.3) })), // Morning is subset
  stop_time_events_midday: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * (SCALES.events * 0.3) })),
  stop_time_events_afternoon: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * (SCALES.events * 0.3) })),
  stop_time_events_night: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * (SCALES.events * 0.1) })),

  unique_routes_all_day: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * SCALES.routes })),
  coverage_300_area_pct: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 100 })),
  stops_per_km2: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * SCALES.density })),

  // === ADVANCED FARE ANALYSIS (Red = Bad for price/tax, Green = Good for service) ===
  service_value_index: GREEN_SCALE.map(s => ({ ...s, value: s.value * 1.0 })),

  effective_price_single: RED_SCALE.map(s => ({ ...s, value: s.value * SCALES.effective_price })),
  observable_effective_price_single: RED_SCALE.map(s => ({ ...s, value: s.value * SCALES.effective_price })),
  geographic_tax_ratio: RED_SCALE.map(s => ({ ...s, value: s.value * SCALES.geo_tax })),

  // === DEMOGRAPHICS ===
  income_median: GREEN_SCALE.map(s => ({ ...s, value: s.value * SCALES.income })),
  prop_elderly: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * SCALES.elderly })), // Elderly concentration

  // === EMPLOYMENT SECTORS ===
  occ_services: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * SCALES.sector_share })),
  occ_construction: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * SCALES.sector_share })),
  occ_industry: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * SCALES.sector_share })),
  occ_agriculture: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * (SCALES.sector_share * 0.5) })), // Agric is lower

  // === INEQUALITY (Red Scales) ===
  indicator_elderly_desert: RED_SCALE.map(s => ({ ...s, value: s.value })), // Normalized 0-1 usually
  indicator_unemployment_trap: RED_SCALE.map(s => ({ ...s, value: s.value * 2000 })), // Needs checking range
  indicator_education_gap: RED_SCALE.map(s => ({ ...s, value: s.value })),
  indicator_service_dependency: RED_SCALE.map(s => ({ ...s, value: s.value })),
  indicator_immigrant_segregation: RED_SCALE.map(s => ({ ...s, value: s.value })),
  indicator_student_access: RED_SCALE.map(s => ({ ...s, value: s.value })),
  indicator_worker_commute: RED_SCALE.map(s => ({ ...s, value: s.value })),
};

interface TimeSlot {
  value: string;
  label: string;
}

const TIME_SLOTS: TimeSlot[] = [
  { value: 'all_day', label: 'Todo el día' },
  { value: 'morning', label: 'Mañana (06:00-10:00)' },
  { value: 'midday', label: 'Mediodía (12:00-16:00)' },
  { value: 'afternoon', label: 'Tarde (16:00-20:00)' },
  { value: 'night', label: 'Noche (20:00-24:00)' },
];

interface Metric {
  value: string;
  label: string;
  formula: string;
  group: string;
}

const METRICS: Metric[] = [
  // === ANÁLISIS DE TARIFAS (NUEVO) ===
  {
    value: 'service_value_index',
    label: 'Índice del Valor del Servicio (0-1)',
    formula: 'Calidad objetiva (Frecuencia + Cobertura + Rutas + Cercanía)',
    group: 'Análisis de Tarifas y Equidad'
  },
  {
    value: 'effective_price_single',
    label: 'Precio Efectivo (€/unidad)',
    formula: 'Coste real por unidad de servicio recibido (1.40€ / Índice)',
    group: 'Análisis de Tarifas y Equidad'
  },
  {
    value: 'observable_effective_price_single',
    label: 'Precio Efectivo Observable (€)',
    formula: 'Precio Efectivo ajustado al máximo IVS observable en la ciudad. P90 como ancla.',
    group: 'Análisis de Tarifas y Equidad'
  },

  // === CONTEXTO SOCIODEMOGRÁFICO ===
  {
    value: 'income_median',
    label: 'Renta Media (Hogares)',
    formula: 'Renta neta media por unidad de consumo',
    group: 'Contexto sociodemográfico'
  },
  {
    value: 'prop_elderly',
    label: 'Población Mayor de 65',
    formula: 'Proporción de población mayor de 65 años',
    group: 'Contexto sociodemográfico'
  },

  // === MÉTRICAS DE SERVICIO ===
  {
    value: 'stop_time_events_all_day',
    label: 'Frecuencia de Servicio',
    formula: 'Número de eventos diarios (varía por franja horaria)',
    group: 'Servicio y accesibilidad'
  },
  {
    value: 'unique_routes_all_day',
    label: 'Diversidad de Líneas',
    formula: 'Número de líneas únicas que sirven la sección',
    group: 'Servicio y accesibilidad'
  },
  {
    value: 'coverage_300_area_pct',
    label: 'Cobertura a 300m',
    formula: 'Porcentaje de área a menos de 300m de paradas',
    group: 'Servicio y accesibilidad'
  },
  {
    value: 'stops_per_km2',
    label: 'Densidad de Paradas',
    formula: 'Número de paradas por kilómetro cuadrado',
    group: 'Servicio y accesibilidad'
  },
];

export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const [sectionsData, setSectionsData] = useState<any>(null);
  const [stopsData, setStopsData] = useState<any>(null);
  const [gridData, setGridData] = useState<any>(null);
  const [shapesData, setShapesData] = useState<any>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState('all_day');
  const [metric, setMetric] = useState('stop_time_events_all_day');
  const [showStops, setShowStops] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [showShapes, setShowShapes] = useState(false);
  const [showTourism, setShowTourism] = useState(false);
  const [densityLayer, setDensityLayer] = useState('none');
  const [contextMetric, setContextMetric] = useState('none');

  // Opacity Control States
  const [sectionsOpacity, setSectionsOpacity] = useState(0.6);
  const [contextOpacity, setContextOpacity] = useState(0.5);
  const [densityOpacity, setDensityOpacity] = useState(0.6);

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [tourismData, setTourismData] = useState<any>(null);

  useEffect(() => {
    loadSections();
    loadStops();
    loadShapes();
    loadTourism();
  }, []);

  // Reload grid when densityLayer changes
  useEffect(() => {
    if (densityLayer !== 'none') {
      loadGrid(densityLayer);
    } else {
      setGridData(null);
    }
  }, [densityLayer]);

  const fetchGeoJson = async (url: string, label: string) => {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`Error loading ${label}:`, response.status, errorText);
        return null;
      }

      const data = await response.json();

      if (!data || data.type !== 'FeatureCollection') {
        console.error(`${label} response is not valid GeoJSON:`, data);
        return null;
      }

      return data;
    } catch (error) {
      console.error(`Error loading ${label}:`, error);
      return null;
    }
  };

  const loadSections = async () => {
    const data = await fetchGeoJson('/api/sections', 'sections');
    setSectionsData(data);
  };

  const loadStops = async () => {
    const data = await fetchGeoJson('/api/stops', 'stops');
    setStopsData(data);
  };

  const loadGrid = async (type: string) => {
    const data = await fetchGeoJson(`/api/grid?type=${type}`, 'grid');
    setGridData(data);
  };

  const loadShapes = async () => {
    const data = await fetchGeoJson('/api/shapes', 'shapes');
    setShapesData(data);
  };

  const loadTourism = async () => {
    const data = await fetchGeoJson('/api/tourist-spots', 'tourist spots');
    setTourismData(data);
  };

  const getMetricKey = () => {
    if (metric === 'stop_time_events_all_day' || metric === 'unique_routes_all_day') {
      // For service metrics, append time slot suffix
      const suffix = timeSlot === 'all_day' ? '_all_day' : `_${timeSlot}`;
      return metric.replace('_all_day', suffix);
    }
    return metric;
  };

  // Dynamic Layer Construction (Fill)
  const sectionsLayer = useMemo<any>(() => {
    const metricKey = getMetricKey();
    const scale = COLOR_SCALES[metricKey as keyof typeof COLOR_SCALES] || COLOR_SCALES[metric as keyof typeof COLOR_SCALES] || COLOR_SCALES.stop_time_events_all_day;

    const colorExpression: any[] = ['interpolate', ['linear'], ['get', metricKey]];
    scale.forEach(({ value, color }) => {
      colorExpression.push(value, color);
    });

    return {
      id: 'sections-fill',
      type: 'fill',
      source: 'sections-source',
      layout: {
        visibility: showSections ? 'visible' : 'none'
      },
      paint: {
        'fill-color': colorExpression as any,
        'fill-opacity': sectionsOpacity,
      },
      minzoom: 0,
      maxzoom: 24,
    };
  }, [metric, timeSlot, showSections, sectionsOpacity]);

  // Context Layer (Bubbles/Label)

  const contextLayer = useMemo<any>(() => {
    if (contextMetric === 'none') return null;

    let radiusExpression: any = ['interpolate', ['linear'], ['get', contextMetric]];

    // Adjusted scales for visibility
    if (contextMetric === 'income_median') {
      // Income: 10k (3px) -> 35k (20px)
      radiusExpression.push(10000, 3, 35000, 20);
    } else if (contextMetric === 'prop_elderly') {
      // Elderly: 5% (2px) -> 35% (25px) - Highlight concentrations well
      radiusExpression.push(0.05, 2, 0.35, 25);
    } else if (contextMetric === 'occ_services' || contextMetric === 'occ_construction') {
      // Employment: 10% (3px) -> 50% (20px)
      radiusExpression.push(0.10, 3, 0.50, 20);
    } else {
      // Default Normalized (0-1): 0 (2px) -> 1 (20px)
      radiusExpression.push(0, 2, 1, 20);
    }

    return {
      id: 'sections-context-circle',
      type: 'circle',
      source: 'sections-source',
      layout: {
        'visibility': showSections ? 'visible' : 'none',
      },
      paint: {
        'circle-radius': radiusExpression,
        'circle-color': '#000000',
        'circle-opacity': contextOpacity * 0.1, // Almost transparent fill to avoid clutter
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': contextOpacity // Stroke remains visible
      },
      minzoom: 10 // Visible sooner
    };
  }, [contextMetric, showSections, contextOpacity]);

  const sectionsOutlineLayer: any = {
    id: 'sections-outline',
    type: 'line',
    layout: {
      visibility: showSections ? 'visible' : 'none'
    },
    paint: {
      'line-color': '#000',
      'line-width': 0.1,
      'line-opacity': 0.2
    },
  };

  const getGridLayerColor = () => {
    return '#e74c3c';
  };

  const gridLayer: CircleLayer = {
    id: 'grid-population',
    type: 'circle',
    source: 'grid-source',
    layout: {
      visibility: densityLayer !== 'none' ? 'visible' : 'none'
    },
    paint: {
      'circle-color': getGridLayerColor(),
      'circle-radius': 1.5,
      'circle-opacity': densityOpacity,
      'circle-stroke-width': 0
    }
  };

  const stopsLayer: CircleLayer = {
    id: 'stops',
    type: 'circle',
    source: 'stops-source',
    layout: {
      visibility: showStops ? 'visible' : 'none'
    },
    paint: {
      'circle-radius': 5,
      'circle-color': '#e74c3c',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  };

  const shapesLayer: any = {
    id: 'shapes',
    type: 'line',
    layout: {
      visibility: showShapes ? 'visible' : 'none',
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 3,
      'line-opacity': 0.8,
    },
  };

  const handleMapClick = (event: MapLayerMouseEvent) => {
    const features = event.features;
    if (!features || features.length === 0) return;

    const feature = features[0];

    if (feature.layer?.id === 'stops') {
      setSelectedStop(feature.properties?.stop_id);
      setSelectedSection(null);
    } else if (feature.layer?.id === 'sections-fill') {
      setSelectedSection(feature.properties?.section_code);
      setSelectedStop(null);
    }
  };

  return (
    <div className="map-container" >
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={INITIAL_VIEW}
        mapStyle="mapbox://styles/mapbox/light-v11"
        interactiveLayerIds={[
          ...(showSections ? ['sections-fill'] : []),
          ...(showStops ? ['stops'] : [])
        ]}
        onClick={handleMapClick}
      >
        {/* IMPORTANT: Layers are rendered in Z-order from bottom to top */}

        {/* Layer 1 (Bottom): Census Sections Fill */}
        {sectionsData && (
          <Source id="sections-source" type="geojson" data={sectionsData}>
            <Layer {...sectionsLayer} />
            {/* Outline on top of fill */}
            <Layer {...sectionsOutlineLayer} />
            {/* Bubble/Symbol Layer on top of everything section-related */}
            {contextLayer && <Layer {...contextLayer} />}
          </Source>
        )}

        {/* Layer 3: Route Shapes - Above sections, below density */}
        {shapesData && (
          <Source id="shapes-source" type="geojson" data={shapesData}>
            <Layer {...shapesLayer} />
          </Source>
        )}

        {/* Layer 4: Density Grid - Above shapes, below tourism */}
        {gridData && (
          <Source id="grid-source" type="geojson" data={gridData}>
            <Layer {...gridLayer} />
          </Source>
        )}

        {/* Layer 5: Tourist Establishments (WMS) - Above density, below stops */}
        {/* Layer 5: Tourist Establishments (Vector) - Above density, below stops */}
        {tourismData && showTourism && (
          <Source id="tourism-source" type="geojson" data={tourismData}>
            <Layer
              id="tourism-spots"
              type="circle"
              paint={{
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  12, 3, // Zoom 12 -> 3px
                  15, ['match', ['get', 'type'], 'Hotel', 10, 'Vivienda Vacacional', 6, 6] // Zoom 15 -> Hoteles grandes, VV medianas
                ],
                'circle-color': ['get', 'color'],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff',
                'circle-opacity': 0.8
              }}
            />
          </Source>
        )}

        {/* Layer 6 (Top): Stops - ALWAYS on top */}
        {stopsData && (
          <Source id="stops-source" type="geojson" data={stopsData}>
            <Layer {...stopsLayer} />
          </Source>
        )}
      </Map>

      <MapControls
        timeSlot={timeSlot}
        metric={metric}
        showStops={showStops}
        showSections={showSections}
        showShapes={showShapes}
        showTourism={showTourism}
        densityLayer={densityLayer}
        contextMetric={contextMetric}
        onTimeSlotChange={setTimeSlot}
        onMetricChange={setMetric}
        onShowStopsChange={setShowStops}
        onShowSectionsChange={setShowSections}
        onShowShapesChange={setShowShapes}
        onShowTourismChange={setShowTourism}
        onDensityLayerChange={setDensityLayer}
        onContextMetricChange={setContextMetric}
        sectionsOpacity={sectionsOpacity}
        onSectionsOpacityChange={setSectionsOpacity}
        contextOpacity={contextOpacity}
        onContextOpacityChange={setContextOpacity}
        densityOpacity={densityOpacity}
        onDensityOpacityChange={setDensityOpacity}
        timeSlots={TIME_SLOTS}
        metrics={METRICS}
      />

      <button
        className={`toggle-panel-btn ${isPanelCollapsed ? 'panel-collapsed' : ''}`}
        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
      >
        {isPanelCollapsed ? '◀ Mostrar panel' : 'Ocultar panel ▶'}
      </button>

      <SidePanel
        selectedSection={selectedSection}
        selectedStop={selectedStop}
        timeSlot={timeSlot}
        metric={metric}
        isCollapsed={isPanelCollapsed}
        onClose={() => {
          setSelectedSection(null);
          setSelectedStop(null);
        }}
      />
    </div>
  );
}
