# PWA & Web Push — app installable + notifications système

> Comment `house` est devenu une app installable sur téléphone, capable d'envoyer
> des notifications push même fermée — sans app native, sans store, sans compte Apple.
> Parcours « app mobile » (lot 0 socle PWA, lot 1 backend). Module : [../MODULES/webpush.md](../MODULES/webpush.md).

## 1. Le problème

`house` est un SPA React servi par Django. On voulait le recevoir **comme une app**
sur le téléphone (surtout iPhone) et surtout : **recevoir des notifications** (stock
bas, rappels, digest…) sans avoir l'app ouverte. Deux options classiques :

- **App native** (Swift/Kotlin) ou **React Native** : vraie app store, push fiable,
  mais un 2ᵉ codebase à maintenir + compte Apple Developer (99 €/an) + build iOS.
- **PWA (Progressive Web App)** : on emballe le site web existant pour qu'il soit
  installable et qu'il reçoive du push. Un seul codebase, gratuit.

Vu qu'on est solo et que le front est déjà responsive, on a choisi la **PWA**.

## 2. Les concepts en deux phrases (chacun)

- **PWA** : un site web qui, grâce à un **manifest** (métadonnées : nom, icône, mode
  plein écran) et un **service worker**, peut être « installé » sur l'écran d'accueil
  et fonctionner comme une app.
- **Service worker (SW)** : un script JS qui tourne **en arrière-plan**, séparé de la
  page, même quand l'app est fermée. Il intercepte les requêtes réseau (cache/offline)
  et reçoit les **événements push** du système.
- **Web Push** : le protocole standard qui permet à un serveur d'envoyer un message à
  un navigateur via un **push service** tiers (Google FCM, Apple, Mozilla). Le
  navigateur réveille le SW, qui affiche la notification.
- **VAPID** : une paire de clés (publique/privée) qui **identifie ton serveur** auprès
  des push services. La clé privée signe chaque envoi ; la clé publique est donnée au
  navigateur au moment de l'abonnement. Sans VAPID, les push services refusent l'envoi.

### Le trajet complet d'une notification

```
1. (navigateur) l'utilisateur autorise + s'abonne avec la clé publique VAPID
        → obtient un "endpoint" (URL unique chez FCM/Apple/Mozilla) + 2 clés de chiffrement
2. (front → serveur) POST /api/webpush/subscribe/  { endpoint, keys }   → stocké en DB
        ...plus tard...
3. (serveur) send_web_push(user, titre, corps)  → signe VAPID + POST vers l'endpoint
4. (push service)  route le message vers l'appareil, réveille le service worker
5. (sw.js) event "push" → showNotification(titre, corps, icône, url)
6. (sw.js) clic → event "notificationclick" → ouvre l'app sur la bonne page (deep-link)
```

## 3. Comment on l'a appliqué dans house

### Lot 0 — rendre l'app installable (le socle)

- **Manifest** : déjà présent (`templates/manifest.json`, servi par Django) — nom,
  icônes 192/512, `display: standalone`, `start_url: /app/dashboard`.
- **Service worker** : `templates/sw.js`. Point subtil de l'archi **django-vite** : le
  HTML est servi par **Django**, pas par Vite, et le build vit sous `/static/react/`.
  Un SW ne contrôle que les URLs **sous son propre chemin** ; servi depuis
  `/static/react/` il ne verrait pas `/app/*`. On le sert donc **à la racine `/sw.js`**
  via une route Django (miroir de `/manifest.json`) → scope `/` → il contrôle tout.
  C'est pour ça qu'on **n'a pas utilisé `vite-plugin-pwa`** (il suppose que Vite
  possède le HTML).
- Le SW met en cache l'app-shell (offline lecture) mais **jamais `/api`** (auth par
  Bearer token → une réponse mise en cache pourrait fuiter vers un autre user du même
  appareil). Il embarque déjà les handlers `push` / `notificationclick`.
- **Installation iOS** : Safari ne propose pas de bouton « installer » automatique, et
  surtout le push iOS **n'existe que depuis une PWA installée** sur l'écran d'accueil
  (iOS 16.4+). D'où `ui/src/components/InstallHint.tsx` : un bandeau « Partager → Sur
  l'écran d'accueil », affiché seulement sur iOS hors mode standalone.

### Lot 1 — le backend d'envoi (VAPID)

- App `apps/webpush/` : modèle `WebPushSubscription` (les abonnements) + service
  `send_web_push` (signature + envoi via `pywebpush`) + endpoints subscribe / unsubscribe
  / vapid-public-key / test. Détails : [../MODULES/webpush.md](../MODULES/webpush.md).
- Clés VAPID générées par `manage.py generate_vapid_keys`, stockées en `.env`.
  Vides ⇒ tout marche mais l'envoi est un **no-op** (dégradation propre).

### Lot 2 — l'abonnement côté front (livré)

- Toggle « Notifications push » dans les réglages (`WebPushSection.tsx`) + bouton
  « notif de test ». État « abonné » lu côté SW (pas serveur). Gating iOS (installer
  l'app d'abord) et navigateur non compatible. Helpers `ui/src/lib/pwa/platform.ts`.

### Lot 3 — branchement des sources + pastille (livré)

- **Événements** : `notifications.service.send()` miroite chaque notif vers
  `send_web_push` en best-effort (point d'entrée unique → stock, invitations, météo
  d'un coup). Deep-link par type + `unreadCount` embarqué.
- **Pings** : abstraction canal `pings.services._deliver()` — Web Push **à côté** de
  Telegram (qui reste en filet + garde la persistance du tour pour les réponses). Le
  ping compte comme envoyé dès qu'un canal délivre ; `PingLog` relâché sinon.
- **Pastille d'icône** (Badging API) : `sw.js` pose `setAppBadge(unreadCount)` au push
  (app fermée) ; `syncAppBadge` + `useUnreadCount` la synchronisent app ouverte et
  l'effacent à la lecture. Pas de pastille par ping (pas de notion « non lu »).

## 4. Pourquoi cette implémentation

- **PWA plutôt que natif** : 1 codebase, 0 € de store, réutilise 100 % du front. Le
  coût assumé est la contrainte iOS (installation manuelle obligatoire).
- **SW servi par Django à la racine** : seule façon simple d'obtenir un scope `/` dans
  une archi où Django possède le HTML. Plus robuste que de forcer un plugin Vite.
- **Transport séparé du contenu** : `webpush` ne sait qu'*envoyer*. Le *quoi* et le
  *quand* restent dans les sources de notifs existantes → on ne duplique aucune logique
  métier, et brancher une nouvelle source = un appel de plus à `send_web_push`.
- **No-op sans clés + best-effort** : la feature n'a jamais le droit de casser un
  déploiement (clés absentes) ni une action métier (push raté).

## 5. Ce qu'on a écarté et pourquoi

- **Capacitor / React Native** : reportés. Pertinents si un jour on veut un push iOS
  ultra-fiable ou une présence App Store. Le backend `webpush` et le front resteraient
  largement réutilisables. Pour un usage foyer, la PWA suffit.
- **`vite-plugin-pwa`** : mauvais fit avec django-vite (HTML côté Django, assets sous
  `/static/react/`). SW écrit à la main = plus simple à raisonner et à servir en scope `/`.
- **Mettre `/api` en cache offline** : écarté pour le lot 0 (risque de fuite entre
  users, auth Bearer). Un offline « données » viendra via une persistance react-query
  ciblée si besoin.
- **Un flag `enabled` sur l'abonnement** : inutile — subscribe crée, unsubscribe et
  prune suppriment. Un seul état.

## 6. Pour aller plus loin

- [Web Push (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [VAPID — RFC 8292](https://datatracker.ietf.org/doc/html/rfc8292)
- [PWA sur iOS / Web Push (WebKit, iOS 16.4+)](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [pywebpush](https://github.com/web-push-libs/pywebpush)
