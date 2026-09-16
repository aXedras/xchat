/**
 * Authentication service for API token management
 */

import config from "@/config/environment";
import { adminConnectionStore } from "@/services/adminConnectionStore";
import { logger } from "@/services/logger";
import i18n from "@/i18n";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/services/supabase/client";
import { getMyProfile } from "@/services/profileService";

const APP_AUTH_STORAGE_KEY = "xchat.appAuth";

export interface AppAuthIdentity {
  role: "user" | "vendor-admin";
  userId?: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
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

async function loadProfileAvatar(): Promise<string | null> {
  try {
    const profile = await getMyProfile();
    return profile?.avatarUrl || null;
  } catch (error) {
    logger.error("Unable to load profile avatar", { error });
    return null;
  }
}

function stripAvatarUrl(
  identity: AppAuthIdentity,
): Omit<AppAuthIdentity, "avatarUrl"> {
  const { avatarUrl: _avatarUrl, ...rest } = identity;
  return rest;
}

function persistAppIdentity(identity: AppAuthIdentity | null) {
  appIdentity = identity;

  if (!globalThis.localStorage) {
    notifyAppAuthChanged(identity);
    return;
  }

  try {
    if (identity) {
      localStorage.setItem(
        APP_AUTH_STORAGE_KEY,
        JSON.stringify(stripAvatarUrl(identity)),
      );
    } else {
      localStorage.removeItem(APP_AUTH_STORAGE_KEY);
    }
  } catch (error) {
    logger.error("Unable to persist app identity to localStorage", { error });
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

  setAvatarUrl: (avatarUrl: string): void => {
    if (!appIdentity) {
      return;
    }
    persistAppIdentity({ ...appIdentity, avatarUrl });
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

    client.auth.onAuthStateChange((event, session) => {
      const user = session?.user;

      if (event === "SIGNED_OUT") {
        persistAppIdentity(null);
        return;
      }

      if (user?.email) {
        // Defer the role RPC out of the Supabase session lock: calling
        // get_my_role synchronously inside onAuthStateChange re-enters the
        // lock and deadlocks with getSession() on a full page reload.
        setTimeout(() => {
          void resolveCurrentUserRole().then((role) => {
            const avatarUrl = appIdentity?.avatarUrl;

            persistAppIdentity({
              role,
              userId: user.id,
              email: user.email,
              displayName: buildDisplayName(
                user.email,
                user.user_metadata?.full_name as string | null | undefined,
              ),
              ...(avatarUrl ? { avatarUrl } : {}),
            });
          });
        }, 0);
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
      persistAppIdentity(null);
      throw new Error(error.message);
    }

    const user = data.session?.user;
    if (!user?.email) {
      persistAppIdentity(null);
      return null;
    }

    const identity: AppAuthIdentity = {
      role: await resolveCurrentUserRole(),
      userId: user.id,
      email: user.email,
      displayName: buildDisplayName(
        user.email,
        user.user_metadata?.full_name as string | null | undefined,
      ),
    };

    const avatarUrl = (await loadProfileAvatar()) ?? appIdentity?.avatarUrl;
    if (avatarUrl) {
      identity.avatarUrl = avatarUrl;
    }

    persistAppIdentity(identity);
    return identity;
  },

  loginToApp: async (
    email: string,
    password: string,
  ): Promise<AppAuthIdentity> => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error(i18n.t("auth.noSupabaseConfig"));
    }

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      throw new Error(error?.message || i18n.t("auth.invalidCredentials"));
    }

    const identity: AppAuthIdentity = {
      role: await resolveCurrentUserRole(),
      userId: data.user.id,
      email: data.user.email || email,
      displayName: buildDisplayName(
        data.user.email || email,
        data.user.user_metadata?.full_name as string | null | undefined,
      ),
    };

    const avatarUrl = await loadProfileAvatar();
    if (avatarUrl) {
      identity.avatarUrl = avatarUrl;
    }

    persistAppIdentity(identity);
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
