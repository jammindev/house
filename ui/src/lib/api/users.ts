import { api } from '@/lib/axios';

/** User profile API utilities */

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  locale: string;
  avatar: string | null;
  theme: string;
  color_theme: string;
  full_name: string;
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
}

export type Theme = 'light' | 'dark' | 'system';
export type ColorTheme =
  | 'theme-house'
  | 'theme-blue'
  | 'theme-sass'
  | 'theme-sass2'
  | 'theme-sass3'
  | 'theme-purple'
  | 'theme-green'
  | 'theme-crimson'
  | 'theme-teal'
  | 'theme-amber'
  | 'theme-indigo'
  | 'theme-rose'
  | 'theme-cyan'
  | 'theme-slate'
  | 'theme-emerald'
  | 'theme-lavender'
  | 'theme-midnight';
export type Locale = 'en' | 'fr' | 'de' | 'es';

export interface UpdateProfileInput {
  display_name?: string;
  locale?: Locale;
  theme?: Theme;
  color_theme?: ColorTheme;
}

export async function fetchMe(): Promise<UserProfile> {
  const { data } = await api.get('/accounts/users/me/');
  return data as UserProfile;
}

export async function patchMe(input: UpdateProfileInput): Promise<UserProfile> {
  const { data } = await api.patch('/accounts/users/me/', input);
  return data as UserProfile;
}

export async function changePassword(
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  await api.post('/accounts/users/me/change-password/', {
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  const { data } = await api.post('/accounts/users/me/avatar/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as { avatar_url: string };
}

export async function deleteAvatar(): Promise<void> {
  await api.delete('/accounts/users/me/avatar/');
}
