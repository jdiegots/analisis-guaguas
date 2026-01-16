'use client';

interface MapControlsProps {
  timeSlot: string;
  metric: string;
  showStops: boolean;
  showSections: boolean;
  showShapes: boolean;
  showTourism: boolean;
  densityLayer: string;
  onTimeSlotChange: (value: string) => void;
  onMetricChange: (value: string) => void;
  onShowStopsChange: (value: boolean) => void;
  onShowSectionsChange: (value: boolean) => void;
  onShowShapesChange: (value: boolean) => void;
  onShowTourismChange: (value: boolean) => void;
  onDensityLayerChange: (value: string) => void;
  timeSlots: Array<{ value: string; label: string }>;
  metrics: Array<{ value: string; label: string; formula: string }>;
}

export default function MapControls({
  timeSlot,
  metric,
  showStops,
  showSections,
  showShapes,
  showTourism,
  densityLayer,
  onTimeSlotChange,
  onMetricChange,
  onShowStopsChange,
  onShowSectionsChange,
  onShowShapesChange,
  onShowTourismChange,
  onDensityLayerChange,
  timeSlots,
  metrics,
}: MapControlsProps) {
  // Time slot selector only applies to frequency metrics
  const isFrequencyMetric = metric === 'stop_time_events_all_day' || metric === 'unique_routes_all_day';

  return (
    <div className="controls">
      <h3>Controles del Mapa</h3>

      <div className="control-group">
        <label htmlFor="metric">Métrica a visualizar</label>
        <select
          id="metric"
          value={metric}
          onChange={(e) => onMetricChange(e.target.value)}
        >
          {metrics.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {isFrequencyMetric && (
        <div className="control-group" style={{ marginTop: '8px' }}>
          <label htmlFor="time-slot" style={{ fontSize: '0.85rem', color: '#666' }}>
            Franja horaria (solo para frecuencia)
          </label>
          <select
            id="time-slot"
            value={timeSlot}
            onChange={(e) => onTimeSlotChange(e.target.value)}
            style={{ fontSize: '0.9rem' }}
          >
            {timeSlots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="control-group">
        <label htmlFor="density-layer">Capa de densidad (Puntos)</label>
        <select
          id="density-layer"
          value={densityLayer}
          onChange={(e) => onDensityLayerChange(e.target.value)}
        >
          <option value="none">Ocultar</option>
          <option value="population">Población Total (1 punto = 20 hab)</option>
          <option value="ppar">Población Parada (1 punto = 5 hab)</option>
          <option value="pact">Población Activa (1 punto = 10 hab)</option>
        </select>
      </div>

      <div className="control-group">
        <div className="layer-toggles">
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showSections}
              onChange={(e) => onShowSectionsChange(e.target.checked)}
            />
            <span>Mostrar secciones censales</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showStops}
              onChange={(e) => onShowStopsChange(e.target.checked)}
            />
            <span>Mostrar paradas</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showShapes}
              onChange={(e) => onShowShapesChange(e.target.checked)}
            />
            <span>Mostrar recorridos de líneas</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showTourism}
              onChange={(e) => onShowTourismChange(e.target.checked)}
            />
            <span>Mostrar establecimientos turísticos</span>
          </label>
        </div>
      </div>

      <a href="/analisis-tarifas" className="fare-analysis-link">
        📊 Análisis de Equidad Tarifaria
      </a>
    </div>
  );
}
