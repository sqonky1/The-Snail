import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Edit } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ProfileTab() {
  const { user } = useAuth();
  const [saltBalance, setSaltBalance] = useState(150);
  const [snailsCount, setSnailsCount] = useState(5);
  const [homeZone, setHomeZone] = useState({ lat: 1.3521, lng: 103.8198 });

  const handleEditHome = () => {
    console.log("Edit home zone clicked");
    // TODO: Open home zone editor
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-screen-sm mx-auto py-6 space-y-6">
        {/* User Profile Header */}
        <div className="flex items-center gap-4">
          <Avatar className="w-20 h-20">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">
              {user?.name || "Player"}
            </h1>
            {user?.email && (
              <p className="text-sm text-muted-foreground">{user.email}</p>
            )}
          </div>
        </div>

        {/* Salt Balance Widget */}
        <GameWidget>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-2xl">🧂</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Salt Balance</p>
                <p className="text-2xl font-bold text-foreground">{saltBalance}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Earned from captures</p>
            </div>
          </div>
        </GameWidget>

        {/* Snails Inventory Widget */}
        <GameWidget>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-2xl">🐌</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Snails</p>
                <p className="text-2xl font-bold text-foreground">{snailsCount}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Available to deploy</p>
            </div>
          </div>
        </GameWidget>

        {/* Home Zone Preview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-foreground">Home Zone</h2>
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

          <GameWidget>
            <div className="space-y-3">
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                {/* Placeholder map preview */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
                <div className="relative z-10 text-center">
                  <MapPin className="w-12 h-12 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {homeZone.lat.toFixed(4)}, {homeZone.lng.toFixed(4)}
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

        {/* Stats Section */}
        <GameWidget>
          <h3 className="font-semibold text-foreground mb-3">Game Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">12</p>
              <p className="text-xs text-muted-foreground">Snails Deployed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">8</p>
              <p className="text-xs text-muted-foreground">Successful Captures</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">3</p>
              <p className="text-xs text-muted-foreground">Snails Lost</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-secondary">67%</p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
          </div>
        </GameWidget>
      </div>

      <BottomNav activeTab="profile" />
    </div>
  );
}
