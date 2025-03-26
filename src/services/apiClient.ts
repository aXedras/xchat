
import { authService } from './authService';
import { Company, User } from '@/types/chat';

// Base URL for API requests (would be environment-specific in a real app)
const API_BASE_URL = '/api';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/**
 * Generic fetch wrapper with authentication and error handling
 */
const fetchWithAuth = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  // In mock mode, simulate network delay
  if (import.meta.env.MODE === 'development') {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const token = authService.getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };
  
  try {
    // In development, simulate API for now
    if (import.meta.env.MODE === 'development') {
      return await simulateApiRequest<T>(url, {
        ...options,
        headers
      });
    }
    
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new ApiError(
        data.message || 'An error occurred with the API request',
        response.status
      );
    }
    
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to connect to the API', 500);
  }
};

/**
 * Simulate API requests in development
 */
const simulateApiRequest = async <T>(url: string, options: RequestInit): Promise<T> => {
  const { method = 'GET', body } = options;
  const token = authService.getToken();
  
  // Check authorization for protected endpoints
  if (url !== '/auth/token' && !token) {
    throw new ApiError('Unauthorized: API token required', 401);
  }
  
  // Handle API token generation
  if (url === '/auth/token' && method === 'POST') {
    const { apiKey, apiSecret } = JSON.parse(body as string);
    
    // Simple validation - in a real app this would verify against a secure source
    if (apiKey === 'demo_key' && apiSecret === 'demo_secret') {
      return { token: `mock_token_${Date.now()}` } as unknown as T;
    } else {
      throw new ApiError('Invalid API credentials', 401);
    }
  }
  
  // Company registration endpoint
  if (url === '/companies' && method === 'POST') {
    const companyData = JSON.parse(body as string);
    
    // Validate required fields
    if (!companyData.name || !companyData.location || !companyData.type) {
      throw new ApiError('Missing required company fields', 400);
    }
    
    // Generate mock ID and return created company
    return {
      ...companyData,
      id: `company_${Date.now()}`,
      users: companyData.users || []
    } as unknown as T;
  }
  
  // User registration endpoint
  if (url.match(/\/companies\/[^/]+\/users/) && method === 'POST') {
    const userData = JSON.parse(body as string);
    
    // Validate required fields
    if (!userData.name || !userData.role) {
      throw new ApiError('Missing required user fields', 400);
    }
    
    // Generate mock ID and return created user
    return {
      ...userData,
      id: `user_${Date.now()}`
    } as unknown as T;
  }
  
  // Get companies endpoint
  if (url === '/companies' && method === 'GET') {
    // Return mock companies data
    return { companies: mockCompanies } as unknown as T;
  }
  
  throw new ApiError(`Endpoint not found: ${url}`, 404);
};

/**
 * Mock companies data for development
 */
const mockCompanies = [
  // Simplified version of the existing mock data
  {
    id: "api-1",
    name: "API Test Company",
    location: "Switzerland",
    type: "Refiner",
    users: [
      { id: "api-1-1", name: "API User", role: "Admin" }
    ]
  }
];

/**
 * Main API client with company and user registration methods
 */
export const apiClient = {
  /**
   * Get an API token using API key and secret
   * @param apiKey Client API key
   * @param apiSecret Client API secret
   * @returns Promise with token response
   */
  getApiToken: (apiKey: string, apiSecret: string) => {
    return fetchWithAuth<{ token: string }>('/auth/token', {
      method: 'POST',
      body: JSON.stringify({ apiKey, apiSecret })
    });
  },
  
  /**
   * Register a new company
   * @param company Company data
   * @returns Promise with created company
   */
  registerCompany: (company: Omit<Company, 'id'>) => {
    return fetchWithAuth<Company>('/companies', {
      method: 'POST',
      body: JSON.stringify(company)
    });
  },
  
  /**
   * Register a new user for a company
   * @param companyId Target company ID
   * @param user User data
   * @returns Promise with created user
   */
  registerUser: (companyId: string, user: Omit<User, 'id'>) => {
    return fetchWithAuth<User>(`/companies/${companyId}/users`, {
      method: 'POST',
      body: JSON.stringify(user)
    });
  },
  
  /**
   * Get all companies
   * @returns Promise with companies list
   */
  getCompanies: () => {
    return fetchWithAuth<{ companies: Company[] }>('/companies');
  }
};
