# 🚌 Análisis Guaguas Municipales - Las Palmas de Gran Canaria

Webapp de análisis de transporte público basada en datos GTFS y secciones censales del INE. Desarrollada con Next.js, PostgreSQL/PostGIS y Mapbox GL.

## 🎯 Objetivo

Permitir a un grupo de trabajo entender rápidamente, con mapa y métricas numéricas, cómo se distribuyen las paradas y el servicio del sistema de transporte público por secciones censales. Sistema transparente donde cada estadística se explica con fórmula y fuentes de datos GTFS.

## 📊 Métricas Calculadas

### Métricas Básicas
- **Paradas por sección**: Conteo de stops dentro del polígono
- **Densidad de paradas**: stops_count / área_km²
- **Distancia a parada más cercana**: Distancia desde centroide de sección a stop más próximo
- **Cobertura 300m/500m**: % de área cubierta por buffers alrededor de paradas

### Métricas de Servicio (por franja horaria)
- **Eventos de servicio**: Número de stop_times en paradas de la sección
- **Líneas únicas**: Número de routes distintas que sirven la sección
- **Top rutas**: Ranking de líneas por número de eventos

### Franjas Horarias
- **Mañana**: 06:00-10:00
- **Mediodía**: 12:00-16:00
- **Tarde**: 16:00-20:00
- **Noche**: 20:00-24:00
- **Todo el día**: 00:00-24:00

## 🏗️ Arquitectura

```
├── database/
│   └── schema.sql              # Esquema PostgreSQL + PostGIS
├── scripts/
│   ├── setup-database.js       # Crear tablas e índices
│   ├── import-gtfs.js          # Importar archivos GTFS
│   ├── import-sections.js      # Importar secciones censales
│   └── build-metrics.js        # Calcular todas las métricas
├── src/
│   ├── app/
│   │   ├── api/                # API endpoints
│   │   │   ├── auth/          # Autenticación
│   │   │   ├── sections/      # Secciones con métricas
│   │   │   ├── section/[code] # Detalle de sección
│   │   │   ├── stops/         # Todas las paradas
│   │   │   └── stop/[id]      # Detalle de parada
│   │   ├── page.tsx           # Página principal
│   │   └── layout.tsx         # Layout raíz
│   ├── components/
│   │   ├── MapView.tsx        # Mapa principal con Mapbox GL
│   │   ├── MapControls.tsx    # Controles del mapa
│   │   ├── SidePanel.tsx      # Panel lateral con métricas
│   │   └── LoginForm.tsx      # Formulario de login
│   └── lib/
│       ├── db.ts              # Conexión PostgreSQL
│       └── auth.ts            # Utilidades de autenticación
└── gtfs/
    └── extracted/             # Archivos GTFS (.csv)
```

## 📋 Requisitos Previos

- **Node.js** 18+ ([descargar](https://nodejs.org/))
- **PostgreSQL** 14+ con **PostGIS** ([descargar](https://www.postgresql.org/download/))
- **Cuenta Mapbox** para token de API ([registrarse gratis](https://account.mapbox.com/auth/signup/))

### Instalar PostgreSQL y PostGIS

#### Windows
```bash
# Descargar instalador desde postgresql.org
# Durante la instalación, instalar Stack Builder
# En Stack Builder, instalar PostGIS desde Spatial Extensions
```

#### macOS (Homebrew)
```bash
brew install postgresql postgis
brew services start postgresql
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis
sudo systemctl start postgresql
```

## 🚀 Instalación Local

### 1. Clonar o descargar el proyecto

El proyecto ya está en `C:\dev\guaguas`

### 2. Instalar dependencias

```bash
cd C:\dev\guaguas
npm install
```

### 3. Crear base de datos PostgreSQL

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE guaguas_db;

# Conectar a la base de datos
\c guaguas_db

# Habilitar PostGIS (también lo hace el script, pero por si acaso)
CREATE EXTENSION postgis;

# Salir
\q
```

### 4. Configurar variables de entorno

Copiar `.env.example` a `.env` y configurar:

```bash
cp .env.example .env
```

Editar `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/guaguas_db

# Mapbox Token (obtener en https://account.mapbox.com/access-tokens/)
MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXIiLCJhIjoiY2xrbDEyMzQ1In0.abcdef123456

# Authentication
ACCESS_PASSWORD=tu_contraseña_segura
SESSION_SECRET=un_secreto_largo_y_aleatorio_de_al_menos_32_caracteres_1234567890
```

**IMPORTANTE**:
- Reemplazar `tu_password` con tu contraseña de PostgreSQL
- Obtener token de Mapbox en https://account.mapbox.com/access-tokens/
- Cambiar `ACCESS_PASSWORD` por una contraseña segura para acceder a la webapp
- Cambiar `SESSION_SECRET` por un string aleatorio largo

### 5. Crear esquema de base de datos

```bash
npm run db:setup
```

Esto crea todas las tablas, índices, funciones y vistas necesarias.

### 6. Importar datos GTFS

Los archivos GTFS ya están en `gtfs/extracted/`. Importarlos:

```bash
npm run import:gtfs
```

Esto importa:
- agency.csv
- routes.csv
- stops.csv (y crea geometrías POINT)
- trips.csv
- stop_times.csv
- shapes.csv (y crea geometrías LINESTRING)
- calendar.csv
- calendar_dates.csv

### 7. Obtener e importar secciones censales

#### Opción A: Descargar del INE (recomendado)

1. Ir a: https://www.ine.es/ss/Satellite?L=es_ES&c=Page&cid=1259952026632&p=1259952026632&pagename=ProductosYServicios%2FPYSLayout

2. Buscar "Cartografía de Secciones Censales" del año más reciente

3. Descargar shapefile de Canarias (provincia 35) o de toda España

4. Extraer el ZIP y ubicar los archivos `.shp`

5. **Filtrar por Las Palmas de Gran Canaria usando QGIS**:
   - Abrir QGIS (descargar gratis en https://qgis.org)
   - Arrastrar el archivo `.shp` al mapa
   - Clic derecho en la capa → Filtrar
   - Usar filtro: `"CPRO" = '35' AND "CMUN" = '016'`
   - Clic derecho → Exportar → Guardar como
   - Formato: GeoJSON
   - CRS: EPSG:4326 - WGS 84
   - Guardar como: `C:\dev\guaguas\data\census_sections_las_palmas.geojson`

6. **Alternativa: Filtrar con ogr2ogr (GDAL)**:
   ```bash
   ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
     C:\dev\guaguas\data\census_sections_las_palmas.geojson \
     SECC_CE_20210101.shp \
     -where "CPRO='35' AND CMUN='016'"
   ```

7. Importar a PostgreSQL:
   ```bash
   npm run import:sections
   ```

#### Opción B: Usar datos de prueba (temporal)

Si necesitas arrancar rápido para probar, puedes crear un GeoJSON de prueba manualmente en `data/census_sections_las_palmas.geojson`:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "CPRO": "35",
        "CMUN": "016",
        "CDIS": "01",
        "CSEC": "001",
        "CUSEC": "35016001001",
        "NOMBRE": "Sección de prueba 1"
      },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[
          [[-15.45, 28.10], [-15.44, 28.10], [-15.44, 28.11], [-15.45, 28.11], [-15.45, 28.10]]
        ]]
      }
    }
  ]
}
```

### 8. Calcular métricas

Una vez importados GTFS y secciones, calcular todas las métricas:

```bash
npm run build:metrics
```

Este script:
- Calcula servicios activos para día de referencia (martes típico)
- Calcula métricas básicas (paradas, densidad, distancias, cobertura)
- Calcula métricas de servicio por franja horaria
- Precalcula top rutas por sección y franja
- Guarda todo en tabla `section_metrics` para lectura rápida

**Duración estimada**: 5-15 minutos dependiendo del tamaño de datos.

### 9. Levantar en desarrollo

```bash
npm run dev
```

Abrir http://localhost:3000

**Login**: Usar la contraseña configurada en `ACCESS_PASSWORD`

## 🎨 Uso de la Webapp

### Pantalla de Login
- Introducir la contraseña configurada en `.env`
- La sesión dura 7 días

### Mapa Principal
- **Controles superiores izquierda**:
  - Selector de franja horaria
  - Selector de métrica a visualizar
  - Checkboxes para mostrar/ocultar capas

- **Mapa**:
  - Secciones censales pintadas con choropleth según métrica seleccionada
  - Puntos rojos = paradas
  - Clic en sección → panel lateral muestra métricas
  - Clic en parada → panel lateral muestra detalles

### Panel Lateral (derecha)
- **Para sección censal**:
  - Métricas básicas con fórmulas
  - Métricas de servicio según franja horaria seleccionada
  - Top 10 rutas que sirven la sección
  - Lista de paradas en la sección

- **Para parada**:
  - Información básica (ID, nombre, coordenadas)
  - Sección censal a la que pertenece
  - Líneas que pasan por la parada
  - Horarios de ejemplo

### Botón "Ocultar/Mostrar panel"
- Colapsa el panel lateral para ver mapa completo

## 🔄 Reimportar Datos

Si actualizas los archivos GTFS o secciones censales:

```bash
# Reimportar todo de cero
npm run import:all

# O individualmente:
npm run import:gtfs
npm run import:sections
npm run build:metrics
```

## 🌐 Despliegue en Vercel

### 1. Preparar base de datos en producción

Opciones:
- **Vercel Postgres** (recomendado para simplicidad)
- **Supabase** (PostgreSQL + PostGIS gratis)
- **Railway** / **Render** / **DigitalOcean**

#### Ejemplo con Supabase:

1. Crear cuenta en https://supabase.com
2. Crear nuevo proyecto
3. En SQL Editor, habilitar PostGIS:
   ```sql
   CREATE EXTENSION postgis;
   ```
4. Obtener connection string en Settings → Database

### 2. Desplegar en Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Desplegar
vercel
```

### 3. Configurar variables de entorno en Vercel

En el dashboard de Vercel → Settings → Environment Variables:

```
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXIiLCJhIjoiY2xrbDEyMzQ1In0.abcdef123456
ACCESS_PASSWORD=tu_contraseña_segura
SESSION_SECRET=un_secreto_largo_y_aleatorio_de_al_menos_32_caracteres_1234567890
```

### 4. Importar datos a producción

Desde tu máquina local, conectado a la DB de producción:

```bash
# Cambiar DATABASE_URL temporalmente en .env a la URL de producción

npm run db:setup
npm run import:gtfs
npm run import:sections
npm run build:metrics

# Restaurar DATABASE_URL local después
```

### 5. Redeploy

```bash
vercel --prod
```

## 📖 Documentación de Métricas

Todas las métricas incluyen su fórmula y tablas usadas, visible en el panel lateral al hacer clic en una sección.

### stops_count
```
Fórmula: COUNT(stops) WHERE ST_Within(stop.geom, section.geom)
Tablas: stops, census_sections
```

### stops_per_km2
```
Fórmula: stops_count / area_km2
Tablas: section_metrics, census_sections
```

### nearest_stop_meters
```
Fórmula: MIN(ST_Distance(ST_Centroid(section.geom), stop.geom))
Tablas: stops, census_sections
```

### coverage_300_area_pct / coverage_500_area_pct
```
Fórmula: area(ST_Intersection(section.geom, ST_Union(ST_Buffer(stops, Xm)))) / area(section.geom) * 100
Tablas: stops, census_sections
```

### stop_time_events (por franja)
```
Fórmula: COUNT(stop_times.trip_id) WHERE stop_id IN (stops de sección) AND service_id IN (activos) AND arrival_time IN (franja)
Tablas: stop_times, trips, calendar, calendar_dates, stops
```

### unique_routes (por franja)
```
Fórmula: COUNT(DISTINCT trips.route_id) WHERE stop_id IN (stops de sección) AND service_id IN (activos) AND arrival_time IN (franja)
Tablas: stop_times, trips, routes, stops
```

## 🛠️ Comandos Disponibles

```bash
npm run dev          # Desarrollo local (http://localhost:3000)
npm run build        # Build para producción
npm run start        # Servidor de producción

npm run db:setup     # Crear esquema de base de datos
npm run import:gtfs  # Importar archivos GTFS
npm run import:sections # Importar secciones censales
npm run build:metrics   # Calcular métricas
npm run import:all      # Ejecutar todos los imports + métricas
```

## 🐛 Troubleshooting

### Error: "relation does not exist"
- Ejecutar `npm run db:setup` primero

### Error: "PostGIS extension not found"
- Asegurar que PostGIS está instalado en PostgreSQL
- En psql: `CREATE EXTENSION postgis;`

### Error: "Census sections file not found"
- Descargar y preparar GeoJSON según instrucciones en paso 7
- Colocar en `data/census_sections_las_palmas.geojson`

### Mapa no carga
- Verificar que `MAPBOX_TOKEN` está configurado correctamente en `.env`
- Token debe empezar con `pk.`

### No aparecen métricas
- Ejecutar `npm run build:metrics`
- Verificar que GTFS y secciones están importados

### Contraseña no funciona
- Verificar `ACCESS_PASSWORD` en `.env`
- Reiniciar servidor de desarrollo

## 📁 Estructura de Base de Datos

### Tablas GTFS
- `agency`, `routes`, `trips`, `stops`, `stop_times`, `shapes`, `calendar`, `calendar_dates`

### Tablas Territoriales
- `census_sections`: Secciones censales con geometría MULTIPOLYGON
- `shape_geometries`: Geometrías LINESTRING de rutas

### Tablas de Métricas (precalculadas)
- `section_metrics`: Métricas agregadas por sección y franja horaria
- `section_top_routes`: Top 10 rutas por sección y franja

### Índices Espaciales
- GiST en todas las columnas `geom` para queries espaciales rápidos
- Índices B-tree en claves foráneas y columnas de búsqueda

## 📄 Licencia

Este proyecto es de uso interno para análisis de transporte público. Los datos GTFS son propiedad de Guaguas Municipales de Las Palmas de Gran Canaria. La cartografía censal es del INE (Instituto Nacional de Estadística).

## 🤝 Soporte

Para problemas o preguntas, revisar:
1. Este README
2. Logs de la aplicación (console del navegador + terminal)
3. Logs de PostgreSQL

---

**Desarrollado con Next.js, PostgreSQL/PostGIS y Mapbox GL**
