
import config from "@/config/environment";
import { adminConnectionStore } from "@/services/adminConnectionStore";
import { Company, User } from "@/types/chat";

const API_BASE_URL = config.api.baseUrl;

export type ApiErrorCode =
  | "invalid_credentials"
  | "unauthorized"
  | "validation_error"
  | "network_error"
  | "not_found"
  | "server_error"
  | "unknown";

interface ApiTokenResponse {
  token: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  details?: unknown;

  constructor(message: string, status: number, code: ApiErrorCode, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = "ApiError";
  }
}

function buildHeaders(options: RequestInit) {
  const token = adminConnectionStore.getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
}

function toApiErrorCode(status: number, details?: unknown): ApiErrorCode {
  if (isRecord(details) && typeof details.code === "string") {
    return details.code as ApiErrorCode;
  }

  switch (status) {
    case 400:
      return "validation_error";
    case 401:
      return "unauthorized";
    case 404:
      return "not_found";
    default:
      return status >= 500 ? "server_error" : "unknown";
  }
}

function toApiMessage(status: number, details?: unknown) {
  if (isRecord(details) && typeof details.message === "string") {
    return details.message;
  }

  if (typeof details === "string" && details.length > 0) {
    return details;
  }

  if (status === 401) {
    return "Unauthorized: API token required";
  }

  if (status >= 500) {
    return "The API is currently unavailable";
  }

  return "An error occurred with the API request";
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let payload: unknown = null;

  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    throw new ApiError(toApiMessage(response.status, payload), response.status, toApiErrorCode(response.status, payload), payload);
  }

  return payload as T;
}

const fetchWithAuth = async <T>(url: string, options: RequestInit = {}, allowUnauthenticated = false): Promise<T> => {
  try {
    if (config.api.mode === "mock") {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return await simulateApiRequest<T>(url, {
        ...options,
        headers: buildHeaders(options),
      });
    }

    if (!allowUnauthenticated && !adminConnectionStore.getToken()) {
      throw new ApiError("Unauthorized: API token required", 401, "unauthorized");
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: buildHeaders(options),
    });

    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("Failed to connect to the API", 500, "network_error", error);
  }
};

const simulateApiRequest = async <T>(url: string, options: RequestInit): Promise<T> => {
  const { method = 'GET', body } = options;
  const token = adminConnectionStore.getToken();
  
  if (url !== '/auth/token' && !token) {
    throw new ApiError('Unauthorized: API token required', 401, 'unauthorized');
  }
  
  if (url === '/auth/token' && method === 'POST') {
    const { apiKey, apiSecret } = JSON.parse(body as string);
    if (!apiKey || !apiSecret) {
      throw new ApiError('API key and secret are required', 400, 'validation_error');
    }

    if (apiKey === 'demo_key' && apiSecret === 'demo_secret') {
      return { token: `mock_token_${Date.now()}` } as T;
    }

    throw new ApiError('Invalid API credentials', 401, 'invalid_credentials');
  }
  
  if (url === '/companies' && method === 'POST') {
    const companyData = JSON.parse(body as string);
    if (!companyData.name || !companyData.location || !companyData.type) {
      throw new ApiError('Missing required company fields', 400, 'validation_error');
    }

    return {
      ...companyData,
      id: `company_${Date.now()}`,
      users: companyData.users || []
    } as T;
  }
  
  if (url.match(/\/companies\/[^/]+\/users/) && method === 'POST') {
    const userData = JSON.parse(body as string);
    if (!userData.name || !userData.role) {
      throw new ApiError('Missing required user fields', 400, 'validation_error');
    }

    return {
      ...userData,
      id: `user_${Date.now()}`
    } as T;
  }
  
  if (url === '/companies' && method === 'GET') {
    return { companies: mockCompanies } as T;
  }
  
  throw new ApiError(`Endpoint not found: ${url}`, 404, 'not_found');
};

const mockCompanies = [
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

export const apiClient = {
  getApiToken: (apiKey: string, apiSecret: string) => {
    return fetchWithAuth<ApiTokenResponse>('/auth/token', {
      method: 'POST',
      body: JSON.stringify({ apiKey, apiSecret })
    }, true);
  },

  registerCompany: (company: Omit<Company, 'id'>) => {
    return fetchWithAuth<Company>('/companies', {
      method: 'POST',
      body: JSON.stringify(company)
    });
  },
  
  registerUser: (companyId: string, user: Omit<User, 'id'>) => {
    return fetchWithAuth<User>(`/companies/${companyId}/users`, {
      method: 'POST',
      body: JSON.stringify(user)
    });
  },
  
  getCompanies: () => {
    return fetchWithAuth<{ companies: Company[] }>('/companies');
  }
};
