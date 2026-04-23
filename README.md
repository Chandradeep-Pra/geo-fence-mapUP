# Geo Fence Alert

Next.js geofencing and vehicle tracking app with polygon zones, live alerts, simulation flows, and a small dashboard.

## Run

Local development:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Deploy shape

- Local: SQLite with `DATABASE_URL=file:./data/geofence-alert.db`
- Hosted: Postgres recommended, e.g. Neon on Vercel

For Vercel, set `DATABASE_URL` to your Neon/Postgres connection string.

## Main routes

- `/dashboard/geofences` create and inspect geofences
- `/dashboard/vehicles` register vehicles, post locations, run simulations
- `/dashboard/alerts` manage alert rules and view live alerts
- `/dashboard/violations` filter historical entry and exit events

## Data structure

- `assessment_geofences`: polygon boundaries and category
- `assessment_vehicles`: vehicle and driver details
- `assessment_vehicle_locations`: raw location updates
- `assessment_vehicle_geofence_state`: latest inside/outside state
- `assessment_alert_configs`: alert rules
- `assessment_violation_events`: entry and exit history
- `assessment_alert_events`: delivered alert records

## Real-time tradeoff

- The app keeps the required `/ws/alerts` stream endpoint, but the deployed dashboard uses database-backed polling for reliability on serverless hosting.
- This avoids relying on in-memory process state, which is fragile on free serverless platforms.

## Other tradeoffs

- SQLite is great for local setup, but Postgres is a better fit for free hosted deployment.
- This submission keeps backend and frontend inside one Next.js app instead of splitting Go and React.

### Lightweight System Design
[exacalidraw link](https://excalidraw.com/#json=37fkdD2nlm7pjzYeo2DlY,glPntWMEVbr7Kxxl_c_HCQ)
