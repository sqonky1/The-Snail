import type { Feature, Polygon } from "geojson";
import type { Coordinates } from "@shared/ghostMovement";
import { HOME_ZONE_RADIUS_KM } from "@shared/const";
import { haversineDistance } from "@shared/ghostMovement";

const POINT_WKT_REGEX = /POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/i;

function parseHexToBuffer(hex: string): DataView | null {
  const sanitized = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(sanitized) || sanitized.length % 2 !== 0) {
    return null;
  }

  const buffer = new Uint8Array(sanitized.length / 2);
  for (let i = 0; i < sanitized.length; i += 2) {
    buffer[i / 2] = parseInt(sanitized.slice(i, i + 2), 16);
  }
  return new DataView(buffer.buffer);
}

function parseWkbPoint(hex: string): Coordinates | null {
  const view = parseHexToBuffer(hex);
  if (!view) return null;

  const littleEndian = view.getUint8(0) === 1;
  let offset = 1;
  const type = view.getUint32(offset, littleEndian);
  offset += 4;

  // SRID flag
  if (type & 0x20000000) {
    offset += 4;
  }

  if (offset + 16 > view.byteLength) return null;

  const lng = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return null;
}

export function parseSupabasePoint(value: unknown): Coordinates | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "coordinates" in value &&
    Array.isArray((value as { coordinates: number[] }).coordinates)
  ) {
    const coords = (value as { coordinates: number[] }).coordinates;
    if (coords.length >= 2) {
      const [lng, lat] = coords;
      return { lat, lng };
    }
  }

  if (typeof value === "string") {
    const match = value.match(POINT_WKT_REGEX);
    if (match) {
      const [, lngStr, latStr] = match;
      return { lat: Number(latStr), lng: Number(lngStr) };
    }

    const wkb = parseWkbPoint(value);
    if (wkb) return wkb;
  }

  return null;
}

export function createCirclePolygon(
  center: Coordinates,
  radiusMeters: number,
  points = 64
): Feature<Polygon> {
  const coords: [number, number][] = [];
  const earthRadius = 6371000;

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = (radiusMeters / earthRadius) * Math.cos(angle);
    const dy = (radiusMeters / earthRadius) * Math.sin(angle);

    const lat = center.lat + (dy * 180) / Math.PI;
    const lng =
      center.lng + ((dx * 180) / Math.PI) / Math.cos((center.lat * Math.PI) / 180);

    coords.push([lng, lat]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}

export function generateLinearPath(
  start: Coordinates,
  end: Coordinates,
  segments = 20
): Coordinates[] {
  const safeSegments = Math.max(2, segments);
  const result: Coordinates[] = [];

  for (let i = 0; i < safeSegments; i++) {
    const t = i / (safeSegments - 1);
    result.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    });
  }

  return result;
}

export function projectPointToCircle(
  center: Coordinates,
  target: Coordinates,
  radiusMeters = HOME_ZONE_RADIUS_KM * 1000
): Coordinates {
  const distance = haversineDistance(center, target);
  if (distance === 0) {
    return {
      lat: center.lat,
      lng: center.lng + radiusMeters / 111320,
    };
  }

  const ratio = radiusMeters / distance;
  return {
    lat: center.lat + (target.lat - center.lat) * ratio,
    lng: center.lng + (target.lng - center.lng) * ratio,
  };
}
