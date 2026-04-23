import { booleanPointInPolygon, point, polygon } from "@turf/turf";

export type LatLngCoordinate = [number, number];

export function isPointInsideGeofence(
  latitude: number,
  longitude: number,
  coordinates: LatLngCoordinate[],
) {
  return booleanPointInPolygon(
    point([longitude, latitude]),
    polygon([[...coordinates.map(([lat, lng]) => [lng, lat])]]),
  );
}

export function getPolygonCenter(coordinates: LatLngCoordinate[]) {
  const uniquePoints = coordinates.slice(0, -1);
  const total = uniquePoints.reduce(
    (accumulator, [lat, lng]) => ({
      lat: accumulator.lat + lat,
      lng: accumulator.lng + lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    centerLat: total.lat / uniquePoints.length,
    centerLng: total.lng / uniquePoints.length,
  };
}

export function getApproxRadiusMeters(
  centerLat: number,
  centerLng: number,
  coordinates: LatLngCoordinate[],
) {
  const maxDegrees = Math.max(
    ...coordinates.slice(0, -1).map(([lat, lng]) =>
      Math.sqrt((lat - centerLat) ** 2 + (lng - centerLng) ** 2),
    ),
  );

  return Math.max(50, Math.round(maxDegrees * 111_320));
}
