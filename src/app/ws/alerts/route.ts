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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDatabaseSetup();

  const encoder = new TextEncoder();
  let lastSeenTimestamp =
    new URL(request.url).searchParams.get("since") ??
    new Date(0).toISOString();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const pushAlerts = async () => {
        try {
          const alertsResult = await query<AlertEventRow>(
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
              WHERE timestamp > $1
              ORDER BY timestamp ASC
              LIMIT 20
            `,
            [lastSeenTimestamp],
          );

          for (const event of alertsResult.rows) {
            controller.enqueue(
              encoder.encode(
                `event: alert\ndata: ${JSON.stringify({
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
                })}\n\n`,
              ),
            );
            lastSeenTimestamp = event.timestamp;
          }
        } catch {
          // Let the next interval retry.
        }
      };

      await pushAlerts();

      const interval = setInterval(() => {
        if (!isClosed) {
          void pushAlerts();
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        }
      }, 3000);

      request.signal.addEventListener("abort", () => {
        isClosed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
