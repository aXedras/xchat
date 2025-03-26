
/**
 * Authentication service for API token management
 */

// Simulated API token (in a real app, this would be handled securely)
let apiToken: string | null = null;

export const authService = {
  /**
   * Get the current API token
   */
  getToken: (): string | null => {
    return apiToken;
  },

  /**
   * Set a new API token
   */
  setToken: (token: string): void => {
    apiToken = token;
    // In a real implementation, this might store the token securely
    localStorage.setItem('api_token', token);
  },

  /**
   * Clear the current API token
   */
  clearToken: (): void => {
    apiToken = null;
    localStorage.removeItem('api_token');
  },

  /**
   * Check if a token exists and is valid
   */
  isAuthenticated: (): boolean => {
    const token = apiToken || localStorage.getItem('api_token');
    return !!token;
  },

  /**
   * Initialize the service by checking for stored token
   */
  initialize: (): void => {
    const storedToken = localStorage.getItem('api_token');
    if (storedToken) {
      apiToken = storedToken;
    }
  }
};

// Initialize the service when imported
authService.initialize();
