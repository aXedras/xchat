// Environment configuration

type AdminApiMode = "mock" | "real";
type RealtimeCarrier = "local" | "websocket" | "supabase";
type PersistenceProvider = "local" | "supabase";

function readRuntimeConfig() {
  const config = globalThis.window?.__XCHAT_RUNTIME_CONFIG__;
  if (!config || typeof config !== "object") {
    return {} as Record<string, string | undefined>;
  }

  return config;
}

function readValue(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.length > 0);
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value === "true";
}

const runtimeConfig = readRuntimeConfig();

const defaultConfig = {
  apiUrl: "/api",
  api: {
    baseUrl:
      readValue(
        runtimeConfig.apiBaseUrl,
        import.meta.env.VITE_API_BASE_URL,
        "/api",
      ) || "/api",
    mode: (readValue(
      runtimeConfig.apiMode,
      import.meta.env.VITE_API_MODE,
      import.meta.env.DEV ? "mock" : "real",
    ) || "real") as AdminApiMode,
  },
  wsUrl:
    readValue(
      runtimeConfig.wsUrl,
      import.meta.env.VITE_WS_URL,
      "ws://localhost:8080/ws",
    ) || "ws://localhost:8080/ws",
  realtime: {
    carrier: (readValue(
      runtimeConfig.realtimeCarrier,
      import.meta.env.VITE_REALTIME_CARRIER,
      "supabase",
    ) || "supabase") as RealtimeCarrier,
    channel:
      readValue(
        runtimeConfig.realtimeChannel,
        import.meta.env.VITE_REALTIME_CHANNEL,
        "xchat-realtime",
      ) || "xchat-realtime",
    event:
      readValue(
        runtimeConfig.realtimeEvent,
        import.meta.env.VITE_REALTIME_EVENT,
        "message",
      ) || "message",
    supabaseUrl:
      readValue(
        runtimeConfig.supabaseUrl,
        import.meta.env.VITE_SUPABASE_URL,
        "",
      ) || "",
    supabasePublishableKey:
      readValue(
        runtimeConfig.supabasePublishableKey,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        "",
      ) || "",
  },
  auth: {
    supabaseRedirectUrl:
      readValue(
        runtimeConfig.supabaseRedirectUrl,
        import.meta.env.VITE_SUPABASE_AUTH_REDIRECT_URL,
        "http://127.0.0.1:4173",
      ) || "http://127.0.0.1:4173",
    vendorAdmin: {
      email:
        readValue(
          runtimeConfig.vendorAdminEmail,
          import.meta.env.VITE_VENDOR_ADMIN_EMAIL,
          "admin@xchat.local",
        ) || "admin@xchat.local",
      password:
        readValue(
          runtimeConfig.vendorAdminPassword,
          import.meta.env.VITE_VENDOR_ADMIN_PASSWORD,
          "change-me-demo-admin",
        ) || "change-me-demo-admin",
    },
  },
  persistence: {
    provider: (readValue(
      runtimeConfig.persistenceProvider,
      import.meta.env.VITE_PERSISTENCE_PROVIDER,
      "supabase",
    ) || "supabase") as PersistenceProvider,
  },
  demo: {
    email:
      readValue(
        runtimeConfig.demoEmail,
        import.meta.env.VITE_DEMO_EMAIL,
        "demo@axedras.com",
      ) || "demo@axedras.com",
    password:
      readValue(
        runtimeConfig.demoPassword,
        import.meta.env.VITE_DEMO_PASSWORD,
        "password",
      ) || "password",
  },
  integrations: {
    bil: {
      enabled: readBoolean(
        readValue(runtimeConfig.bilEnabled, import.meta.env.VITE_BIL_ENABLED),
        false,
      ),
      baseUrl:
        readValue(
          runtimeConfig.bilBaseUrl,
          import.meta.env.VITE_BIL_BASE_URL,
          "",
        ) || "",
      apiKey:
        readValue(
          runtimeConfig.bilApiKey,
          import.meta.env.VITE_BIL_API_KEY,
          "",
        ) || "",
      network:
        readValue(
          runtimeConfig.bilNetwork,
          import.meta.env.VITE_BIL_NETWORK,
          "",
        ) || "",
      participantId:
        readValue(
          runtimeConfig.bilParticipantId,
          import.meta.env.VITE_BIL_PARTICIPANT_ID,
          "",
        ) || "",
      ledgerId:
        readValue(
          runtimeConfig.bilLedgerId,
          import.meta.env.VITE_BIL_LEDGER_ID,
          "",
        ) || "",
    },
  },
  features: {
    macros: true,
    fileAttachments: true,
    groupChats: true,
  },
};

const environmentConfig: Record<string, Partial<typeof defaultConfig>> = {
  development: {},
  production: {
    apiUrl: "/api/v1",
  },
  test: {},
};

const environment = import.meta.env.MODE || "development";

export const config = {
  ...defaultConfig,
  ...(environmentConfig[environment] || {}),
  environment,
};

export default config;
