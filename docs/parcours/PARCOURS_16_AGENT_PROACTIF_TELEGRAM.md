# Parcours 16 — L'agent me contacte (pings proactifs Telegram)

> Cadrage : 2026-07-12. Le canal Telegram (parcours 07, lot 9) est entrant
> uniquement ; ce parcours le rend **bidirectionnel** : l'agent initie la
> conversation au bon moment, l'utilisateur répond, la donnée est enregistrée.
> Use case fondateur : « 🥚 Combien d'œufs ramassés aujourd'hui ? » le soir →
> réponse « 5 » → `EggLog` du jour.
>
> Module : [pings.md](../MODULES/pings.md). Reprend l'idée « notifications
> sortantes proactives » différée en #225.

## Décisions d'architecture (actées)

1. **Pattern tick + scheduler bête** : un conteneur `scheduler`
   (docker-compose prod, même image que `web`) exécute
   `manage.py send_scheduled_pings --loop` toutes les 5 min. Toute
   l'intelligence (heure locale, dédup, gating) est dans
   `pings.services.send_due_pings()` — idempotent, rattrapage, testable sans
   infra. Pas de Celery (cohérent avec l'arbitrage #189 : un seul foyer).
2. **Le ping sortant est un template, pas une génération LLM** : gettext dans
   la langue du destinataire, coût zéro à l'envoi, aucun appel API dans le
   scheduler. Le LLM n'entre en jeu qu'à la réponse, via le pipeline entrant
   existant (le ping persiste comme tour assistant dans la conversation canal —
   le modèle voit sa propre question dans l'historique).
3. **Registry `PingSpec`** (miroir de `searchables`/`writables`) : chaque app
   déclare ses pings dans `apps.py::ready()` ; `build_message` retourne `None`
   quand il n'y a rien à demander (donnée déjà saisie) — la règle « jamais de
   question inutile » vit dans la spec, pas dans le scheduler.
4. **Opt-in par user** : tout est off par défaut ; préférence
   `(household, user, ping_type)` + heure locale (timezone du foyer).

## Backlog

### Lot A — Socle : l'agent peut écrire en premier

| # | Story | État |
|---|---|---|
| A1 | Recevoir un message initié par l'agent (envoi + persistance conversation, langue user, skip silencieux si non lié, échec loggé sans casser le job) | ✅ V1 |
| A2 | Répondre au ping → écriture via writables + undo (contexte = historique de conversation, réponse hors sujet traitée normalement) | ✅ V1 (pipeline existant) |
| A3 | Scheduler fiable (heure fixe par foyer, idempotent, fault-isolé, observable, compatible compose prod) | ✅ V1 |
| A4 | Anti-spam global : plage de silence, plafond quotidien, « stop » conversationnel | ⏳ V2 (la dédup jour + skip donnée-déjà-saisie sont en V1) |

### Lot B — Contrôle utilisateur

| # | Story | État |
|---|---|---|
| B1 | Réglages « Messages proactifs » : toggle + heure par ping, off par défaut, gating modules, hint si Telegram non lié | ✅ V1 |
| B2 | Historique unifié web (ping visible dans la conversation canal, undo depuis le web, `/reset` n'empêche pas les pings suivants) | ✅ V1 (par construction) |

### Lot C — Saisies récurrentes (question du soir → écriture)

| # | Story | État |
|---|---|---|
| C1 | ⭐ Relevé de ponte quotidien (« combien d'œufs ? » 19h, upsert `log_eggs`, skip si déjà saisi / pas de poule) | ✅ V1 |
| C2 | Rappel de relevé par tracker (fréquence configurable, dernière valeur en contexte) — rejoint #197 | V2 |
| C3 | Rappel compteur d'eau mensuel (dernier index en contexte, monotonie) | V2 |
| C4 | Rappel compteur électrique (multi-compteurs) | V2 |
| C5 | « Une dépense à noter ? » hebdo (opt-in explicite) | V2 |

### Lot D — Échéances et seuils

| # | Story | État |
|---|---|---|
| D1 | Digest quotidien des alertes (`build_alerts_summary`, groupé, silence si rien) | V2 |
| D2 | Rappel de tâche à échéance (« c'est fait » → done, « décale à samedi » → due_date) | V2 |
| D3 | Stock bas avec réassort conversationnel (event-driven sur transition de statut) | V2 |
| D4 | Garantie / maintenance équipement (prérequis : writable d'intervention) | V2 |
| D5 | Échéances d'assurance (prérequis : module terminé) | V2 |

## Scope V1 livré

- `apps/pings/` : registry + `PingPreference`/`PingLog` + tick + API + command.
- `apps/telegram/outbound.py` : envoi sortant + persistance conversation canal.
- `apps/chickens/pings.py` : ping `egg_log` (le premier `PingSpec`).
- Service `scheduler` dans `docker-compose.prod.yml`.
- Réglages UI (`ProactiveSection`) + i18n 4 langues (UI et message du bot).

## Garde-fous V1 (implicites au design)

- Jamais deux fois le même ping le même jour (contrainte DB, claim avant envoi).
- Jamais de question sur une donnée déjà saisie (`build_message` → `None`).
- Off par défaut, opt-in par user, heure choisie par l'utilisateur.
- Échec de livraison ⇒ rien de persisté, retry naturel au tick suivant.
