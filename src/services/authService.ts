
/**
 * Authentication service for API token management
 */

import config from "@/config/environment";
import { adminConnectionStore } from "@/services/adminConnectionStore";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/services/supabase/client";

const APP_AUTH_STORAGE_KEY = "xchat.appAuth";

export interface AppAuthIdentity {
  mode: "demo" | "supabase";
  userId?: string;
  email: string;
  displayName: string;
}

let appIdentity: AppAuthIdentity | null = null;

function buildDisplayName(email: string, fallback?: string | null) {
  if (fallback?.trim()) {
    return fallback.trim();
  }

  const [localPart] = email.split("@");
  if (!localPart) {
    return email;
  }

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function persistAppIdentity(identity: AppAuthIdentity | null) {
  appIdentity = identity;

  if (!globalThis.localStorage) {
    return;
  }

  if (identity) {
    localStorage.setItem(APP_AUTH_STORAGE_KEY, JSON.stringify(identity));
    return;
  }

  localStorage.removeItem(APP_AUTH_STORAGE_KEY);
}

export const authService = {
  getToken: (): string | null => {
    return adminConnectionStore.getToken();
  },

  setToken: (token: string): void => {
    adminConnectionStore.setConnected(token);
  },

  clearToken: (): void => {
    adminConnectionStore.clear();
  },

  isAuthenticated: (): boolean => {
    return adminConnectionStore.isConnected();
  },

  initialize: (): void => {
    const storedIdentity = localStorage.getItem(APP_AUTH_STORAGE_KEY);
    if (storedIdentity) {
      try {
        appIdentity = JSON.parse(storedIdentity) as AppAuthIdentity;
      } catch {
        appIdentity = null;
      }
    }
  },

  isSupabaseAuthConfigured: (): boolean => {
    return hasSupabaseConfig();
  },

  getAppIdentity: (): AppAuthIdentity | null => {
    return appIdentity;
  },

  isAppAuthenticated: (): boolean => {
    return !!appIdentity;
  },

  restoreAppSession: async (): Promise<AppAuthIdentity | null> => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return appIdentity;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      if (appIdentity?.mode === "supabase") {
        persistAppIdentity(null);
      }
      throw new Error(error.message);
    }

    const user = data.session?.user;
    if (!user?.email) {
      if (appIdentity?.mode === "supabase") {
        persistAppIdentity(null);
      }
      return appIdentity;
    }

    const identity: AppAuthIdentity = {
      mode: "supabase",
      userId: user.id,
      email: user.email,
      displayName: buildDisplayName(user.email, user.user_metadata?.full_name as string | null | undefined),
    };

    persistAppIdentity(identity);
    return identity;
  },

  loginToApp: async (email: string, password: string): Promise<AppAuthIdentity> => {
    if (config.demo.email && config.demo.password && email === config.demo.email && password === config.demo.password) {
      persistAppIdentity({
        mode: "demo",
        userId: "demo-user",
        email,
        displayName: "Demo User",
      });
      return appIdentity;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error("Supabase authentication is not configured. Use the demo credentials or configure Supabase first.");
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message || "Invalid credentials");
    }

    persistAppIdentity({
      mode: "supabase",
      userId: data.user.id,
      email: data.user.email || email,
      displayName: buildDisplayName(data.user.email || email, data.user.user_metadata?.full_name as string | null | undefined),
    });
    return appIdentity;
  },

  sendMagicLink: async (email: string): Promise<void> => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error("Magic link login requires a configured Supabase project.");
    }

    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: config.auth.supabaseRedirectUrl,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  logoutApp: async (): Promise<void> => {
    const client = getSupabaseBrowserClient();
    if (client) {
      await client.auth.signOut();
    }

    persistAppIdentity(null);
  }
};

// Initialize the service when imported
authService.initialize();
