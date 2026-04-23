import { EventEmitter } from "node:events";

type LiveAlertEvent = {
  event_id: string;
  event_type: "entry" | "exit";
  timestamp: string;
  vehicle: {
    vehicle_id: string;
    vehicle_number: string;
    driver_name: string;
  };
  geofence: {
    geofence_id: string;
    geofence_name: string;
    category: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
};

const globalForAlerts = globalThis as unknown as {
  alertEmitter?: EventEmitter;
};

export const alertEmitter = globalForAlerts.alertEmitter ?? new EventEmitter();

alertEmitter.setMaxListeners(200);

if (process.env.NODE_ENV !== "production") {
  globalForAlerts.alertEmitter = alertEmitter;
}

export function publishLiveAlert(event: LiveAlertEvent) {
  alertEmitter.emit("alert", event);
}

export type { LiveAlertEvent };
