import config from "@/config/environment";
import { authService } from "@/services/authService";
import { logger } from "@/services/logger";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import {
  createDefaultSystemSettings,
  SystemSettings,
} from "@/types/systemSettings";

const STORAGE_KEY = "xchat.systemSettings";
const SYSTEM_SETTINGS_CATEGORY = "system";

const bilSettingDefinitions = [
  {
    key: "integrations.bil.enabled",
    valueType: "boolean",
    description: "Enable Bullion Integrity Ledger connectivity",
    isSensitive: false,
  },
  {
    key: "integrations.bil.base_url",
    valueType: "string",
    description: "Bullion Integrity Ledger base URL",
    isSensitive: false,
  },
  {
    key: "integrations.bil.api_key",
    valueType: "string",
    description: "Bullion Integrity Ledger API key",
    isSensitive: true,
  },
  {
    key: "integrations.bil.network",
    valueType: "string",
    description: "Bullion Integrity Ledger target network",
    isSensitive: false,
  },
  {
    key: "integrations.bil.participant_id",
    valueType: "string",
    description: "Bullion Integrity Ledger participant identifier",
    isSensitive: false,
  },
  {
    key: "integrations.bil.ledger_id",
    valueType: "string",
    description: "Bullion Integrity Ledger ledger identifier",
    isSensitive: false,
  },
] as const;

type SystemSettingRow = {
  key: string;
  value: string;
  value_type: string;
  updated_at: string | null;
};

function isBrowser() {
  return (
    globalThis.window !== undefined && globalThis.localStorage !== undefined
  );
}

function cloneSettings(settings: SystemSettings): SystemSettings {
  return {
    bil: { ...settings.bil },
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
    storageMode: settings.storageMode,
  };
}

function buildSeedSettings() {
  return createDefaultSystemSettings(config.integrations.bil);
}

function canUseSharedSettings() {
  return (
    !!getSupabaseBrowserClient() &&
    authService.getAppIdentity()?.mode === "supabase"
  );
}

function deriveValue(row: SystemSettingRow) {
  if (row.value_type === "boolean") {
    return row.value === "true";
  }

  return row.value;
}

function buildSettingsFromRows(rows: SystemSettingRow[]) {
  const settings = buildSeedSettings();

  rows.forEach((row) => {
    const value = deriveValue(row);

    switch (row.key) {
      case "integrations.bil.enabled":
        settings.bil.enabled = value === true;
        break;
      case "integrations.bil.base_url":
        settings.bil.baseUrl =
          typeof value === "string" ? value : settings.bil.baseUrl;
        break;
      case "integrations.bil.api_key":
        settings.bil.apiKey =
          typeof value === "string" ? value : settings.bil.apiKey;
        break;
      case "integrations.bil.network":
        settings.bil.network =
          typeof value === "string" ? value : settings.bil.network;
        break;
      case "integrations.bil.participant_id":
        settings.bil.participantId =
          typeof value === "string" ? value : settings.bil.participantId;
        break;
      case "integrations.bil.ledger_id":
        settings.bil.ledgerId =
          typeof value === "string" ? value : settings.bil.ledgerId;
        break;
      default:
        break;
    }
  });

  return {
    ...settings,
    storageMode: "supabase-shared" as const,
    updatedAt: rows.reduce<string | null>((latest, row) => {
      if (!row.updated_at) {
        return latest;
      }

      if (!latest || row.updated_at > latest) {
        return row.updated_at;
      }

      return latest;
    }, null),
    updatedBy: null,
  };
}

function buildRowsFromSettings(settings: SystemSettings) {
  return bilSettingDefinitions.map((definition) => {
    let value = "";

    switch (definition.key) {
      case "integrations.bil.enabled":
        value = settings.bil.enabled ? "true" : "false";
        break;
      case "integrations.bil.base_url":
        value = settings.bil.baseUrl;
        break;
      case "integrations.bil.api_key":
        value = settings.bil.apiKey;
        break;
      case "integrations.bil.network":
        value = settings.bil.network;
        break;
      case "integrations.bil.participant_id":
        value = settings.bil.participantId;
        break;
      case "integrations.bil.ledger_id":
        value = settings.bil.ledgerId;
        break;
      default:
        break;
    }

    return {
      key: definition.key,
      value,
      value_type: definition.valueType,
      category: SYSTEM_SETTINGS_CATEGORY,
      description: definition.description,
      is_sensitive: definition.isSensitive,
      updated_at: new Date().toISOString(),
    };
  });
}

function parseStoredSettings(raw: string | null): SystemSettings | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SystemSettings> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.bil ||
      typeof parsed.bil !== "object"
    ) {
      return null;
    }

    return {
      bil: {
        enabled: parsed.bil.enabled === true,
        baseUrl:
          typeof parsed.bil.baseUrl === "string" ? parsed.bil.baseUrl : "",
        apiKey: typeof parsed.bil.apiKey === "string" ? parsed.bil.apiKey : "",
        network:
          typeof parsed.bil.network === "string" ? parsed.bil.network : "",
        participantId:
          typeof parsed.bil.participantId === "string"
            ? parsed.bil.participantId
            : "",
        ledgerId:
          typeof parsed.bil.ledgerId === "string" ? parsed.bil.ledgerId : "",
      },
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      updatedBy: typeof parsed.updatedBy === "string" ? parsed.updatedBy : null,
      storageMode: "browser-local",
    };
  } catch (error) {
    logger.error("Unable to parse stored system settings", { error });
    return null;
  }
}

function persistSettings(settings: SystemSettings) {
  if (!isBrowser()) {
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

let currentSettings =
  parseStoredSettings(
    isBrowser() ? globalThis.localStorage.getItem(STORAGE_KEY) : null,
  ) || buildSeedSettings();

export const systemSettingsService = {
  async loadSettings() {
    if (!canUseSharedSettings()) {
      return cloneSettings(currentSettings);
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      return cloneSettings(currentSettings);
    }

    const { data, error } = await client
      .from("system_settings")
      .select("key, value, value_type, updated_at")
      .in(
        "key",
        bilSettingDefinitions.map((definition) => definition.key),
      );

    if (error) {
      logger.error("Unable to load shared system settings", { error });
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      const seeded = {
        ...buildSeedSettings(),
        storageMode: "supabase-shared" as const,
        updatedAt: null,
        updatedBy: null,
      };
      currentSettings = seeded;
      return cloneSettings(currentSettings);
    }

    currentSettings = buildSettingsFromRows(data as SystemSettingRow[]);
    return cloneSettings(currentSettings);
  },

  getSettings() {
    return cloneSettings(currentSettings);
  },

  async saveSettings(nextSettings: SystemSettings) {
    if (canUseSharedSettings()) {
      const client = getSupabaseBrowserClient();
      if (!client) {
        throw new Error(
          "Shared system settings require a configured Supabase client.",
        );
      }

      const rows = buildRowsFromSettings(nextSettings);
      const { error } = await client
        .from("system_settings")
        .upsert(rows, { onConflict: "key" });

      if (error) {
        logger.error("Unable to save shared system settings", { error });
        throw new Error(error.message);
      }

      currentSettings = {
        ...nextSettings,
        storageMode: "supabase-shared",
        updatedAt: rows[0]?.updated_at || new Date().toISOString(),
        updatedBy: authService.getAppIdentity()?.email || null,
      };

      logger.info("Shared system settings updated", {
        updatedBy: currentSettings.updatedBy,
      });
      return cloneSettings(currentSettings);
    }

    currentSettings = {
      bil: { ...nextSettings.bil },
      updatedAt: new Date().toISOString(),
      updatedBy: authService.getAppIdentity()?.email || "vendor-admin",
      storageMode: "browser-local",
    };

    persistSettings(currentSettings);
    logger.info("System settings updated", {
      updatedBy: currentSettings.updatedBy,
    });
    return cloneSettings(currentSettings);
  },

  async reset() {
    if (canUseSharedSettings()) {
      const client = getSupabaseBrowserClient();
      if (!client) {
        throw new Error(
          "Shared system settings require a configured Supabase client.",
        );
      }

      const { error } = await client
        .from("system_settings")
        .delete()
        .in(
          "key",
          bilSettingDefinitions.map((definition) => definition.key),
        );

      if (error) {
        logger.error("Unable to reset shared system settings", { error });
        throw new Error(error.message);
      }

      currentSettings = {
        ...buildSeedSettings(),
        storageMode: "supabase-shared",
      };
      logger.info("Shared system settings reset to deployment defaults");
      return cloneSettings(currentSettings);
    }

    currentSettings = buildSeedSettings();
    persistSettings(currentSettings);
    logger.info("System settings reset to deployment defaults");
    return cloneSettings(currentSettings);
  },
};
