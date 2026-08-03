/** Détection de plateforme / capacités PWA, partagée (InstallHint, Web Push). */

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * La plateforme, du point de vue de **ce qu'on peut y faire** — pas de la marque.
 *
 * L'envoi de photos depuis un téléphone n'a pas le même parcours partout, et
 * l'utilisateur n'a aucun moyen de le deviner : Android reçoit le partage système
 * sans rien configurer, iOS impose un raccourci et un jeton, et sur un ordinateur
 * la question ne se pose pas. Un écran qui ne fait pas cette distinction affiche à
 * chacun les instructions des deux autres.
 */
export type DevicePlatform = 'ios' | 'android' | 'desktop';

export function devicePlatform(): DevicePlatform {
  if (isIos()) return 'ios';
  if (isAndroid()) return 'android';
  return 'desktop';
}

/** True quand l'app tourne installée (écran d'accueil / fenêtre standalone). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari expose ce flag non standard quand lancée depuis l'écran d'accueil.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** True si le navigateur supporte le Web Push (service worker + PushManager + Notification). */
export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Reflète le nombre de notifications non lues sur l'icône de l'app (Badging API).
 * No-op silencieux si l'API n'est pas exposée (navigateur/OS non compatible, ou
 * PWA non installée). `count <= 0` efface la pastille.
 */
export function syncAppBadge(count: number): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) {
      void nav.setAppBadge?.(count);
    } else {
      void nav.clearAppBadge?.();
    }
  } catch {
    // Badging API absent or refused — ignore.
  }
}

/**
 * Convertit une clé publique VAPID (base64url) en Uint8Array, format attendu par
 * `pushManager.subscribe({ applicationServerKey })`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  // Back it by a concrete ArrayBuffer so the result satisfies BufferSource
  // (applicationServerKey) under the generic Uint8Array typings.
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
