-- SCHEMA TEMPORAL SIN POSTGIS
-- Para poder cargar datos GTFS mientras se instala PostGIS

-- GTFS Tables (sin geometrías)

CREATE TABLE IF NOT EXISTS agency (
  agency_id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL,
  agency_url TEXT,
  agency_timezone TEXT
);

CREATE TABLE IF NOT EXISTS routes (
  route_id TEXT PRIMARY KEY,
  agency_id TEXT,
  route_short_name TEXT,
  route_long_name TEXT,
  route_desc TEXT,
  route_type INTEGER,
  route_url TEXT,
  route_color TEXT,
  route_text_color TEXT
);

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

CREATE TABLE IF NOT EXISTS calendar_dates (
  service_id TEXT,
  date TEXT,
  exception_type INTEGER,
  PRIMARY KEY (service_id, date)
);

CREATE TABLE IF NOT EXISTS stops (
  stop_id TEXT PRIMARY KEY,
  stop_code TEXT,
  stop_name TEXT NOT NULL,
  stop_desc TEXT,
  stop_lat DOUBLE PRECISION NOT NULL,
  stop_lon DOUBLE PRECISION NOT NULL,
  zone_id TEXT
);

CREATE INDEX idx_stops_name ON stops(stop_name);

CREATE TABLE IF NOT EXISTS trips (
  trip_id TEXT PRIMARY KEY,
  route_id TEXT,
  service_id TEXT,
  trip_headsign TEXT,
  direction_id INTEGER,
  shape_id TEXT
);

CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_trips_service ON trips(service_id);

CREATE TABLE IF NOT EXISTS stop_times (
  trip_id TEXT,
  arrival_time TEXT,
  departure_time TEXT,
  stop_id TEXT,
  stop_sequence INTEGER,
  PRIMARY KEY (trip_id, stop_sequence)
);

CREATE INDEX idx_stop_times_trip ON stop_times(trip_id);
CREATE INDEX idx_stop_times_stop ON stop_times(stop_id);
CREATE INDEX idx_stop_times_arrival ON stop_times(arrival_time);

CREATE TABLE IF NOT EXISTS shapes (
  shape_id TEXT,
  shape_pt_lat DOUBLE PRECISION NOT NULL,
  shape_pt_lon DOUBLE PRECISION NOT NULL,
  shape_pt_sequence INTEGER,
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

CREATE INDEX idx_shapes_id ON shapes(shape_id);

-- Mensaje
DO $$
BEGIN
  RAISE NOTICE '✅ Esquema básico creado (SIN PostGIS)';
  RAISE NOTICE '⚠️  Este es un esquema temporal sin funciones espaciales';
  RAISE NOTICE '📥 Instala PostGIS y ejecuta schema.sql para funcionalidad completa';
END $$;
