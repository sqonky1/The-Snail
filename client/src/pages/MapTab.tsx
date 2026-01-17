import { useEffect, useMemo, useRef, useState } from "react";
import MapboxMap, { mapboxgl } from "@/components/MapboxMap";
import BottomNav from "@/components/BottomNav";
import NotificationModal from "@/components/NotificationModal";
import InterceptModal from "@/components/InterceptModal";
import Joystick from "@/components/Joystick";
import { Button } from "@/components/ui/button";
import { Coordinates, getSnailPosition, isInInterceptRange } from "@shared/ghostMovement";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSnails } from "@/hooks/useSnails";
import { useProfile } from "@/hooks/useProfile";
import { useFriendships } from "@/hooks/useFriendships";
import { useNotifications } from "@/hooks/useNotifications";
import type { Snail } from "@/lib/database.types";
import { createCirclePolygon, parseSupabasePoint } from "@/lib/geo";
import { INTERCEPT_RANGE_METERS, SNAIL_FOCUS_EVENT, SNAIL_FOCUS_STORAGE_KEY } from "@shared/const";

export default function MapTab() {
  const { user } = useAuth();
  const { incomingSnails, outgoingSnails, snails, refresh: refreshSnails, interceptSnail } = useSnails();
  const { profile, refresh: refreshProfile } = useProfile();
  const { friends } = useFriendships();
  const { newNotification, clearNewNotification, markAsRead, refresh: refreshNotifications } = useNotifications();

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

  const friendUsernames = useMemo(() => {
    const map = new Map<string, string>();
    for (const friendship of friends) {
      if (friendship.requester_id === user?.id) {
        map.set(friendship.addressee_id, friendship.addressee_username);
      } else {
        map.set(friendship.requester_id, friendship.requester_username);
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
  const [isDemoMode, setIsDemoMode] = useState(false);
  const joystickVelocityRef = useRef({ x: 0, y: 0 });
  const [tick, setTick] = useState(0);
  const [interceptableSnail, setInterceptableSnail] = useState<Snail | null>(null);
  const dismissedSnailsRef = useRef<Set<string>>(new Set());

  // Timer to update snail positions every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check if any snail has arrived and trigger sync
  useEffect(() => {
    const now = new Date();
    const hasArrivedSnail = snails.some(
      (snail) => new Date(snail.arrival_time) <= now
    );
    if (hasArrivedSnail) {
      refreshSnails();
    }
  }, [tick, snails, refreshSnails]);

  // Check for interceptable snails
  useEffect(() => {
    if (!userPosition || interceptableSnail) return;

    for (const snail of incomingSnails) {
      if (dismissedSnailsRef.current.has(snail.id)) continue;

      const snailPos = getSnailPosition(
        snail.path_json,
        new Date(snail.start_time),
        new Date(snail.arrival_time)
      );

      if (isInInterceptRange(userPosition, snailPos.currentPosition, INTERCEPT_RANGE_METERS)) {
        setInterceptableSnail(snail);
        break;
      }
    }
  }, [userPosition, incomingSnails, interceptableSnail, tick]);

  const handleIntercept = async () => {
    if (!interceptableSnail) return;
    await interceptSnail(interceptableSnail.id);
    await refreshProfile();
    await refreshNotifications();
    setInterceptableSnail(null);
  };

  const handleInterceptClose = () => {
    if (interceptableSnail) {
      dismissedSnailsRef.current.add(interceptableSnail.id);
    }
    setInterceptableSnail(null);
  };

  // Initialize GPS tracking
  useEffect(() => {
    if (isDemoMode) return;
    
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
  }, [isDemoMode]);

  // Demo mode joystick movement
  useEffect(() => {
    if (!isDemoMode) return;

    const MOVEMENT_SPEED_MS = 1000;
    const LAT_PER_METER = 1 / 111320;
    
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const animate = (timestamp: number) => {
      const deltaTime = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const { x, y } = joystickVelocityRef.current;
      
      if (x !== 0 || y !== 0) {
        setUserPosition((prev) => {
          if (!prev) {
            return { lat: 1.3521, lng: 103.8198 };
          }

          const metersPerSecond = MOVEMENT_SPEED_MS;
          const latPerMeter = LAT_PER_METER;
          const lngPerMeter = LAT_PER_METER / Math.cos((prev.lat * Math.PI) / 180);

          const newLat = prev.lat + y * metersPerSecond * latPerMeter * deltaTime;
          const newLng = prev.lng + x * metersPerSecond * lngPerMeter * deltaTime;

          return { lat: newLat, lng: newLng };
        });
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDemoMode]);

  const handleJoystickMove = (x: number, y: number) => {
    joystickVelocityRef.current = { x, y: -y };
  };

  const toggleDemoMode = () => {
    setIsDemoMode((prev) => !prev);
    if (!isDemoMode && !userPosition) {
      setUserPosition({ lat: 1.3521, lng: 103.8198 });
    }
  };

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
        "fill-opacity": 0.3,
      },
    });

    map.addLayer({
      id: "home-base-border",
      type: "line",
      source: "home-base-zone",
      paint: {
        "line-color": "#3B82F6",
        "line-width": 1,
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
        "fill-opacity": 0.3,
      },
    });

    map.addLayer({
      id: "friend-home-border",
      type: "line",
      source: "friend-home-zones",
      paint: {
        "line-color": "#A855F7",
        "line-width": 1,
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
        "line-width": 4,
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
        "line-width": 2,
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

    map.loadImage("/user-snail.webp", (error, image) => {
      if (!error && image) {
        if (!map.hasImage("user-snail")) {
          map.addImage("user-snail", image, { pixelRatio: 2 });
        }
      }
    });

    map.loadImage("/enemy-snail.webp", (error, image) => {
      if (!error && image) {
        if (!map.hasImage("enemy-snail")) {
          map.addImage("enemy-snail", image, { pixelRatio: 2 });
        }
      }
    });

    map.loadImage("/avatar.webp", (error, image) => {
      if (!error && image) {
        if (!map.hasImage("avatar")) {
          map.addImage("avatar", image, { pixelRatio: 2 });
        }
      }
    });

    // Snail markers glow
    map.addLayer({
      id: "snail-marker-glow",
      type: "circle",
      source: "snail-positions",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          4,
          8,
          8,
          14,
          12,
          18,
          16,
        ],
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
      id: "snail-marker-emoji",
      type: "symbol",
      source: "snail-positions",
      layout: {
        "icon-image": [
          "case",
          ["==", ["get", "direction"], "outgoing"],
          "user-snail",
          "enemy-snail",
        ],
        "icon-size": [
         "interpolate",
         ["linear"],
         ["zoom"],
         3, 0.05,  // Microscopic when zoomed out
         14, 0.08, // Still very small when fairly close
         22, 0.4   // Small even when fully zoomed in
       ],
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
      },
    });

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
      type: "symbol",
      source: "user-position",
      layout: {
        "icon-image": "avatar",
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3, 1,  // Microscopic when zoomed out
          14, 1, // Still very small when fairly close
          22, 0.5   // Small even when fully zoomed in
        ],
        "icon-allow-overlap": true,
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

    // Calculate bearing between two coordinates (in degrees)
    const calculateBearing = (from: Coordinates, to: Coordinates): number => {
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const toDeg = (rad: number) => (rad * 180) / Math.PI;
      
      const dLng = toRad(to.lng - from.lng);
      const lat1 = toRad(from.lat);
      const lat2 = toRad(to.lat);
      
      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      
      return (toDeg(Math.atan2(y, x)) + 360) % 360;
    };

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

        // Calculate bearing from the snail's movement direction
        let bearing = 0;
        if (snailPos.futureTrail.length > 0) {
          // Bearing points toward the next point in the path
          bearing = calculateBearing(snailPos.currentPosition, snailPos.futureTrail[0]);
        } else if (snailPos.pastTrail.length >= 2) {
          // If no future trail, use the last segment of past trail
          const lastIdx = snailPos.pastTrail.length - 1;
          bearing = calculateBearing(snailPos.pastTrail[lastIdx - 1], snailPos.pastTrail[lastIdx]);
        }

        positionFeatures.push({
          type: "Feature",
          properties: { snailId: snail.id, direction, bearing },
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
  }, [incomingSnails, outgoingSnails, pendingFocusSnailId, mapLoaded, tick]);

  const SINGAPORE_CENTER: [number, number] = [103.8198, 1.3521];
  const SINGAPORE_OVERVIEW_ZOOM = 10.5;

  const handleNotificationClose = async () => {
    if (newNotification) {
      await markAsRead(newNotification.id);
      clearNewNotification();
      refreshProfile();
    }
  };

  return (
    <div className="relative w-full h-screen">
      <MapboxMap
        center={initialCenter.current ?? SINGAPORE_CENTER}
        zoom={SINGAPORE_OVERVIEW_ZOOM}
        onMapLoad={handleMapLoad}
        className="w-full h-full"
      />

      {/* GPS status indicator */}
      {!userPosition && !isDemoMode && (
        <div className="absolute top-4 left-4 bg-card text-card-foreground px-4 py-2 rounded-lg shadow-md">
          <p className="text-sm">Acquiring GPS...</p>
        </div>
      )}

      {/* Demo mode controls */}
      <div className="absolute bottom-24 right-6 pointer-events-none flex flex-col items-end gap-2">
        <Button
          onClick={toggleDemoMode}
          variant={isDemoMode ? "default" : "outline"}
          size="icon"
          className="pointer-events-auto h-8 w-8"
        >
          {isDemoMode ? "✕" : "◎"}
        </Button>
        {isDemoMode && (
          <div className="pointer-events-auto">
            <Joystick onMove={handleJoystickMove} size={100} />
          </div>
        )}
      </div>

      <NotificationModal notification={newNotification} onClose={handleNotificationClose} />

      <InterceptModal
        open={!!interceptableSnail}
        senderUsername={interceptableSnail ? (friendUsernames.get(interceptableSnail.sender_id) ?? "Unknown") : ""}
        onIntercept={handleIntercept}
        onClose={handleInterceptClose}
      />

      <BottomNav activeTab="map" />
    </div>
  );
}
