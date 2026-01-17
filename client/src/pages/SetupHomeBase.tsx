import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import GameWidget from "@/components/GameWidget";
import MapboxMap, { mapboxgl } from "@/components/MapboxMap";
import { useProfile } from "@/hooks/useProfile";
import { useEffect, useState, useCallback } from "react";
import { Redirect, useLocation } from "wouter";
import { toast } from "sonner";

type Coords = { lat: number; lng: number };

const DEFAULT_CENTER: [number, number] = [103.8198, 1.3521];

export default function SetupHomeBase() {
  const { user, loading: authLoading, logout } = useAuth();
  const { profile, createProfile, loading: profileLoading } = useProfile();
  const [, navigate] = useLocation();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [geolocating, setGeolocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const username = user?.user_metadata?.username ?? "";

  useEffect(() => {
    if (!user) return;
    if (!navigator.geolocation) {
      setGeolocating(false);
      setCoords({ lat: DEFAULT_CENTER[1], lng: DEFAULT_CENTER[0] });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setInitialCenter([userCoords.lng, userCoords.lat]);
        setCoords(userCoords);
        setGeolocating(false);
      },
      () => {
        setCoords({ lat: DEFAULT_CENTER[1], lng: DEFAULT_CENTER[0] });
        setGeolocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }, [user]);

  useEffect(() => {
    if (profile?.home_location) {
      navigate("/");
    }
  }, [profile?.home_location, navigate]);

  const handleMapLoad = useCallback(
    (loadedMap: mapboxgl.Map) => {
      const center = loadedMap.getCenter();
      const marker = new mapboxgl.Marker({
        color: "#3B82F6",
        draggable: true,
      })
        .setLngLat([center.lng, center.lat])
        .addTo(loadedMap);

      setCoords({ lat: center.lat, lng: center.lng });

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        setCoords({ lat: lngLat.lat, lng: lngLat.lng });
      });
    },
    []
  );


  if ((authLoading || profileLoading) && !submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (profile?.home_location) {
    return <Redirect to="/" />;
  }

  const handleSubmit = async () => {
    if (!username.trim()) {
      toast.error("Username is required. Please sign up again.");
      return;
    }
    if (!coords) {
      toast.error("Please select a location on the map.");
      return;
    }

    setSubmitting(true);
    try {
      await createProfile(username.trim(), coords);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create profile";
      toast.error(message);
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sign out";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Not you? Sign out
          </Button>
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Set up your home base
          </h1>
          <p className="text-muted-foreground">
            Drag the marker to set your home base location.
          </p>
        </div>

        <GameWidget>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Home base location
              </p>
              <div className="relative h-72 rounded-lg border border-border/70 overflow-hidden">
                {geolocating ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Detecting your location...
                  </div>
                ) : (
                  <MapboxMap
                    center={initialCenter}
                    zoom={15}
                    onMapLoad={handleMapLoad}
                    className="h-full w-full"
                  />
                )}
              </div>
              {coords && (
                <div className="text-xs text-muted-foreground text-center">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </div>
              )}
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={submitting || !coords || geolocating}
              onClick={handleSubmit}
            >
              {submitting ? "Saving..." : "Create Home Base"}
            </Button>
          </div>
        </GameWidget>
      </div>
    </div>
  );
}
