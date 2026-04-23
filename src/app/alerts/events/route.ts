import { startTimer, timedJson } from "@/lib/api";
import { ensureDatabaseSetup, query } from "@/lib/db";

type AlertEventRow = {
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

export async function GET(request: Request) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const searchParams = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "20"), 1), 50);

    const eventsResult = await query<AlertEventRow>(
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
        LIMIT $1
      `,
      [limit],
    );

    return timedJson(startedAt, {
      alerts: eventsResult.rows.map((event) => ({
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
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to fetch live alerts.",
      },
      { status: 500 },
    );
  }
}
