import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
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
import {
  calculateProgress,
  getRemainingHours,
} from "@shared/ghostMovement";
import {
  SNAIL_FOCUS_EVENT,
  SNAIL_FOCUS_STORAGE_KEY,
} from "@shared/const";
import { Check, Loader2, Plus, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function DeployTab() {
  const { user } = useAuth();
  const { outgoingSnails, incomingSnails, loading } = useSnails();
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

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [, navigate] = useLocation();

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

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

      clearSearchResults();
      setSearchQuery("");
      setHasSearched(false);
      setIsAddFriendOpen(false);
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
        className="fixed inset-0 bg-cover bg-center opacity-40 pointer-events-none"
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
          <div className="mb-4">
            <h2 className="font-gaegu font-bold text-3xl text-foreground">
              Your Snails
            </h2>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-4">
              Loading...
            </p>
          ) : outgoingSnailsWithProgress.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No active snails. Deploy one from the Garden tab!
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
                        src="/user-snail.webp"
                        alt=""
                        className="h-10 w-10"
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
                        src="/enemy-snail.webp"
                        alt=""
                        className="h-10 w-10"
                      />
                      <span className="font-medium text-foreground">
                        From {snail.sender_username}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatRemainingTime(snail.remainingHours)}
                    </span>
                  </div>
                  <Progress value={snail.progress} variant="danger" className="h-3" />
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
