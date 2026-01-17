import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Edit, LogOut } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

export default function ProfileTab() {
  const { user, logout } = useAuth();
  const { profile, loading } = useProfile();

  const handleEditHome = () => {
    console.log("Edit home zone clicked");
    // TODO: Open home zone editor
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Get display name from profile or user metadata
  const displayName =
    profile?.username ||
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    "Player";

  return (
    <div className="fixed inset-0 flex flex-col">
      <div className="relative flex-1 overflow-y-auto pb-24">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('/background.png')" }}
          aria-hidden="true"
        />

        <div className="relative z-10 container max-w-screen-sm mx-auto py-6 space-y-6">
        <GameWidget>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src="/snail-avatar.svg" alt="Snail avatar" />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="font-gaegu font-bold text-3xl sm:text-4xl text-foreground tracking-wide leading-tight">
                {displayName}
              </h1>
              {user?.email && (
                <p className="text-sm text-muted-foreground">{user.email}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="ml-auto"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </GameWidget>

        {/* Achievements */}
        <div className="space-y-3">
          <GameWidget>
            <div className="space-y-3">
              <h2 className="font-gaegu font-bold text-3xl text-foreground">
                Achievements
              </h2>
              <div className="grid grid-cols-2 gap-4 text-foreground">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl">🚩</span>
                  </div>
                  <div>
                    <p className="text-base text-muted-foreground font-semibold">
                      Successful invasions
                    </p>
                    <p className="font-gaegu font-bold text-4xl">
                      {loading ? "..." : profile?.successful_invasions ?? 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-2xl">🛡️</span>
                  </div>
                  <div>
                    <p className="text-base text-muted-foreground font-semibold">
                      Snails thwarted
                    </p>
                    <p className="font-gaegu font-bold text-4xl">
                      {loading ? "..." : profile?.snails_thwarted ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </GameWidget>
        </div>

        {/* Shop */}
        <div className="space-y-3">
          <GameWidget>
            <div className="space-y-4">
              <h2 className="font-gaegu font-bold text-3xl text-foreground">
                Shop
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="text-2xl">🧂</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-semibold">
                      Salt balance
                    </p>
                    <p className="font-gaegu font-bold text-4xl text-foreground">
                      {loading ? "..." : profile?.salt_balance ?? 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl">🐌</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-semibold">
                      Snails
                    </p>
                    <p className="font-gaegu font-bold text-4xl text-foreground">
                      {loading ? "..." : profile?.snail_inventory ?? 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Buy</p>
                <p className="text-sm text-muted-foreground">
                  The salt economy shop is coming soon. Upgrades and boosts will appear here.
                </p>
              </div>
            </div>
          </GameWidget>
        </div>

        {/* Home Zone Preview */}
        <GameWidget>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-gaegu font-bold text-3xl text-foreground">Home Zone</h2>
            <Button
              onClick={handleEditHome}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </div>
          <div className="space-y-3">
            <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
              <div className="relative z-10 text-center">
                <MapPin className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {profile?.home_location
                    ? "Home location set"
                    : "No home location set"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Protection Radius</span>
              <span className="font-medium text-foreground">1.0 km</span>
            </div>
          </div>
        </GameWidget>
        </div>
      </div>
      <BottomNav activeTab="profile" />
    </div>
  );
}
