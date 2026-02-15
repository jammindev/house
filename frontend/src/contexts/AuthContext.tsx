import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authAPI, householdAPI, type User, type Household } from '../api/client';

interface AuthContextType {
  user: User | null;
  households: Household[];
  selectedHouseholdId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
    locale?: 'en' | 'fr';
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshHouseholds: () => Promise<void>;
  setSelectedHouseholdId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load selected household from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedHouseholdId');
    if (saved) {
      setSelectedHouseholdIdState(saved);
    }
  }, []);

  // Save selected household to localStorage
  const setSelectedHouseholdId = (id: string | null) => {
    setSelectedHouseholdIdState(id);
    if (id) {
      localStorage.setItem('selectedHouseholdId', id);
    } else {
      localStorage.removeItem('selectedHouseholdId');
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authAPI.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    }
  };

  const refreshHouseholds = async () => {
    try {
      const householdsData = await householdAPI.list();
      setHouseholds(householdsData);

      // Auto-select first household if none selected or selected one no longer exists
      if (householdsData.length > 0) {
        const stillExists = householdsData.find(h => h.id === selectedHouseholdId);
        if (!stillExists) {
          setSelectedHouseholdId(householdsData[0].id);
        }
      } else {
        setSelectedHouseholdId(null);
      }
    } catch (error) {
      console.error('Failed to fetch households:', error);
      setHouseholds([]);
    }
  };

  // Initialize user and households on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          await refreshUser();
          await refreshHouseholds();
        } catch (error) {
          console.error('Auth initialization failed:', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    localStorage.setItem('accessToken', response.access);
    localStorage.setItem('refreshToken', response.refresh);
    await refreshUser();
    await refreshHouseholds();
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('selectedHouseholdId');
    setUser(null);
    setHouseholds([]);
    setSelectedHouseholdId(null);
  };

  const register = async (data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
    locale?: 'en' | 'fr';
  }) => {
    await authAPI.register(data);
    // Auto-login after registration
    await login(data.email, data.password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        households,
        selectedHouseholdId,
        loading,
        login,
        logout,
        register,
        refreshUser,
        refreshHouseholds,
        setSelectedHouseholdId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
