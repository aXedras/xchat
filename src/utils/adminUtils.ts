
import { adminConnectionService } from '@/services/adminConnectionService';
import { apiClient } from '@/services/apiClient';
import { companyDirectoryStore } from '@/services/companyDirectoryStore';
import { logger } from '@/services/logger';
import { AdminConnectionState } from '@/types/admin';
import { Company, User } from '@/types/chat';

export const adminUtils = {
  initializeApiAccess: async (apiKey: string, apiSecret: string): Promise<AdminConnectionState> => {
    try {
      return await adminConnectionService.connect(apiKey, apiSecret);
    } catch (error) {
      logger.error('Failed to initialize admin API access', { error });
      throw error;
    }
  },

  registerCompanyWithUsers: async (
    companyData: Omit<Company, 'id' | 'users'>,
    users: Omit<User, 'id'>[]
  ): Promise<Company> => {
    try {
      if (companyDirectoryStore.companyExists(companyData.name)) {
        throw new Error(`Company "${companyData.name}" already exists.`);
      }

      const company = await apiClient.registerCompany({
        ...companyData,
        users: []
      });

      const registeredUsers: User[] = [];

      for (const userData of users) {
        const user = await apiClient.registerUser(company.id, userData);
        registeredUsers.push(user);
      }

      const registeredCompany = {
        ...company,
        users: registeredUsers
      };

      companyDirectoryStore.registerCompany(registeredCompany);
      return registeredCompany;
    } catch (error) {
      logger.error('Failed to register company with users', {
        companyName: companyData.name,
        userCount: users.length,
        error,
      });
      throw error;
    }
  }
};
