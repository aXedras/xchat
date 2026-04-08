export interface BilSystemSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  network: string;
  participantId: string;
  ledgerId: string;
}

export type SystemSettingsStorageMode = "browser-local" | "supabase-shared";

export interface SystemSettings {
  bil: BilSystemSettings;
  updatedAt: string | null;
  updatedBy: string | null;
  storageMode: SystemSettingsStorageMode;
}

export function createDefaultSystemSettings(
  seed?: Partial<BilSystemSettings>,
): SystemSettings {
  return {
    bil: {
      enabled: seed?.enabled ?? false,
      baseUrl: seed?.baseUrl ?? "",
      apiKey: seed?.apiKey ?? "",
      network: seed?.network ?? "",
      participantId: seed?.participantId ?? "",
      ledgerId: seed?.ledgerId ?? "",
    },
    updatedAt: null,
    updatedBy: null,
    storageMode: "browser-local",
  };
}
