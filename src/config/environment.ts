
// Environment configuration

// Default environment values
const defaultConfig = {
  // API endpoints
  apiUrl: "/api",
  
  // WebSocket endpoint for the messaging service
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws",
  
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
