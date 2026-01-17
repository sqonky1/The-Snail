import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MapboxMap, { mapboxgl } from "@/components/MapboxMap";
import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useFriendships } from "@/hooks/useFriendships";
import { Coordinates } from "@shared/ghostMovement";
import { parseSupabasePoint, createCirclePolygon } from "@/lib/geo";
import { fetchWalkingRoute } from "@/lib/routing";
import { Loader2 } from "lucide-react";

const MIN_RELEASE_DISTANCE_KM = 5;

function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function GardenTab() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { friends } = useFriendships();
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<Coordinates | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [deploying, setDeploying] = useState(false);

  // Get user's current GPS position
  useEffect(() => {
    if (!isReleaseModalOpen) return;

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
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
        alert("Unable to get your location. Please enable GPS.");
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
  }, [isReleaseModalOpen]);

  const handleMapLoad = (map: mapboxgl.Map) => {
    setMapInstance(map);

    // Disable dragging, keep zoom
    map.dragPan.disable();
    map.scrollZoom.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();

    // Add friend's home base zone source (purple circle)
    map.addSource("friend-home-zone", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "friend-home-fill",
      type: "fill",
      source: "friend-home-zone",
      paint: {
        "fill-color": "#A855F7",
        "fill-opacity": 0.3,
      },
    });

    map.addLayer({
      id: "friend-home-border",
      type: "line",
      source: "friend-home-zone",
      paint: {
        "line-color": "#A855F7",
        "line-width": 2,
      },
    });

    // Add route line source
    map.addSource("release-route", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "release-route-line",
      type: "line",
      source: "release-route",
      paint: {
        "line-color": "#22C55E",
        "line-width": 3,
        "line-dasharray": [2, 2],
      },
    });

    // Add flag markers source
    map.addSource("release-flags", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    // Load flag images
    map.loadImage("/green-flag.webp", (error, image) => {
      if (error) {
        console.error("Error loading green-flag:", error);
        return;
      }
      if (image && !map.hasImage("green-flag")) {
        map.addImage("green-flag", image, { pixelRatio: 2 });
      }
    });

    map.loadImage("/finish-flag.webp", (error, image) => {
      if (error) {
        console.error("Error loading finish-flag:", error);
        return;
      }
      if (image && !map.hasImage("finish-flag")) {
        map.addImage("finish-flag", image, { pixelRatio: 2 });
      }
    });

    // Add flag markers layer
    map.addLayer({
      id: "release-flag-markers",
      type: "symbol",
      source: "release-flags",
      layout: {
        "icon-image": ["get", "flagType"],
        "icon-size": 0.3,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });

    // Add user position marker source
    map.addSource("release-position", {
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

    // Load avatar image
    map.loadImage("/avatar.webp", (error, image) => {
      if (error) {
        console.error("Error loading avatar:", error);
        return;
      }
      if (image && !map.hasImage("avatar")) {
        map.addImage("avatar", image, { pixelRatio: 2 });
      }
    });

    // Add user marker layer
    map.addLayer({
      id: "release-marker",
      type: "symbol",
      source: "release-position",
      layout: {
        "icon-image": "avatar",
        "icon-size": 0.3,
        "icon-allow-overlap": true,
      },
    });
  };

  // Update user position on map
  useEffect(() => {
    if (!mapInstance || !userPosition) return;

    const source = mapInstance.getSource("release-position") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [userPosition.lng, userPosition.lat],
        },
      });

      // Center map on user position
      mapInstance.easeTo({
        center: [userPosition.lng, userPosition.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [mapInstance, userPosition]);

  // Handle zoom to keep centered on user position
  useEffect(() => {
    if (!mapInstance || !userPosition) return;

    const handleZoom = () => {
      if (userPosition) {
        mapInstance.setCenter([userPosition.lng, userPosition.lat]);
      }
    };

    mapInstance.on('zoom', handleZoom);
    
    return () => {
      mapInstance.off('zoom', handleZoom);
    };
  }, [mapInstance, userPosition]);

  // Get selected friend's home location
  const selectedFriendHomeLocation = useMemo(() => {
    if (!selectedFriend) return null;
    
    const friendship = friends.find(
      (f) => f.requester_id === selectedFriend || f.addressee_id === selectedFriend
    );
    
    if (!friendship) return null;
    
    const homeLocationRaw = friendship.requester_id === selectedFriend
      ? friendship.requester_home_location
      : friendship.addressee_home_location;
      
    return parseSupabasePoint(homeLocationRaw);
  }, [selectedFriend, friends]);

  // Update friend's home base zone (purple circle around their base)
  useEffect(() => {
    if (!mapInstance || !selectedFriendHomeLocation) {
      // Clear friend home zone if no friend selected
      const zoneSource = mapInstance?.getSource("friend-home-zone") as mapboxgl.GeoJSONSource;
      if (zoneSource) {
        zoneSource.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }

    const zoneSource = mapInstance.getSource("friend-home-zone") as mapboxgl.GeoJSONSource;
    if (zoneSource) {
      zoneSource.setData({
        type: "FeatureCollection",
        features: [createCirclePolygon(selectedFriendHomeLocation, 1000)], // 1km radius like in DeployTab
      });
    }
  }, [mapInstance, selectedFriendHomeLocation]);

  // Update route and flags when friend is selected
  useEffect(() => {
    if (!mapInstance || !userPosition || !selectedFriendHomeLocation) {
      // Clear route and flags if no friend selected
      const routeSource = mapInstance?.getSource("release-route") as mapboxgl.GeoJSONSource;
      const flagSource = mapInstance?.getSource("release-flags") as mapboxgl.GeoJSONSource;
      
      if (routeSource) {
        routeSource.setData({ type: "FeatureCollection", features: [] });
      }
      if (flagSource) {
        flagSource.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }

    // Calculate route
    const fetchRoute = async () => {
      try {
        const routeResult = await fetchWalkingRoute(userPosition, selectedFriendHomeLocation);
        
        // Update route line
        const routeSource = mapInstance.getSource("release-route") as mapboxgl.GeoJSONSource;
        if (routeSource && routeResult) {
          routeSource.setData({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: routeResult.coordinates.map((c) => [c.lng, c.lat]),
                },
              },
            ],
          });
        }

        // Update flags (green at start, finish at end)
        const flagSource = mapInstance.getSource("release-flags") as mapboxgl.GeoJSONSource;
        if (flagSource) {
          flagSource.setData({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { flagType: "green-flag" },
                geometry: {
                  type: "Point",
                  coordinates: [userPosition.lng, userPosition.lat],
                },
              },
              {
                type: "Feature",
                properties: { flagType: "finish-flag" },
                geometry: {
                  type: "Point",
                  coordinates: [selectedFriendHomeLocation.lng, selectedFriendHomeLocation.lat],
                },
              },
            ],
          });
        }
      } catch (error) {
        console.error("Error calculating route:", error);
      }
    };

    fetchRoute();
  }, [mapInstance, userPosition, selectedFriendHomeLocation]);

  const homeLocation = parseSupabasePoint(profile?.home_location);
  const distanceFromHome = userPosition && homeLocation
    ? calculateDistance(userPosition, homeLocation)
    : 0;
  const isValidDistance = distanceFromHome >= MIN_RELEASE_DISTANCE_KM;

  const friendsList = friends.map((friendship) => {
    const isFriendRequester = friendship.requester_id !== user?.id;
    return {
      id: isFriendRequester ? friendship.requester_id : friendship.addressee_id,
      username: isFriendRequester ? friendship.requester_username : friendship.addressee_username,
    };
  });

  const handleReleaseSnail = async () => {
    if (!selectedFriend || !userPosition || !isValidDistance) return;

    setDeploying(true);
    try {
      // TODO: Implement actual deployment logic
      console.log("Deploying snail from", userPosition, "to friend", selectedFriend);
      
      // Placeholder - will implement actual RPC call later
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsReleaseModalOpen(false);
      setSelectedFriend(null);
    } catch (error) {
      console.error("Error deploying snail:", error);
      alert("Failed to release snail");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="relative w-full h-screen">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/background.png)" }}
      />

      <div className="relative z-10 flex flex-col h-screen overflow-y-auto pb-24">
        <div className="flex-1 container mx-auto max-w-2xl px-4 py-6 space-y-6">
          <GameWidget>
            <div className="text-center space-y-4">
              <h2 className="font-gaegu font-bold text-3xl text-foreground">
                Garden
              </h2>
              <p className="text-muted-foreground">
                Release a snail to attack your friends!
              </p>
              <Button
                onClick={() => setIsReleaseModalOpen(true)}
                size="lg"
                className="w-full max-w-sm"
              >
                Release Snail
              </Button>
            </div>
          </GameWidget>
        </div>
      </div>

      <Dialog open={isReleaseModalOpen} onOpenChange={setIsReleaseModalOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Release Snail</DialogTitle>
            <DialogDescription>
              Choose a friend to send your snail to. You must be at least 5km from your home base.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-4">
            {/* Map */}
            <div className="flex-1 rounded-lg overflow-hidden border border-border">
              {userPosition ? (
                <MapboxMap
                  center={[userPosition.lng, userPosition.lat]}
                  zoom={14}
                  onMapLoad={handleMapLoad}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <p className="text-muted-foreground">Acquiring GPS location...</p>
                </div>
              )}
            </div>

            {/* Distance indicator */}
            {userPosition && homeLocation && (
              <div className={`p-3 rounded-lg border ${
                isValidDistance 
                  ? "bg-green-50 border-green-200 text-green-800" 
                  : "bg-red-50 border-red-200 text-red-800"
              }`}>
                <p className="text-sm font-medium">
                  {isValidDistance 
                    ? `✓ Distance from home: ${distanceFromHome.toFixed(1)}km` 
                    : `✗ Too close to home: ${distanceFromHome.toFixed(1)}km (need ${MIN_RELEASE_DISTANCE_KM}km)`
                  }
                </p>
              </div>
            )}

            {/* Friend selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Friend</label>
              <Select value={selectedFriend ?? undefined} onValueChange={setSelectedFriend}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a friend" />
                </SelectTrigger>
                <SelectContent>
                  {friendsList.map((friend) => (
                    <SelectItem key={friend.id} value={friend.id}>
                      {friend.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReleaseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReleaseSnail}
              disabled={!selectedFriend || !isValidDistance || deploying || !userPosition}
            >
              {deploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Releasing...
                </>
              ) : (
                "Release Snail"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav activeTab="garden" />
    </div>
  );
}
