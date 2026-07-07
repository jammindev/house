# Parcours 07 — Lot 9 : Canal Telegram (parler à la maison depuis sa messagerie)

> **État : 🧭 cadré le 2026-07-07, non démarré.**
> L'agent conversationnel devient joignable depuis **Telegram** : on pose sa
> question dans sa messagerie habituelle, l'agent répond avec ses citations,
> et peut créer des items (tâche, note) avec un Undo inline.
>
> Socle : [PARCOURS_07_LOT7_FUNCTION_CALLING.md](./PARCOURS_07_LOT7_FUNCTION_CALLING.md)
> + [PARCOURS_07_LOT8_ACTIONS_ECRITURE.md](./PARCOURS_07_LOT8_ACTIONS_ECRITURE.md)
> Doc produit : [PARCOURS_07_AGENT_CONVERSATIONNEL.md](./PARCOURS_07_AGENT_CONVERSATIONNEL.md)
> Fiche module : [docs/MODULES/agent.md](../MODULES/agent.md)

## 1. Pourquoi ce lot

L'agent sait lire (lot 7) et écrire (lot 8), mais il n'est joignable que depuis
l'app web. Or l'usage naturel d'un assistant foyer est **mobile et impulsif** :
« combien j'ai payé la VMC ? » se pose depuis le canapé ou le magasin, pas
devant un navigateur. Telegram donne ce point d'entrée pour un coût minimal :
API bot gratuite et sans validation, webhook HTTPS (déjà couvert par Traefik),
boutons inline (parfaits pour l'Undo du lot 8).

### La contrainte directrice

> Telegram est un **canal**, pas une feature : zéro logique métier dedans.

Le bot est une couche de transport qui (1) authentifie l'expéditeur,
(2) appelle `agent.service.ask()` — le même point d'entrée que l'API web —,
(3) met en forme la réponse. Toute la logique (tools, retrieval, garde-fous
d'écriture, anti-doublon) reste dans `apps/agent/`, intacte. Le choix inverse
(logique dans le bot) rendrait WhatsApp/canaux futurs deux fois plus chers.

### Alternatives écartées

- **WhatsApp** : le bon canal côté adoption, mais Meta Business + numéro dédié
  + facturation par conversation + fenêtre de 24 h. V2 si l'usage décolle.
- **Signal / iMessage** : pas d'API bot officielle. **Matrix** : homeserver à
  héberger pour zéro gain d'adoption. **SMS** : payant et pauvre (pas de liens
  riches, pas de boutons).

## 2. Architecture cible

```
Telegram  ──POST──▶  /api/telegram/webhook/          (secret header vérifié)
                          │  200 immédiat, traitement en thread
                          ▼
              TelegramAccount.chat_id → user + household   (compte non lié → invite)
                          ▼
              AgentConversation get-or-create (ancre channel/telegram)
                          ▼
              agent.service.ask(question, household, user=…, history=…)
                          ▼
              réponse HTML + citations → liens FRONTEND_URL + url_path
              created_entities → boutons inline « Annuler » (callback_query)
```

Points clés :

- **Nouvelle app `apps/telegram/`** — seule adhérence à `apps/agent/` :
  `service.ask` + `AgentConversation`/`AgentMessage`. La signature de `ask()`
  **ne change pas**.
- **Pas de nouveau conteneur** : le webhook vit dans le service `web` existant.
  Pas de Celery — à l'échelle d'un foyer, un `threading.Thread` daemon suffit
  (répondre 200 tout de suite, car Telegram retente en boucle au-delà de
  quelques secondes ; `ask()` peut prendre 10–30 s avec les tool calls).
- **Feature OFF par défaut** : `TELEGRAM_BOT_TOKEN` vide → aucune URL exposée
  utile, aucun appel sortant, l'app tourne exactement comme avant.

## 3. Liaison de compte (le seul vrai morceau de conception)

Un `chat_id` Telegram doit être associé à un user du foyer, sans jamais faire
confiance à ce que l'expéditeur déclare.

### Modèle `TelegramAccount` (`apps/telegram/models.py`)

- `user` OneToOne(`accounts.User`) — 1 user = 1 compte Telegram ; chaque membre
  du foyer lie le sien.
- `chat_id` BigIntegerField unique — l'identité côté Telegram.
- `username` CharField blank — affichage dans les réglages (« lié à @ben »).
- `linked_at` DateTimeField.

Le household n'est **pas** stocké : résolu à chaque message via
`user.active_household` (fallback premier membership), comme le middleware web.

### Flux de liaison

1. Réglages web → bouton « Connecter Telegram » → `POST /api/telegram/link-token/`
   renvoie un deep-link `https://t.me/<bot>?start=<token>`.
2. Le token est **signé, pas stocké** : `django.core.signing.TimestampSigner`
   sur l'id du user, expiration 15 min. Zéro modèle, zéro cleanup.
3. L'user ouvre le lien → Telegram envoie `/start <token>` au webhook →
   signature + fraîcheur vérifiées → `TelegramAccount` créé (ou re-pointé si
   l'user relie un nouveau compte). Confirmation dans le chat.
4. Message d'un `chat_id` inconnu → réponse fixe « compte non lié, passe par
   les réglages de l'app » — **aucune donnée du foyer ne sort**.

## 4. Webhook & traitement

- `POST /api/telegram/webhook/` — hors auth DRF, `csrf_exempt`. Sécurité :
  header `X-Telegram-Bot-Api-Secret-Token` comparé à
  `settings.TELEGRAM_WEBHOOK_SECRET` (`constant_time_compare`) ; mismatch → 403.
- **Dédup** best-effort par `update_id` (cache mémoire borné) : Telegram
  retente tout non-200, on ne veut pas répondre deux fois.
- Thread de traitement : `close_old_connections()` à l'entrée,
  `translation.override(user.locale or household.preferred_language)` autour du
  rendu (messages système du bot localisés ; l'agent répond de toute façon dans
  la langue de la question).
- `sendChatAction: typing` pendant le traitement.

### Commandes

| Entrée | Effet |
|---|---|
| `/start <token>` | liaison de compte (§3) |
| `/start` nu, `/help` | statut + mode d'emploi |
| `/reset` | archive la conversation courante → repart à zéro |
| texte libre | `ask()` avec l'historique |

### Conversation & historique

Réutilise `AgentConversation` avec l'ancre comme **discriminateur de canal** :
`get_or_create(household, created_by=user, context_entity_type="channel",
context_object_id="telegram")`. L'ancre n'est **pas** passée à `ask()` (pas de
pré-injection de contexte — ce n'est pas une entité). Historique : mêmes règles
que le web (20 derniers `AgentMessage`), messages persistés → la rétention
(`cleanup_agent_conversations`) et l'admin sont gratuits. La sidebar web
n'affiche que les conversations non ancrées, donc pas de pollution.

### Rendu de la réponse

- `parse_mode=HTML` (échappement plus simple que MarkdownV2).
- Les `<cite id="…"/>` du texte sont remplacés par des liens numérotés, et les
  citations listées en pied de message :
  `<a href="{FRONTEND_URL}{url_path}">{label}</a>`.
- Découpage à 4 096 caractères (limite Telegram) sur des frontières de lignes.

### Client Telegram (`apps/telegram/client.py`)

Wrapper mince sur l'API Bot (`requests`, timeouts courts) : `send_message`,
`send_chat_action`, `answer_callback_query`, `edit_message_reply_markup`,
`set_webhook`. Pas de SDK tiers — 5 méthodes ne justifient pas une dépendance.
Management command `telegram_set_webhook` pour enregistrer l'URL + le secret
(à lancer une fois au déploiement).

## 5. Écritures & Undo inline (symétrie avec le lot 8)

`metadata.created_entities` existe déjà. Côté Telegram, le toast « Annuler »
devient un **bouton inline** sous la réponse : `callback_data =
"undo:<entity_type>:<id>"`. Le handler `callback_query` supprime l'item et
édite le message (« ✅ annulé », bouton retiré).

Le front web garde ses `UNDO_HANDLERS` (TS) ; le backend n'a pas d'équivalent.
On l'ajoute **au bon endroit** : un champ optionnel `delete: Callable`
(`(household, user, object_id) -> None`) sur `WritableSpec`, câblé sur les
services métier existants (`tasks` → archive, `note` → delete interaction).
Miroir backend de l'undo front, réutilisable par tout canal futur — zéro
logique dans `apps/telegram/`.

Garde-fous du lot 8 inchangés (prompt strict, anti-doublon par tour) : ils
vivent dans `service.ask`, donc valent pour tous les canaux par construction.

## 6. Sécurité — récapitulatif

1. Webhook : secret header en temps constant, 403 sinon.
2. Identité : seule la table `TelegramAccount` fait foi ; token de liaison
   signé + expirant ; chat inconnu → réponse fixe sans donnée.
3. Scope foyer : `ask()` reçoit le household résolu côté serveur — même
   cloisonnement que l'API web.
4. Anti-abus : cooldown simple par `chat_id` (réutilise le cache), au-delà →
   message « doucement » sans appel LLM.
5. `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` : env uniquement
   (`base.py` défaut vide + `local.py`/`production.py` + `.env.example`).

## 7. Découpage en lots / issues

| Lot | Contenu | Issue |
|---|---|---|
| 9a | Socle backend : app `apps/telegram`, `TelegramAccount`, webhook sécurisé, liaison `/start <token>`, client API, `telegram_set_webhook` | #221 |
| 9b | Pont agent : conversation canal, `ask()` en thread, rendu HTML + citations, locale, `/reset`, typing, cooldown | #222 |
| 9c | Frontend réglages : carte « Telegram » (connecter via deep-link, statut @username, délier) + i18n ×4 | #223 |
| 9d | Écritures : `WritableSpec.delete`, boutons inline « Annuler », handler `callback_query` | #224 |

9a → 9b livrent la valeur cœur (poser une question). 9c rend la liaison
self-service (avant ça, deep-link généré à la main pour la recette). 9d ferme
la parité avec le web.

## 8. Fichiers touchés (prévision)

**Backend**
- `apps/telegram/` (nouveau) — `models.py`, `views.py` (webhook + link-token),
  `client.py`, `service.py` (routage commandes, thread, rendu), `urls.py`,
  `management/commands/telegram_set_webhook.py`, tests.
- `apps/agent/writables.py` — champ optionnel `delete` sur `WritableSpec` (9d).
- `apps/tasks/apps.py`, `apps/interactions/apps.py` — câblage `delete` (9d).
- `config/settings/{base,local,production}.py`, `.env.example` — 2 variables.
- `config/urls.py` — include `apps.telegram.urls`.

**Frontend (9c)**
- Page réglages : carte Telegram (connecter / statut / délier).
- `ui/src/features/telegram/hooks.ts` — link-token + statut + délier.
- `locales/{en,fr,de,es}` — clés `telegram.*`.

## 9. Tests

- **Webhook** : sans header → 403 ; header faux → 403 ; `update_id` dupliqué →
  traité une fois.
- **Liaison** : token valide → `TelegramAccount` créé ; token expiré/altéré →
  refus ; re-liaison → `chat_id` re-pointé ; chat inconnu → réponse fixe,
  `ask()` jamais appelé.
- **Pont agent** : message texte → `ask()` mocké (pattern
  `test_conversations_api.py`) → `send_message` mocké reçoit réponse + liens
  citations ; l'historique circule au 2ᵉ message ; `/reset` archive.
- **Undo** : `created_entities` → clavier inline ; `callback_query` → item
  supprimé via `WritableSpec.delete` + message édité ; id inconnu → erreur
  propre.
- Le client HTTP est **toujours mocké** — aucun appel réseau en test.

## 10. Hors scope de ce lot (→ issue `idea` V2 : #225)

- **Notifications sortantes proactives** (alertes du parcours 06, digest
  quotidien, stock bas) — le canal devient bidirectionnel.
- **Photos → documents** (envoyer une facture en photo depuis Telegram).
- **Messages vocaux** (transcription puis `ask()`).
- **Groupe Telegram du foyer** (bot en groupe, multi-locuteurs).
- **Streaming** de la réponse (Telegram ne le permet pas proprement —
  `editMessageText` en rafale = rate limit).
- **WhatsApp** — même architecture de canal, plateforme V2.

## 11. Definition of done

1. Depuis les réglages web, « Connecter Telegram » → `/start` → compte lié en
   moins d'une minute, confirmation dans le chat.
2. « combien j'ai payé pour la VMC ? » dans Telegram → réponse correcte avec
   citations cliquables vers l'app.
3. Le suivi de conversation tient d'un message à l'autre ; `/reset` repart à
   zéro.
4. « ajoute une tâche : purger la VMC samedi » crée la tâche ; le bouton
   « Annuler » sous la réponse la retire.
5. Un inconnu qui écrit au bot n'obtient **aucune** donnée du foyer.
6. `TELEGRAM_BOT_TOKEN` vide → aucun comportement ne change nulle part.
