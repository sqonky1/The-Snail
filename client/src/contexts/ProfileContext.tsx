import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/database.types";
import { useAuth } from "@/_core/hooks/useAuth";
import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  createProfile: (
    username: string,
    homeLocation?: { lat: number; lng: number },
    userIdOverride?: string
  ) => Promise<Profile>;
  updateProfile: (updates: Partial<Profile>) => Promise<Profile>;
  updateHomeLocation: (lat: number, lng: number) => Promise<void>;
  purchaseSnail: () => Promise<unknown>;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
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

      if (homeLocation) {
        insertData.home_location = `POINT(${homeLocation.lng} ${homeLocation.lat})`;
      }

      const { data, error } = await supabase
        .from("profiles")
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;
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

    const { data, error } = await supabase.rpc("purchase_snail" as never);
    if (error) throw error;

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            salt_balance:
              typeof (data as { salt_balance?: number })?.salt_balance === "number"
                ? (data as { salt_balance: number }).salt_balance
                : prev.salt_balance,
            snail_inventory:
              typeof (data as { snail_inventory?: number })?.snail_inventory === "number"
                ? (data as { snail_inventory: number }).snail_inventory
                : prev.snail_inventory,
          }
        : prev
    );

    return data;
  }, [user]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        error,
        createProfile,
        updateProfile,
        updateHomeLocation,
        purchaseSnail,
        refresh: fetchProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
