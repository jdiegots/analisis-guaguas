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
  metrics: Array<{ value: string; label: string; formula: string; group: string }>;
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
  const selectedMetric = metrics.find((item) => item.value === metric);
  const selectedTimeSlot = timeSlots.find((slot) => slot.value === timeSlot);
  const groupedMetrics = metrics.reduce<Record<string, typeof metrics>>((acc, item) => {
    const groupName = item.group ?? 'Indicadores';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(item);
    return acc;
  }, {});
  const densityOptions = [
    {
      value: 'none',
      label: 'Sin densidad',
      description: 'Oculta los puntos de densidad.',
    },
    {
      value: 'population',
      label: 'Población total',
      description: '1 punto = 20 habitantes.',
    },
    {
      value: 'ppar',
      label: 'Población parada',
      description: '1 punto = 5 personas en paro.',
    },
    {
      value: 'pact',
      label: 'Población activa',
      description: '1 punto = 10 personas activas.',
    },
  ];
  const activeLayers = [
    showSections ? 'Secciones censales' : null,
    showStops ? 'Paradas' : null,
    showShapes ? 'Recorridos' : null,
    showTourism ? 'Turismo' : null,
  ].filter(Boolean) as string[];
  const densityLabel =
    densityOptions.find((option) => option.value === densityLayer)?.label ?? 'Sin densidad';

  return (
    <div className="controls">
      <div className="controls-header">
        <h3>Controles del mapa</h3>
        <p className="controls-subtitle">
          Elige un indicador, una franja horaria y las capas que quieres superponer.
        </p>
      </div>
      <div className="control-summary">
        <div className="summary-block">
          <span className="summary-label">Métrica activa</span>
          <span className="summary-value">{selectedMetric?.label}</span>
          {selectedMetric?.formula && (
            <span className="summary-caption">{selectedMetric.formula}</span>
          )}
        </div>
        <div className="summary-block">
          <span className="summary-label">Capas activas</span>
          <div className="tag-list">
            {activeLayers.length > 0 ? (
              activeLayers.map((layer) => (
                <span key={layer} className="tag">
                  {layer}
                </span>
              ))
            ) : (
              <span className="tag muted">Sin capas activas</span>
            )}
          </div>
        </div>
        <div className="summary-block">
          <span className="summary-label">Densidad</span>
          <span className="summary-value">
            {densityOptions.find((option) => option.value === densityLayer)?.label ?? 'Sin densidad'}
            {densityLabel}
          </span>
          {isFrequencyMetric && selectedTimeSlot && (
            <span className="summary-caption">Franja: {selectedTimeSlot.label}</span>
          )}
        </div>
      </div>
      <div className="control-section">
        <div className="section-header">
          <h4>Indicador principal</h4>
          <p>Define el color de las secciones según el indicador seleccionado.</p>
        </div>
        <div className="control-group">
          <label htmlFor="metric">Métrica</label>
          <select
            id="metric"
            value={metric}
            onChange={(e) => onMetricChange(e.target.value)}
          >
            {Object.entries(groupedMetrics).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selectedMetric?.formula && (
            <p className="control-helper">{selectedMetric.formula}</p>
          )}
        </div>
        <div className="control-group">
          <label>Franja horaria</label>
          <div className={`segmented-control ${isFrequencyMetric ? '' : 'is-disabled'}`}>
            {timeSlots.map((slot) => (
              <button
                key={slot.value}
                type="button"
                className={slot.value === timeSlot ? 'is-active' : ''}
                onClick={() => onTimeSlotChange(slot.value)}
                disabled={!isFrequencyMetric}
              >
                {slot.label}
              </button>
            ))}
          </div>
          {!isFrequencyMetric && (
            <p className="control-helper">
              Disponible al seleccionar Frecuencia de Servicio o Diversidad de Líneas.
            </p>
          )}
        </div>
      </div>
      <div className="control-section">
        <div className="section-header">
          <h4>Densidad de población</h4>
          <p>Visualiza puntos para tener una idea rápida de concentración.</p>
        </div>
        <div className="option-cards" role="radiogroup" aria-label="Capa de densidad">
          {densityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={densityLayer === option.value}
              className={densityLayer === option.value ? 'is-selected' : ''}
              onClick={() => onDensityLayerChange(option.value)}
            >
              <span className="option-title">{option.label}</span>
              <span className="option-description">{option.description}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="control-section">
        <div className="section-header">
          <h4>Capas adicionales</h4>
          <p>Activa elementos para contextualizar el indicador.</p>
        </div>
        <div className="layer-toggles">
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showSections}
              onChange={(e) => onShowSectionsChange(e.target.checked)}
            />
            <span>Secciones censales</span>
          </label>
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showStops}
              onChange={(e) => onShowStopsChange(e.target.checked)}
            />
            <span>Paradas</span>
          </label>
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showShapes}
              onChange={(e) => onShowShapesChange(e.target.checked)}
            />
            <span>Recorridos de líneas</span>
          </label>
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showTourism}
              onChange={(e) => onShowTourismChange(e.target.checked)}
            />
            <span>Establecimientos turísticos</span>
          </label>
        </div>
      </div>
      <a href="/analisis-tarifas" className="fare-analysis-link">
        📊 Análisis de Equidad Tarifaria
      </a>
    </div>
  );
}
