import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Mapbox access token - will be set via environment variable
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

interface MapboxMapProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  onMapLoad?: (map: mapboxgl.Map) => void;
  className?: string;
}

export default function MapboxMap({
  center = [103.8198, 1.3521], // Default to Singapore
  zoom = 13,
  onMapLoad,
  className = "w-full h-full",
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Set Mapbox token
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11", // Start with light base
      center: center,
      zoom: zoom,
      attributionControl: false,
      doubleClickZoom: false,
    });

    // Apply tactical monochromatic styling
    map.current.on("load", () => {
      if (!map.current) return;

      // Apply custom tactical styling
      const layers = map.current.getStyle().layers;
      if (layers) {
        layers.forEach((layer) => {
          if (layer.type === "background") {
            map.current?.setPaintProperty(layer.id, "background-color", "#F9FAFB");
          } else if (layer.type === "line") {
            // Roads and dividers in tactical silver
            map.current?.setPaintProperty(layer.id, "line-color", "#DCDCDD");
          } else if (layer.type === "fill") {
            // Land areas in off-white
            map.current?.setPaintProperty(layer.id, "fill-color", "#F9FAFB");
            map.current?.setPaintProperty(layer.id, "fill-opacity", 0.8);
          } else if (layer.type === "symbol") {
            // Text in dark charcoal
            if (layer.layout && "text-field" in layer.layout) {
              map.current?.setPaintProperty(layer.id, "text-color", "#1F2937");
              map.current?.setPaintProperty(layer.id, "text-halo-color", "#F9FAFB");
              map.current?.setPaintProperty(layer.id, "text-halo-width", 1);
            }
          }
          if (layer['source-layer'] === 'water') {
            map.current?.setPaintProperty(layer.id, "fill-color", "#e1e1e1"); // Your desired blue
            map.current?.setPaintProperty(layer.id, "fill-opacity", 1);
          }
        });
      }

      setMapLoaded(true);
      if (onMapLoad && map.current) {
        onMapLoad(map.current);
      }
    });

    // Cleanup
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update center when prop changes
  useEffect(() => {
    if (map.current && mapLoaded) {
      const [lng, lat] = center;
      const currentCenter = map.current.getCenter();
      const distance = Math.sqrt(
        Math.pow(currentCenter.lng - lng, 2) + 
        Math.pow(currentCenter.lat - lat, 2)
      );
      
      // Only update if significantly different (more than ~1km)
      if (distance > 0.01) {
        map.current.setCenter(center);
      }
    }
  }, [center[0], center[1], mapLoaded]);

  return (
    <div className={className}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

export { mapboxgl };
