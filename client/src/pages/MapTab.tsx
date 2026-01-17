import { useEffect, useMemo, useRef, useState } from "react";
import MapboxMap, { mapboxgl } from "@/components/MapboxMap";
import BottomNav from "@/components/BottomNav";
import { Coordinates, getSnailPosition } from "@shared/ghostMovement";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSnails } from "@/hooks/useSnails";
import { useProfile } from "@/hooks/useProfile";
import { useFriendships } from "@/hooks/useFriendships";
import type { Snail } from "@/lib/database.types";
import { createCirclePolygon, parseSupabasePoint } from "@/lib/geo";
import { SNAIL_FOCUS_EVENT, SNAIL_FOCUS_STORAGE_KEY } from "@shared/const";

export default function MapTab() {
  const { user } = useAuth();
  const { incomingSnails, outgoingSnails } = useSnails();
  const { profile } = useProfile();
  const { friends } = useFriendships();

  const friendHomeLocations = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const friendship of friends) {
      if (friendship.requester_id === user?.id) {
        map.set(friendship.addressee_id, friendship.addressee_home_location);
      } else {
        map.set(friendship.requester_id, friendship.requester_home_location);
      }
    }
    return map;
  }, [friends, user?.id]);

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const initialCenter = useRef<[number, number] | undefined>(undefined);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userPosition, setUserPosition] = useState<Coordinates | null>(null);
  const [pendingFocusSnailId, setPendingFocusSnailId] = useState<string | null>(
    () => sessionStorage.getItem(SNAIL_FOCUS_STORAGE_KEY)
  );

  // Initialize GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by this browser.");
      alert(
        "Geolocation is not supported by your browser. This game requires GPS access."
      );
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const coords: Coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserPosition(coords);
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMessage = "Unable to get your location. ";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage +=
              "Please enable location permissions in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out.";
            break;
          default:
            errorMessage += "An unknown error occurred.";
            break;
        }

        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail;
      if (typeof detail === "string" && detail) {
        setPendingFocusSnailId(detail);
      }
    };

    window.addEventListener(SNAIL_FOCUS_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(SNAIL_FOCUS_EVENT, handler as EventListener);
    };
  }, []);

  // Render map layers when map loads
  const handleMapLoad = (map: mapboxgl.Map) => {
    console.log("handleMapLoad called");
    mapRef.current = map;
    setMapLoaded(true);

    map.addSource("user-position", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [0, 0],
        },
      },
    });

    map.addLayer({
      id: "user-marker",
      type: "circle",
      source: "user-position",
      paint: {
        "circle-radius": 12,
        "circle-color": "#4285F4",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#FFFFFF",
      },
    });

    // Snail trails source
    map.addSource("snail-trails", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    // Past trails (solid lines)
    map.addLayer({
      id: "past-trails",
      type: "line",
      source: "snail-trails",
      filter: ["==", ["get", "trailType"], "past"],
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
      },
    });

    // Future trails (dotted lines)
    map.addLayer({
      id: "future-trails",
      type: "line",
      source: "snail-trails",
      filter: ["==", ["get", "trailType"], "future"],
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
        "line-dasharray": [2, 2],
      },
    });

    // Snail positions source
    map.addSource("snail-positions", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    // Snail markers
    map.addLayer({
      id: "snail-marker-glow",
      type: "circle",
      source: "snail-positions",
      paint: {
        "circle-radius": 18,
        "circle-color": [
          "case",
          ["==", ["get", "direction"], "outgoing"],
          "rgba(34, 197, 94, 0.35)",
          "rgba(248, 113, 113, 0.35)",
        ],
        "circle-blur": 0.8,
      },
    });

    map.addLayer({
      id: "snail-marker-core",
      type: "circle",
      source: "snail-positions",
      paint: {
        "circle-radius": 8,
        "circle-color": [
          "case",
          ["==", ["get", "direction"], "outgoing"],
          "#22C55E",
          "#EF4444",
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
      },
    });

    map.addSource("home-base-zone", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "home-base-fill",
      type: "fill",
      source: "home-base-zone",
      paint: {
        "fill-color": "#3B82F6",
        "fill-opacity": 0.15,
      },
    });

    map.addSource("friend-home-zones", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "friend-home-fill",
      type: "fill",
      source: "friend-home-zones",
      paint: {
        "fill-color": "#A855F7",
        "fill-opacity": 0.15,
      },
    });
  };

  // Update user position on map
  const updateUserPositionOnMap = (
    map: mapboxgl.Map,
    position: Coordinates
  ) => {
    const source = map.getSource("user-position") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [position.lng, position.lat],
        },
      });
    }
  };

  useEffect(() => {
    if (!mapRef.current || !userPosition || !mapLoaded) return;
    updateUserPositionOnMap(mapRef.current, userPosition);
  }, [userPosition, mapLoaded]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource(
      "home-base-zone"
    ) as mapboxgl.GeoJSONSource | undefined;

    if (!source) return;

    const center = parseSupabasePoint(profile?.home_location);
    if (!center) {
      source.setData({
        type: "FeatureCollection",
        features: [],
      });
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: [createCirclePolygon(center, 1000)],
    });
  }, [profile?.home_location, mapLoaded]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource(
      "friend-home-zones"
    ) as mapboxgl.GeoJSONSource | undefined;

    if (!source) return;

    const features: GeoJSON.Feature[] = [];
    const seenLocations = new Set<string>();

    for (const snail of outgoingSnails) {
      const homeLocationRaw = friendHomeLocations.get(snail.target_id);
      const homeLocation = parseSupabasePoint(homeLocationRaw);
      if (!homeLocation) continue;

      const locationKey = `${homeLocation.lng},${homeLocation.lat}`;
      if (seenLocations.has(locationKey)) continue;
      seenLocations.add(locationKey);

      features.push(createCirclePolygon(homeLocation, 1000));
    }

    source.setData({
      type: "FeatureCollection",
      features,
    });
  }, [outgoingSnails, friendHomeLocations, mapLoaded]);

  // Update snail positions and check for intercept opportunities
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const trailSource = map.getSource("snail-trails") as mapboxgl.GeoJSONSource;
    const positionSource = map.getSource(
      "snail-positions"
    ) as mapboxgl.GeoJSONSource;

    if (!trailSource || !positionSource) return;

    const trailFeatures: GeoJSON.Feature[] = [];
    const positionFeatures: GeoJSON.Feature[] = [];
    const snailPositionMap = new Map<string, Coordinates>();

    const buildFeatures = (
      snailsToPlot: Snail[],
      direction: "incoming" | "outgoing",
      color: string
    ) => {
      for (const snail of snailsToPlot) {
        const snailPos = getSnailPosition(
          snail.path_json,
          new Date(snail.start_time),
          new Date(snail.arrival_time)
        );

        positionFeatures.push({
          type: "Feature",
          properties: { snailId: snail.id, direction },
          geometry: {
            type: "Point",
            coordinates: [
              snailPos.currentPosition.lng,
              snailPos.currentPosition.lat,
            ],
          },
        });
        snailPositionMap.set(snail.id, snailPos.currentPosition);

        if (snailPos.pastTrail.length >= 2) {
          trailFeatures.push({
            type: "Feature",
            properties: { trailType: "past", color },
            geometry: {
              type: "LineString",
              coordinates: snailPos.pastTrail.map((c) => [c.lng, c.lat]),
            },
          });
        }

        if (snailPos.futureTrail.length >= 2 && direction === "outgoing") {
          trailFeatures.push({
            type: "Feature",
            properties: { trailType: "future", color },
            geometry: {
              type: "LineString",
              coordinates: snailPos.futureTrail.map((c) => [c.lng, c.lat]),
            },
          });
        }

      }
    };

    buildFeatures(incomingSnails, "incoming", "#EF4444");
    buildFeatures(outgoingSnails, "outgoing", "#22C55E");

    trailSource.setData({
      type: "FeatureCollection",
      features: trailFeatures,
    });

    positionSource.setData({
      type: "FeatureCollection",
      features: positionFeatures,
    });
    if (pendingFocusSnailId) {
      const coords = snailPositionMap.get(pendingFocusSnailId);
      if (!coords) {
        console.warn(
          "Snail focus requested but coordinates missing",
          pendingFocusSnailId,
          Array.from(snailPositionMap.keys())
        );
      }
      if (coords && mapRef.current) {
        mapRef.current.easeTo({
          center: [coords.lng, coords.lat],
          zoom: 15,
          duration: 1500,
        });
        setPendingFocusSnailId(null);
        sessionStorage.removeItem(SNAIL_FOCUS_STORAGE_KEY);
      }
    }
  }, [incomingSnails, outgoingSnails, pendingFocusSnailId, mapLoaded]);

  const SINGAPORE_CENTER: [number, number] = [103.8198, 1.3521];
  const SINGAPORE_OVERVIEW_ZOOM = 10.5;

  return (
    <div className="relative w-full h-screen">
      <MapboxMap
        center={initialCenter.current ?? SINGAPORE_CENTER}
        zoom={SINGAPORE_OVERVIEW_ZOOM}
        onMapLoad={handleMapLoad}
        className="w-full h-full"
      />

      {/* GPS status indicator */}
      {!userPosition && (
        <div className="absolute top-4 left-4 bg-card text-card-foreground px-4 py-2 rounded-lg shadow-md">
          <p className="text-sm">Acquiring GPS...</p>
        </div>
      )}

      <BottomNav activeTab="map" />
    </div>
  );
}
