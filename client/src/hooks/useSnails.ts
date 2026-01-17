import { supabase } from "@/lib/supabase";
import type { Snail, SnailArrivalResult, InterceptResult } from "@/lib/database.types";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";

export type EconomyEvent =
  | { type: "arrival"; data: Exclude<SnailArrivalResult, { already_processed: true }> }
  | { type: "intercept"; data: InterceptResult };

export function useSnails() {
  const { user } = useAuth();
  const [snails, setSnails] = useState<Snail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [economyEvents, setEconomyEvents] = useState<EconomyEvent[]>([]);

  const clearEconomyEvents = useCallback(() => {
    setEconomyEvents([]);
  }, []);

  const fetchSnails = useCallback(async () => {
    if (!user) {
      setSnails([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Sync expired snails and get economy events
    try {
      const { data: syncResults } = await supabase.rpc("check_and_sync_snails");
      if (syncResults && Array.isArray(syncResults)) {
        const arrivals = syncResults
          .filter((r): r is Exclude<SnailArrivalResult, { already_processed: true }> =>
            !("already_processed" in r)
          )
          .map((data) => ({ type: "arrival" as const, data }));
        if (arrivals.length > 0) {
          setEconomyEvents((prev) => [...prev, ...arrivals]);
        }
      }
    } catch {
      // Ignore if function doesn't exist yet
    }

    // Get all snails where user is sender or target
    const { data, error } = await supabase
      .from("snails")
      .select("*")
      .or(`sender_id.eq.${user.id},target_id.eq.${user.id}`)
      .eq("status", "moving")
      .order("start_time", { ascending: false });

    if (error) {
      setError(error);
      setLoading(false);
      return;
    }

    setSnails((data as Snail[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSnails();
  }, [fetchSnails]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("snails-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "snails",
        },
        () => {
          // Refresh on any change
          fetchSnails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSnails]);

  const deploySnail = useCallback(
    async (
      targetId: string,
      friendshipId: string,
      pathJson: [number, number][],
      arrivalTime: Date
    ) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("deploy_snail", {
        p_target_id: targetId,
        p_friendship_id: friendshipId,
        p_path_json: pathJson,
        p_arrival_time: arrivalTime.toISOString(),
      });

      if (error) throw error;
      await fetchSnails();
      return data as string;
    },
    [user, fetchSnails]
  );

  const interceptSnail = useCallback(
    async (snailId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("intercept_snail", {
        p_snail_id: snailId,
      });

      if (error) throw error;

      const result = data as InterceptResult;
      setEconomyEvents((prev) => [...prev, { type: "intercept", data: result }]);
      await fetchSnails();
      return result;
    },
    [user, fetchSnails]
  );

  // Get snails targeting the user (incoming threats)
  const incomingSnails = snails.filter((s) => s.target_id === user?.id);

  // Get snails sent by the user (outgoing attacks)
  const outgoingSnails = snails.filter((s) => s.sender_id === user?.id);

  return {
    snails,
    incomingSnails,
    outgoingSnails,
    loading,
    error,
    economyEvents,
    clearEconomyEvents,
    deploySnail,
    interceptSnail,
    refresh: fetchSnails,
  };
}
