import { startTimer, timedJson } from "@/lib/api";
import { ensureDatabaseSetup, query } from "@/lib/db";

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

function buildFilterClause(searchParams: URLSearchParams) {
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  const vehicleId = searchParams.get("vehicle_id");
  const geofenceId = searchParams.get("geofence_id");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (vehicleId) {
    clauses.push(`vehicle_id = $${values.length + 1}`);
    values.push(vehicleId);
  }

  if (geofenceId) {
    clauses.push(`geofence_id = $${values.length + 1}`);
    values.push(geofenceId);
  }

  if (startDate) {
    clauses.push(`timestamp >= $${values.length + 1}`);
    values.push(startDate);
  }

  if (endDate) {
    clauses.push(`timestamp <= $${values.length + 1}`);
    values.push(endDate);
  }

  return {
    whereClause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

export async function GET(request: Request) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const searchParams = new URL(request.url).searchParams;
    const requestedLimit = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 500)
      : 50;

    const { whereClause, values } = buildFilterClause(searchParams);

    const [violationsResult, totalCountResult] = await Promise.all([
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
          ${whereClause}
          ORDER BY timestamp DESC
          LIMIT $${values.length + 1}
        `,
        [...values, limit],
      ),
      query<CountRow>(
        `
          SELECT COUNT(*) AS total_count
          FROM assessment_violation_events
          ${whereClause}
        `,
        values,
      ),
    ]);

    return timedJson(startedAt, {
      violations: violationsResult.rows,
      total_count: totalCountResult.rows[0]?.total_count ?? 0,
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to fetch violation history.",
      },
      { status: 500 },
    );
  }
}
