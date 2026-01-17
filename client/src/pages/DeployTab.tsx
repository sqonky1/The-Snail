import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Plus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSnails } from "@/hooks/useSnails";
import {
  calculateProgress,
  getRemainingHours,
} from "@shared/ghostMovement";

export default function DeployTab() {
  const { user } = useAuth();
  const { outgoingSnails, loading } = useSnails();

  const handleAddFriend = () => {
    console.log("Add friend clicked");
    // TODO: Open add friend dialog
  };

  const handleDeploySnail = () => {
    console.log("Deploy snail clicked");
    // TODO: Open deployment modal
  };

  // Calculate progress and remaining time for each snail
  const snailsWithProgress = outgoingSnails.map((snail) => {
    const startTime = new Date(snail.start_time);
    const arrivalTime = new Date(snail.arrival_time);
    const progress = calculateProgress(startTime, arrivalTime) * 100;
    const remainingHours = getRemainingHours(arrivalTime);

    return {
      ...snail,
      progress,
      remainingHours,
    };
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-screen-sm mx-auto py-6 space-y-6">
        {/* Friends Section - Placeholder for now */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Friends</h2>
            <Button
              onClick={handleAddFriend}
              size="sm"
              variant="outline"
              className="rounded-full w-8 h-8 p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <GameWidget>
            <p className="text-muted-foreground text-center py-4">
              Friend system coming soon!
            </p>
          </GameWidget>
        </div>

        {/* Your Snails Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">
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

          <GameWidget>
            {loading ? (
              <p className="text-muted-foreground text-center py-4">
                Loading...
              </p>
            ) : snailsWithProgress.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No active snails. Deploy one to attack a friend!
              </p>
            ) : (
              <div className="space-y-4">
                {snailsWithProgress.map((snail) => (
                  <div key={snail.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🐌</span>
                        <span className="font-medium text-foreground">
                          Target: {snail.target_id.slice(0, 8)}...
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {snail.remainingHours.toFixed(1)}h left
                      </span>
                    </div>
                    <div className="space-y-1">
                      <Progress value={snail.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">
                        {snail.progress.toFixed(1)}% complete
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GameWidget>
        </div>
      </div>

      <BottomNav activeTab="deploy" />
    </div>
  );
}
