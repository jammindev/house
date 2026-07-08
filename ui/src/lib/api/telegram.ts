import { api } from '@/lib/axios';

export interface TelegramStatus {
  /** Server-side channel toggle — hide the settings card when false. */
  enabled: boolean;
  linked: boolean;
  username: string;
  linked_at: string | null;
}

export interface TelegramLinkToken {
  deep_link: string;
  expires_in: number;
}

export async function fetchTelegramStatus(): Promise<TelegramStatus> {
  const { data } = await api.get<TelegramStatus>('/telegram/account/');
  return data;
}

export async function createTelegramLinkToken(): Promise<TelegramLinkToken> {
  const { data } = await api.post<TelegramLinkToken>('/telegram/link-token/');
  return data;
}

export async function unlinkTelegram(): Promise<void> {
  await api.delete('/telegram/account/');
}
