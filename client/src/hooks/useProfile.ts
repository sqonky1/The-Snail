import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/database.types";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      // Profile might not exist yet
      if (error.code === "PGRST116") {
        setProfile(null);
      } else {
        setError(error);
      }
    } else {
      setProfile(data as Profile);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const createProfile = useCallback(
    async (
      username: string,
      homeLocation?: { lat: number; lng: number },
      userIdOverride?: string
    ) => {
      const userId = userIdOverride ?? user?.id;
      if (!userId) throw new Error("Not authenticated");

      const insertData: Record<string, unknown> = {
        id: userId,
        username,
      };

      // Convert to PostGIS point if provided
      if (homeLocation) {
        insertData.home_location = `POINT(${homeLocation.lng} ${homeLocation.lat})`;
      }

      const { data, error } = await supabase
        .from("profiles")
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;
      // If we created profile for current user, update state
      if (!userIdOverride || userIdOverride === user?.id) {
        setProfile(data as Profile);
      }
      return data as Profile;
    },
    [user]
  );

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update(updates as never)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data as Profile);
      return data as Profile;
    },
    [user]
  );

  const updateHomeLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ home_location: `POINT(${lng} ${lat})` } as never)
        .eq("id", user.id);

      if (error) throw error;
      await fetchProfile();
    },
    [user, fetchProfile]
  );

  const purchaseSnail = useCallback(async () => {
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase.rpc("purchase_snail");
    if (error) throw error;

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            salt_balance:
              typeof data?.salt_balance === "number"
                ? data.salt_balance
                : prev.salt_balance,
            snail_inventory:
              typeof data?.snail_inventory === "number"
                ? data.snail_inventory
                : prev.snail_inventory,
          }
        : prev
    );

    return data;
  }, [user]);

  return {
    profile,
    loading,
    error,
    createProfile,
    updateProfile,
    updateHomeLocation,
    purchaseSnail,
    refresh: fetchProfile,
  };
}
