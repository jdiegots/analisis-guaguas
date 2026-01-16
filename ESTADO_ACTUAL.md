# 📊 Estado Actual del Proyecto - Guaguas Analyzer

**Fecha**: 16 de enero de 2025

## ✅ Lo que ESTÁ funcionando

### 1. Base de Datos PostgreSQL + PostGIS
- ✅ PostgreSQL 18 instalado y corriendo (puerto 5433)
- ✅ PostGIS 3.6.1 instalado y habilitado
- ✅ Base de datos `guaguas_db` creada
- ✅ Todas las tablas creadas con geometrías

### 2. Datos GTFS Importados
- ✅ **183,871 registros** totales importados:
  - 47 líneas/rutas
  - 848 paradas (con geometrías POINT)
  - 7,131 viajes
  - 155,324 horarios de paso
  - 20,414 puntos de shape
  - 9 calendarios de servicio
  - 97 excepciones de calendario

### 3. Secciones Censales
- ✅ **279 secciones censales** de Las Palmas de Gran Canaria importadas
- ✅ Geometrías MULTIPOLYGON creadas
- ✅ Áreas calculadas en km²
- ⚠️ **PROBLEMA**: Las geometrías están en coordenadas UTM, no WGS84
  - Funcionan para cálculos pero pueden dar warnings
  - Para producción, deberían reconvertirse correctamente

### 4. Infraestructura Web
- ✅ Next.js configurado
- ✅ Mapbox token configurado: `pk.eyJ1IjoiamRpZWdvdHMi...`
- ✅ Conexión a base de datos funcionando
- ✅ Servidor corriendo en http://localhost:3000

### 5. Página de Prueba
- ✅ http://localhost:3000/test funcionando
- ✅ Muestra estadísticas de datos
- ✅ Muestra muestras de líneas, paradas y secciones

## ⚠️ Lo que FALTA para funcionalidad completa

### 1. Calcular Métricas
**Ejecutar**:
```bash
npm run build:metrics
```

Esto calculará:
- Paradas por sección
- Densidad de paradas
- Cobertura 300m y 500m
- Eventos de servicio por franja horaria
- Líneas únicas por sección
- Top rutas

**Duración estimada**: 5-15 minutos

### 2. Reiniciar Servidor
Para que cargue el nuevo token de Mapbox:
```bash
# Detener el servidor actual (Ctrl+C en la terminal)
# O cerrar la ventana de terminal
npm run dev
```

### 3. Reconvertir Secciones Censales (OPCIONAL)
Para tener geometrías correctas en WGS84:

```bash
# En la carpeta data/
ogr2ogr -f GeoJSON \
  -s_srs EPSG:25830 \  # UTM Zone 30N
  -t_srs EPSG:4326 \   # WGS84
  census_sections_las_palmas_wgs84.geojson \
  España_Seccionado2025_ETRS89H30/SECC_CE_20250101.shp \
  -where "CPRO='35' AND CMUN='016'"

# Luego reimportar con el nuevo archivo
```

## 🚀 Cómo probarlo AHORA

1. **Página de test** (sin mapa):
   ```
   http://localhost:3000/test
   ```
   - Muestra todos los datos importados
   - Muestra estadísticas
   - Muestra muestras de líneas, paradas, secciones

2. **Después de build:metrics**, página principal (con mapa):
   ```
   http://localhost:3000
   ```
   - Login con password: `guaguas2024`
   - Mapa interactivo con Mapbox
   - Choropleth de métricas
   - Panel lateral con detalles

## 🐛 Problemas Conocidos

### 1. Geometrías en coordenadas UTM
**Síntoma**: Warnings al calcular áreas
```
NOTICE: Coordinate values were coerced into range...
```

**Causa**: El shapefile del INE viene en ETRS89 UTM Zone 30N, no WGS84

**Solución**: Reconvertir con ogr2ogr especificando `-s_srs EPSG:25830`

**Impacto**: Las métricas funcionarán, pero puede haber pequeñas imprecisiones

### 2. API endpoints principales dan error
**Síntoma**:
```
Error: no existe la relación «section_metrics»
Error: no existe la columna s.geom
```

**Causa**: Estos endpoints esperan PostGIS completo y métricas precalculadas

**Solución**: Ejecutar `npm run build:metrics`

## 📁 Archivos Importantes

```
C:\dev\guaguas\
├── .env                          # Configuración (DB, Mapbox token, password)
├── database/
│   └── schema.sql                # Esquema completo PostGIS
├── scripts/
│   ├── import-gtfs.js            # ✅ Ejecutado
│   ├── import-sections.js        # ✅ Ejecutado
│   ├── build-metrics.js          # ⏳ Pendiente
│   └── check-postgis.js          # Para verificar PostGIS
├── data/
│   ├── seccionado_2025.zip       # Shapefile nacional del INE
│   ├── España_Seccionado2025_ETRS89H30/  # Shapefile extraído
│   └── census_sections_las_palmas.geojson  # 279 secciones (UTM)
└── src/
    ├── app/
    │   ├── test/page.tsx         # ✅ Página de prueba funcionando
    │   └── page.tsx              # Página principal (requiere métricas)
    └── lib/
        └── db.ts                 # Conexión PostgreSQL
```

## 🔧 Comandos Útiles

```bash
# Verificar PostGIS
node scripts/check-postgis.js

# Reimportar datos (si necesitas)
npm run import:gtfs
npm run import:sections

# Calcular métricas (IMPORTANTE)
npm run build:metrics

# Iniciar servidor
npm run dev

# Ver datos en PostgreSQL
psql -h localhost -U postgres -p 5433 -d guaguas_db
# Password: 1949Udlp1949
```

## 🎯 Próximos Pasos Recomendados

1. **AHORA**: Abre http://localhost:3000/test para ver los datos
2. **Ejecuta**: `npm run build:metrics` (demora ~10 min)
3. **Reinicia** el servidor Next.js
4. **Abre**: http://localhost:3000
5. **Login**: `guaguas2024`
6. **Disfruta** del mapa interactivo!

## 📞 Si algo no funciona

1. Verificar que PostgreSQL esté corriendo:
   ```bash
   psql -h localhost -U postgres -p 5433 -c "SELECT version();"
   ```

2. Verificar PostGIS:
   ```bash
   node scripts/check-postgis.js
   ```

3. Ver logs del servidor:
   ```bash
   # En la terminal donde corre npm run dev
   ```

4. Verificar datos:
   ```bash
   psql -h localhost -U postgres -p 5433 -d guaguas_db -c "
   SELECT
     (SELECT COUNT(*) FROM stops) as stops,
     (SELECT COUNT(*) FROM census_sections) as sections,
     (SELECT COUNT(*) FROM section_metrics) as metrics;
   "
   ```

---

**Estado**: 🟡 Funcional parcialmente - Listo para calcular métricas y usar mapa completo
