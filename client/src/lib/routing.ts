import type { Coordinates } from "@shared/ghostMovement";

export type RouteResult = {
  coordinates: Coordinates[];
  distance: number;
  duration: number;
};

const OSRM_BASE_URL = "https://router.project-osrm.org";

/**
 * Requests a walking route between two points using OSRM.
 */
export async function fetchWalkingRoute(
  start: Coordinates,
  end: Coordinates
): Promise<RouteResult> {
  const url = `${OSRM_BASE_URL}/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch walking route");
  }

  const data = await response.json();
  if (!data?.routes?.length) {
    throw new Error("No walking route found");
  }

  const route = data.routes[0];
  return {
    coordinates: route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    ),
    distance: route.distance,
    duration: route.duration,
  };
}
