# Geo Fence Alert

Next.js geofencing and vehicle tracking app with live alerts, map-based simulation, and local SQLite storage.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000/dashboard`.

## Main routes

- `/dashboard/geofences` create and view polygon geofences
- `/dashboard/vehicles` register vehicles, post locations, run simulations
- `/dashboard/alerts` create, enable, disable, and delete alert rules
- `/dashboard/violations` review entry and exit history

## Data shape

- `assessment_geofences`: polygon zones and category
- `assessment_vehicles`: registered vehicles and driver metadata
- `assessment_vehicle_locations`: raw location pings
- `assessment_vehicle_geofence_state`: latest inside/outside state per vehicle and geofence
- `assessment_alert_configs`: alert rules
- `assessment_violation_events`: historical entry and exit events
- `assessment_alert_events`: real-time alert records sent to clients

Database file: `data/geofence-alert.db`

## Real-time

Live alerts are delivered through `GET /ws/alerts`.

Tradeoff:
- The app uses Server-Sent Events instead of a true WebSocket server.
- This keeps the setup simple inside a standard Next.js app and is enough for one-way live alert delivery.

## Tradeoffs

- SQLite keeps local setup very small, but it is not the best fit for high write volume or multi-instance deployment.
- SSE is simpler than WebSocket here, but it does not support bi-directional communication.
- The app is built fully in Next.js rather than splitting frontend and Go backend.
