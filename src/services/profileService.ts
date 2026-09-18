import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { logger } from "@/services/logger";
import { MyProfile } from "@/types/profile";

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("Supabase is not configured");
  }
  return client;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMyProfile(value: unknown): MyProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    fullName: typeof value.fullName === "string" ? value.fullName : "",
    organization:
      typeof value.organization === "string" ? value.organization : "",
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : "",
  };
}

export async function getMyProfile(): Promise<MyProfile | null> {
  const client = requireClient();

  const { data, error } = await client.rpc("get_my_profile");
  if (error) {
    logger.error("Profile: failed to load own profile", { error });
    throw error;
  }

  return parseMyProfile(data);
}

export async function updateMyAvatar(avatarUrl: string): Promise<void> {
  const client = requireClient();

  const { error } = await client.rpc("update_my_avatar", {
    p_avatar_url: avatarUrl,
  });
  if (error) {
    logger.error("Profile: failed to update avatar", { error });
    throw error;
  }
}
