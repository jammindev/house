import axios from 'axios';

// Use relative URLs - Vite proxy in dev, same origin in prod
const API_BASE_URL = '/api';
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

function getCookie(name: string): string | null {
  if (!document.cookie) {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.substring(name.length + 1));
    }
  }

  return null;
}

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include CSRF token for unsafe methods
apiClient.interceptors.request.use(
  (config) => {
    const method = (config.method || 'GET').toUpperCase();
    if (!CSRF_SAFE_METHODS.has(method)) {
      const csrfToken = getCookie('csrftoken');
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle unauthenticated requests
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login/') {
      window.location.href = '/login/';
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

  logout: async () => {
    const response = await apiClient.post('/auth/logout/');
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
