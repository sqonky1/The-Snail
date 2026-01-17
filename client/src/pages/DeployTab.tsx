import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Plus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

interface Friend {
  id: number;
  name: string;
  email?: string;
}

interface ActiveSnail {
  id: number;
  targetName: string;
  progress: number; // 0-100
  remainingHours: number;
}

export default function DeployTab() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([
    { id: 1, name: "Alice", email: "alice@example.com" },
    { id: 2, name: "Bob", email: "bob@example.com" },
    { id: 3, name: "Charlie", email: "charlie@example.com" },
  ]);

  const [activeSnails, setActiveSnails] = useState<ActiveSnail[]>([
    { id: 1, targetName: "Player A", progress: 49.2, remainingHours: 24.4 },
    { id: 2, targetName: "Player B", progress: 39.7, remainingHours: 28.9 },
  ]);

  const handleAddFriend = () => {
    console.log("Add friend clicked");
    // TODO: Open add friend dialog
  };

  const handleDeploySnail = () => {
    console.log("Deploy snail clicked");
    // TODO: Open deployment modal
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-screen-sm mx-auto py-6 space-y-6">
        {/* Friends Section */}
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
            {friends.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No friends yet. Add friends to deploy snails!
              </p>
            ) : (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {friend.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {friend.name}
                      </p>
                      {friend.email && (
                        <p className="text-sm text-muted-foreground truncate">
                          {friend.email}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GameWidget>
        </div>

        {/* Your Snails Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Your Snails</h2>
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
            {activeSnails.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No active snails. Deploy one from the map!
              </p>
            ) : (
              <div className="space-y-4">
                {activeSnails.map((snail) => (
                  <div key={snail.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🐌</span>
                        <span className="font-medium text-foreground">
                          to {snail.targetName}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {snail.remainingHours.toFixed(1)}h
                      </span>
                    </div>
                    <div className="space-y-1">
                      <Progress value={snail.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">
                        {snail.progress.toFixed(1)}% · {(48 - snail.remainingHours).toFixed(1)}h / 48h
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
