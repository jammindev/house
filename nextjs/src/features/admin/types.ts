// Admin-specific types
export interface SystemAdmin {
  id: string;
  user_id: string;
  role: 'admin' | 'super_admin';
  granted_by?: string;
  granted_at: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined user data
  user_email?: string;
  user_display_name?: string;
}

export interface SystemStats {
  total_users: number;
  total_households: number;
  total_interactions: number;
  total_zones: number;
  total_documents: number;
  total_projects: number;
  total_equipment: number;
  active_users_last_30_days: number;
  new_households_last_30_days: number;
  storage_usage_mb: number;
}

export interface UserWithStats {
  id: string;
  email: string;
  display_name?: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  households_count: number;
  interactions_count: number;
  is_admin: boolean;
  admin_role?: 'admin' | 'super_admin';
}

export interface HouseholdWithStats {
  id: string;
  name: string;
  created_at: string;
  members_count: number;
  interactions_count: number;
  zones_count: number;
  projects_count: number;
  documents_count: number;
  equipment_count: number;
  owner_email?: string;
}

export type AdminRole = 'user' | 'admin' | 'super_admin';

export interface AdminContext {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminRole: AdminRole;
  loading: boolean;
  refresh: () => Promise<void>;
}