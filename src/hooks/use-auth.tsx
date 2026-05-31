"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { auth as apiAuth } from "@/lib/api/client";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  beta_features: string[];
}

interface AuthContextValue {
  user: any | null;
  profile: Profile | null;
  /**
   * Session-level loading. Flips to false as soon as we know whether
   * a user is signed in, *without* waiting for the profile row. Use
   * this for chrome (sidebar / header) that can render with just the
   * user object.
   */
  loading: boolean;
  /**
   * Profile-row loading. Stays true until `fetchProfile` settles
   * (success, missing row, or error). Code that branches on
   * `profile.beta_features` MUST gate on this — otherwise it sees the
   * `{ loading: false, profile: null }` window during initial load
   * and may take the "not opted in" branch incorrectly.
   */
  profileLoading: boolean;
  signOut: () => Promise<void>;
  /** Re-fetch the current user's profile row — call after a save from
   *  the settings form so header/sidebar reflect the change without a
   *  full page reload. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider — wrap this around the dashboard layout.
 * Makes ONE getSession() call for the whole tree instead of one per
 * component, avoiding internal lock contention in the Supabase client.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const me = await apiAuth.getUser();
      if (me) {
        setProfile({
          id: me.id,
          full_name: me.full_name ?? null,
          email: me.email,
          avatar_url: me.avatar_url ?? null,
          role: (me as any).role ?? null,
          beta_features: [],
        });
        setUser(me);
      } else {
        setProfile(null);
        setUser(null);
      }
    } catch (err) {
      console.error("[AuthProvider] fetchProfile threw:", err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        if (apiAuth.isAuthenticated()) {
          await fetchProfile();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    apiAuth.signOut();
    document.cookie = "platform_access_token=; path=/; max-age=0";
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  }, []);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, profileLoading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — read the shared auth state from context.
 * Must be used inside an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider (shouldn't
    // happen in normal flow, but don't crash the page).
    return {
      user: null,
      profile: null,
      loading: false,
      profileLoading: false,
      signOut: async () => {
        window.location.href = "/login";
      },
      refreshProfile: async () => {},
    };
  }
  return ctx;
}
