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
  onContextMetricChange: (value: string) => void;
  sectionsOpacity: number;
  onSectionsOpacityChange: (value: number) => void;
  contextOpacity: number;
  onContextOpacityChange: (value: number) => void;
  densityOpacity: number;
  onDensityOpacityChange: (value: number) => void;
  timeSlots: Array<{ value: string; label: string }>;
  metrics: Array<{ value: string; label: string; formula: string; group: string }>;
  contextMetric: string;
}

export default function MapControls({
  timeSlot,
  metric,
  showStops,
  showSections,
  showShapes,
  showTourism,
  densityLayer,
  contextMetric,
  onTimeSlotChange,
  onMetricChange,
  onShowStopsChange,
  onShowSectionsChange,
  onShowShapesChange,
  onShowTourismChange,
  onDensityLayerChange,
  onContextMetricChange,
  sectionsOpacity,
  onSectionsOpacityChange,
  contextOpacity,
  onContextOpacityChange,
  densityOpacity,
  onDensityOpacityChange,
  timeSlots,
  metrics,
}: MapControlsProps) {
  // Time slot selector only applies to frequency metrics
  const isFrequencyMetric = metric === 'stop_time_events_all_day' || metric === 'unique_routes_all_day';
  const selectedMetric = metrics.find((item) => item.value === metric);
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
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        </svg>
      )
    },
    {
      value: 'population',
      label: 'Población total',
      description: '1 punto = 20 habitantes.',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      )
    },
    {
      value: 'ppar',
      label: 'Población parada',
      description: '1 punto = 5 personas en paro.',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <line x1="19" y1="8" x2="19" y2="12"></line>
          <line x1="19" y2="16" x2="19.01" y1="16"></line>
        </svg>
      )
    },
    {
      value: 'pact',
      label: 'Población activa',
      description: '1 punto = 10 personas activas.',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline>
        </svg>
      )
    },
  ];

  const selectedDensity = densityOptions.find(o => o.value === densityLayer) || densityOptions[0];

  return (
    <div className="controls">
      <div className="controls-header">
        <h3>Controles del mapa</h3>
        <p className="controls-subtitle">
          Elige un indicador, una franja horaria y las capas que quieres superponer.
        </p>
      </div>

      <div className="control-section">
        <div className="section-header">
          <h4>Capas del mapa</h4>
          <p>Activa elementos para visualizar en el visor.</p>
        </div>

        <div className="layer-toggles" style={{ paddingBottom: '8px' }}>
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showSections}
              onChange={(e) => onShowSectionsChange(e.target.checked)}
            />
            <span>Secciones censales</span>
          </label>
        </div>

        {/* Métrica principal - Bloqueado si no hay secciones */}
        <div className={`control-group ${!showSections ? 'is-disabled' : ''}`} style={{ marginTop: '8px' }}>
          <label htmlFor="metric">Métrica principal</label>
          <select
            id="metric"
            value={metric}
            onChange={(e) => onMetricChange(e.target.value)}
            disabled={!showSections}
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
          {selectedMetric?.formula && showSections && (
            <p className="control-helper">{selectedMetric.formula}</p>
          )}
        </div>

        {/* Contexto - Bloqueado si no hay secciones */}
        <div className={`control-group ${!showSections ? 'is-disabled' : ''}`}>
          <label htmlFor="contextMetric">Contexto</label>
          <select
            id="contextMetric"
            value={contextMetric}
            onChange={(e) => onContextMetricChange(e.target.value)}
            disabled={!showSections}
          >
            <option value="none">Sin contexto adicional</option>
            <option value="prop_elderly">Población &gt; 65 años (Círculo)</option>
            <option value="income_median">Renta Media (Círculo)</option>
          </select>
        </div>

        <div className={`control-group ${!showSections ? 'is-disabled' : ''}`}>
          <label>Opacidad secciones: {Math.round(sectionsOpacity * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={sectionsOpacity}
            onChange={(e) => onSectionsOpacityChange(parseFloat(e.target.value))}
            style={{ width: '100%' }}
            disabled={!showSections}
          />
        </div>

        <div className={`control-group ${(!showSections || contextMetric === 'none') ? 'is-disabled' : ''}`}>
          <label>Opacidad círculos: {Math.round(contextOpacity * 100)}%</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={contextOpacity}
            onChange={(e) => onContextOpacityChange(parseFloat(e.target.value))}
            style={{ width: '100%' }}
            disabled={!showSections || contextMetric === 'none'}
          />
        </div>

        <div className={`control-group ${!showSections ? 'is-disabled' : ''}`}>
          <label>Franja horaria</label>
          <div className={`segmented-control ${isFrequencyMetric && showSections ? '' : 'is-disabled'}`}>
            {timeSlots.map((slot) => (
              <button
                key={slot.value}
                type="button"
                className={slot.value === timeSlot ? 'is-active' : ''}
                onClick={() => onTimeSlotChange(slot.value)}
                disabled={!isFrequencyMetric || !showSections}
              >
                {slot.label}
              </button>
            ))}
          </div>
          {(!isFrequencyMetric || !showSections) && (
            <p className="control-helper">
              {showSections ? 'Disponible al seleccionar Frecuencia de Servicio o Diversidad de Líneas.' : 'Activa Secciones censales para habilitar.'}
            </p>
          )}
        </div>

        <div className="layer-toggles" style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
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

          {showTourism && (
            <div className="legend-container" style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '6px', fontSize: '0.8rem' }}>

              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2980b9', marginRight: '8px', display: 'inline-block' }}></span>
                <span>Hoteles</span>
              </div>

              <div className="legend-item" style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#e67e22', marginRight: '8px', display: 'inline-block' }}></span>
                <span>Vivienda Vacacional</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="control-section">
        <div className="section-header">
          <h4 style={{ marginBottom: '12px' }}>Densidad de población</h4>
        </div>
        <div className="density-mini-selector">
          <div className="density-icons">
            {densityOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`density-icon-btn ${densityLayer === option.value ? 'is-active' : ''}`}
                onClick={() => onDensityLayerChange(option.value)}
                title={option.label}
              >
                {option.icon}
              </button>
            ))}
          </div>
          <div className="density-info-centered">
            <strong>{selectedDensity.label}</strong>
            <p>{selectedDensity.description}</p>
          </div>
        </div>
        {densityLayer !== 'none' && (
          <div className="control-group" style={{ marginTop: '1rem' }}>
            <label>Opacidad de los puntos: {Math.round(densityOpacity * 100)}%</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={densityOpacity}
              onChange={(e) => onDensityOpacityChange(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>


      <a href="/analisis-tarifas" className="fare-analysis-link">
        Análisis
      </a>
    </div >
  );
}
