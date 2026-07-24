/*
 * Service worker — House PWA.
 *
 * Servi à la racine (`/sw.js`) par Django (voir config/urls.py) pour avoir un
 * scope `/` et contrôler tout `/app/*`. NE PAS le déplacer sous /static/ :
 * son scope serait réduit à /static/ et il ne contrôlerait plus le SPA.
 *
 * Rôles :
 *  - rendre l'app installable + consultable hors-ligne (cache app-shell + assets
 *    Vite immuables). Les réponses /api ne sont volontairement jamais mises en
 *    cache ici (auth par Bearer token → risque de fuite entre utilisateurs).
 *  - recevoir les notifications push (Web Push) et gérer le clic → deep-link.
 *
 * Fichier servi via TemplateView : ne pas y introduire de syntaxe de template
 * Django (doubles accolades ou balises pourcent), elle serait interprétée.
 */

const STATIC_CACHE = 'house-static-v1';
const SHELL_CACHE = 'house-shell-v1';
const SHELL_KEY = '__app_shell__';
const KNOWN_CACHES = [STATIC_CACHE, SHELL_CACHE];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isImmutableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/static/react/assets/') || url.pathname.startsWith('/static/icons/'))
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Tous les chemins /app/* renvoient le même index.html : on le stocke
      // sous une clé unique pour servir n'importe quelle route hors-ligne.
      cache.put(SHELL_KEY, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(SHELL_KEY);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // Tout le reste (dont /api) : réseau direct, pas de cache SW.
});

// --- Web Push -------------------------------------------------------------

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'House';
  const options = {
    body: payload.body || '',
    icon: '/static/icons/icon-192.png',
    badge: '/static/icons/icon-192.png',
    tag: payload.tag || undefined,
    data: { url: payload.url || '/app/dashboard' },
  };

  // App-icon badge (Badging API): the count rides in the payload so the badge
  // stays right even when the SPA is closed. Guarded — not every UA/OS exposes
  // it, and it only surfaces on an installed PWA (iOS 16.4+).
  const tasks = [self.registration.showNotification(title, options)];
  if (typeof payload.unreadCount === 'number' && self.navigator.setAppBadge) {
    tasks.push(
      payload.unreadCount > 0
        ? self.navigator.setAppBadge(payload.unreadCount)
        : self.navigator.clearAppBadge()
    );
  }
  event.waitUntil(Promise.all(tasks).catch(() => {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/app/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
