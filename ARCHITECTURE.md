# 🏗️ Arquitectura del Sistema - Guaguas Analyzer

## 📐 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                    │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ LoginForm  │  │   MapView    │  │   SidePanel      │   │
│  │            │  │  + Mapbox GL │  │  + Metrics       │   │
│  │  Password  │  │  + Controls  │  │  + Formulas      │   │
│  └────────────┘  └──────────────┘  └──────────────────┘   │
│                          ▲                                   │
│                          │ fetch()                          │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    API ROUTES (Next.js)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /api/auth   │  │ /api/sections│  │ /api/section │      │
│  │  - login    │  │  (GeoJSON)   │  │  /[code]     │      │
│  │  - logout   │  │              │  │  (detail)    │      │
│  │  - check    │  └──────────────┘  └──────────────┘      │
│  └─────────────┘                                            │
│  ┌─────────────┐  ┌──────────────┐                         │
│  │ /api/stops  │  │ /api/stop    │                         │
│  │  (GeoJSON)  │  │  /[id]       │                         │
│  │             │  │  (detail)    │                         │
│  └─────────────┘  └──────────────┘                         │
│                          ▲                                   │
│                          │ pg-promise                       │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│              POSTGRESQL + POSTGIS DATABASE                   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │                    GTFS Tables                      │    │
│  │  - agency          - trips        - calendar        │    │
│  │  - routes          - stop_times   - calendar_dates │    │
│  │  - stops (POINT)   - shapes       - shape_geometries│   │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Territorial Tables                     │    │
│  │  - census_sections (MULTIPOLYGON)                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           Precalculated Metrics Tables              │    │
│  │  - section_metrics (all metrics by section)         │    │
│  │  - section_top_routes (top 10 routes per section)   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Indexes: GiST (spatial), B-tree (IDs)                      │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │ import scripts
┌──────────────────────────┼──────────────────────────────────┐
│                    IMPORT SCRIPTS (Node.js)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ import-gtfs  │  │import-sections│  │ build-metrics   │  │
│  │              │  │               │  │                 │  │
│  │ Read CSVs    │  │ Read GeoJSON  │  │ Calculate:      │  │
│  │ Insert to DB │  │ Insert to DB  │  │ - Basic metrics │  │
│  │ Build geoms  │  │ Calculate area│  │ - Coverage      │  │
│  │              │  │               │  │ - Service       │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│         ▲                 ▲                                  │
└─────────┼─────────────────┼──────────────────────────────────┘
          │                 │
    ┌─────────────┐   ┌─────────────┐
    │ GTFS .csv   │   │ GeoJSON     │
    │ files       │   │ (INE)       │
    └─────────────┘   └─────────────┘
```

---

## 🔄 Flujo de Datos

### 1. Importación (una vez)

```
GTFS CSVs → import-gtfs.js → PostgreSQL tables
                              ↓
                         Create POINT geometries for stops
                         Create LINESTRING geometries for shapes

Census GeoJSON → import-sections.js → PostgreSQL census_sections
                                      ↓
                                 Calculate areas in km²

GTFS + Sections → build-metrics.js → Precalculate metrics
                                     ↓
                                Store in section_metrics
                                Store in section_top_routes
```

### 2. Uso de la webapp

```
User → Login (password) → Session stored (iron-session)
       ↓
User → Browse map → fetch /api/sections → PostgreSQL read
                   ↓
              GeoJSON sent to frontend
                   ↓
              Mapbox GL renders choropleth + points
                   ↓
User → Click section → fetch /api/section/[code] → PostgreSQL join
                      ↓
                 Detailed metrics + top routes
                      ↓
                 Display in SidePanel
```

---

## 📊 Modelo de Datos

### Core GTFS Schema

```sql
agency
  ├─ agency_id (PK)
  ├─ agency_name
  └─ ...

routes
  ├─ route_id (PK)
  ├─ agency_id (FK → agency)
  ├─ route_short_name (ej: "1", "12", "21")
  ├─ route_long_name
  └─ route_color

calendar
  ├─ service_id (PK)
  ├─ monday, tuesday, ..., sunday (0 o 1)
  ├─ start_date
  └─ end_date

calendar_dates
  ├─ service_id (PK)
  ├─ date (PK)
  └─ exception_type (1=add, 2=remove)

stops
  ├─ stop_id (PK)
  ├─ stop_name
  ├─ stop_lat, stop_lon
  └─ geom (POINT, 4326) ← calculado

trips
  ├─ trip_id (PK)
  ├─ route_id (FK → routes)
  ├─ service_id (FK → calendar)
  └─ shape_id

stop_times
  ├─ trip_id (PK, FK → trips)
  ├─ stop_sequence (PK)
  ├─ stop_id (FK → stops)
  ├─ arrival_time
  └─ departure_time

shapes
  ├─ shape_id (PK)
  ├─ shape_pt_sequence (PK)
  ├─ shape_pt_lat, shape_pt_lon
  └─ → aggregates to shape_geometries

shape_geometries
  ├─ shape_id (PK)
  └─ geom (LINESTRING, 4326) ← calculado
```

### Territorial Schema

```sql
census_sections
  ├─ id (PK serial)
  ├─ section_code (unique) ← "3501600X00Y"
  ├─ cusec, cumun, cdis, csec (INE codes)
  ├─ name
  ├─ area_km2 ← calculado
  └─ geom (MULTIPOLYGON, 4326)
```

### Metrics Schema (precalculated)

```sql
section_metrics
  ├─ section_code (PK, FK → census_sections)
  │
  ├─ stops_count
  ├─ stops_per_km2
  ├─ nearest_stop_meters
  ├─ nearest_stop_id, nearest_stop_name
  │
  ├─ coverage_300_area_pct
  ├─ coverage_500_area_pct
  │
  ├─ stop_time_events_all_day
  ├─ unique_routes_all_day
  │
  ├─ stop_time_events_morning
  ├─ unique_routes_morning
  │
  ├─ stop_time_events_midday
  ├─ unique_routes_midday
  │
  ├─ stop_time_events_afternoon
  ├─ unique_routes_afternoon
  │
  ├─ stop_time_events_night
  ├─ unique_routes_night
  │
  ├─ reference_date
  └─ calculated_at

section_top_routes
  ├─ id (PK serial)
  ├─ section_code (FK → census_sections)
  ├─ time_slot ('all_day', 'morning', ...)
  ├─ route_id (FK → routes)
  ├─ route_short_name, route_long_name
  ├─ stop_time_events
  └─ rank (1-10)
```

---

## 🚀 API Endpoints

### Authentication

- `POST /api/auth/login`
  - Body: `{ password: string }`
  - Response: `{ success: boolean }`
  - Creates session cookie

- `POST /api/auth/logout`
  - Response: `{ success: boolean }`
  - Destroys session

- `GET /api/auth/check`
  - Response: `{ isAuthenticated: boolean }`

### Data

- `GET /api/sections`
  - Auth: Required
  - Response: GeoJSON FeatureCollection
  - Features: All census sections with simplified geometry + all metrics
  - Used by: Map choropleth layer

- `GET /api/section/[code]`
  - Auth: Required
  - Response: `{ section, stops, topRoutes }`
  - Detailed metrics, list of stops, top routes per time slot
  - Used by: SidePanel when section clicked

- `GET /api/stops`
  - Auth: Required
  - Response: GeoJSON FeatureCollection
  - Features: All stops with POINT geometry
  - Used by: Map stops layer

- `GET /api/stop/[id]`
  - Auth: Required
  - Response: `{ stop, routes, stopTimes }`
  - Stop details, serving routes, sample schedules
  - Used by: SidePanel when stop clicked

---

## 🎨 Frontend Components

### `app/page.tsx`
- Root component
- Checks authentication
- Shows `LoginForm` or `MapView`

### `components/LoginForm.tsx`
- Simple password form
- POST to `/api/auth/login`
- On success, reload to show map

### `components/MapView.tsx`
- Main map component
- Uses react-map-gl + Mapbox GL JS
- Manages state: selected section/stop, time slot, metric
- Renders:
  - Sections layer (choropleth)
  - Stops layer (points)
  - Controls
  - SidePanel

### `components/MapControls.tsx`
- UI controls for:
  - Time slot selector
  - Metric selector
  - Layer toggles (sections, stops)
- Positioned top-left overlay

### `components/SidePanel.tsx`
- Right sidebar
- Shows details for selected section or stop
- Fetches data from API
- Displays metrics with formulas
- Shows top routes, stops list

---

## 🗂️ File Structure

```
guaguas/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── check/route.ts
│   │   │   ├── sections/route.ts
│   │   │   ├── section/[code]/route.ts
│   │   │   ├── stops/route.ts
│   │   │   └── stop/[id]/route.ts
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── LoginForm.tsx
│   │   ├── MapView.tsx
│   │   ├── MapControls.tsx
│   │   └── SidePanel.tsx
│   └── lib/
│       ├── db.ts          (pg-promise connection)
│       └── auth.ts        (iron-session helpers)
├── scripts/
│   ├── db-config.js
│   ├── setup-database.js
│   ├── import-gtfs.js
│   ├── import-sections.js
│   └── build-metrics.js
├── database/
│   └── schema.sql
├── gtfs/
│   └── extracted/
│       ├── agency.csv
│       ├── routes.csv
│       ├── stops.csv
│       ├── trips.csv
│       ├── stop_times.csv
│       ├── shapes.csv
│       ├── calendar.csv
│       └── calendar_dates.csv
├── data/
│   └── census_sections_las_palmas.geojson
├── package.json
├── tsconfig.json
├── next.config.js
├── .env
├── .gitignore
├── README.md
├── FORMULAS.md
├── ARCHITECTURE.md
└── INSTRUCCIONES_RAPIDAS.md
```

---

## 🔒 Security

### Authentication
- Simple password-based access
- Session stored in encrypted cookie (iron-session)
- All data endpoints check `isAuthenticated()`
- Not suitable for multi-user or public deployment

### Database
- Read-only for API (no writes)
- All queries parameterized (prevent SQL injection)
- Connection string in `.env` (not committed)

### Deployment
- Use environment variables for secrets
- Enable HTTPS (Vercel does this automatically)
- Consider IP whitelisting if very sensitive

---

## 📈 Performance

### Database Optimizations
- **Spatial indexes (GiST)**: All geometry columns
- **B-tree indexes**: Foreign keys, search columns
- **Precalculated metrics**: No complex JOINs at request time
- **Simplified geometries**: `ST_Simplify(geom, 0.0001)` for API

### Frontend Optimizations
- **Dynamic import**: Map components loaded client-side only
- **GeoJSON caching**: Browser caches sections/stops data
- **Choropleth expressions**: Mapbox GL renders on GPU
- **Session storage**: Avoid repeated auth checks

### Expected Performance
- API response time: < 100ms (precalculated data)
- Initial map load: 1-3s (depends on GeoJSON size)
- Interaction: Instant (client-side state)

---

## 🔧 Maintenance

### Update GTFS Data
```bash
# Replace files in gtfs/extracted/
npm run import:gtfs
npm run build:metrics
```

### Update Census Sections
```bash
# Replace data/census_sections_las_palmas.geojson
npm run import:sections
npm run build:metrics
```

### Change Reference Date
Edit `scripts/build-metrics.js`:
```javascript
const REFERENCE_DATE = '20250121'; // new date
```
Then:
```bash
npm run build:metrics
```

### Add New Metric
1. Add column to `section_metrics` in `schema.sql`
2. Add calculation logic to `build-metrics.js`
3. Add to API response in `app/api/sections/route.ts`
4. Add to UI in `components/SidePanel.tsx`
5. Add formula to `FORMULAS.md`

---

## 🌐 Deployment Architecture (Vercel)

```
Internet
   ↓
Vercel Edge Network (CDN + routing)
   ↓
Next.js Serverless Functions (API routes)
   ↓
PostgreSQL Database (Supabase/Railway/etc)
   ↑
   Import scripts (run from local machine)
```

**Why serverless?**
- Auto-scaling
- Zero infrastructure management
- Pay per request
- Global distribution

**Why external DB?**
- Vercel doesn't host databases
- Need persistent storage for PostGIS
- Supabase/Railway have free tiers with PostGIS

---

## 🎯 Design Decisions

### Why Next.js?
- Full-stack framework (frontend + API)
- Easy deployment to Vercel
- TypeScript support
- React ecosystem

### Why PostGIS?
- Industry standard for spatial queries
- Powerful geometry operations
- Proven performance
- Transparent SQL (no black box)

### Why Mapbox GL?
- Best-in-class web mapping
- GPU-accelerated rendering
- Excellent choropleth support
- GeoJSON native

### Why Precalculate Metrics?
- Prioritize user experience (fast API)
- Complex spatial queries are expensive
- Data changes infrequently
- Acceptable to rebuild on update

---

**Version**: 1.0
**Last Updated**: 2025-01-15
