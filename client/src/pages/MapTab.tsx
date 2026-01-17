import { useEffect, useRef, useState } from "react";
import MapboxMap, { mapboxgl } from "@/components/MapboxMap";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Coordinates, getSnailPosition, haversineDistance, isInCaptureRange } from "@shared/ghostMovement";
import { useAuth } from "@/_core/hooks/useAuth";

export default function MapTab() {
  const { user } = useAuth();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [userPosition, setUserPosition] = useState<Coordinates | null>(null);
  const [homeZone, setHomeZone] = useState<Coordinates | null>(null);
  const [captureTarget, setCaptureTarget] = useState<{ snailId: number; position: Coordinates } | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Initialize GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by this browser.");
      alert("Geolocation is not supported by your browser. This game requires GPS access.");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const coords: Coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserPosition(coords);

        // Set home zone on first GPS fix (if not already set)
        if (!homeZone) {
          setHomeZone(coords);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMessage = "Unable to get your location. ";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Please enable location permissions in your browser settings.";
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

    setWatchId(id);

    return () => {
      if (id) {
        navigator.geolocation.clearWatch(id);
      }
    };
  }, [homeZone]);

  // Render map layers when map loads
  const handleMapLoad = (map: mapboxgl.Map) => {
    mapRef.current = map;

    // Add sources and layers for game elements
    map.addSource("home-zone", {
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

    // Home zone circle (1km radius, blue)
    map.addLayer({
      id: "home-zone-circle",
      type: "circle",
      source: "home-zone",
      paint: {
        "circle-radius": {
          stops: [
            [0, 0],
            [20, 1000000], // Approximation for 1km at different zoom levels
          ],
          base: 2,
        },
        "circle-color": "rgba(37, 99, 235, 0.2)", // Deep Sea Blue with transparency
        "circle-stroke-width": 2,
        "circle-stroke-color": "#2563EB", // Deep Sea Blue
      },
    });

    // User position marker source
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

    // User position (red dot)
    map.addLayer({
      id: "user-marker",
      type: "circle",
      source: "user-position",
      paint: {
        "circle-radius": 10,
        "circle-color": "#EF4444", // Racing Red
        "circle-stroke-width": 3,
        "circle-stroke-color": "#FFFFFF",
      },
    });

    // Snail trails source (will be populated dynamically)
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

    // Snail positions (current)
    map.addLayer({
      id: "snail-markers",
      type: "circle",
      source: "snail-trails",
      filter: ["==", ["get", "type"], "snail"],
      paint: {
        "circle-radius": 8,
        "circle-color": ["get", "color"],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
      },
    });
  };

  // Update user position on map
  useEffect(() => {
    if (!mapRef.current || !userPosition) return;

    const map = mapRef.current;
    const source = map.getSource("user-position") as mapboxgl.GeoJSONSource;

    if (source) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [userPosition.lng, userPosition.lat],
        },
      });

      // Center map on user
      map.setCenter([userPosition.lng, userPosition.lat]);
    }
  }, [userPosition]);

  // Update home zone on map
  useEffect(() => {
    if (!mapRef.current || !homeZone) return;

    const map = mapRef.current;
    const source = map.getSource("home-zone") as mapboxgl.GeoJSONSource;

    if (source) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [homeZone.lng, homeZone.lat],
        },
      });
    }
  }, [homeZone]);

  // Handle capture button click
  const handleCapture = () => {
    if (!captureTarget) return;
    console.log("Capturing snail:", captureTarget.snailId);
    // TODO: Call tRPC mutation to capture snail
    setCaptureTarget(null);
  };

  return (
    <div className="relative w-full h-screen">
      <MapboxMap
        center={userPosition ? [userPosition.lng, userPosition.lat] : undefined}
        zoom={15}
        onMapLoad={handleMapLoad}
        className="w-full h-full"
      />

      {/* Capture button (floating) */}
      {captureTarget && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Button
            onClick={handleCapture}
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-6 py-3 text-lg shadow-lg"
          >
            SALT IT
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
