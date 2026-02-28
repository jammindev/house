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

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function fetchMe(): Promise<UserProfile> {
  const response = await fetch('/api/accounts/users/me/', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json() as Promise<UserProfile>;
}

export async function patchMe(data: UpdateProfileInput): Promise<UserProfile> {
  const csrfToken = getCsrfToken();
  const response = await fetch('/api/accounts/users/me/', {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }
  return response.json() as Promise<UserProfile>;
}

export async function changePassword(
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  const csrfToken = getCsrfToken();
  const response = await fetch('/api/accounts/users/me/change-password/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
    body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(error.detail ?? `API error ${response.status}`);
  }
}

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const csrfToken = getCsrfToken();
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await fetch('/api/accounts/users/me/avatar/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
    body: formData,
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { avatar?: string[] };
    throw new Error(error.avatar?.[0] ?? `API error ${response.status}`);
  }
  return response.json() as Promise<{ avatar_url: string }>;
}

export async function deleteAvatar(): Promise<void> {
  const csrfToken = getCsrfToken();
  const response = await fetch('/api/accounts/users/me/avatar/', {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(error.detail ?? `API error ${response.status}`);
  }
}
