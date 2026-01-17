import polyline from "@mapbox/polyline";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface SnailPosition {
  currentPosition: Coordinates;
  progress: number; // 0 to 1
  isComplete: boolean;
  pastTrail: Coordinates[]; // Solid trail
  futureTrail: Coordinates[]; // Dotted projection
}

/**
 * Decode Google Encoded Polyline to array of coordinates
 */
export function decodePolyline(encoded: string): Coordinates[] {
  const decoded = polyline.decode(encoded);
  return decoded.map(([lat, lng]: [number, number]) => ({ lat, lng }));
}

/**
 * Encode array of coordinates to Google Encoded Polyline
 */
export function encodePolyline(coords: Coordinates[]): string {
  const points: [number, number][] = coords.map((c) => [c.lat, c.lng]);
  return polyline.encode(points);
}

/**
 * Calculate progress of snail journey (0 to 1)
 * progress = (now - startTime) / 48h
 */
export function calculateProgress(startTime: Date, now: Date = new Date()): number {
  const JOURNEY_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
  const elapsed = now.getTime() - startTime.getTime();
  const progress = Math.min(Math.max(elapsed / JOURNEY_DURATION_MS, 0), 1);
  return progress;
}

/**
 * Calculate cumulative distances along a path
 */
function calculateCumulativeDistances(path: Coordinates[]): number[] {
  const distances = [0];
  let totalDistance = 0;

  for (let i = 1; i < path.length; i++) {
    const dist = haversineDistance(path[i - 1]!, path[i]!);
    totalDistance += dist;
    distances.push(totalDistance);
  }

  return distances;
}

/**
 * Interpolate position along a path based on progress
 */
export function interpolatePosition(
  path: Coordinates[],
  progress: number
): Coordinates {
  if (path.length === 0) {
    throw new Error("Path must contain at least one point");
  }

  if (progress <= 0) return path[0]!;
  if (progress >= 1) return path[path.length - 1]!;

  const distances = calculateCumulativeDistances(path);
  const totalDistance = distances[distances.length - 1]!;
  const targetDistance = totalDistance * progress;

  // Find the segment containing the target distance
  for (let i = 1; i < distances.length; i++) {
    if (targetDistance <= distances[i]!) {
      const segmentStart = path[i - 1]!;
      const segmentEnd = path[i]!;
      const segmentDistance = distances[i]! - distances[i - 1]!;
      const segmentProgress =
        (targetDistance - distances[i - 1]!) / segmentDistance;

      // Linear interpolation between segment points
      return {
        lat: segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * segmentProgress,
        lng: segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * segmentProgress,
      };
    }
  }

  return path[path.length - 1]!;
}

/**
 * Get snail position with past and future trails
 */
export function getSnailPosition(
  encodedPolyline: string,
  startTime: Date,
  now: Date = new Date()
): SnailPosition {
  const path = decodePolyline(encodedPolyline);
  const progress = calculateProgress(startTime, now);
  const currentPosition = interpolatePosition(path, progress);

  const distances = calculateCumulativeDistances(path);
  const totalDistance = distances[distances.length - 1]!;
  const currentDistance = totalDistance * progress;

  // Split trail into past (solid) and future (dotted)
  const pastTrail: Coordinates[] = [];
  const futureTrail: Coordinates[] = [];

  for (let i = 0; i < path.length; i++) {
    if (distances[i]! <= currentDistance) {
      pastTrail.push(path[i]!);
    } else {
      futureTrail.push(path[i]!);
    }
  }

  // Add current position to both trails for continuity
  if (pastTrail.length > 0 && futureTrail.length > 0) {
    pastTrail.push(currentPosition);
    futureTrail.unshift(currentPosition);
  }

  return {
    currentPosition,
    progress,
    isComplete: progress >= 1,
    pastTrail,
    futureTrail,
  };
}

/**
 * Haversine distance calculation between two coordinates (in meters)
 */
export function haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a snail has breached (48h elapsed without capture)
 */
export function hasBreached(startTime: Date, now: Date = new Date()): boolean {
  const progress = calculateProgress(startTime, now);
  return progress >= 1;
}

/**
 * Check if user is within capture range of a snail (<15m)
 */
export function isInCaptureRange(
  userPosition: Coordinates,
  snailPosition: Coordinates,
  rangeMeters: number = 15
): boolean {
  const distance = haversineDistance(userPosition, snailPosition);
  return distance <= rangeMeters;
}
