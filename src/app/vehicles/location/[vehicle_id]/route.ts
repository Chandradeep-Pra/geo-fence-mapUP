import { startTimer, timedJson } from "@/lib/api";
import { isPointInsideGeofence, type LatLngCoordinate } from "@/lib/assessment-geo";
import { ensureDatabaseSetup, query } from "@/lib/db";

type VehicleRow = {
  id: string;
  vehicle_number: string;
};

type VehicleLocationRow = {
  latitude: number;
  longitude: number;
  timestamp: string;
};

type GeofenceRow = {
  id: string;
  name: string;
  category: "delivery_zone" | "restricted_zone" | "toll_zone" | "customer_area";
  coordinates_json: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ vehicle_id: string }> },
) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const { vehicle_id } = await context.params;

    const vehicleResult = await query<VehicleRow>(
      `
        SELECT id, vehicle_number
        FROM assessment_vehicles
        WHERE id = $1
        LIMIT 1
      `,
      [vehicle_id],
    );

    const vehicle = vehicleResult.rows[0];

    if (!vehicle) {
      return timedJson(
        startedAt,
        {
          error: "Vehicle not found.",
        },
        { status: 404 },
      );
    }

    const locationResult = await query<VehicleLocationRow>(
      `
        SELECT latitude, longitude, timestamp
        FROM assessment_vehicle_locations
        WHERE vehicle_id = $1
        ORDER BY timestamp DESC
        LIMIT 1
      `,
      [vehicle_id],
    );

    const currentLocation = locationResult.rows[0] ?? null;
    const geofencesResult = await query<GeofenceRow>(
      `
        SELECT id, name, category, coordinates_json
        FROM assessment_geofences
        WHERE status = 'active'
      `,
    );

    const currentGeofences =
      currentLocation === null
        ? []
        : geofencesResult.rows
            .filter((geofence) =>
              isPointInsideGeofence(
                currentLocation.latitude,
                currentLocation.longitude,
                JSON.parse(geofence.coordinates_json) as LatLngCoordinate[],
              ),
            )
            .map((geofence) => ({
              geofence_id: geofence.id,
              geofence_name: geofence.name,
              category: geofence.category,
            }));

    return timedJson(startedAt, {
      vehicle_id: vehicle.id,
      vehicle_number: vehicle.vehicle_number,
      current_location:
        currentLocation === null
          ? null
          : {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              timestamp: currentLocation.timestamp,
            },
      current_geofences: currentGeofences,
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to fetch vehicle location.",
      },
      { status: 500 },
    );
  }
}
