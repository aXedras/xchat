
// Environment configuration

// Default environment values
const defaultConfig = {
  // API endpoints
  apiUrl: "/api",
  
  // WebSocket endpoint for the messaging service
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws",

  realtime: {
    carrier: (import.meta.env.VITE_REALTIME_CARRIER || "supabase") as "local" | "websocket" | "supabase",
    channel: import.meta.env.VITE_REALTIME_CHANNEL || "xchat-realtime",
    event: import.meta.env.VITE_REALTIME_EVENT || "message",
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
    supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  },

  auth: {
    supabaseRedirectUrl: import.meta.env.VITE_SUPABASE_AUTH_REDIRECT_URL || "http://127.0.0.1:4173",
  },

  persistence: {
    provider: (import.meta.env.VITE_PERSISTENCE_PROVIDER || "supabase") as "local" | "supabase",
  },

  demo: {
    email: import.meta.env.VITE_DEMO_EMAIL,
    password: import.meta.env.VITE_DEMO_PASSWORD,
  },
  
  // Feature flags
  features: {
    macros: true,
    fileAttachments: true,
    groupChats: true,
  }
};

// Environment-specific overrides
const environmentConfig: Record<string, Partial<typeof defaultConfig>> = {
  development: {
    // Development-specific configuration
  },
  production: {
    // Production-specific configuration
    apiUrl: "/api/v1",
  },
  test: {
    // Test-specific configuration
  },
};

// Determine current environment
const environment = import.meta.env.MODE || 'development';

// Merge default config with environment-specific overrides
export const config = {
  ...defaultConfig,
  ...(environmentConfig[environment] || {}),
  environment,
};

export default config;
