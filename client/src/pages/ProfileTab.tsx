import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProfile } from "@/contexts/ProfileContext";
import { useState } from "react";

export default function ProfileTab() {
  const { user, logout } = useAuth();
  const { profile, loading, purchaseSnail } = useProfile();
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseFeedback, setPurchaseFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  const saltBalance = profile?.salt_balance ?? 0;
  const snailInventory = profile?.snail_inventory ?? 0;
  const canAffordSnail = saltBalance >= 100;

  const handleBuySnail = async () => {
    if (purchaseLoading) return;

    setPurchaseFeedback(null);
    setPurchaseLoading(true);
    try {
      await purchaseSnail();
      setPurchaseFeedback({
        type: "success",
        message: "Purchased 1 snail for 100 salt.",
      });
    } catch (error) {
      console.error("Failed to purchase snail:", error);
      setPurchaseFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to complete purchase. Try again.",
      });
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col">
      <div
        className="fixed inset-0 bg-cover bg-center opacity-40 pointer-events-none"
        style={{ backgroundImage: "url('/background.png')" }}
        aria-hidden="true"
      />
      <div className="relative flex-1 overflow-y-auto pb-24">
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
              <div className="flex flex-col gap-4 text-foreground">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚩</span>
                    <p className="text-base text-muted-foreground font-semibold">
                      Successful invasions
                    </p>
                  </div>
                  <p className="font-gaegu font-bold text-4xl">
                    {loading ? "..." : profile?.successful_invasions ?? 0}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛡️</span>
                    <p className="text-base text-muted-foreground font-semibold">
                      Snails intercepted
                    </p>
                  </div>
                  <p className="font-gaegu font-bold text-4xl">
                    {loading ? "..." : profile?.snails_intercepted ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </GameWidget>
        </div>

        {/* Shop */}
        <div className="space-y-3">
          <GameWidget>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-gaegu font-bold text-3xl text-foreground">
                  Shop
                </h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '22px' }}>🧂</span>
                    <p className="font-gaegu font-bold text-foreground" style={{ fontSize: '22px' }}>
                      {loading ? "..." : saltBalance}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '22px' }}>🐌</span>
                    <p className="font-gaegu font-bold text-foreground" style={{ fontSize: '22px' }}>
                      {loading ? "..." : snailInventory}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Buy Snails</p>
                  <p className="text-sm text-muted-foreground">
                    Trade 100 🧂 for 1 🐌 to keep your offensive lineup stocked.
                  </p>
                </div>
                <Button
                  onClick={handleBuySnail}
                  disabled={purchaseLoading || !canAffordSnail || loading}
                  className="w-full bg-transparent hover:bg-[#78350F]/10 text-black font-semibold text-lg border border-[#78350F]"
                >
                  {purchaseLoading ? "Processing..." : "Buy 1 🐌 — 100 🧂"}
                </Button>
                {!canAffordSnail && !loading && (
                  <p className="text-xs text-muted-foreground">
                    Earn more salt through deliveries or interceptions to keep buying snails.
                  </p>
                )}
                {purchaseFeedback && (
                  <p
                    className={`text-sm ${
                      purchaseFeedback.type === "error"
                        ? "text-red-500"
                        : "text-emerald-500"
                    }`}
                  >
                    {purchaseFeedback.message}
                  </p>
                )}
              </div>
            </div>
          </GameWidget>
        </div>

        </div>
      </div>
      <BottomNav activeTab="profile" />
    </div>
  );
}
