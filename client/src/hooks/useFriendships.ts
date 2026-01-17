import { useAuth } from "@/_core/hooks/useAuth";
import type { Friendship } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

export type FriendshipWithDetails = Friendship & {
  requester_username: string;
  addressee_username: string;
};

export type ProfileSearchResult = {
  id: string;
  username: string;
};

export function useFriendships() {
  const { user } = useAuth();
  const [friendships, setFriendships] = useState<FriendshipWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>(
    []
  );
  const [searching, setSearching] = useState(false);

  const fetchFriendships = useCallback(async () => {
    if (!user) {
      setFriendships([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc(
      "get_friendships_with_profiles"
    );

    if (error) {
      setError(error);
      setFriendships([]);
    } else {
      setError(null);
      const normalized = (data ?? []).map((friendship) => ({
        ...friendship,
        requester_username:
          friendship.requester_username ?? "Mystery Player",
        addressee_username:
          friendship.addressee_username ?? "Mystery Player",
      }));
      setFriendships(normalized as FriendshipWithDetails[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFriendships();
  }, [fetchFriendships]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`friendships-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          fetchFriendships();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchFriendships]);

  const searchProfiles = useCallback(
    async (query: string) => {
      const trimmed = query.trim();

      if (!trimmed) {
        setSearchResults([]);
        return [];
      }

      setSearching(true);
      const { data, error } = await supabase.rpc("search_profiles", {
        p_query: trimmed,
      });
      setSearching(false);

      if (error) {
        setError(error);
        throw error;
      }

      const results = (data as ProfileSearchResult[]) ?? [];
      setSearchResults(results);
      return results;
    },
    []
  );

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
  }, []);

  const requestFriend = useCallback(
    async (targetId: string) => {
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.rpc("request_friend", {
        p_target_id: targetId,
      });

      if (error) {
        setError(error);
        throw error;
      }

      await fetchFriendships();
      return data as string | null;
    },
    [user, fetchFriendships]
  );

  const respondToRequest = useCallback(
    async (friendshipId: string, accept: boolean) => {
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { error } = await supabase.rpc("respond_friend_request", {
        p_friendship_id: friendshipId,
        p_accept: accept,
      });

      if (error) {
        setError(error);
        throw error;
      }

      await fetchFriendships();
    },
    [user, fetchFriendships]
  );

  const friends = useMemo(
    () => friendships.filter((friendship) => friendship.status === "friends"),
    [friendships]
  );

  const incomingRequests = useMemo(
    () =>
      friendships.filter(
        (friendship) =>
          friendship.status === "requested" &&
          friendship.addressee_id === user?.id
      ),
    [friendships, user?.id]
  );

  const outgoingRequests = useMemo(
    () =>
      friendships.filter(
        (friendship) =>
          friendship.status === "requested" &&
          friendship.requester_id === user?.id
      ),
    [friendships, user?.id]
  );

  return {
    friendships,
    friends,
    incomingRequests,
    outgoingRequests,
    loading,
    error,
    searchResults,
    searching,
    searchProfiles,
    clearSearchResults,
    requestFriend,
    respondToRequest,
    refresh: fetchFriendships,
  };
}
