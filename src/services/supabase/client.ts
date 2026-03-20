import { createClient, SupabaseClient } from "@supabase/supabase-js";
import config from "@/config/environment";

let browserClient: SupabaseClient | null | undefined;

export function hasSupabaseConfig() {
  return !!config.realtime.supabaseUrl && !!config.realtime.supabasePublishableKey;
}

export function getSupabaseBrowserClient() {
  if (browserClient !== undefined) {
    return browserClient;
  }

  if (!globalThis.window || !hasSupabaseConfig()) {
    browserClient = null;
    return browserClient;
  }

  browserClient = createClient(config.realtime.supabaseUrl, config.realtime.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return browserClient;
}