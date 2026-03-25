import { adminConnectionStore } from "@/services/adminConnectionStore";
import { ApiError, apiClient } from "@/services/apiClient";
import { logger } from "@/services/logger";

export function getAdminConnectionErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "invalid_credentials":
      case "unauthorized":
        return "Invalid API credentials. Check the API key and secret and try again.";
      case "network_error":
        return "Unable to reach the admin API. Check the connection and try again.";
      case "server_error":
        return "The admin API is currently unavailable. Try again later.";
      case "validation_error":
        return error.message;
      default:
        return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to establish the admin API connection.";
}

export const adminConnectionService = {
  subscribe: adminConnectionStore.subscribe,
  getState: adminConnectionStore.getState,
  getToken: adminConnectionStore.getToken,
  isConnected: adminConnectionStore.isConnected,

  async connect(apiKey: string, apiSecret: string) {
    adminConnectionStore.setConnecting();

    try {
      const { token } = await apiClient.getApiToken(apiKey, apiSecret);
      adminConnectionStore.setConnected(token);
      logger.info("Admin API connection established", { mode: adminConnectionStore.getState().mode });
      return adminConnectionStore.getState();
    } catch (error) {
      const message = getAdminConnectionErrorMessage(error);
      adminConnectionStore.setError(message);
      logger.warn("Admin API connection failed", { message });
      throw error;
    }
  },

  disconnect() {
    adminConnectionStore.clear();
    logger.info("Admin API connection cleared");
  },
};