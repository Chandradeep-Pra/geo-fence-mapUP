import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const databasePath = resolve(
  process.cwd(),
  process.env.DATABASE_URL?.replace("file:", "") || "./data/geofence-alert.db",
);

mkdirSync(dirname(databasePath), { recursive: true });

const globalForDb = globalThis as unknown as {
  db?: DatabaseSync;
  setupPromise?: Promise<void>;
};

export const db =
  globalForDb.db ??
  new DatabaseSync(databasePath);

db.exec("PRAGMA foreign_keys = ON;");

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export function createId() {
  return randomUUID();
}

export function createEntityId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

type QueryResult<T> = {
  rows: T[];
};

function normalizeSql(text: string) {
  return text.replace(/\$\d+/g, "?");
}

function bindValues(text: string, values: unknown[]) {
  const placeholders = [...text.matchAll(/\$(\d+)/g)];

  if (placeholders.length === 0) {
    return values;
  }

  return placeholders.map((match) => {
    const position = Number(match[1]) - 1;
    return values[position];
  });
}

export async function query<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
  const statement = db.prepare(normalizeSql(text));
  const boundValues = bindValues(text, values);
  const trimmed = text.trim().toUpperCase();

  if (trimmed.startsWith("SELECT") || trimmed.includes("RETURNING")) {
    return {
      rows: statement.all(...boundValues) as T[],
    } satisfies QueryResult<T>;
  }

  statement.run(...boundValues);
  return {
    rows: [],
  } satisfies QueryResult<T>;
}

export async function ensureDatabaseSetup() {
  if (!globalForDb.setupPromise) {
    globalForDb.setupPromise = (async () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS devices (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          last_lat REAL,
          last_lng REAL,
          last_seen_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS geofences (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          center_lat REAL NOT NULL,
          center_lng REAL NOT NULL,
          radius_meters INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS location_pings (
          id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          recorded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alert_events (
          id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
          geofence_id TEXT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL CHECK (event_type IN ('ENTER', 'EXIT')),
          distance_meters REAL NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          triggered_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_location_pings_device_recorded
          ON location_pings (device_id, recorded_at DESC);

        CREATE INDEX IF NOT EXISTS idx_alert_events_triggered
          ON alert_events (triggered_at DESC);

        CREATE INDEX IF NOT EXISTS idx_alert_events_device_geofence
          ON alert_events (device_id, geofence_id, triggered_at DESC);

        CREATE TABLE IF NOT EXISTS assessment_geofences (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          coordinates_json TEXT NOT NULL,
          category TEXT NOT NULL CHECK (
            category IN ('delivery_zone', 'restricted_zone', 'toll_zone', 'customer_area')
          ),
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assessment_vehicles (
          id TEXT PRIMARY KEY,
          vehicle_number TEXT NOT NULL UNIQUE,
          driver_name TEXT NOT NULL,
          vehicle_type TEXT NOT NULL,
          phone TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assessment_vehicle_locations (
          id TEXT PRIMARY KEY,
          vehicle_id TEXT NOT NULL REFERENCES assessment_vehicles(id) ON DELETE CASCADE,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          timestamp TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assessment_alert_configs (
          id TEXT PRIMARY KEY,
          geofence_id TEXT NOT NULL REFERENCES assessment_geofences(id) ON DELETE CASCADE,
          vehicle_id TEXT REFERENCES assessment_vehicles(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL CHECK (event_type IN ('entry', 'exit', 'both')),
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assessment_vehicle_geofence_state (
          vehicle_id TEXT NOT NULL REFERENCES assessment_vehicles(id) ON DELETE CASCADE,
          geofence_id TEXT NOT NULL REFERENCES assessment_geofences(id) ON DELETE CASCADE,
          is_inside INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (vehicle_id, geofence_id)
        );

        CREATE TABLE IF NOT EXISTS assessment_violation_events (
          id TEXT PRIMARY KEY,
          vehicle_id TEXT NOT NULL REFERENCES assessment_vehicles(id) ON DELETE CASCADE,
          vehicle_number TEXT NOT NULL,
          geofence_id TEXT NOT NULL REFERENCES assessment_geofences(id) ON DELETE CASCADE,
          geofence_name TEXT NOT NULL,
          event_type TEXT NOT NULL CHECK (event_type IN ('entry', 'exit')),
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          timestamp TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assessment_alert_events (
          id TEXT PRIMARY KEY,
          violation_id TEXT REFERENCES assessment_violation_events(id) ON DELETE SET NULL,
          vehicle_id TEXT NOT NULL REFERENCES assessment_vehicles(id) ON DELETE CASCADE,
          vehicle_number TEXT NOT NULL,
          driver_name TEXT NOT NULL,
          geofence_id TEXT NOT NULL REFERENCES assessment_geofences(id) ON DELETE CASCADE,
          geofence_name TEXT NOT NULL,
          geofence_category TEXT NOT NULL,
          event_type TEXT NOT NULL CHECK (event_type IN ('entry', 'exit')),
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          timestamp TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_assessment_vehicle_locations_vehicle_timestamp
          ON assessment_vehicle_locations (vehicle_id, timestamp DESC);

        CREATE INDEX IF NOT EXISTS idx_assessment_alert_configs_lookup
          ON assessment_alert_configs (geofence_id, vehicle_id, status);

        CREATE INDEX IF NOT EXISTS idx_assessment_violations_filters
          ON assessment_violation_events (vehicle_id, geofence_id, timestamp DESC);
      `);
    })();
  }

  await globalForDb.setupPromise;
}
