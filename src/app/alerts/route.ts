import { startTimer, timedJson } from "@/lib/api";
import { ensureDatabaseSetup, query } from "@/lib/db";

type AlertRow = {
  alert_id: string;
  geofence_id: string;
  geofence_name: string;
  vehicle_id: string | null;
  vehicle_number: string | null;
  event_type: "entry" | "exit" | "both";
  status: string;
  created_at: string;
};

export async function GET(request: Request) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const searchParams = new URL(request.url).searchParams;
    const geofenceId = searchParams.get("geofence_id");
    const vehicleId = searchParams.get("vehicle_id");

    const alertsResult = await query<AlertRow>(
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
        WHERE ($1 IS NULL OR a.geofence_id = $1)
          AND ($2 IS NULL OR a.vehicle_id = $2)
        ORDER BY a.created_at DESC
      `,
      [geofenceId, vehicleId],
    );

    return timedJson(startedAt, {
      alerts: alertsResult.rows,
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to list alerts.",
      },
      { status: 500 },
    );
  }
}
