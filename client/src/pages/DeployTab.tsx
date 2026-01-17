import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import MapboxMap, { mapboxgl } from "@/components/MapboxMap";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/_core/hooks/useAuth";
import { useFriendships } from "@/hooks/useFriendships";
import { useSnails } from "@/hooks/useSnails";
import { useProfile } from "@/hooks/useProfile";
import {
  createCirclePolygon,
  parseSupabasePoint,
  projectPointToCircle,
} from "@/lib/geo";
import type { Coordinates } from "@shared/ghostMovement";
import {
  calculateProgress,
  haversineDistance,
  getDefaultArrivalTime,
  getRemainingHours,
  coordinatesToPathJson,
} from "@shared/ghostMovement";
import {
  HOME_ZONE_RADIUS_KM,
  MIN_DEPLOY_DISTANCE_METERS,
  SNAIL_TRAVEL_DURATION_HOURS,
  SNAIL_FOCUS_EVENT,
  SNAIL_FOCUS_STORAGE_KEY,
} from "@shared/const";
import { fetchWalkingRoute } from "@/lib/routing";
import { Check, Loader2, Plus, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { FeatureCollection } from "geojson";
import { useLocation } from "wouter";

const emptyFeatureCollection = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});

export default function DeployTab() {
  const { user } = useAuth();
  const { outgoingSnails, incomingSnails, loading, deploySnail } = useSnails();
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    loading: friendsLoading,
    error: friendsError,
    searchResults,
    searching,
    searchProfiles,
    clearSearchResults,
    requestFriend,
    respondToRequest,
  } = useFriendships();
  const { profile } = useProfile();

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [selectedFriendshipId, setSelectedFriendshipId] = useState<string | null>(
    null
  );
  const [deploying, setDeploying] = useState(false);
  const [deployMap, setDeployMap] = useState<mapboxgl.Map | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<Coordinates | null>(null);
  const [routePreview, setRoutePreview] = useState<Coordinates[] | null>(null);
  const [routeStats, setRouteStats] = useState<{ distanceMeters: number } | null>(
    null
  );
  const [routingPreview, setRoutingPreview] = useState(false);

  const dropRequirementKm = MIN_DEPLOY_DISTANCE_METERS / 1000;

  const resetDeployState = useCallback(() => {
    setSelectedTarget(null);
    setRoutePreview(null);
    setRouteStats(null);
    setRoutingPreview(false);
  }, []);

  useEffect(() => {
    if (!isAddFriendOpen) {
      setSearchQuery("");
      setHasSearched(false);
      clearSearchResults();
    }
  }, [isAddFriendOpen, clearSearchResults]);

  const friendListEmpty =
    !friendsLoading &&
    friends.length === 0 &&
    incomingRequests.length === 0 &&
    outgoingRequests.length === 0;
  const [, navigate] = useLocation();

  const myHomeLocation = useMemo(
    () => parseSupabasePoint(profile?.home_location),
    [profile?.home_location]
  );

  const friendUsernames = useMemo(() => {
    const map = new Map<string, string>();
    friends.forEach((friendship) => {
      if (friendship.requester_id) {
        map.set(
          friendship.requester_id,
          friendship.requester_username || "Mystery Player"
        );
      }
      if (friendship.addressee_id) {
        map.set(
          friendship.addressee_id,
          friendship.addressee_username || "Mystery Player"
        );
      }
    });
    return map;
  }, [friends]);

  const getFriendUsername = (friendship: (typeof friends)[number]) => {
    if (friendship.requester_id === user?.id) {
      return friendship.addressee_username || "Mystery Player";
    }
    return friendship.requester_username || "Mystery Player";
  };

  const getUsernameForProfile = useCallback(
    (profileId: string) => friendUsernames.get(profileId) ?? "Mystery Player",
    [friendUsernames]
  );

  const hasSnailInventory = (profile?.snail_inventory ?? 0) > 0;

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

  const handleDeploySnail = () => {
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

  const handleDeployMapLoad = useCallback(
    (map: mapboxgl.Map) => {
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
    },
    []
  );

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

    if (selectedFriend?.homeLocation) {
      if (friendHomeSource) {
        friendHomeSource.setData({
          type: "FeatureCollection",
          features: [
            createCirclePolygon(
              selectedFriend.homeLocation,
              HOME_ZONE_RADIUS_KM * 1000
            ),
          ],
        });
      }

      if (dropBoundarySource) {
        dropBoundarySource.setData({
          type: "FeatureCollection",
          features: [
            createCirclePolygon(
              selectedFriend.homeLocation,
              MIN_DEPLOY_DISTANCE_METERS
            ),
          ],
        });
      }
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

  const handleSearchSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!searchQuery.trim()) {
      toast.error("Enter a username to search");
      return;
    }

    setHasSearched(true);

    try {
      await searchProfiles(searchQuery);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to search players";
      toast.error(message);
    }
  };

  const handleRequestFriend = async (targetId: string, username: string) => {
    setRequestingId(targetId);

    try {
      await requestFriend(targetId);
      toast.success(`Friend request sent to ${username}`);
      await searchProfiles(searchQuery);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send request";
      toast.error(message);
    } finally {
      setRequestingId(null);
    }
  };

  const handleRespond = async (friendshipId: string, accept: boolean) => {
    setRespondingId(friendshipId);

    try {
      await respondToRequest(friendshipId, accept);
      toast.success(
        accept ? "Friend request accepted" : "Friend request declined"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update request";
      toast.error(message);
    } finally {
      setRespondingId(null);
    }
  };

  const focusSnailOnMap = useCallback(
    (snailId: string) => {
      sessionStorage.setItem(SNAIL_FOCUS_STORAGE_KEY, snailId);
      window.dispatchEvent(
        new CustomEvent(SNAIL_FOCUS_EVENT, { detail: snailId })
      );
      navigate("/");
    },
    [navigate]
  );

  const formatRemainingTime = (remainingHours: number) => {
    const totalMinutes = Math.max(0, Math.floor(remainingHours * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m left`;
  };

  const outgoingSnailsWithProgress = outgoingSnails.map((snail) => {
    const startTime = new Date(snail.start_time);
    const arrivalTime = new Date(snail.arrival_time);
    const progress = calculateProgress(startTime, arrivalTime) * 100;
    const remainingHours = getRemainingHours(arrivalTime);

    return {
      ...snail,
      progress,
      remainingHours,
      target_username: getUsernameForProfile(snail.target_id),
    };
  });

  const incomingSnailsWithCountdown = incomingSnails.map((snail) => {
    const startTime = new Date(snail.start_time);
    const arrivalTime = new Date(snail.arrival_time);
    const progress = calculateProgress(startTime, arrivalTime) * 100;
    const remainingHours = getRemainingHours(arrivalTime);

    return {
      ...snail,
      progress,
      remainingHours,
      sender_username: getUsernameForProfile(snail.sender_id),
    };
  });

  return (
    <div className="relative min-h-screen pb-24">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: "url('/background.png')" }}
        aria-hidden="true"
      />
      <div className="relative z-10 container max-w-screen-sm mx-auto py-6 space-y-6">
        <GameWidget>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-gaegu font-bold text-3xl text-foreground">
              Friends
            </h2>
            <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full w-8 h-8 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a friend</DialogTitle>
                  <DialogDescription>
                    Search for a player by username to send a request.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <Input
                    placeholder="Enter username"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    autoFocus
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={searching}>
                      {searching ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Searching
                        </>
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
                <div className="space-y-2">
                  {hasSearched && searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No matching players found.
                    </p>
                  ) : (
                    searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {result.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-sm font-medium">
                            {result.username}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleRequestFriend(result.id, result.username)
                          }
                          disabled={requestingId === result.id}
                        >
                          {requestingId === result.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            "Add"
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

            {friendsError && (
              <p className="text-red-500 text-sm mb-2">
                {friendsError.message}
              </p>
            )}
            {friendsLoading ? (
              <p className="text-muted-foreground text-center py-4">
                Loading friends...
              </p>
            ) : friendListEmpty ? (
              <p className="text-muted-foreground text-center py-4">
                Add a friend to start trading snails.
              </p>
            ) : (
              <div className="space-y-5">
                {incomingRequests.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Incoming requests
                    </p>
                    {incomingRequests.map((friendship) => {
                      const username = getFriendUsername(friendship);
                      return (
                        <div
                          key={friendship.id}
                          className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{username}</p>
                              <p className="text-xs text-muted-foreground">
                                wants to connect
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={respondingId === friendship.id}
                              onClick={() =>
                                handleRespond(friendship.id, false)
                              }
                            >
                              {respondingId === friendship.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <X className="mr-2 h-4 w-4" />
                                  Decline
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                handleRespond(friendship.id, true)
                              }
                              disabled={respondingId === friendship.id}
                            >
                              {respondingId === friendship.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="mr-2 h-4 w-4" />
                                  Accept
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {outgoingRequests.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Pending requests
                    </p>
                    {outgoingRequests.map((friendship) => {
                      const username = getFriendUsername(friendship);
                      return (
                        <div
                          key={friendship.id}
                          className="flex items-center justify-between rounded-lg border border-border/70 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <p className="font-medium text-sm">{username}</p>
                          </div>
                          <Badge variant="outline">Waiting</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}

                {friends.length > 0 && (
                  <div className="space-y-2">
                    {friends.map((friendship) => {
                      const username = getFriendUsername(friendship);
                      return (
                        <div
                          key={friendship.id}
                          className="flex items-center justify-between rounded-lg border border-border/70 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{username}</p>
                              <p className="text-xs text-muted-foreground">
                                Ready for snail exchanges
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">Friend</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
        </GameWidget>

        <GameWidget>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-gaegu font-bold text-3xl text-foreground">
              Your Snails
            </h2>
            <Button
              onClick={handleDeploySnail}
              size="sm"
              variant="outline"
              className="rounded-full w-8 h-8 p-0"
            >
              <Plus className="w-4 h-4" />
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deploy a snail</DialogTitle>
                <DialogDescription>
                  Snails travel for {SNAIL_TRAVEL_DURATION_HOURS} hours regardless of
                  distance. Pick a friend to send one to.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-md border border-border/70 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Snails available</span>
                    <span className="font-semibold">
                      {profile?.snail_inventory ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Home base</span>
                    <span className="font-semibold">
                      {myHomeLocation ? "Ready" : "Not set"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {deployableFriends.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add a friend to send a snail.
                    </p>
                  ) : (
                    deployableFriends.map((friend) => {
                      const selected =
                        friend.friendshipId === selectedFriendshipId;
                      const disabled = !friend.homeLocation;
                      return (
                        <button
                          key={friend.friendshipId}
                          type="button"
                          onClick={() =>
                            !disabled &&
                            setSelectedFriendshipId(friend.friendshipId)
                          }
                          className={`w-full text-left rounded-md border px-3 py-2 transition ${
                            selected ? "border-primary bg-primary/5" : "border-border/70"
                          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                          disabled={disabled}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{friend.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {disabled
                                  ? "Home base not set"
                                  : "Home base ready"}
                              </p>
                            </div>
                            {selected && !disabled && (
                              <Check className="w-4 h-4 text-primary" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      Drop site
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ≥ {dropRequirementKm.toFixed(1)} km from base
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click the map to place a snail. Routes snap to
                    OpenStreetMap walking paths so players can intercept along
                    sidewalks.
                  </p>
                  <div className="relative h-72 rounded-lg border border-border/70 overflow-hidden">
                    {selectedFriend?.homeLocation ? (
                      <MapboxMap
                        center={deployMapCenter}
                        zoom={12}
                        onMapLoad={handleDeployMapLoad}
                        className="h-full w-full"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                        Ask this friend to set their home base before deploying.
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
                      Drop site distance: {targetDistanceFromFriendKm.toFixed(2)}{" "}
                      km from {selectedFriend?.username}'s base.
                    </p>
                  )}
                  {routeStats && (
                    <p className="text-xs text-muted-foreground">
                      Walking route length:{" "}
                      {(routeStats.distanceMeters / 1000).toFixed(2)} km
                    </p>
                  )}
                </div>
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

          {loading ? (
            <p className="text-muted-foreground text-center py-4">
              Loading...
            </p>
          ) : outgoingSnailsWithProgress.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No active snails. Deploy one to attack a friend!
            </p>
          ) : (
            <div className="space-y-4">
              {outgoingSnailsWithProgress.map((snail) => (
                <button
                  key={snail.id}
                  type="button"
                  onClick={() => focusSnailOnMap(snail.id)}
                  className="w-full text-left space-y-2 rounded-lg border border-border/70 p-3 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img
                              src="/snail-avatar.svg"
                              alt=""
                              className="h-10 w-10 rounded-full bg-white/70 p-1 shadow"
                            />
                            <span className="font-medium text-foreground">
                              To {snail.target_username}
                            </span>
                          </div>
                    <span className="text-sm text-muted-foreground">
                      {formatRemainingTime(snail.remainingHours)}
                    </span>
                  </div>
                    <Progress value={snail.progress} className="h-3" />
                </button>
              ))}
            </div>
          )}
        </GameWidget>

        <GameWidget>
          <div className="mb-4">
            <h2 className="font-gaegu font-bold text-3xl text-foreground">
              Snails incoming
            </h2>
          </div>
          {loading ? (
            <p className="text-muted-foreground text-center py-4">
              Loading...
            </p>
          ) : incomingSnailsWithCountdown.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No one is approaching your base.
            </p>
          ) : (
            <div className="space-y-4">
              {incomingSnailsWithCountdown.map((snail) => (
                <button
                  key={snail.id}
                  type="button"
                  onClick={() => focusSnailOnMap(snail.id)}
                  className="w-full text-left space-y-2 rounded-lg border border-border/70 p-3 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src="/snail-avatar.svg"
                          alt=""
                          className="h-10 w-10 rounded-full bg-white/70 p-1 shadow ring-2 ring-[var(--racing-red)]/50"
                        />
                        <span className="font-medium text-foreground">
                          From {snail.sender_username}
                        </span>
                      </div>
                    <span className="text-sm text-muted-foreground">
                      {formatRemainingTime(snail.remainingHours)}
                    </span>
                  </div>
                    <Progress value={snail.progress} className="h-3" />
                </button>
              ))}
            </div>
          )}
        </GameWidget>
      </div>

      <BottomNav activeTab="deploy" />
    </div>
  );
}
