import { startTimer, timedJson } from "@/lib/api";
import { publishLiveAlert, type LiveAlertEvent } from "@/lib/alert-stream";
import { isPointInsideGeofence, type LatLngCoordinate } from "@/lib/assessment-geo";
import { vehicleLocationSchema } from "@/lib/assessment-validation";
import { createEntityId, ensureDatabaseSetup, query } from "@/lib/db";

type VehicleRow = {
  id: string;
  vehicle_number: string;
  driver_name: string;
};

type GeofenceRow = {
  id: string;
  name: string;
  category: "delivery_zone" | "restricted_zone" | "toll_zone" | "customer_area";
  coordinates_json: string;
};

type VehicleStateRow = {
  geofence_id: string;
  is_inside: number;
};

type AlertConfigRow = {
  id: string;
  event_type: "entry" | "exit" | "both";
};

export async function POST(request: Request) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const payload = await request.json();
    const parsed = vehicleLocationSchema.safeParse(payload);

    if (!parsed.success) {
      return timedJson(
        startedAt,
        {
          error: "Invalid location payload.",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const vehicleResult = await query<VehicleRow>(
      `
        SELECT id, vehicle_number, driver_name
        FROM assessment_vehicles
        WHERE id = $1
        LIMIT 1
      `,
      [parsed.data.vehicle_id],
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

    await query(
      `
        INSERT INTO assessment_vehicle_locations (
          id,
          vehicle_id,
          latitude,
          longitude,
          timestamp,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $5)
      `,
      [
        createEntityId("loc"),
        parsed.data.vehicle_id,
        parsed.data.latitude,
        parsed.data.longitude,
        parsed.data.timestamp,
      ],
    );

    const geofencesResult = await query<GeofenceRow>(
      `
        SELECT id, name, category, coordinates_json
        FROM assessment_geofences
        WHERE status = 'active'
      `,
    );

    const previousStateResult = await query<VehicleStateRow>(
      `
        SELECT geofence_id, is_inside
        FROM assessment_vehicle_geofence_state
        WHERE vehicle_id = $1
      `,
      [parsed.data.vehicle_id],
    );

    const previousState = new Map(
      previousStateResult.rows.map((row) => [row.geofence_id, row.is_inside === 1]),
    );

    const currentGeofences: Array<{
      geofence_id: string;
      geofence_name: string;
      status: "inside";
    }> = [];
    const liveAlerts: LiveAlertEvent[] = [];

    for (const geofence of geofencesResult.rows) {
      const coordinates = JSON.parse(geofence.coordinates_json) as LatLngCoordinate[];
      const isInside = isPointInsideGeofence(
        parsed.data.latitude,
        parsed.data.longitude,
        coordinates,
      );
      const wasInside = previousState.get(geofence.id) ?? false;

      await query(
        `
          INSERT INTO assessment_vehicle_geofence_state (
            vehicle_id,
            geofence_id,
            is_inside,
            updated_at
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT(vehicle_id, geofence_id)
          DO UPDATE SET
            is_inside = excluded.is_inside,
            updated_at = excluded.updated_at
        `,
        [
          parsed.data.vehicle_id,
          geofence.id,
          isInside ? 1 : 0,
          parsed.data.timestamp,
        ],
      );

      if (isInside) {
        currentGeofences.push({
          geofence_id: geofence.id,
          geofence_name: geofence.name,
          status: "inside",
        });
      }

      if (isInside === wasInside) {
        continue;
      }

      const eventType = isInside ? "entry" : "exit";
      const violationId = createEntityId("viol");

      await query(
        `
          INSERT INTO assessment_violation_events (
            id,
            vehicle_id,
            vehicle_number,
            geofence_id,
            geofence_name,
            event_type,
            latitude,
            longitude,
            timestamp
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          violationId,
          parsed.data.vehicle_id,
          vehicle.vehicle_number,
          geofence.id,
          geofence.name,
          eventType,
          parsed.data.latitude,
          parsed.data.longitude,
          parsed.data.timestamp,
        ],
      );

      const alertConfigsResult = await query<AlertConfigRow>(
        `
          SELECT id, event_type
          FROM assessment_alert_configs
          WHERE geofence_id = $1
            AND status = 'active'
            AND (vehicle_id IS NULL OR vehicle_id = $2)
        `,
        [geofence.id, parsed.data.vehicle_id],
      );

      const hasMatchingConfig = alertConfigsResult.rows.some(
        (config) => config.event_type === "both" || config.event_type === eventType,
      );
      const shouldBroadcast = geofence.category === "restricted_zone" || hasMatchingConfig;

      if (!shouldBroadcast) {
        continue;
      }

      const eventId = createEntityId("evt");

      await query(
        `
          INSERT INTO assessment_alert_events (
            id,
            violation_id,
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
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          eventId,
          violationId,
          parsed.data.vehicle_id,
          vehicle.vehicle_number,
          vehicle.driver_name,
          geofence.id,
          geofence.name,
          geofence.category,
          eventType,
          parsed.data.latitude,
          parsed.data.longitude,
          parsed.data.timestamp,
        ],
      );

      liveAlerts.push({
        event_id: eventId,
        event_type: eventType,
        timestamp: parsed.data.timestamp,
        vehicle: {
          vehicle_id: parsed.data.vehicle_id,
          vehicle_number: vehicle.vehicle_number,
          driver_name: vehicle.driver_name,
        },
        geofence: {
          geofence_id: geofence.id,
          geofence_name: geofence.name,
          category: geofence.category,
        },
        location: {
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
        },
      });
    }

    queueMicrotask(() => {
      liveAlerts.forEach((event) => publishLiveAlert(event));
    });

    return timedJson(startedAt, {
      vehicle_id: parsed.data.vehicle_id,
      location_updated: true,
      current_geofences: currentGeofences,
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to update vehicle location.",
      },
      { status: 500 },
    );
  }
}
