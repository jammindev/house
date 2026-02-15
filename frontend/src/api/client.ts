import axios from 'axios';

// Use relative URLs - Vite proxy in dev, same origin in prod
const API_BASE_URL = '/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Try to refresh the token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('accessToken', access);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

// API types
export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  locale: 'en' | 'fr';
  avatar_url?: string;
  full_name: string;
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
}

export interface Household {
  id: string;
  name: string;
  created_at: string;
  address?: string;
  city?: string;
  country?: string;
  context_notes?: string;
  ai_prompt_context?: string;
  inbound_email_alias?: string;
  default_household: boolean;
  member_count: number;
  user_role?: 'owner' | 'member';
}

export interface HouseholdMember {
  id: number;
  household: string;
  user: number;
  user_email: string;
  user_display_name: string;
  role: 'owner' | 'member';
  joined_at: string;
}

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login/', { email, password });
    return response.data;
  },

  refresh: async (refresh: string) => {
    const response = await apiClient.post('/auth/refresh/', { refresh });
    return response.data;
  },

  register: async (data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
    locale?: 'en' | 'fr';
  }) => {
    const response = await apiClient.post('/users/', data);
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get('/users/me/');
    return response.data;
  },
};

// Household API
export const householdAPI = {
  list: async (): Promise<Household[]> => {
    const response = await apiClient.get('/households/');
    return response.data;
  },

  get: async (id: string): Promise<Household> => {
    const response = await apiClient.get(`/households/${id}/`);
    return response.data;
  },

  create: async (data: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    context_notes?: string;
    ai_prompt_context?: string;
  }): Promise<Household> => {
    const response = await apiClient.post('/households/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Household>): Promise<Household> => {
    const response = await apiClient.patch(`/households/${id}/`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/households/${id}/`);
  },

  getMembers: async (id: string): Promise<HouseholdMember[]> => {
    const response = await apiClient.get(`/households/${id}/members/`);
    return response.data;
  },

  inviteMember: async (id: string, email: string, role: 'owner' | 'member' = 'member'): Promise<HouseholdMember> => {
    const response = await apiClient.post(`/households/${id}/invite/`, { email, role });
    return response.data;
  },

  leave: async (id: string): Promise<void> => {
    await apiClient.post(`/households/${id}/leave/`);
  },

  removeMember: async (id: string, userId: number): Promise<void> => {
    await apiClient.post(`/households/${id}/remove_member/`, { user_id: userId });
  },

  updateRole: async (id: string, userId: number, role: 'owner' | 'member'): Promise<HouseholdMember> => {
    const response = await apiClient.post(`/households/${id}/update_role/`, { user_id: userId, role });
    return response.data;
  },
};
