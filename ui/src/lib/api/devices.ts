import { api } from '@/lib/axios';

/**
 * Un jeton d'appareil — le droit d'envoyer des photos, et rien d'autre.
 *
 * `token` n'est présent **que** dans la réponse de création : le serveur n'en garde
 * que l'empreinte. Ne pas le copier à ce moment-là oblige à en émettre un autre.
 */
export interface DeviceToken {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  is_revoked: boolean;
}

export interface IssuedDeviceToken extends DeviceToken {
  token: string;
}

function rows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  return ((data as { results?: T[] })?.results ?? []) as T[];
}

export async function fetchDeviceTokens(): Promise<DeviceToken[]> {
  const { data } = await api.get('/accounts/devices/');
  return rows<DeviceToken>(data);
}

export async function createDeviceToken(name: string): Promise<IssuedDeviceToken> {
  const { data } = await api.post('/accounts/devices/', { name });
  return data as IssuedDeviceToken;
}

export async function revokeDeviceToken(id: string): Promise<DeviceToken> {
  const { data } = await api.post(`/accounts/devices/${id}/revoke/`);
  return data as DeviceToken;
}
