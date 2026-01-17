import { useEffect, useRef, useState } from "react";
import MapboxMap, { mapboxgl } from "@/components/MapboxMap";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import {
  Coordinates,
  getSnailPosition,
  isInInterceptRange,
} from "@shared/ghostMovement";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSnails } from "@/hooks/useSnails";
import { useProfile } from "@/hooks/useProfile";
import type { Snail } from "@/lib/database.types";

export default function MapTab() {
  const { user } = useAuth();
  const { incomingSnails, interceptSnail } = useSnails();
  const { profile, addSalt } = useProfile();

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userPosition, setUserPosition] = useState<Coordinates | null>(null);
  const [captureTarget, setCaptureTarget] = useState<{
    snail: Snail;
    position: Coordinates;
  } | null>(null);

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
      id: "snail-markers",
      type: "circle",
      source: "snail-positions",
      paint: {
        "circle-radius": 8,
        "circle-color": "#F97316", // Safety Orange for incoming snails
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
      },
    });
  };

  // Update user position on map
  const updateUserPositionOnMap = (map: mapboxgl.Map, position: Coordinates) => {
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
    map.setCenter([position.lng, position.lat]);
  };

  useEffect(() => {
    if (!mapRef.current || !userPosition || !mapLoaded) return;
    updateUserPositionOnMap(mapRef.current, userPosition);
  }, [userPosition, mapLoaded]);

  // Update snail positions and check for intercept opportunities
  useEffect(() => {
    if (!mapRef.current || !userPosition) return;

    const map = mapRef.current;
    const trailSource = map.getSource("snail-trails") as mapboxgl.GeoJSONSource;
    const positionSource = map.getSource(
      "snail-positions"
    ) as mapboxgl.GeoJSONSource;

    if (!trailSource || !positionSource) return;

    const trailFeatures: GeoJSON.Feature[] = [];
    const positionFeatures: GeoJSON.Feature[] = [];
    let nearestIntercept: { snail: Snail; position: Coordinates } | null = null;
    let nearestDistance = Infinity;

    for (const snail of incomingSnails) {
      const snailPos = getSnailPosition(
        snail.path_json,
        new Date(snail.start_time),
        new Date(snail.arrival_time)
      );

      // Add snail position marker
      positionFeatures.push({
        type: "Feature",
        properties: { snailId: snail.id },
        geometry: {
          type: "Point",
          coordinates: [snailPos.currentPosition.lng, snailPos.currentPosition.lat],
        },
      });

      // Add past trail
      if (snailPos.pastTrail.length >= 2) {
        trailFeatures.push({
          type: "Feature",
          properties: { trailType: "past", color: "#F97316" },
          geometry: {
            type: "LineString",
            coordinates: snailPos.pastTrail.map((c) => [c.lng, c.lat]),
          },
        });
      }

      // Add future trail
      if (snailPos.futureTrail.length >= 2) {
        trailFeatures.push({
          type: "Feature",
          properties: { trailType: "future", color: "#F97316" },
          geometry: {
            type: "LineString",
            coordinates: snailPos.futureTrail.map((c) => [c.lng, c.lat]),
          },
        });
      }

      // Check if within intercept range
      if (isInInterceptRange(userPosition, snailPos.currentPosition, 50)) {
        const distance = Math.sqrt(
          Math.pow(userPosition.lat - snailPos.currentPosition.lat, 2) +
            Math.pow(userPosition.lng - snailPos.currentPosition.lng, 2)
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIntercept = { snail, position: snailPos.currentPosition };
        }
      }
    }

    trailSource.setData({
      type: "FeatureCollection",
      features: trailFeatures,
    });

    positionSource.setData({
      type: "FeatureCollection",
      features: positionFeatures,
    });

    setCaptureTarget(nearestIntercept);
  }, [incomingSnails, userPosition]);

  // Handle intercept button click
  const handleIntercept = async () => {
    if (!captureTarget) return;

    try {
      await interceptSnail(captureTarget.snail.id);
      // Award salt for successful intercept
      await addSalt(10);
      setCaptureTarget(null);
    } catch (error) {
      console.error("Failed to intercept snail:", error);
    }
  };

  return (
    <div className="relative w-full h-screen">
      <MapboxMap
        center={
          userPosition ? [userPosition.lng, userPosition.lat] : undefined
        }
        zoom={15}
        onMapLoad={handleMapLoad}
        className="w-full h-full"
      />

      {/* Intercept button (floating) */}
      {captureTarget && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Button
            onClick={handleIntercept}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 text-lg shadow-lg"
          >
            INTERCEPT
          </Button>
        </div>
      )}

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
