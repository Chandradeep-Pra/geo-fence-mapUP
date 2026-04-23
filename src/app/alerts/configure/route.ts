import { startTimer, timedJson } from "@/lib/api";
import { alertConfigurationSchema } from "@/lib/assessment-validation";
import { createEntityId, ensureDatabaseSetup, nowIso, query } from "@/lib/db";

type IdRow = {
  id: string;
};

export async function POST(request: Request) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const payload = await request.json();
    const parsed = alertConfigurationSchema.safeParse(payload);

    if (!parsed.success) {
      return timedJson(
        startedAt,
        {
          error: "Invalid alert configuration payload.",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const geofenceResult = await query<IdRow>(
      "SELECT id FROM assessment_geofences WHERE id = $1 LIMIT 1",
      [parsed.data.geofence_id],
    );

    if (!geofenceResult.rows[0]) {
      return timedJson(
        startedAt,
        {
          error: "Geofence not found.",
        },
        { status: 404 },
      );
    }

    if (parsed.data.vehicle_id) {
      const vehicleResult = await query<IdRow>(
        "SELECT id FROM assessment_vehicles WHERE id = $1 LIMIT 1",
        [parsed.data.vehicle_id],
      );

      if (!vehicleResult.rows[0]) {
        return timedJson(
          startedAt,
          {
            error: "Vehicle not found.",
          },
          { status: 404 },
        );
      }
    }

    const alertId = createEntityId("alert");

    await query(
      `
        INSERT INTO assessment_alert_configs (
          id,
          geofence_id,
          vehicle_id,
          event_type,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, 'active', $5)
      `,
      [
        alertId,
        parsed.data.geofence_id,
        parsed.data.vehicle_id ?? null,
        parsed.data.event_type,
        nowIso(),
      ],
    );

    return timedJson(startedAt, {
      alert_id: alertId,
      geofence_id: parsed.data.geofence_id,
      vehicle_id: parsed.data.vehicle_id ?? null,
      event_type: parsed.data.event_type,
      status: "active",
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to configure alert.",
      },
      { status: 500 },
    );
  }
}
