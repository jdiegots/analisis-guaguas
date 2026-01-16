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

// Unified color scale - all metrics use the same blue gradient
const UNIFIED_BLUE_SCALE = [
  { value: 0, color: '#f7fbff' },
  { value: 0.2, color: '#deebf7' },
  { value: 0.4, color: '#c6dbef' },
  { value: 0.6, color: '#9ecae1' },
  { value: 0.8, color: '#6baed6' },
  { value: 1.0, color: '#08519c' },
];

const COLOR_SCALES = {
  // Frequency metrics (normalized 0-1)
  stop_time_events_all_day: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 3000 })),
  stop_time_events_morning: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 800 })),
  stop_time_events_midday: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 800 })),
  stop_time_events_afternoon: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 800 })),
  stop_time_events_night: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 300 })),

  // Coverage metrics (0-100%)
  coverage_300_area_pct: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 100 })),
  coverage_500_area_pct: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 100 })),

  // Density and accessibility
  stops_per_km2: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 50 })),
  nearest_stop_meters: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 1000 })),
  unique_routes_all_day: UNIFIED_BLUE_SCALE.map(s => ({ ...s, value: s.value * 20 })),

  // Inequality indicators (0-1)
  indicator_elderly_desert: UNIFIED_BLUE_SCALE,
  indicator_unemployment_trap: UNIFIED_BLUE_SCALE,
  indicator_education_gap: UNIFIED_BLUE_SCALE,
  indicator_service_dependency: UNIFIED_BLUE_SCALE,

  // Demographic context (0-1)
  prop_elderly: UNIFIED_BLUE_SCALE,

  // Occupation sectors (share of total employed, 0-1)
  occ_services: UNIFIED_BLUE_SCALE,
  occ_construction: UNIFIED_BLUE_SCALE,
  occ_industry: UNIFIED_BLUE_SCALE,
  occ_agriculture: UNIFIED_BLUE_SCALE,
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
  // === INDICADORES DE DESIGUALDAD ===
  {
    value: 'indicator_unemployment_trap',
    label: 'Exclusión Laboral',
    formula: 'Zonas con alto desempleo y baja frecuencia de servicio',
    group: 'Indicadores de desigualdad'
  },
  {
    value: 'indicator_elderly_desert',
    label: 'Aislamiento de Población Mayor',
    formula: 'Zonas con alta población 65+ y baja cobertura de paradas',
    group: 'Indicadores de desigualdad'
  },
  {
    value: 'indicator_education_gap',
    label: 'Inequidad Educativa',
    formula: 'Zonas con bajo nivel formativo y mala accesibilidad',
    group: 'Indicadores de desigualdad'
  },
  {
    value: 'indicator_service_dependency',
    label: 'Dependencia de Servicios',
    formula: 'Zonas con alto empleo en servicios y baja frecuencia de guaguas',
    group: 'Indicadores de desigualdad'
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
    value: 'coverage_500_area_pct',
    label: 'Cobertura a 500m',
    formula: 'Porcentaje de área a menos de 500m de paradas',
    group: 'Servicio y accesibilidad'
  },
  {
    value: 'nearest_stop_meters',
    label: 'Distancia a Parada Más Cercana',
    formula: 'Distancia desde el centroide de la sección',
    group: 'Servicio y accesibilidad'
  },
  {
    value: 'stops_per_km2',
    label: 'Densidad de Paradas',
    formula: 'Número de paradas por kilómetro cuadrado',
    group: 'Servicio y accesibilidad'
  },

  // === CONTEXTO SOCIODEMOGRÁFICO ===
  {
    value: 'prop_elderly',
    label: 'Población Mayor de 65',
    formula: 'Proporción de población mayor de 65 años',
    group: 'Contexto sociodemográfico'
  },
  {
    value: 'occ_services',
    label: 'Empleo en Servicios',
    formula: 'Proporción de empleo en el sector servicios',
    group: 'Contexto sociodemográfico'
  },
  {
    value: 'occ_construction',
    label: 'Empleo en Construcción',
    formula: 'Proporción de empleo en construcción',
    group: 'Contexto sociodemográfico'
  },
  {
    value: 'occ_industry',
    label: 'Empleo en Industria',
    formula: 'Proporción de empleo en industria',
    group: 'Contexto sociodemográfico'
  },
  {
    value: 'occ_agriculture',
    label: 'Empleo en Agricultura',
    formula: 'Proporción de empleo en agricultura',
    group: 'Contexto sociodemográfico'
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
  const [showStops, setShowStops] = useState(true);
  const [showSections, setShowSections] = useState(true);
  const [showShapes, setShowShapes] = useState(false);
  const [showTourism, setShowTourism] = useState(false);
  const [densityLayer, setDensityLayer] = useState('population');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  useEffect(() => {
    loadSections();
    loadStops();
    loadShapes();
    loadGrid('population');
  }, []);

  // Reload grid when densityLayer changes
  useEffect(() => {
    if (densityLayer !== 'none') {
      loadGrid(densityLayer);
    } else {
      setGridData(null);
    }
  }, [densityLayer]);

  const loadSections = async () => {
    try {
      const response = await fetch('/api/sections');
      const data = await response.json();
      setSectionsData(data);
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  };

  const loadStops = async () => {
    try {
      const response = await fetch('/api/stops');
      const data = await response.json();
      setStopsData(data);
    } catch (error) {
      console.error('Error loading stops:', error);
    }
  };

  const loadGrid = async (type: string) => {
    try {
      const response = await fetch(`/api/grid?type=${type}`);
      const data = await response.json();
      setGridData(data);
    } catch (error) {
      console.error('Error loading grid:', error);
    }
  };

  const loadShapes = async () => {
    try {
      const response = await fetch('/api/shapes');
      const data = await response.json();
      setShapesData(data);
    } catch (error) {
      console.error('Error loading shapes:', error);
    }
  };

  const getMetricKey = () => {
    if (metric === 'stop_time_events_all_day' || metric === 'unique_routes_all_day') {
      // For service metrics, append time slot suffix
      const suffix = timeSlot === 'all_day' ? '_all_day' : `_${timeSlot}`;
      return metric.replace('_all_day', suffix);
    }
    return metric;
  };

  const sectionsLayer = useMemo<FillLayer>(() => {
    const metricKey = getMetricKey();
    const scale = COLOR_SCALES[metricKey as keyof typeof COLOR_SCALES] || COLOR_SCALES[metric as keyof typeof COLOR_SCALES] || COLOR_SCALES.stop_time_events_all_day;

    const expression: any[] = ['interpolate', ['linear'], ['get', metricKey]];

    scale.forEach(({ value, color }) => {
      expression.push(value, color);
    });

    return {
      id: 'sections-fill',
      type: 'fill',
      layout: {
        visibility: showSections ? 'visible' : 'none'
      },
      paint: {
        'fill-color': expression,
        'fill-opacity': 0.6,
      },
      minzoom: 0,
      maxzoom: 24,
    };
  }, [metric, timeSlot, showSections]);

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
    // All density layers use black
    return '#000000';
  };

  const gridLayer: CircleLayer = {
    id: 'grid-population',
    type: 'circle',
    layout: {
      visibility: densityLayer !== 'none' ? 'visible' : 'none'
    },
    paint: {
      'circle-color': getGridLayerColor(),
      'circle-radius': 1.5,
      'circle-opacity': 0.5,
      'circle-stroke-width': 0
    }
  };

  const stopsLayer: CircleLayer = {
    id: 'stops',
    type: 'circle',
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

    if (feature.layer.id === 'stops') {
      setSelectedStop(feature.properties?.stop_id);
      setSelectedSection(null);
    } else if (feature.layer.id === 'sections-fill') {
      setSelectedSection(feature.properties?.section_code);
      setSelectedStop(null);
    }
  };

  return (
    <div className="map-container">
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
          </Source>
        )}

        {/* Layer 2: Census Sections Outline (on top of fill) */}
        {sectionsData && (
          <Source id="sections-outline-source" type="geojson" data={sectionsData}>
            <Layer {...sectionsOutlineLayer} />
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
        {showTourism && (
          <>
            <Source
              id="tourism-hotels-source"
              type="raster"
              tiles={[
                `https://idecan2.grafcan.es/ServicioWMS/EstablecimientosTuristicos?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=ALOJATIVOS_HOTELERO&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`
              ]}
              tileSize={256}
              bounds={[-15.527, 28.024, -15.396, 28.181]}
            >
              <Layer
                id="tourism-hotels"
                type="raster"
                minzoom={11}
                paint={{ 'raster-opacity': 0.7 }}
              />
            </Source>

            <Source
              id="tourism-restaurants-source"
              type="raster"
              tiles={[
                `https://idecan2.grafcan.es/ServicioWMS/EstablecimientosTuristicos?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=RESTAURACION&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`
              ]}
              tileSize={256}
              bounds={[-15.527, 28.024, -15.396, 28.181]}
            >
              <Layer
                id="tourism-restaurants"
                type="raster"
                minzoom={11}
                paint={{ 'raster-opacity': 0.7 }}
              />
            </Source>

            <Source
              id="tourism-vacation-source"
              type="raster"
              tiles={[
                `https://idecan2.grafcan.es/ServicioWMS/EstablecimientosTuristicos?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=ALOJATIVOS_EXTRAHOTELERO_VV&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`
              ]}
              tileSize={256}
              bounds={[-15.527, 28.024, -15.396, 28.181]}
            >
              <Layer
                id="tourism-vacation"
                type="raster"
                minzoom={11}
                paint={{ 'raster-opacity': 0.7 }}
              />
            </Source>
          </>
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
        onTimeSlotChange={setTimeSlot}
        onMetricChange={setMetric}
        onShowStopsChange={setShowStops}
        onShowSectionsChange={setShowSections}
        onShowShapesChange={setShowShapes}
        onShowTourismChange={setShowTourism}
        onDensityLayerChange={setDensityLayer}
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
