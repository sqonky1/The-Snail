import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/login" } =
    options ?? {};

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        error: error ?? null,
        isAuthenticated: !!session?.user,
      });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        error: null,
        isAuthenticated: !!session?.user,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect if unauthenticated
  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, state.loading, state.user]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      username: string
    ): Promise<User | null> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      });
      if (error) throw error;
      return data.user ?? null;
    },
    [],
  );

  const signInWithOAuth = useCallback(
    async (provider: "google" | "github" | "apple") => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    },
    []
  );

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const refresh = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();
    if (error) throw error;
    return session;
  }, []);

  return {
    ...state,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    logout,
    refresh,
  };
}
