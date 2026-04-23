export type GeofenceCategory =
  | "delivery_zone"
  | "restricted_zone"
  | "toll_zone"
  | "customer_area";

export type GeofenceItem = {
  id: string;
  name: string;
  description: string | null;
  coordinates: [number, number][];
  category: GeofenceCategory;
  status: string;
  created_at: string;
};

export type VehicleItem = {
  id: string;
  vehicle_number: string;
  driver_name: string;
  vehicle_type: string;
  phone: string;
  status: string;
  created_at: string;
  current_location: {
    vehicle_id: string;
    latitude: number;
    longitude: number;
    timestamp: string;
  } | null;
};

export type AlertRule = {
  alert_id: string;
  geofence_id: string;
  geofence_name: string;
  vehicle_id: string | null;
  vehicle_number: string | null;
  event_type: "entry" | "exit" | "both";
  status: string;
  created_at: string;
};

export type LiveAlert = {
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

export type ViolationItem = {
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

export type DashboardData = {
  geofences: GeofenceItem[];
  vehicles: VehicleItem[];
  alertConfigs: AlertRule[];
  liveAlerts: LiveAlert[];
  violations: ViolationItem[];
  violationCount: number;
};
