/**
 * Enregistre le service worker (`/sw.js`, servi par Django à la racine).
 *
 * Uniquement en production : en dev, Vite/django-vite fait du HMR et un SW qui
 * met en cache l'app-shell rendrait le rechargement à chaud imprévisible.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[pwa] service worker registration failed', err);
    });
  });
}
