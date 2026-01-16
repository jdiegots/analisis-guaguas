# 🚀 Inicio Rápido - Guaguas Analyzer

## ⚡ Pasos mínimos para arrancar

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar PostgreSQL
```bash
# Crear base de datos
psql -U postgres
CREATE DATABASE guaguas_db;
\q
```

### 3. Configurar .env
Copiar `.env.example` a `.env` y editar:
```env
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/guaguas_db
MAPBOX_TOKEN=tu_token_de_mapbox
ACCESS_PASSWORD=tu_password_webapp
SESSION_SECRET=secreto_largo_aleatorio_32chars
```

**Obtener token Mapbox**: https://account.mapbox.com/access-tokens/

### 4. Crear tablas
```bash
npm run db:setup
```

### 5. Importar GTFS (ya tienes los archivos)
```bash
npm run import:gtfs
```

### 6. Descargar secciones censales

**Opción A - Desde INE (oficial)**:
1. Ir a: https://www.ine.es/censos2011/ine_censos2011_secciones.htm
2. Descargar shapefile de Canarias o España
3. Usar QGIS para filtrar: `CPRO='35' AND CMUN='016'`
4. Exportar como GeoJSON (EPSG:4326)
5. Guardar en: `data/census_sections_las_palmas.geojson`

**Opción B - Con ogr2ogr**:
```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
  data/census_sections_las_palmas.geojson \
  SECC_CE_20210101.shp \
  -where "CPRO='35' AND CMUN='016'"
```

### 7. Importar secciones
```bash
npm run import:sections
```

### 8. Calcular métricas (demora ~5-15 min)
```bash
npm run build:metrics
```

### 9. Arrancar webapp
```bash
npm run dev
```

Abrir: http://localhost:3000

**Login**: Usar el password del `.env` (`ACCESS_PASSWORD`)

---

## 📊 ¿Qué hace cada script?

- `db:setup` → Crea tablas, índices, funciones PostGIS
- `import:gtfs` → Lee CSVs, los mete en Postgres, crea geometrías
- `import:sections` → Lee GeoJSON de secciones censales, lo mete en Postgres
- `build:metrics` → Calcula todas las métricas por sección y franja horaria
- `import:all` → Ejecuta los 3 imports + build:metrics

---

## 🐛 Problemas comunes

**"relation does not exist"**
→ `npm run db:setup`

**"PostGIS not found"**
→ En psql: `CREATE EXTENSION postgis;`

**"Census sections file not found"**
→ Descargar y preparar el GeoJSON (paso 6)

**Mapa no carga**
→ Revisar `MAPBOX_TOKEN` en `.env`

**No hay métricas**
→ `npm run build:metrics`

---

## 📁 Estructura mínima que necesitas

```
guaguas/
├── gtfs/extracted/          ✅ Ya los tienes
├── data/
│   └── census_sections_las_palmas.geojson  ❌ Descargar del INE
├── .env                      ❌ Crear desde .env.example
└── [resto del código]        ✅ Ya está
```

---

## 🌐 Desplegar a Vercel

```bash
npm i -g vercel
vercel login
vercel

# En Vercel dashboard, añadir las variables de entorno
# Importar datos conectando a DB de producción
```

**Más detalles**: Ver `README.md` completo
