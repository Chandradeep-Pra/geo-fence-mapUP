import { startTimer, timedJson } from "@/lib/api";
import {
  getApproxRadiusMeters,
  getPolygonCenter,
  type LatLngCoordinate,
} from "@/lib/assessment-geo";
import { assessmentGeofenceSchema } from "@/lib/assessment-validation";
import { createEntityId, ensureDatabaseSetup, nowIso, query } from "@/lib/db";

type GeofenceRow = {
  id: string;
  name: string;
  description: string | null;
  coordinates: string;
  category: "delivery_zone" | "restricted_zone" | "toll_zone" | "customer_area";
  created_at: string;
};

export async function POST(request: Request) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const payload = await request.json();
    const parsed = assessmentGeofenceSchema.safeParse(payload);

    if (!parsed.success) {
      return timedJson(
        startedAt,
        {
          error: "Invalid geofence payload.",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const coordinates = parsed.data.coordinates as LatLngCoordinate[];
    const { centerLat, centerLng } = getPolygonCenter(coordinates);
    const createdAt = nowIso();
    const geofenceId = createEntityId("geo");

    await query(
      `
        INSERT INTO assessment_geofences (
          id,
          name,
          description,
          coordinates_json,
          category,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, 'active', $6)
      `,
      [
        geofenceId,
        parsed.data.name,
        parsed.data.description || null,
        JSON.stringify(coordinates),
        parsed.data.category,
        createdAt,
      ],
    );

    await query(
      `
        INSERT INTO geofences (
          id,
          name,
          description,
          center_lat,
          center_lng,
          radius_meters,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $7)
      `,
      [
        geofenceId,
        parsed.data.name,
        parsed.data.description || null,
        centerLat,
        centerLng,
        getApproxRadiusMeters(centerLat, centerLng, coordinates),
        createdAt,
      ],
    );

    return timedJson(startedAt, {
      id: geofenceId,
      name: parsed.data.name,
      status: "active",
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to create geofence.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const category = new URL(request.url).searchParams.get("category");

    const geofencesResult = await query<GeofenceRow>(
      `
        SELECT
          id,
          name,
          description,
          coordinates_json AS coordinates,
          category,
          created_at
        FROM assessment_geofences
        WHERE ($1 IS NULL OR category = $1)
        ORDER BY created_at DESC
      `,
      [category],
    );

    return timedJson(startedAt, {
      geofences: geofencesResult.rows.map((geofence) => ({
        id: geofence.id,
        name: geofence.name,
        description: geofence.description,
        coordinates: JSON.parse(geofence.coordinates) as LatLngCoordinate[],
        category: geofence.category,
        created_at: geofence.created_at,
      })),
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to list geofences.",
      },
      { status: 500 },
    );
  }
}
