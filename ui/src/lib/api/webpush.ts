import { api } from '@/lib/axios';

export interface VapidPublicKey {
  publicKey: string;
}

/** Clé publique VAPID (vide = push non configuré côté serveur → feature masquée). */
export async function fetchVapidPublicKey(): Promise<string> {
  const { data } = await api.get<VapidPublicKey>('/webpush/vapid-public-key/');
  return data.publicKey;
}

/**
 * Enregistre l'abonnement du navigateur. `PushSubscription.toJSON()` produit
 * exactement la forme attendue par le backend : { endpoint, keys: { p256dh, auth } }.
 */
export async function subscribeWebPush(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await api.post('/webpush/subscribe/', {
    endpoint: json.endpoint,
    keys: json.keys,
  });
}

export async function unsubscribeWebPush(endpoint: string): Promise<void> {
  await api.post('/webpush/unsubscribe/', { endpoint });
}

export async function sendTestWebPush(): Promise<number> {
  const { data } = await api.post<{ sent: number }>('/webpush/test/', {});
  return data.sent;
}
