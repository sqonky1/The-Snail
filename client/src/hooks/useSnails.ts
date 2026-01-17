import { supabase } from "@/lib/supabase";
import type { Snail, SnailStatus } from "@/lib/database.types";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";

export function useSnails() {
  const { user } = useAuth();
  const [snails, setSnails] = useState<Snail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSnails = useCallback(async () => {
    if (!user) {
      setSnails([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // First, sync any expired snails
    try {
      await supabase.rpc("check_and_sync_snails");
    } catch {
      // Ignore if function doesn't exist
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

      const snailData: Record<string, unknown> = {
        sender_id: user.id,
        target_id: targetId,
        friendship_id: friendshipId,
        path_json: pathJson,
        arrival_time: arrivalTime.toISOString(),
        status: "moving",
      };

      const { data, error } = await supabase
        .from("snails")
        .insert(snailData as never)
        .select()
        .single();

      if (error) throw error;
      await fetchSnails();
      return data as Snail;
    },
    [user, fetchSnails]
  );

  const interceptSnail = useCallback(async () => {
    throw new Error("Interception is temporarily disabled.");
  }, []);

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
    deploySnail,
    interceptSnail,
    refresh: fetchSnails,
  };
}
