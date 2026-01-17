import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GameWidget from "@/components/GameWidget";
import { useProfile } from "@/hooks/useProfile";
import { useEffect, useState, FormEvent } from "react";
import { Redirect, useLocation } from "wouter";
import { toast } from "sonner";

type Coords = { lat: number; lng: number };

export default function SetupHomeBase() {
  const { user, loading: authLoading, logout } = useAuth();
  const { profile, createProfile, loading: profileLoading } = useProfile();
  const [, navigate] = useLocation();

  const [username, setUsername] = useState<string>(
    user?.user_metadata?.username ?? ""
  );
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(
      (prev: string) => prev || user.user_metadata?.username || ""
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocError(null);
      },
      (error) => {
        setLocError(
          error.message || "Unable to retrieve your location right now."
        );
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

  if (authLoading || profileLoading) {
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!coords) {
      toast.error("Waiting for your location...");
      return;
    }

    setSubmitting(true);
    try {
      await createProfile(username.trim(), coords);
      navigate("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create profile";
      toast.error(message);
    } finally {
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
            Choose a username and we&apos;ll anchor your base to your current
            location.
          </p>
        </div>

        <GameWidget>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Username
              </label>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="snailmaster42"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Home base location
              </p>
              {coords ? (
                <div className="text-sm text-muted-foreground rounded-md border border-border/70 p-3">
                  <p>Lat: {coords.lat.toFixed(5)}</p>
                  <p>Lng: {coords.lng.toFixed(5)}</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground rounded-md border border-dashed border-border/70 p-3">
                  {locError ?? "Fetching your location..."}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !coords}
            >
              {submitting ? "Saving..." : "Create Home Base"}
            </Button>
          </form>
        </GameWidget>
      </div>
    </div>
  );
}
