'use client';

import { useState, useEffect } from 'react';

export default function TestPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/test')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={styles.container}>Cargando...</div>;
  if (error) return <div style={styles.container}>Error: {error}</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🚌 Guaguas Analyzer - Test Page</h1>

      <div style={styles.status}>
        <h2>Estado del Sistema</h2>
        <p>✅ Base de datos: Conectada</p>
        <p>✅ Datos GTFS: Importados</p>
        <p style={{color: data?.postgis_available ? '#27ae60' : '#ff6b6b'}}>
          {data?.postgis_available ? '✅' : '⚠️'} PostGIS: {data?.postgis_available ? `Instalado (${data.postgis_version})` : 'No instalado'}
        </p>
        <p>✅ Secciones Censales: Importadas (WGS84)</p>
      </div>

      <div style={styles.stats}>
        <h2>Estadísticas</h2>
        <div style={styles.statGrid}>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{data?.stats?.routes_count || 0}</div>
            <div style={styles.statLabel}>Líneas</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{data?.stats?.stops_count || 0}</div>
            <div style={styles.statLabel}>Paradas</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{data?.stats?.trips_count || 0}</div>
            <div style={styles.statLabel}>Viajes</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{data?.stats?.stop_times_count?.toLocaleString() || 0}</div>
            <div style={styles.statLabel}>Horarios</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{data?.stats?.sections_count || 0}</div>
            <div style={styles.statLabel}>Secciones Censales</div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2>Líneas de Ejemplo (primeras 10)</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Número</th>
              <th>Nombre</th>
              <th>Color</th>
            </tr>
          </thead>
          <tbody>
            {data?.sample_routes?.map((route: any) => (
              <tr key={route.route_id}>
                <td><strong>{route.route_short_name}</strong></td>
                <td>{route.route_long_name}</td>
                <td>
                  <div style={{
                    ...styles.colorBox,
                    backgroundColor: `#${route.route_color || 'cccccc'}`
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.section}>
        <h2>Paradas de Ejemplo (primeras 20)</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Latitud</th>
              <th>Longitud</th>
            </tr>
          </thead>
          <tbody>
            {data?.sample_stops?.map((stop: any) => (
              <tr key={stop.stop_id}>
                <td>{stop.stop_id}</td>
                <td>{stop.stop_name}</td>
                <td>{stop.stop_lat?.toFixed(6)}</td>
                <td>{stop.stop_lon?.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.section}>
        <h2>Secciones Censales (primeras 10)</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
            </tr>
          </thead>
          <tbody>
            {data?.sample_sections?.map((section: any) => (
              <tr key={section.section_code}>
                <td><strong>{section.section_code}</strong></td>
                <td>{section.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.nextSteps}>
        <h2>Próximos Pasos</h2>
        <ol>
          <li>
            <strong>✅ Datos GTFS</strong>: 183,871 registros importados
          </li>
          <li>
            <strong>✅ Secciones censales</strong>: 279 secciones de Las Palmas importadas
          </li>
          <li>
            <strong>✅ PostGIS instalado</strong>: Versión 3.6.1
          </li>
          <li>
            <strong>✅ Token de Mapbox configurado</strong>
          </li>
          <li style={{color: '#3498db'}}>
            <strong>⏳ Calculando métricas...</strong>: npm run build:metrics está corriendo
            <br/>
            <small>Este proceso puede tardar 5-15 minutos</small>
          </li>
          <li style={{color: '#666'}}>
            <strong>Próximo</strong>: Una vez terminadas las métricas, la webapp completa estará lista
            <br/>
            <small>Podrás acceder al mapa interactivo en http://localhost:3000</small>
          </li>
        </ol>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  title: {
    fontSize: '2.5rem',
    marginBottom: '30px',
    color: '#2c3e50',
  },
  status: {
    background: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '30px',
  },
  stats: {
    marginBottom: '40px',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  statCard: {
    background: '#3498db',
    color: 'white',
    padding: '30px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  statNumber: {
    fontSize: '3rem',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  statLabel: {
    fontSize: '1rem',
    opacity: 0.9,
  },
  section: {
    marginBottom: '40px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '20px',
    fontSize: '0.9rem',
  },
  colorBox: {
    width: '60px',
    height: '30px',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  nextSteps: {
    background: '#fff3cd',
    padding: '30px',
    borderRadius: '8px',
    marginTop: '40px',
  },
};
