import { startTimer, timedJson } from "@/lib/api";
import { assessmentVehicleSchema } from "@/lib/assessment-validation";
import { createEntityId, ensureDatabaseSetup, nowIso, query } from "@/lib/db";

type VehicleRow = {
  id: string;
  vehicle_number: string;
  driver_name: string;
  vehicle_type: string;
  phone: string;
  status: string;
  created_at: string;
};

export async function POST(request: Request) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const payload = await request.json();
    const parsed = assessmentVehicleSchema.safeParse(payload);

    if (!parsed.success) {
      return timedJson(
        startedAt,
        {
          error: "Invalid vehicle payload.",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const vehicleId = createEntityId("veh");
    const createdAt = nowIso();

    await query(
      `
        INSERT INTO assessment_vehicles (
          id,
          vehicle_number,
          driver_name,
          vehicle_type,
          phone,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, 'active', $6)
      `,
      [
        vehicleId,
        parsed.data.vehicle_number,
        parsed.data.driver_name,
        parsed.data.vehicle_type,
        parsed.data.phone,
        createdAt,
      ],
    );

    return timedJson(startedAt, {
      id: vehicleId,
      vehicle_number: parsed.data.vehicle_number,
      status: "active",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to register vehicle.";
    const status = message.includes("UNIQUE") ? 409 : 500;

    return timedJson(
      startedAt,
      {
        error: message,
      },
      { status },
    );
  }
}

export async function GET() {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const vehiclesResult = await query<VehicleRow>(
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
    );

    return timedJson(startedAt, {
      vehicles: vehiclesResult.rows,
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to list vehicles.",
      },
      { status: 500 },
    );
  }
}
