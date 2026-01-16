-- Guaguas Municipales Database Schema
-- PostgreSQL + PostGIS

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- GTFS Tables
-- ============================================================

-- Agency
CREATE TABLE IF NOT EXISTS agency (
  agency_id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL,
  agency_url TEXT,
  agency_timezone TEXT,
  agency_lang TEXT,
  agency_phone TEXT
);

-- Routes (líneas)
CREATE TABLE IF NOT EXISTS routes (
  route_id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES agency(agency_id),
  route_short_name TEXT,
  route_long_name TEXT,
  route_desc TEXT,
  route_type INTEGER,
  route_url TEXT,
  route_color TEXT,
  route_text_color TEXT
);

CREATE INDEX idx_routes_agency ON routes(agency_id);

-- Calendar (servicios programados)
CREATE TABLE IF NOT EXISTS calendar (
  service_id TEXT PRIMARY KEY,
  monday INTEGER,
  tuesday INTEGER,
  wednesday INTEGER,
  thursday INTEGER,
  friday INTEGER,
  saturday INTEGER,
  sunday INTEGER,
  start_date TEXT,
  end_date TEXT
);

-- Calendar dates (excepciones de servicio)
CREATE TABLE IF NOT EXISTS calendar_dates (
  service_id TEXT,
  date TEXT,
  exception_type INTEGER,
  PRIMARY KEY (service_id, date)
);

CREATE INDEX idx_calendar_dates_service ON calendar_dates(service_id);
CREATE INDEX idx_calendar_dates_date ON calendar_dates(date);

-- Stops (paradas) - CON GEOMETRÍA
CREATE TABLE IF NOT EXISTS stops (
  stop_id TEXT PRIMARY KEY,
  stop_code TEXT,
  stop_name TEXT NOT NULL,
  stop_desc TEXT,
  stop_lat DOUBLE PRECISION NOT NULL,
  stop_lon DOUBLE PRECISION NOT NULL,
  zone_id TEXT,
  stop_url TEXT,
  location_type INTEGER,
  parent_station TEXT,
  stop_timezone TEXT,
  wheelchair_boarding INTEGER,
  geom GEOMETRY(POINT, 4326) -- WGS84
);

-- Crear geometría a partir de lat/lon
CREATE INDEX idx_stops_geom ON stops USING GIST(geom);
CREATE INDEX idx_stops_name ON stops(stop_name);

-- Trips (recorridos)
CREATE TABLE IF NOT EXISTS trips (
  trip_id TEXT PRIMARY KEY,
  route_id TEXT REFERENCES routes(route_id),
  service_id TEXT,
  trip_headsign TEXT,
  trip_short_name TEXT,
  direction_id INTEGER,
  block_id TEXT,
  shape_id TEXT,
  wheelchair_accessible INTEGER,
  bikes_allowed INTEGER
);

CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_trips_service ON trips(service_id);
CREATE INDEX idx_trips_shape ON trips(shape_id);

-- Stop times (horarios de paso)
CREATE TABLE IF NOT EXISTS stop_times (
  trip_id TEXT REFERENCES trips(trip_id),
  arrival_time TEXT,
  departure_time TEXT,
  stop_id TEXT REFERENCES stops(stop_id),
  stop_sequence INTEGER,
  stop_headsign TEXT,
  pickup_type INTEGER,
  drop_off_type INTEGER,
  shape_dist_traveled DOUBLE PRECISION,
  timepoint INTEGER,
  PRIMARY KEY (trip_id, stop_sequence)
);

CREATE INDEX idx_stop_times_trip ON stop_times(trip_id);
CREATE INDEX idx_stop_times_stop ON stop_times(stop_id);
CREATE INDEX idx_stop_times_arrival ON stop_times(arrival_time);

-- Shapes (trazados de rutas) - CON GEOMETRÍA
CREATE TABLE IF NOT EXISTS shapes (
  shape_id TEXT,
  shape_pt_lat DOUBLE PRECISION NOT NULL,
  shape_pt_lon DOUBLE PRECISION NOT NULL,
  shape_pt_sequence INTEGER,
  shape_dist_traveled DOUBLE PRECISION,
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

CREATE INDEX idx_shapes_id ON shapes(shape_id);

-- Tabla auxiliar: shapes como LINESTRING por shape_id
CREATE TABLE IF NOT EXISTS shape_geometries (
  shape_id TEXT PRIMARY KEY,
  geom GEOMETRY(LINESTRING, 4326)
);

CREATE INDEX idx_shape_geometries_geom ON shape_geometries USING GIST(geom);

-- ============================================================
-- Census Sections (Secciones Censales)
-- ============================================================

CREATE TABLE IF NOT EXISTS census_sections (
  id SERIAL PRIMARY KEY,
  section_code TEXT UNIQUE NOT NULL, -- CPRO + CMUN + CDIS + CSEC
  cusec TEXT, -- Código completo si viene del INE
  cumun TEXT, -- Código municipio
  cdis TEXT,  -- Código distrito
  csec TEXT,  -- Código sección
  name TEXT,
  area_km2 DOUBLE PRECISION,
  geom GEOMETRY(MULTIPOLYGON, 4326)
);

CREATE INDEX idx_census_sections_code ON census_sections(section_code);
CREATE INDEX idx_census_sections_geom ON census_sections USING GIST(geom);

-- ============================================================
-- Metrics Tables (precalculadas)
-- ============================================================

-- Métricas agregadas por sección censal
CREATE TABLE IF NOT EXISTS section_metrics (
  section_code TEXT PRIMARY KEY REFERENCES census_sections(section_code),

  -- Métricas básicas
  stops_count INTEGER DEFAULT 0,
  stops_per_km2 DOUBLE PRECISION DEFAULT 0,

  -- Distancia a parada más cercana
  nearest_stop_meters DOUBLE PRECISION,
  nearest_stop_id TEXT,
  nearest_stop_name TEXT,

  -- Cobertura espacial (área cubierta por buffers)
  coverage_300_area_pct DOUBLE PRECISION DEFAULT 0,
  coverage_500_area_pct DOUBLE PRECISION DEFAULT 0,

  -- Servicio día completo (00:00-24:00)
  stop_time_events_all_day INTEGER DEFAULT 0,
  unique_routes_all_day INTEGER DEFAULT 0,

  -- Servicio por franjas horarias
  -- Mañana (06:00-10:00)
  stop_time_events_morning INTEGER DEFAULT 0,
  unique_routes_morning INTEGER DEFAULT 0,

  -- Mediodía (12:00-16:00)
  stop_time_events_midday INTEGER DEFAULT 0,
  unique_routes_midday INTEGER DEFAULT 0,

  -- Tarde (16:00-20:00)
  stop_time_events_afternoon INTEGER DEFAULT 0,
  unique_routes_afternoon INTEGER DEFAULT 0,

  -- Noche (20:00-24:00)
  stop_time_events_night INTEGER DEFAULT 0,
  unique_routes_night INTEGER DEFAULT 0,

  -- Fecha de cálculo
  reference_date TEXT,
  calculated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_section_metrics_section ON section_metrics(section_code);

-- Top rutas por sección y franja horaria
CREATE TABLE IF NOT EXISTS section_top_routes (
  id SERIAL PRIMARY KEY,
  section_code TEXT REFERENCES census_sections(section_code),
  time_slot TEXT, -- 'all_day', 'morning', 'midday', 'afternoon', 'night'
  route_id TEXT REFERENCES routes(route_id),
  route_short_name TEXT,
  route_long_name TEXT,
  stop_time_events INTEGER,
  rank INTEGER
);

CREATE INDEX idx_section_top_routes_section ON section_top_routes(section_code, time_slot);

-- ============================================================
-- Helper Views
-- ============================================================

-- Vista simplificada para API
CREATE OR REPLACE VIEW sections_summary AS
SELECT
  cs.section_code,
  cs.name,
  cs.area_km2,
  ST_AsGeoJSON(ST_Simplify(cs.geom, 0.0001))::json as geom_simplified,
  ST_AsGeoJSON(ST_Centroid(cs.geom))::json as centroid,
  sm.*
FROM census_sections cs
LEFT JOIN section_metrics sm ON cs.section_code = sm.section_code;

-- Vista de paradas con sección censal asignada
CREATE OR REPLACE VIEW stops_with_section AS
SELECT
  s.stop_id,
  s.stop_name,
  s.stop_lat,
  s.stop_lon,
  ST_AsGeoJSON(s.geom)::json as geom_json,
  cs.section_code
FROM stops s
LEFT JOIN census_sections cs ON ST_Within(s.geom, cs.geom);

-- ============================================================
-- Functions
-- ============================================================

-- Función para actualizar geometría de stops desde lat/lon
CREATE OR REPLACE FUNCTION update_stops_geometry() RETURNS void AS $$
BEGIN
  UPDATE stops
  SET geom = ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)
  WHERE geom IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Función para crear shape_geometries desde shapes
CREATE OR REPLACE FUNCTION build_shape_geometries() RETURNS void AS $$
BEGIN
  TRUNCATE shape_geometries;

  INSERT INTO shape_geometries (shape_id, geom)
  SELECT
    shape_id,
    ST_SetSRID(
      ST_MakeLine(
        ST_MakePoint(shape_pt_lon, shape_pt_lat)
        ORDER BY shape_pt_sequence
      ),
      4326
    ) as geom
  FROM shapes
  GROUP BY shape_id;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular área en km²
CREATE OR REPLACE FUNCTION calculate_section_areas() RETURNS void AS $$
BEGIN
  UPDATE census_sections
  SET area_km2 = ST_Area(ST_Transform(geom, 3857)) / 1000000.0;
END;
$$ LANGUAGE plpgsql;
