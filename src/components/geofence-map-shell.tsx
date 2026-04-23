"use client";

import { LatLngBounds } from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

type Geofence = {
  id: string;
  name: string;
  description: string | null;
  coordinates: [number, number][];
  category: "delivery_zone" | "restricted_zone" | "toll_zone" | "customer_area";
  status: string;
};

type Vehicle = {
  id: string;
  vehicle_number: string;
  driver_name: string;
  current_location: {
    latitude: number;
    longitude: number;
    timestamp: string;
  } | null;
};

function geofenceColor(category: Geofence["category"]) {
  switch (category) {
    case "restricted_zone":
      return "#ff8b7d";
    case "toll_zone":
      return "#ffcb6b";
    case "customer_area":
      return "#7dd3fc";
    default:
      return "#85f779";
  }
}

export default function GeofenceMapShell({
  geofences,
  vehicles,
  selectedVehicleId,
  selectedVehicleLocation,
  isTracking,
  selectedPoint,
  simulationPoint,
  simulationPath,
  onMapClick,
}: {
  geofences: Geofence[];
  vehicles: Vehicle[];
  selectedVehicleId?: string;
  selectedVehicleLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  } | null;
  isTracking?: boolean;
  selectedPoint?: { latitude: number; longitude: number } | null;
  simulationPoint?: { latitude: number; longitude: number } | null;
  simulationPath?: Array<{ latitude: number; longitude: number }>;
  onMapClick?: (point: { latitude: number; longitude: number }) => void;
}) {
  const trackedVehicle = useMemo(
    () =>
      vehicles.find(
        (vehicle) =>
          vehicle.id === selectedVehicleId &&
          (selectedVehicleLocation !== null || vehicle.current_location !== null),
      ),
    [selectedVehicleId, selectedVehicleLocation, vehicles],
  );

  return (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      scrollWheelZoom
      className="h-[460px] w-full rounded-[28px]"
    >
      <MapViewportController
        geofences={geofences}
        trackedVehicle={trackedVehicle}
        selectedVehicleLocation={selectedVehicleLocation ?? null}
        selectedPoint={selectedPoint ?? null}
        simulationPoint={simulationPoint ?? null}
        simulationPath={simulationPath ?? []}
        isTracking={isTracking ?? false}
      />
      <MapClickCapture onMapClick={onMapClick} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {geofences.map((geofence) => (
        <Polygon
          key={geofence.id}
          positions={geofence.coordinates}
          pathOptions={{
            color: geofenceColor(geofence.category),
            fillColor: geofenceColor(geofence.category),
            fillOpacity: 0.16,
            weight: 2,
          }}
        >
          <Popup>
            <strong>{geofence.name}</strong>
            <br />
            {geofence.category.replaceAll("_", " ")}
            {geofence.description ? (
              <>
                <br />
                {geofence.description}
              </>
            ) : null}
          </Popup>
        </Polygon>
      ))}

      {vehicles
        .map((vehicle) => {
          const displayLocation =
            vehicle.id === selectedVehicleId && selectedVehicleLocation
              ? selectedVehicleLocation
              : vehicle.current_location;

          if (!displayLocation) {
            return null;
          }

          return (
            <CircleMarker
              key={vehicle.id}
              center={[displayLocation.latitude, displayLocation.longitude]}
              radius={vehicle.id === selectedVehicleId ? 10 : 8}
              pathOptions={{
                color: "#041106",
                fillColor: vehicle.id === selectedVehicleId ? "#a6ff85" : "#f9ff90",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{vehicle.vehicle_number}</strong>
                <br />
                Driver: {vehicle.driver_name}
                <br />
                Last seen: {new Date(displayLocation.timestamp).toLocaleString()}
              </Popup>
            </CircleMarker>
          );
        })}

      {selectedPoint ? (
        <CircleMarker
          center={[selectedPoint.latitude, selectedPoint.longitude]}
          radius={7}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#38bdf8",
            fillOpacity: 1,
            weight: 2,
          }}
        >
          <Popup>Selected map point for location update</Popup>
        </CircleMarker>
      ) : null}

      {simulationPath && simulationPath.length > 1 ? (
        <Polyline
          positions={simulationPath.map((point) => [point.latitude, point.longitude])}
          pathOptions={{
            color: "#7dd3fc",
            weight: 4,
            opacity: 0.85,
            dashArray: "8 8",
          }}
        />
      ) : null}

    </MapContainer>
  );
}

function MapClickCapture({
  onMapClick,
}: {
  onMapClick?: (point: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click(event) {
      onMapClick?.({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

function MapViewportController({
  geofences,
  trackedVehicle,
  selectedVehicleLocation,
  selectedPoint,
  simulationPoint,
  simulationPath,
  isTracking,
}: {
  geofences: Geofence[];
  trackedVehicle?: Vehicle;
  selectedVehicleLocation: { latitude: number; longitude: number; timestamp: string } | null;
  selectedPoint: { latitude: number; longitude: number } | null;
  simulationPoint: { latitude: number; longitude: number } | null;
  simulationPath: Array<{ latitude: number; longitude: number }>;
  isTracking: boolean;
}) {
  const map = useMap();
  const hasFittedBounds = useRef(false);
  const lastFocusedPoint = useRef<string | null>(null);

  useEffect(() => {
    const focusedLocation = selectedVehicleLocation ?? trackedVehicle?.current_location ?? null;

    if ((isTracking || simulationPoint !== null) && focusedLocation) {
      const nextPosition = `${focusedLocation.latitude}:${focusedLocation.longitude}`;

      if (lastFocusedPoint.current !== nextPosition) {
        map.flyTo(
          [focusedLocation.latitude, focusedLocation.longitude],
          Math.max(map.getZoom(), 15),
          { animate: true, duration: 1 },
        );
        lastFocusedPoint.current = nextPosition;
      }

      return;
    }

    if (hasFittedBounds.current) {
      return;
    }

    const bounds = new LatLngBounds([]);

    geofences.forEach((geofence) => {
      geofence.coordinates.forEach(([latitude, longitude]) => {
        bounds.extend([latitude, longitude]);
      });
    });

    if (focusedLocation) {
      bounds.extend([focusedLocation.latitude, focusedLocation.longitude]);
    } else {
      vehiclesWithLocation(trackedVehicle ? [trackedVehicle] : []).forEach((vehicle) => {
        bounds.extend([
          vehicle.current_location!.latitude,
          vehicle.current_location!.longitude,
        ]);
      });
    }

    if (selectedPoint) {
      bounds.extend([selectedPoint.latitude, selectedPoint.longitude]);
    }

    if (simulationPoint) {
      bounds.extend([simulationPoint.latitude, simulationPoint.longitude]);
    }

    simulationPath.forEach((point) => {
      bounds.extend([point.latitude, point.longitude]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [36, 36],
      });
      hasFittedBounds.current = true;
    }
  }, [geofences, isTracking, map, selectedPoint, selectedVehicleLocation, simulationPath, simulationPoint, trackedVehicle]);

  return null;
}

function vehiclesWithLocation(vehicles: Vehicle[]) {
  return vehicles.filter((vehicle) => vehicle.current_location !== null);
}
