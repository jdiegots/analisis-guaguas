# 📐 Fórmulas y Cálculos - Guaguas Analyzer

Este documento explica en detalle cómo se calcula cada métrica en el sistema.

## 🎯 Filosofía

Todas las métricas se calculan a partir de:
- **Datos GTFS** locales (stops, routes, trips, stop_times, calendar)
- **Secciones censales** del INE (polígonos geográficos)
- **PostGIS** para cálculos espaciales

No hay "magia". Cada número es trazable a su fuente y fórmula.

---

## 📊 Métricas Básicas

### 1. stops_count
**Definición**: Número de paradas físicas dentro de la sección censal.

**Fórmula SQL**:
```sql
SELECT COUNT(s.stop_id)
FROM stops s
INNER JOIN census_sections cs ON ST_Within(s.geom, cs.geom)
WHERE cs.section_code = ?
```

**Tablas usadas**:
- `stops`: Paradas con geometría POINT
- `census_sections`: Secciones con geometría MULTIPOLYGON

**Interpretación**:
- 0 = Sin paradas en la sección
- 1-5 = Cobertura baja
- 6-15 = Cobertura media
- 16+ = Cobertura alta

---

### 2. stops_per_km2
**Definición**: Densidad de paradas por kilómetro cuadrado.

**Fórmula**:
```
stops_per_km2 = stops_count / area_km2
```

**Fórmula SQL**:
```sql
SELECT
  COUNT(s.stop_id) / cs.area_km2 AS stops_per_km2
FROM census_sections cs
LEFT JOIN stops s ON ST_Within(s.geom, cs.geom)
WHERE cs.section_code = ?
GROUP BY cs.area_km2
```

**Cálculo de area_km2**:
```sql
-- Proyectar a Web Mercator (metros), calcular área, convertir a km²
area_km2 = ST_Area(ST_Transform(geom, 3857)) / 1000000.0
```

**Interpretación**:
- < 5: Baja densidad (zonas periféricas)
- 5-15: Densidad media (zonas residenciales)
- 15-30: Alta densidad (zonas urbanas)
- > 30: Muy alta densidad (centro urbano)

---

### 3. nearest_stop_meters
**Definición**: Distancia en metros desde el centroide de la sección a la parada más cercana.

**Fórmula SQL**:
```sql
SELECT
  ST_Distance(
    ST_Transform(ST_Centroid(cs.geom), 3857),
    ST_Transform(s.geom, 3857)
  ) AS distance_meters
FROM census_sections cs
CROSS JOIN stops s
WHERE cs.section_code = ?
ORDER BY distance_meters ASC
LIMIT 1
```

**Notas**:
- Se usa `ST_Centroid` para obtener el punto central de la sección
- Se transforma a EPSG:3857 (Web Mercator) para cálculos en metros
- `ST_Distance` calcula distancia euclidiana

**Interpretación**:
- < 300m: Excelente accesibilidad
- 300-500m: Buena accesibilidad
- 500-800m: Accesibilidad media
- > 800m: Baja accesibilidad

---

### 4. coverage_300_area_pct
**Definición**: Porcentaje del área de la sección cubierta por buffers de 300m alrededor de paradas.

**Fórmula conceptual**:
```
coverage_300 = (área_intersección / área_sección) × 100

área_intersección = área( sección ∩ union(buffer(parada, 300m) para todas las paradas) )
```

**Fórmula SQL**:
```sql
SELECT
  (ST_Area(
    ST_Intersection(
      cs.geom,
      ST_Union(ST_Buffer(s.geom::geography, 300)::geometry)
    )
  ) / ST_Area(cs.geom)) * 100 AS coverage_pct
FROM census_sections cs
LEFT JOIN stops s ON ST_DWithin(s.geom::geography, cs.geom::geography, 300)
WHERE cs.section_code = ?
GROUP BY cs.geom
```

**Notas**:
- Se usa `geography` para buffers precisos en metros
- `ST_Union` combina los buffers de todas las paradas
- `ST_Intersection` encuentra la parte del área que se solapa
- `ST_DWithin` pre-filtra paradas cercanas para optimizar

**Interpretación**:
- 0-20%: Cobertura muy baja
- 20-40%: Cobertura baja
- 40-60%: Cobertura media
- 60-80%: Cobertura buena
- 80-100%: Cobertura excelente

---

### 5. coverage_500_area_pct
Igual que `coverage_300_area_pct` pero con buffers de 500m.

---

## 🚌 Métricas de Servicio

### Concepto: Servicios Activos

Para calcular métricas de servicio, primero determinamos qué servicios operan en una fecha de referencia (ej: martes 7 enero 2025).

**Algoritmo**:
1. Obtener día de la semana de la fecha de referencia
2. Consultar `calendar` para servicios que operan ese día
3. Aplicar excepciones de `calendar_dates`:
   - `exception_type = 1`: Servicio añadido
   - `exception_type = 2`: Servicio removido

**SQL**:
```sql
-- Servicios del martes regular
SELECT service_id
FROM calendar
WHERE tuesday = 1
  AND start_date <= '20250107'
  AND end_date >= '20250107'

UNION

-- Excepciones añadidas
SELECT service_id
FROM calendar_dates
WHERE date = '20250107'
  AND exception_type = 1

EXCEPT

-- Excepciones removidas
SELECT service_id
FROM calendar_dates
WHERE date = '20250107'
  AND exception_type = 2
```

---

### 6. stop_time_events (por franja horaria)
**Definición**: Número de veces que una guagua para en cualquier parada de la sección durante la franja horaria.

**Fórmula conceptual**:
```
stop_time_events = COUNT(stop_times)
  WHERE stop_id IN (paradas de la sección)
    AND trip_id IN (trips con service_id activo)
    AND arrival_time IN (franja horaria)
```

**Fórmula SQL (ejemplo: mediodía 12:00-16:00)**:
```sql
SELECT COUNT(st.trip_id) AS events
FROM stop_times st
INNER JOIN trips t ON st.trip_id = t.trip_id
INNER JOIN stops s ON st.stop_id = s.stop_id
INNER JOIN census_sections cs ON ST_Within(s.geom, cs.geom)
WHERE cs.section_code = ?
  AND t.service_id IN ('LA', 'VS', 'LS', ...)  -- servicios activos
  AND st.arrival_time >= '12:00:00'
  AND st.arrival_time < '16:00:00'
```

**Tablas usadas**:
- `stop_times`: Horarios de paso (trip_id, stop_id, arrival_time)
- `trips`: Expediciones (trip_id, route_id, service_id)
- `stops`: Paradas
- `census_sections`: Secciones
- `calendar` + `calendar_dates`: Para determinar servicios activos

**Interpretación**:
- Por sección por día:
  - < 100: Servicio muy bajo
  - 100-500: Servicio bajo
  - 500-1000: Servicio medio
  - 1000-2000: Servicio alto
  - > 2000: Servicio muy alto

- Por franja horaria (4 horas):
  - < 50: Servicio escaso
  - 50-200: Servicio moderado
  - 200-500: Servicio frecuente
  - > 500: Servicio muy frecuente

---

### 7. unique_routes (por franja horaria)
**Definición**: Número de líneas distintas que sirven la sección en la franja horaria.

**Fórmula SQL**:
```sql
SELECT COUNT(DISTINCT t.route_id) AS unique_routes
FROM stop_times st
INNER JOIN trips t ON st.trip_id = t.trip_id
INNER JOIN stops s ON st.stop_id = s.stop_id
INNER JOIN census_sections cs ON ST_Within(s.geom, cs.geom)
WHERE cs.section_code = ?
  AND t.service_id IN (...)  -- servicios activos
  AND st.arrival_time >= '06:00:00'
  AND st.arrival_time < '10:00:00'
```

**Interpretación**:
- 0: Sin servicio
- 1-3: Conectividad baja (pocas opciones)
- 4-8: Conectividad media
- 9-15: Conectividad alta
- > 15: Conectividad muy alta (hub de transporte)

---

## 🏆 Top Rutas por Sección

**Definición**: Ranking de las 10 líneas con más eventos de servicio en la sección.

**Fórmula SQL**:
```sql
SELECT
  r.route_id,
  r.route_short_name,
  r.route_long_name,
  COUNT(st.trip_id) AS stop_time_events,
  ROW_NUMBER() OVER (ORDER BY COUNT(st.trip_id) DESC) AS rank
FROM stop_times st
INNER JOIN trips t ON st.trip_id = t.trip_id
INNER JOIN routes r ON t.route_id = r.route_id
INNER JOIN stops s ON st.stop_id = s.stop_id
INNER JOIN census_sections cs ON ST_Within(s.geom, cs.geom)
WHERE cs.section_code = ?
  AND t.service_id IN (...)
  AND st.arrival_time >= '12:00:00'
  AND st.arrival_time < '16:00:00'
GROUP BY r.route_id, r.route_short_name, r.route_long_name
ORDER BY stop_time_events DESC
LIMIT 10
```

**Uso**: Identificar qué líneas son las más importantes para una sección específica.

---

## ⏰ Franjas Horarias

| Franja | Horario | Uso típico |
|--------|---------|------------|
| `morning` | 06:00-10:00 | Hora punta mañana (trabajo, colegio) |
| `midday` | 12:00-16:00 | Mediodía (almuerzo, servicios) |
| `afternoon` | 16:00-20:00 | Hora punta tarde (vuelta a casa) |
| `night` | 20:00-24:00 | Noche (ocio, servicios nocturnos) |
| `all_day` | 00:00-24:00 | Todo el día completo |

---

## 🗓️ Día de Referencia

El sistema usa **martes 7 de enero de 2025** como día típico para calcular métricas.

**¿Por qué martes?**
- Evita efectos de lunes (reinicios)
- Evita efectos de viernes (pre-fin de semana)
- Representa un día laboral medio
- No hay festivos en enero en Las Palmas

**¿Cómo cambiar?**
Editar en `scripts/build-metrics.js`:
```javascript
const REFERENCE_DATE = '20250114'; // martes 14 enero
```

---

## 🔄 Precalculo vs. Tiempo Real

**Todo se precalcula** en `section_metrics` y `section_top_routes`.

**Ventajas**:
- API ultrarrápida (solo SELECT, sin JOINs complejos)
- UX fluida (respuesta < 100ms)
- Escalable a miles de secciones

**Desventajas**:
- Datos "congelados" a fecha de cálculo
- Cambios en GTFS requieren recalcular

**Recalcular**:
```bash
npm run build:metrics
```

---

## 📏 Sistema de Coordenadas

**EPSG:4326 (WGS84)**:
- Usado para almacenar geometrías en PostGIS
- Lat/Lon en grados decimales
- Compatible con GeoJSON y Mapbox

**EPSG:3857 (Web Mercator)**:
- Usado para cálculos de distancia y área
- Coordenadas en metros
- Se convierte con `ST_Transform(geom, 3857)`

---

## 🎓 Recursos

- **PostGIS**: https://postgis.net/docs/
- **GTFS Reference**: https://gtfs.org/reference/static
- **Mapbox GL**: https://docs.mapbox.com/mapbox-gl-js/

---

**Actualizado**: 2025-01-15
