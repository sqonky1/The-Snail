import BottomNav from "@/components/BottomNav";
import MapboxMap, { mapboxgl } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { useFriendships } from "@/hooks/useFriendships";
import { useSnails } from "@/hooks/useSnails";
import { useProfile } from "@/contexts/ProfileContext";
import {
  createCirclePolygon,
  parseSupabasePoint,
  projectPointToCircle,
} from "@/lib/geo";
import type { Coordinates } from "@shared/ghostMovement";
import {
  haversineDistance,
  getDefaultArrivalTime,
  coordinatesToPathJson,
} from "@shared/ghostMovement";
import {
  HOME_ZONE_RADIUS_KM,
  MIN_DEPLOY_DISTANCE_METERS,
  SNAIL_TRAVEL_DURATION_HOURS,
} from "@shared/const";
import { fetchWalkingRoute } from "@/lib/routing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { FeatureCollection } from "geojson";

const emptyFeatureCollection = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});

export default function GardenTab() {
  const { user } = useAuth();
  const { deploySnail } = useSnails();
  const { friends } = useFriendships();
  const { profile } = useProfile();

  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [selectedFriendshipId, setSelectedFriendshipId] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployMap, setDeployMap] = useState<mapboxgl.Map | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<Coordinates | null>(null);
  const [routePreview, setRoutePreview] = useState<Coordinates[] | null>(null);
  const [routeStats, setRouteStats] = useState<{ distanceMeters: number } | null>(null);
  const [routingPreview, setRoutingPreview] = useState(false);

  const dropRequirementKm = MIN_DEPLOY_DISTANCE_METERS / 1000;

  const resetDeployState = useCallback(() => {
    setSelectedTarget(null);
    setRoutePreview(null);
    setRouteStats(null);
    setRoutingPreview(false);
  }, []);

  const myHomeLocation = useMemo(
    () => parseSupabasePoint(profile?.home_location),
    [profile?.home_location]
  );

  const getFriendUsername = (friendship: (typeof friends)[number]) => {
    if (friendship.requester_id === user?.id) {
      return friendship.addressee_username || "Mystery Player";
    }
    return friendship.requester_username || "Mystery Player";
  };

  const snailInventory = profile?.snail_inventory ?? 0;
  const hasSnailInventory = snailInventory > 0;

  const deployableFriends = useMemo(
    () =>
      friends.map((friendship) => {
        const isRequester = friendship.requester_id === user?.id;
        const profileId = isRequester
          ? friendship.addressee_id
          : friendship.requester_id;
        const username = getFriendUsername(friendship);
        const homeLocation = parseSupabasePoint(
          isRequester
            ? friendship.addressee_home_location
            : friendship.requester_home_location
        );

        return {
          friendshipId: friendship.id,
          profileId,
          username,
          homeLocation,
        };
      }),
    [friends, user?.id]
  );

  const selectedFriend = useMemo(
    () =>
      deployableFriends.find(
        (friend) => friend.friendshipId === selectedFriendshipId
      ),
    [deployableFriends, selectedFriendshipId]
  );

  const targetDistanceFromFriendKm = useMemo(() => {
    if (!selectedFriend?.homeLocation || !selectedTarget) {
      return null;
    }

    return (
      haversineDistance(selectedFriend.homeLocation, selectedTarget) / 1000
    );
  }, [selectedFriend?.homeLocation, selectedTarget]);

  const deployMapCenter = useMemo<[number, number] | undefined>(() => {
    if (selectedFriend?.homeLocation) {
      return [
        selectedFriend.homeLocation.lng,
        selectedFriend.homeLocation.lat,
      ];
    }
    if (myHomeLocation) {
      return [myHomeLocation.lng, myHomeLocation.lat];
    }
    return undefined;
  }, [selectedFriend?.homeLocation, myHomeLocation]);

  useEffect(() => {
    if (deployableFriends.length === 0) {
      setSelectedFriendshipId(null);
      return;
    }

    if (
      selectedFriendshipId &&
      deployableFriends.some((f) => f.friendshipId === selectedFriendshipId)
    ) {
      return;
    }

    const fallback =
      deployableFriends.find((f) => f.homeLocation) ?? deployableFriends[0];
    setSelectedFriendshipId(fallback?.friendshipId ?? null);
  }, [deployableFriends, selectedFriendshipId]);

  useEffect(() => {
    setSelectedTarget(null);
    setRoutePreview(null);
    setRouteStats(null);
    setRoutingPreview(false);
  }, [selectedFriendshipId]);

  const handleOpenDeploy = () => {
    if (deployableFriends.length === 0) {
      toast.error("Add a friend before deploying a snail.");
      return;
    }

    if (!profile) {
      toast.error("Profile not loaded yet.");
      return;
    }

    if (!myHomeLocation) {
      toast.error("Set your home base before deploying snails.");
      return;
    }

    if (!hasSnailInventory) {
      toast.error("You have no snails available.");
      return;
    }

    const fallback =
      deployableFriends.find((f) => f.homeLocation) ?? deployableFriends[0];
    resetDeployState();
    setSelectedFriendshipId(fallback?.friendshipId ?? null);
    setIsDeployDialogOpen(true);
  };

  const handleConfirmDeploy = async () => {
    if (!profile) {
      toast.error("Profile not loaded yet.");
      return;
    }

    if (!myHomeLocation) {
      toast.error("Set your home base before deploying snails.");
      return;
    }

    if (!hasSnailInventory) {
      toast.error("You have no snails available.");
      return;
    }

    if (!selectedFriend) {
      toast.error("Select a friend to target.");
      return;
    }

    if (!selectedFriend.homeLocation) {
      toast.error("This friend has not set their home base yet.");
      return;
    }

    if (!selectedTarget || !routePreview) {
      toast.error("Select a drop site to generate a walking route.");
      return;
    }

    const distanceFromFriend = haversineDistance(
      selectedFriend.homeLocation,
      selectedTarget
    );
    if (distanceFromFriend < MIN_DEPLOY_DISTANCE_METERS) {
      toast.error(
        `Pick a point at least ${dropRequirementKm.toFixed(
          1
        )}km from ${selectedFriend.username}'s base.`
      );
      return;
    }

    setDeploying(true);
    try {
      const pathJson = coordinatesToPathJson(routePreview);
      const arrivalTime = getDefaultArrivalTime();

      await deploySnail(
        selectedFriend.profileId,
        selectedFriend.friendshipId,
        pathJson,
        arrivalTime
      );
      toast.success(`Snail deployed to ${selectedFriend.username}`);
      setIsDeployDialogOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to deploy snail";
      toast.error(message);
    } finally {
      setDeploying(false);
    }
  };

  const handleDeployMapLoad = useCallback((map: mapboxgl.Map) => {
    setDeployMap(map);
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.addSource("deploy-friend-home", {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
    map.addLayer({
      id: "deploy-friend-home-fill",
      type: "fill",
      source: "deploy-friend-home",
      paint: {
        "fill-color": "#C084FC",
        "fill-opacity": 0.2,
      },
    });
    map.addLayer({
      id: "deploy-friend-home-outline",
      type: "line",
      source: "deploy-friend-home",
      paint: {
        "line-color": "#A855F7",
        "line-width": 2,
      },
    });

    map.addSource("deploy-drop-boundary", {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
    map.addLayer({
      id: "deploy-drop-boundary-outline",
      type: "line",
      source: "deploy-drop-boundary",
      paint: {
        "line-color": "#FBBF24",
        "line-width": 2,
        "line-dasharray": [1.5, 1.5],
      },
    });

    map.addSource("deploy-target-point", {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
    map.addLayer({
      id: "deploy-target-circle",
      type: "circle",
      source: "deploy-target-point",
      paint: {
        "circle-radius": 8,
        "circle-color": "#22C55E",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
      },
    });

    map.addSource("deploy-route-line", {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
    map.addLayer({
      id: "deploy-route",
      type: "line",
      source: "deploy-route-line",
      paint: {
        "line-color": "#0EA5E9",
        "line-width": 3,
      },
    });
  }, []);

  useEffect(() => {
    if (!deployMap || !isDeployDialogOpen) return;

    const handleClick = (event: mapboxgl.MapMouseEvent) => {
      if (!myHomeLocation) {
        toast.error("Set your home base before deploying snails.");
        return;
      }
      if (!selectedFriend?.homeLocation) {
        toast.error("Ask this friend to set their home base first.");
        return;
      }

      const point: Coordinates = {
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      };
      const distanceFromFriend = haversineDistance(
        selectedFriend.homeLocation,
        point
      );

      if (distanceFromFriend < MIN_DEPLOY_DISTANCE_METERS) {
        toast.error(
          `Drop site must be at least ${dropRequirementKm.toFixed(
            1
          )}km from ${selectedFriend.username}'s base.`
        );
        return;
      }

      setSelectedTarget(point);
    };

    deployMap.on("click", handleClick);
    return () => {
      deployMap.off("click", handleClick);
    };
  }, [
    deployMap,
    selectedFriend?.homeLocation,
    selectedFriend?.username,
    myHomeLocation,
    dropRequirementKm,
    isDeployDialogOpen,
  ]);

  useEffect(() => {
    if (!deployMap) return;

    const friendHomeSource = deployMap.getSource(
      "deploy-friend-home"
    ) as mapboxgl.GeoJSONSource | undefined;
    const dropBoundarySource = deployMap.getSource(
      "deploy-drop-boundary"
    ) as mapboxgl.GeoJSONSource | undefined;

    if (!friendHomeSource || !dropBoundarySource) return;

    if (selectedFriend?.homeLocation) {
      friendHomeSource.setData({
        type: "FeatureCollection",
        features: [
          createCirclePolygon(
            selectedFriend.homeLocation,
            HOME_ZONE_RADIUS_KM * 1000
          ),
        ],
      });

      dropBoundarySource.setData({
        type: "FeatureCollection",
        features: [
          createCirclePolygon(
            selectedFriend.homeLocation,
            MIN_DEPLOY_DISTANCE_METERS
          ),
        ],
      });
    } else {
      friendHomeSource?.setData(emptyFeatureCollection());
      dropBoundarySource?.setData(emptyFeatureCollection());
    }
  }, [deployMap, selectedFriend?.homeLocation]);

  useEffect(() => {
    if (!deployMap) return;

    const targetSource = deployMap.getSource(
      "deploy-target-point"
    ) as mapboxgl.GeoJSONSource | undefined;
    if (!targetSource) return;

    if (selectedTarget) {
      targetSource.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: [selectedTarget.lng, selectedTarget.lat],
            },
          },
        ],
      });
    } else {
      targetSource.setData(emptyFeatureCollection());
    }
  }, [deployMap, selectedTarget]);

  useEffect(() => {
    if (!deployMap) return;

    const routeSource = deployMap.getSource(
      "deploy-route-line"
    ) as mapboxgl.GeoJSONSource | undefined;
    if (!routeSource) return;

    if (routePreview) {
      routeSource.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: routePreview.map((coord) => [coord.lng, coord.lat]),
            },
          },
        ],
      });
    } else {
      routeSource.setData(emptyFeatureCollection());
    }
  }, [deployMap, routePreview]);

  useEffect(() => {
    if (!selectedTarget || !selectedFriend?.homeLocation) {
      setRoutePreview(null);
      setRouteStats(null);
      setRoutingPreview(false);
      return;
    }

    let cancelled = false;
    setRoutingPreview(true);

    const landingPoint = projectPointToCircle(
      selectedFriend.homeLocation,
      selectedTarget
    );

    fetchWalkingRoute(selectedTarget, landingPoint)
      .then((route) => {
        if (cancelled) return;
        const adjusted =
          route.coordinates.length === 0
            ? [selectedTarget, landingPoint]
            : route.coordinates.map((coord, index, arr) => {
                if (index === 0) return selectedTarget;
                if (index === arr.length - 1) return landingPoint;
                return coord;
              });

        setRoutePreview(adjusted);
        setRouteStats({ distanceMeters: route.distance });
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to plan a walking route";
        toast.error(message);
        setRoutePreview(null);
        setRouteStats(null);
      })
      .finally(() => {
        if (!cancelled) {
          setRoutingPreview(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTarget, selectedFriend?.homeLocation]);

  return (
    <div className="relative min-h-screen pb-24">
      <div
        className="fixed inset-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/garden.webp')" }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen pb-24">
        <Button
          onClick={handleOpenDeploy}
          className="rounded-xl px-12 py-6 text-xl font-bold text-black hover:opacity-90"
          style={{ backgroundColor: '#FFF696' }}
        >
          Release Snails
        </Button>
      </div>

      <Dialog
        open={isDeployDialogOpen}
        onOpenChange={(open) => {
          setIsDeployDialogOpen(open);
          if (!open) {
            setDeploying(false);
            resetDeployState();
            setDeployMap(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Deploy a snail</DialogTitle>
            <DialogDescription>
              Snails travel for {SNAIL_TRAVEL_DURATION_HOURS} hours regardless of distance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative h-64 rounded-lg border border-border/70 overflow-hidden">
              {selectedFriend?.homeLocation ? (
                <MapboxMap
                  center={deployMapCenter}
                  zoom={12}
                  onMapLoad={handleDeployMapLoad}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  Select a friend to see their home base on the map.
                </div>
              )}
              {routingPreview && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>

            {selectedTarget && targetDistanceFromFriendKm !== null && (
              <p className="text-xs text-muted-foreground">
                Drop site: {targetDistanceFromFriendKm.toFixed(2)} km from {selectedFriend?.username}'s base
                {routeStats && ` | Route: ${(routeStats.distanceMeters / 1000).toFixed(2)} km`}
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Target</p>
              {deployableFriends.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add a friend to send a snail.
                </p>
              ) : (
                <Select
                  value={selectedFriendshipId ?? undefined}
                  onValueChange={(value) => setSelectedFriendshipId(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a friend" />
                  </SelectTrigger>
                  <SelectContent>
                    {deployableFriends.map((friend) => (
                      <SelectItem
                        key={friend.friendshipId}
                        value={friend.friendshipId}
                        disabled={!friend.homeLocation}
                      >
                        {friend.username}
                        {!friend.homeLocation && " (no home base)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/70 p-3">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px' }}>🐌</span>
                <p className="text-sm text-muted-foreground">Snails available</p>
              </div>
              <p className="font-gaegu font-bold text-2xl text-foreground">
                {snailInventory}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Click the map to place your snail. Drop site must be at least {dropRequirementKm.toFixed(1)} km from their base.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeployDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDeploy}
              disabled={
                deploying ||
                !selectedFriend?.homeLocation ||
                !myHomeLocation ||
                !hasSnailInventory ||
                !routePreview ||
                !selectedTarget ||
                routingPreview
              }
            >
              {deploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                "Deploy"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav activeTab="garden" />
    </div>
  );
}
