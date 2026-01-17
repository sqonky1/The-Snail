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

    const palette = {
      background: "#F9FAFB",
      land: "#F9FAFB",
      park: "#EDEFF1",
      water: "#E8E3DC",
      road: "#DCDCDD",
      roadOutline: "#BFC1C5",
      text: "#1F2937",
      textHalo: "#FFFFFF",
    };

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
          const sourceLayer = (layer as unknown as { "source-layer"?: string })["source-layer"] ?? "";
          if (layer.type === "background") {
            map.current?.setPaintProperty(layer.id, "background-color", palette.background);
          } else if (layer.type === "line") {
            if (sourceLayer.includes("road") || layer.id.includes("road")) {
              map.current?.setPaintProperty(layer.id, "line-color", palette.road);
              map.current?.setPaintProperty(layer.id, "line-width", 0.8);
            } else if (sourceLayer.includes("rail") || layer.id.includes("rail")) {
              map.current?.setPaintProperty(layer.id, "line-color", palette.roadOutline);
            } else {
              map.current?.setPaintProperty(layer.id, "line-color", "#D8CFC6");
            }
          } else if (layer.type === "fill") {
            if (sourceLayer.includes("water")) {
              map.current?.setPaintProperty(layer.id, "fill-color", palette.water);
              map.current?.setPaintProperty(layer.id, "fill-opacity", 1);
            } else if (sourceLayer.includes("landcover") || sourceLayer.includes("landuse") || sourceLayer.includes("park")) {
              map.current?.setPaintProperty(layer.id, "fill-color", palette.park);
              map.current?.setPaintProperty(layer.id, "fill-opacity", 0.7);
            } else if (sourceLayer.includes("building")) {
              map.current?.setPaintProperty(layer.id, "fill-color", "#EBDDCF");
              map.current?.setPaintProperty(layer.id, "fill-opacity", 0.8);
            } else {
              map.current?.setPaintProperty(layer.id, "fill-color", palette.land);
              map.current?.setPaintProperty(layer.id, "fill-opacity", 0.8);
            }
          } else if (layer.type === "symbol") {
            // Text in dark charcoal
            if (layer.layout && "text-field" in layer.layout) {
              map.current?.setPaintProperty(layer.id, "text-color", palette.text);
              map.current?.setPaintProperty(layer.id, "text-halo-color", palette.textHalo);
              map.current?.setPaintProperty(layer.id, "text-halo-width", 1);
            }
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
