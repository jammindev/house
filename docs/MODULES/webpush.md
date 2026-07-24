# Module — webpush

> Rôle : **canal de notifications push** vers la PWA (Web Push / VAPID). Stocke les
> abonnements des navigateurs des utilisateurs et sait leur envoyer une notification
> système, même app fermée. Couche de **transport** pure : le *contenu* des notifs
> vient des sources existantes (`notifications.service.send`, `pings`) — cf. lot 3.
>
> Parcours : « app mobile » (lot 0 socle PWA, lot 1 backend). Concepts + décisions :
> [../fiches/PWA_PUSH.md](../fiches/PWA_PUSH.md). Sources de notifs :
> [notifications.md](./notifications.md), [pings.md](./pings.md).

## État synthétique

- **Backend** : `apps/webpush/`
  - `models.py` — `WebPushSubscription` (user-scoped, 1 ligne par endpoint navigateur : `endpoint` unique, `p256dh`, `auth`, `user_agent`, `last_success_at`).
  - `service.py` — `send_web_push(user, title, body, *, url, tag, data)` : signe (VAPID) et POST via `pywebpush`. **Best-effort** (ne lève jamais), **prune auto** des abonnements morts (HTTP 404/410), **no-op** si VAPID non configuré (`is_configured()`).
  - `views.py` / `urls.py` — 4 endpoints DRF (voir plus bas).
  - `serializers.py` — `SubscribeSerializer` (shape `PushSubscription.toJSON()` : `endpoint` + `keys{p256dh, auth}`).
  - `management/commands/generate_vapid_keys.py` — génère une paire VAPID (formats prêts pour le navigateur + pywebpush).
  - `admin.py` — lecture des abonnements (clés en readonly).
- **Service worker** (socle PWA, lot 0) : `templates/sw.js`, servi à la racine `/sw.js` par une route Django (`config/urls.py`) pour avoir un scope `/`. Porte les handlers `push` + `notificationclick`. Enregistré en prod par `ui/src/lib/pwa/registerServiceWorker.ts`.
- **Frontend abonnement** : lot 2 (à venir) — le SW sait déjà recevoir.
- **Config** : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_ADMIN_EMAIL` (env ; défauts vides ⇒ push désactivé proprement).
- **Dépendance** : `pywebpush==2.3.0` (tire `cryptography`, `py-vapid`, `http-ece`).
- **Tests** : `apps/webpush/tests/test_webpush.py` — subscribe/unsubscribe/scoping, no-op sans clés, prune 410, garde sur erreur transitoire, endpoint de test.

## Modèles & API

`WebPushSubscription` — **user-scoped** (comme `Notification`) : un abonnement appartient
à un navigateur d'un user, pas à un foyer. Un push part vers tous les appareils du user.

| Endpoint | Méthode | Rôle |
|---|---|---|
| `/api/webpush/vapid-public-key/` | GET | Clé publique (application server key) dont le navigateur a besoin pour s'abonner. |
| `/api/webpush/subscribe/` | POST | Upsert **par `endpoint`** (idempotent) l'abonnement du user courant. |
| `/api/webpush/unsubscribe/` | POST | Supprime l'abonnement (`endpoint`) du user courant. |
| `/api/webpush/test/` | POST | Envoie une notif de test au user courant → `{ "sent": <n> }`. |

Toutes protégées par `IsAuthenticated`.

## Flux d'un envoi

```
source de notif (stock bas, invitation, ping…)   ← lot 3
   ▼
webpush.service.send_web_push(user, title, body, url=…)
   │  is_configured() ? sinon return 0 (no-op)
   ▼  pour chaque WebPushSubscription du user
pywebpush.webpush(subscription_info, data=JSON, vapid_private_key, vapid_claims)
   │   ├─ 201/2xx → last_success_at = now()
   │   ├─ 404/410 → DELETE la sub (endpoint mort)
   │   └─ autre erreur → log, sub conservée (transitoire)
   ▼
push service (FCM/Apple/Mozilla) → SW du navigateur → sw.js `push` → showNotification
   ▼ clic → sw.js `notificationclick` → focus/ouvre data.url (deep-link)
```

## Sécurité & robustesse

- **VAPID** : la clé privée signe chaque envoi, prouvant au push service l'identité du serveur. Vide ⇒ `is_configured()` False ⇒ aucun envoi (pas de crash). La clé privée ne vit que dans le `.env` (jamais commitée ; `generate_vapid_keys` ne l'imprime qu'au terminal).
- **Scope user** : `subscribe`/`unsubscribe` opèrent sur `request.user` ; un user ne peut pas supprimer l'abonnement d'un autre.
- **Auto-nettoyage** : les endpoints révoqués par le navigateur (désabonnement, désinstallation) renvoient 404/410 au premier envoi → la ligne est supprimée. Pas d'accumulation de subs mortes.
- **Best-effort** : `send_web_push` avale toutes les exceptions — un push raté ne casse jamais l'action métier qui l'a déclenché.
- **Contenu non mis en cache** : le SW ne met jamais `/api` en cache (auth Bearer → risque de fuite entre users) ; seul l'app-shell + les assets immuables le sont.

## Activer en production

1. `docker compose -f docker-compose.prod.yml exec web python manage.py generate_vapid_keys`
2. Copier `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` dans le `.env`, ajouter `VAPID_ADMIN_EMAIL=<contact>`.
3. Recréer les conteneurs qui envoient : `docker compose -f docker-compose.prod.yml up -d --force-recreate web scheduler`.
4. Vérifier : `... exec web python manage.py shell -c "from webpush.service import is_configured; print(is_configured())"` → `True`.

## Notes / décisions

- **Pas de `enabled` sur le modèle** : subscribe = create, unsubscribe = delete, prune = delete. Un seul état, pas de flag à synchroniser.
- **`web` ET `scheduler` doivent avoir les clés** : le `web` envoie les notifs événementielles + le test ; le `scheduler` enverra les pings (lot 3). Les deux lisent `env_file: .env`.
- **iOS** : le push n'arrive que si la PWA est **installée** sur l'écran d'accueil (iOS 16.4+) — d'où le bandeau d'installation du lot 0. Cf. fiche PWA_PUSH.
