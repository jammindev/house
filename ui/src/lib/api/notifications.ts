import { api } from '@/lib/axios';

export type NotificationType = 'household_invitation' | (string & {});

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  /** Où mène la notification. Porté par la ligne et non par le type : « Bob a
   * terminé Tondre la pelouse » désigne cette tâche-là. Vide = rien à ouvrir. */
  url: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface PaginatedResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const p = data as PaginatedResponse<T>;
  return Array.isArray(p?.results) ? p.results : [];
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data } = await api.get('/notifications/');
  return normalizeList<NotificationItem>(data);
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count/');
  return data?.count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/mark-read/`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/mark-all-read/', {});
}

/**
 * Les types que l'utilisateur a le droit de faire taire.
 *
 * Servi par l'API et non redéclaré ici : `MUTABLE_TYPES` est ce que le chemin
 * d'écriture applique réellement, donc une liste en dur finirait par proposer
 * une case que l'API refuse — ou par en cacher une qu'elle accepterait.
 */
export async function fetchMutableNotificationTypes(): Promise<string[]> {
  const { data } = await api.get<{ types: string[] }>('/notifications/mutable-types/');
  return data?.types ?? [];
}
