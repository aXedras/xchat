/**
 * Authentication service for API token management
 */

import config from "@/config/environment";
import { adminConnectionStore } from "@/services/adminConnectionStore";
import { logger } from "@/services/logger";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/services/supabase/client";

const APP_AUTH_STORAGE_KEY = "xchat.appAuth";

export interface AppAuthIdentity {
  mode: "demo" | "supabase" | "vendor-admin";
  role: "user" | "vendor-admin";
  userId?: string;
  email: string;
  displayName: string;
}

let appIdentity: AppAuthIdentity | null = null;

type AppAuthListener = (identity: AppAuthIdentity | null) => void;

const appAuthListeners = new Set<AppAuthListener>();

function notifyAppAuthChanged(identity: AppAuthIdentity | null) {
  appAuthListeners.forEach((listener) => {
    try {
      listener(identity);
    } catch {
      // Listener failures must not break the auth flow.
    }
  });
}

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

async function resolveCurrentUserRole(): Promise<"user" | "vendor-admin"> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "user";
  }

  try {
    const { data, error } = await client.rpc("get_my_role");
    if (error) {
      logger.error("Unable to resolve current user role", { error });
      return "user";
    }

    if (data === null) {
      return "user";
    }

    if (typeof data !== "string") {
      logger.error("Unexpected role payload from get_my_role", { data });
      return "user";
    }

    const normalizedRole = data.toLowerCase();
    return normalizedRole === "vendor" || normalizedRole === "admin"
      ? "vendor-admin"
      : "user";
  } catch (error) {
    logger.error("Unable to resolve current user role", { error });
    return "user";
  }
}

function persistAppIdentity(identity: AppAuthIdentity | null) {
  appIdentity = identity;

  if (!globalThis.localStorage) {
    notifyAppAuthChanged(identity);
    return;
  }

  if (identity) {
    localStorage.setItem(APP_AUTH_STORAGE_KEY, JSON.stringify(identity));
  } else {
    localStorage.removeItem(APP_AUTH_STORAGE_KEY);
  }

  notifyAppAuthChanged(identity);
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
        const parsed = JSON.parse(storedIdentity) as AppAuthIdentity;
        if (
          !config.auth.enableDemoAuth &&
          parsed &&
          (parsed.mode === "demo" || parsed.mode === "vendor-admin")
        ) {
          appIdentity = null;
          localStorage.removeItem(APP_AUTH_STORAGE_KEY);
        } else {
          appIdentity = parsed;
        }
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

  isVendorAdmin: (): boolean => {
    return appIdentity?.role === "vendor-admin";
  },

  isAppAuthenticated: (): boolean => {
    return !!appIdentity;
  },

  subscribeAppAuth(listener: AppAuthListener) {
    appAuthListeners.add(listener);
    return () => {
      appAuthListeners.delete(listener);
    };
  },

  startAuthListener: (): void => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    client.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user;

      if (user?.email) {
        const role = await resolveCurrentUserRole();
        persistAppIdentity({
          mode: "supabase",
          role,
          userId: user.id,
          email: user.email,
          displayName: buildDisplayName(
            user.email,
            user.user_metadata?.full_name as string | null | undefined,
          ),
        });
        return;
      }

      if (event === "SIGNED_OUT") {
        if (appIdentity?.mode === "supabase") {
          persistAppIdentity(null);
        }
      }
    });
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
      role: await resolveCurrentUserRole(),
      userId: user.id,
      email: user.email,
      displayName: buildDisplayName(
        user.email,
        user.user_metadata?.full_name as string | null | undefined,
      ),
    };

    persistAppIdentity(identity);
    return identity;
  },

  loginToApp: async (
    email: string,
    password: string,
  ): Promise<AppAuthIdentity> => {
    if (config.auth.enableDemoAuth) {
      if (
        email === config.auth.vendorAdmin.email &&
        password === config.auth.vendorAdmin.password
      ) {
        persistAppIdentity({
          mode: "vendor-admin",
          role: "vendor-admin",
          userId: "vendor-admin",
          email,
          displayName: "Vendor Admin",
        });
        return appIdentity;
      }

      if (
        config.demo.email &&
        config.demo.password &&
        email === config.demo.email &&
        password === config.demo.password
      ) {
        persistAppIdentity({
          mode: "demo",
          role: "user",
          userId: "demo-user",
          email,
          displayName: "Demo User",
        });
        return appIdentity;
      }
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error(
        "Supabase authentication is not configured. Use the demo credentials or configure Supabase first.",
      );
    }

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      throw new Error(error?.message || "Invalid credentials");
    }

    persistAppIdentity({
      mode: "supabase",
      role: await resolveCurrentUserRole(),
      userId: data.user.id,
      email: data.user.email || email,
      displayName: buildDisplayName(
        data.user.email || email,
        data.user.user_metadata?.full_name as string | null | undefined,
      ),
    });
    return appIdentity;
  },

  sendMagicLink: async (email: string): Promise<void> => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error(
        "Magic link login requires a configured Supabase project.",
      );
    }

    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: config.auth.supabaseRedirectUrl,
        shouldCreateUser: false,
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
  },
};

// Initialize the service when imported
authService.initialize();
authService.startAuthListener();
