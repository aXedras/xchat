
import { apiClient } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { Company, User } from '@/types/chat';

/**
 * Utility for admin operations like API authentication and company registration
 */
export const adminUtils = {
  /**
   * Initialize API access with key and secret
   * @returns Promise with success state
   */
  initializeApiAccess: async (apiKey: string, apiSecret: string): Promise<boolean> => {
    try {
      const { token } = await apiClient.getApiToken(apiKey, apiSecret);
      authService.setToken(token);
      console.log('API access initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize API access:', error);
      return false;
    }
  },
  
  /**
   * Register a new company with users
   * @param companyData Company data
   * @param users Initial users for the company
   * @returns Promise with registered company
   */
  registerCompanyWithUsers: async (
    companyData: Omit<Company, 'id' | 'users'>,
    users: Omit<User, 'id'>[]
  ): Promise<Company | null> => {
    try {
      // First register the company
      const company = await apiClient.registerCompany({
        ...companyData,
        users: []
      });
      
      // Then register each user
      const registeredUsers: User[] = [];
      
      for (const userData of users) {
        const user = await apiClient.registerUser(company.id, userData);
        registeredUsers.push(user);
      }
      
      // Return the complete company with users
      return {
        ...company,
        users: registeredUsers
      };
    } catch (error) {
      console.error('Failed to register company with users:', error);
      return null;
    }
  }
};
