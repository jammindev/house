# Module — telegram

> Rôle : canal Telegram de l'agent conversationnel. Un bot Telegram devient un point d'entrée vers `agent.service.ask()` — poser une question sur son foyer, recevoir la réponse avec citations cliquables, créer des items (tâche, note) avec un bouton « Annuler ». Couche de transport pure : **aucune logique métier**, tout passe par le même `ask()` que l'API web.
>
> Parcours : `docs/parcours/PARCOURS_07_LOT9_CANAL_TELEGRAM.md` (lots 9a–9d). Socle agent : [agent.md](./agent.md).

## État synthétique

- **Backend** : `apps/telegram/`
  - `models.py` — `TelegramAccount` (OneToOne user ↔ `chat_id`, source unique d'identité).
  - `linking.py` — tokens de liaison signés/expirants (aucun stockage), `link_account`.
  - `client.py` — wrapper mince sur l'API Bot (`httpx`, erreurs avalées).
  - `service.py` — routage des updates (messages + `callback_query`), thread de traitement, cooldown, dédup, i18n. Porte aussi `BOT_COMMANDS`, la **source de vérité** du menu de commandes.
  - `rendering.py` — `AnswerResult` → messages HTML (citations en liens, découpage 4096), clavier inline d'undo.
  - `views.py` — webhook sécurisé, `link-token`, `account` (statut/délier).
  - `management/commands/telegram_set_webhook.py` — enregistre l'URL + le secret (à lancer au déploiement).
  - `management/commands/telegram_set_commands.py` — pousse `BOT_COMMANDS` vers Telegram (`setMyCommands`, par langue). Câblé au job `deploy` (`continue-on-error`).
- **Frontend** : `ui/src/features/settings/components/TelegramSection.tsx` (carte réglages : connecter / statut / délier), `ui/src/lib/api/telegram.ts`, hooks dans `ui/src/features/settings/hooks.ts`.
- **Locales (en/fr/de/es)** : clés `settings.telegram*`. Les messages du bot sont côté serveur (`gettext`, `locale/`).
- **Tests** : `apps/telegram/tests/` — `test_webhook.py`, `test_linking.py`, `test_service.py`, `test_bridge.py`, `test_rendering.py`, `test_account_api.py`, `test_undo.py`.
- **Feature flag** : `TELEGRAM_BOT_TOKEN` vide ⇒ canal désactivé (le webhook rejette tout, aucun appel sortant, la carte réglages disparaît).

## Flux d'un message

```
Telegram ──POST /api/telegram/webhook/── (secret header, temps constant)
   │  200 immédiat + dédup update_id
   ▼
TelegramAccount.chat_id → user  (chat inconnu → réponse fixe, zéro donnée)
   ▼  thread daemon (Telegram retente sinon ; ask() = 10–30 s)
household résolu (active_household / 1er membership)
   ▼
AgentConversation get-or-create (ancre channel/telegram = discriminateur, PAS passée à ask())
   ▼
agent.service.ask(text, household, user=…, history=…)  ← même entrée que l'API web
   ▼
render_answer → messages HTML + citations (FRONTEND_URL + url_path)
created_entities → clavier inline « ↩️ Annuler »
```

## Liaison de compte

1. Réglages web → « Connecter Telegram » → `POST /api/telegram/link-token/` → deep-link `t.me/<bot>?start=<token>`.
2. Token = HMAC salé sur `<user_pk>_<timestamp>`, ≤ 64 chars `[A-Za-z0-9_-]` (contrainte du payload `/start`), expire après `TELEGRAM_LINK_TOKEN_MAX_AGE_SECONDS` (15 min). **Rien en base.**
3. `/start <token>` → `consume_link_token` vérifie signature + fraîcheur → `link_account` (re-liaison = `chat_id` volé à l'ancien propriétaire, cas légitime : nouveau téléphone).
4. Chat non lié → réponse fixe identique pour tous (aucune fuite sur les comptes existants).

## Sécurité

- **Webhook** : `X-Telegram-Bot-Api-Secret-Token` comparé en temps constant à `TELEGRAM_WEBHOOK_SECRET` ; secret vide ⇒ tout est rejeté. Toujours 200 une fois authentifié (un non-200 fait boucler Telegram).
- **Identité** : seule la table `TelegramAccount` fait foi ; jamais confiance aux ids du payload. Le `callback_query` d'undo est re-vérifié (`chat_id` lié **et** `from.id == chat_id`).
- **Scope foyer** : `ask()` reçoit le household résolu serveur — même cloisonnement que l'API web.
- **Anti-abus** : cooldown par `chat_id` (`TELEGRAM_COOLDOWN_SECONDS`, cache) — une rafale coûte un seul appel LLM.

## Undo des écritures (lot 9d)

`WritableSpec` (registry `agent.writables`) gagne un champ optionnel
`delete(household, user, object_id)` — miroir backend des `UNDO_HANDLERS` du front.
Câblé sur les services métier : `task` → `tasks.services.archive_task` (archive),
`note` → `interactions.services.delete_note_interaction` (hard delete). Point
d'entrée unique `writables.delete_created(entity_type, household, user, id)`
(`LookupError` si déjà supprimé → double-tap idempotent).

Côté Telegram, `metadata.created_entities` → un bouton inline par entité undoable
(`callback_data = "undo:<type>:<id>"`). Le handler supprime puis édite le message
(clavier retiré) et accuse réception via `answerCallbackQuery`.

**Rendre une nouvelle entité undoable depuis un canal** = ajouter `delete=` à son
`WritableSpec` (le service métier existe déjà pour la DELETE API). Zéro touche à
`apps/telegram/`.

## Configuration & déploiement

Variables d'env (`base.py` défaut vide → `local.py`/`production.py` → `.env.example`) :

| Variable | Rôle |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token @BotFather ; vide = canal off |
| `TELEGRAM_BOT_USERNAME` | @username public du bot (deep-links) |
| `TELEGRAM_WEBHOOK_SECRET` | chaîne aléatoire, vérifiée à chaque webhook |

Déploiement : renseigner les 3 variables, puis
`python manage.py telegram_set_webhook` (URL par défaut : `<FRONTEND_URL>/api/telegram/webhook/`,
doit être en HTTPS). Pas de conteneur ni de worker dédié : le webhook vit dans le
service `web`, le traitement dans un thread daemon.

## Menu de commandes (`/` autocomplete)

Telegram n'apprend PAS les commandes du comportement du bot : le menu `/` est une
liste qu'on enregistre via `setMyCommands` et que Telegram garde côté serveur.
La **source de vérité** est `BOT_COMMANDS` dans `service.py` (nom + description
`gettext_lazy`). `telegram_set_commands` la pousse par langue ; **le job `deploy`
le lance à chaque push sur `main`** (`continue-on-error`), donc le menu se met à
jour tout seul.

> **En ajoutant/renommant une commande slash dans `_handle_message`, mets à jour
> `BOT_COMMANDS`** — sinon le menu diverge de ce que le bot accepte réellement.
> Le test `test_set_commands.py::test_commands_mirror_the_handlers` garde ce
> couplage. `/start` n'y figure pas (bouton « Start » natif de Telegram).

## Envoi sortant proactif (pings)

`outbound.py::send_agent_message(account, household, text)` — le seul chemin
d'envoi initié serveur : délivre via `client.send_message` **puis** persiste le
tour assistant dans LA conversation canal (rien n'est persisté si Telegram
rejette). Consommé par le module [pings](./pings.md) (scheduler + préférences) ;
la réponse de l'utilisateur suit le flux entrant standard ci-dessus.

Opt-out conversationnel : un message `stop` (ou `/stop`, mot seul, insensible à
la casse) désactive toutes les `PingPreference` du user — intercepté en dur
dans `service.py` avant l'agent, comme `/help` et `/reset`. Détail dans
[pings.md](./pings.md).

## Hors scope (→ #225, V2)

Photos → documents, messages vocaux, groupe foyer, streaming, WhatsApp (même
architecture de canal). Les notifications sortantes proactives sont couvertes
par le module [pings](./pings.md).
