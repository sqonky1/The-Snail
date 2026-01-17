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
 * Convert path_json [lng, lat][] to Coordinates[]
 */
export function pathJsonToCoordinates(pathJson: [number, number][]): Coordinates[] {
  return pathJson.map(([lng, lat]) => ({ lat, lng }));
}

/**
 * Convert Coordinates[] to path_json [lng, lat][]
 */
export function coordinatesToPathJson(coords: Coordinates[]): [number, number][] {
  return coords.map((c) => [c.lng, c.lat]);
}

/**
 * Calculate progress of snail journey (0 to 1)
 * Based on start_time and arrival_time
 */
export function calculateProgress(
  startTime: Date,
  arrivalTime: Date,
  now: Date = new Date()
): number {
  const totalDuration = arrivalTime.getTime() - startTime.getTime();
  if (totalDuration <= 0) return 1;

  const elapsed = now.getTime() - startTime.getTime();
  const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1);
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
        lat:
          segmentStart.lat +
          (segmentEnd.lat - segmentStart.lat) * segmentProgress,
        lng:
          segmentStart.lng +
          (segmentEnd.lng - segmentStart.lng) * segmentProgress,
      };
    }
  }

  return path[path.length - 1]!;
}

/**
 * Get snail position with past and future trails
 * Uses path_json format [lng, lat][] and arrival_time
 */
export function getSnailPosition(
  pathJson: [number, number][],
  startTime: Date,
  arrivalTime: Date,
  now: Date = new Date()
): SnailPosition {
  const path = pathJsonToCoordinates(pathJson);
  const progress = calculateProgress(startTime, arrivalTime, now);
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
export function haversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
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
 * Check if a snail has arrived (journey complete)
 */
export function hasArrived(
  arrivalTime: Date,
  now: Date = new Date()
): boolean {
  return now >= arrivalTime;
}

/**
 * Check if user is within intercept range of a snail
 */
export function isInInterceptRange(
  userPosition: Coordinates,
  snailPosition: Coordinates,
  rangeMeters: number = 50
): boolean {
  const distance = haversineDistance(userPosition, snailPosition);
  return distance <= rangeMeters;
}

/**
 * Get remaining time until arrival in hours
 */
export function getRemainingHours(
  arrivalTime: Date,
  now: Date = new Date()
): number {
  const remaining = arrivalTime.getTime() - now.getTime();
  return Math.max(0, remaining / (1000 * 60 * 60));
}

/**
 * Get elapsed time since start in hours
 */
export function getElapsedHours(
  startTime: Date,
  now: Date = new Date()
): number {
  const elapsed = now.getTime() - startTime.getTime();
  return Math.max(0, elapsed / (1000 * 60 * 60));
}
