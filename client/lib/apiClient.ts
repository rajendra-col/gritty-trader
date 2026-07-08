// src/lib/apiClient.ts
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8090'
    : 'https://tgtbackend.idea2reality.tech');

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export class ApiClient {
  private static baseURL = API_BASE_URL;

  // Generic fetch wrapper
  static async fetch<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      mode: 'cors',
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        let userMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const data = await response.clone().json();
          const msg = (data && (data.error || data.message)) as string | undefined;
          if (msg) userMessage = msg;
        } catch {
          try {
            const text = await response.text();
            // Try to extract {"error":"..."} from text
            const match = text.match(/"(error|message)"\s*:\s*"([^"]+)"/);
            userMessage = match ? match[2] : (text || userMessage);
          } catch {
            // keep default
          }
        }
        throw new Error(userMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Convenience methods
  static async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' });
  }

  static async post<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async put<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: 'DELETE' });
  }

  static async patch<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Get base URL for direct usage
  static getBaseURL(): string {
    return this.baseURL;
  }
}

// Export convenience functions
export const { get: apiGet, post: apiPost, put: apiPut, delete: apiDelete, fetch: apiFetch } = ApiClient;
export default ApiClient;
