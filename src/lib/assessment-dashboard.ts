import { ensureDatabaseSetup, query } from "@/lib/db";

type GeofenceRow = {
  id: string;
  name: string;
  description: string | null;
  coordinates_json: string;
  category: "delivery_zone" | "restricted_zone" | "toll_zone" | "customer_area";
  status: string;
  created_at: string;
};

type VehicleRow = {
  id: string;
  vehicle_number: string;
  driver_name: string;
  vehicle_type: string;
  phone: string;
  status: string;
  created_at: string;
};

type VehicleLocationRow = {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
};

type AlertConfigRow = {
  alert_id: string;
  geofence_id: string;
  geofence_name: string;
  vehicle_id: string | null;
  vehicle_number: string | null;
  event_type: "entry" | "exit" | "both";
  status: string;
  created_at: string;
};

type LiveAlertRow = {
  id: string;
  vehicle_id: string;
  vehicle_number: string;
  driver_name: string;
  geofence_id: string;
  geofence_name: string;
  geofence_category: string;
  event_type: "entry" | "exit";
  latitude: number;
  longitude: number;
  timestamp: string;
};

type ViolationRow = {
  id: string;
  vehicle_id: string;
  vehicle_number: string;
  geofence_id: string;
  geofence_name: string;
  event_type: "entry" | "exit";
  latitude: number;
  longitude: number;
  timestamp: string;
};

type CountRow = {
  total_count: number;
};

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function getDashboardData() {
  await ensureDatabaseSetup();

  const [
    geofencesResult,
    vehiclesResult,
    locationsResult,
    alertConfigsResult,
    liveAlertsResult,
    violationsResult,
    violationCountResult,
  ] =
    await Promise.all([
      query<GeofenceRow>(
        `
          SELECT
            id,
            name,
            description,
            coordinates_json,
            category,
            status,
            created_at
          FROM assessment_geofences
          ORDER BY created_at DESC
        `,
      ),
      query<VehicleRow>(
        `
          SELECT
            id,
            vehicle_number,
            driver_name,
            vehicle_type,
            phone,
            status,
            created_at
          FROM assessment_vehicles
          ORDER BY created_at DESC
        `,
      ),
      query<VehicleLocationRow>(
        `
          SELECT
            location.vehicle_id,
            location.latitude,
            location.longitude,
            location.timestamp
          FROM assessment_vehicle_locations location
          WHERE location.id IN (
            SELECT latest.id
            FROM assessment_vehicle_locations latest
            WHERE latest.vehicle_id = location.vehicle_id
            ORDER BY latest.timestamp DESC
            LIMIT 1
          )
        `,
      ),
      query<AlertConfigRow>(
        `
          SELECT
            a.id AS alert_id,
            a.geofence_id,
            g.name AS geofence_name,
            a.vehicle_id,
            v.vehicle_number,
            a.event_type,
            a.status,
            a.created_at
          FROM assessment_alert_configs a
          INNER JOIN assessment_geofences g ON g.id = a.geofence_id
          LEFT JOIN assessment_vehicles v ON v.id = a.vehicle_id
          ORDER BY a.created_at DESC
        `,
      ),
      query<LiveAlertRow>(
        `
          SELECT
            id,
            vehicle_id,
            vehicle_number,
            driver_name,
            geofence_id,
            geofence_name,
            geofence_category,
            event_type,
            latitude,
            longitude,
            timestamp
          FROM assessment_alert_events
          ORDER BY timestamp DESC
          LIMIT 20
        `,
      ),
      query<ViolationRow>(
        `
          SELECT
            id,
            vehicle_id,
            vehicle_number,
            geofence_id,
            geofence_name,
            event_type,
            latitude,
            longitude,
            timestamp
          FROM assessment_violation_events
          ORDER BY timestamp DESC
          LIMIT 50
        `,
      ),
      query<CountRow>(
        `
          SELECT COUNT(*) AS total_count
          FROM assessment_violation_events
        `,
      ),
    ]);

  const latestLocationByVehicle = new Map(
    locationsResult.rows.map((location) => [location.vehicle_id, toPlain(location)]),
  );

  return toPlain({
    geofences: geofencesResult.rows.map((geofence) => ({
      id: geofence.id,
      name: geofence.name,
      description: geofence.description,
      coordinates: JSON.parse(geofence.coordinates_json) as [number, number][],
      category: geofence.category,
      status: geofence.status,
      created_at: geofence.created_at,
    })),
    vehicles: vehiclesResult.rows.map((vehicle) => ({
      ...toPlain(vehicle),
      current_location: latestLocationByVehicle.get(vehicle.id) ?? null,
    })),
    alertConfigs: alertConfigsResult.rows.map((alertConfig) => toPlain(alertConfig)),
    liveAlerts: liveAlertsResult.rows.map((event) => ({
      event_id: event.id,
      event_type: event.event_type,
      timestamp: event.timestamp,
      vehicle: {
        vehicle_id: event.vehicle_id,
        vehicle_number: event.vehicle_number,
        driver_name: event.driver_name,
      },
      geofence: {
        geofence_id: event.geofence_id,
        geofence_name: event.geofence_name,
        category: event.geofence_category,
      },
      location: {
        latitude: event.latitude,
        longitude: event.longitude,
      },
    })),
    violations: violationsResult.rows.map((violation) => toPlain(violation)),
    violationCount: violationCountResult.rows[0]?.total_count ?? 0,
  });
}
