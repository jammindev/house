# Module — pings

> Rôle : messages **proactifs** de l'agent — l'app parle en premier. Un scheduler
> envoie à heure fixe une question templatée sur Telegram (« 🥚 Combien d'œufs
> ramassés aujourd'hui ? ») ; la réponse de l'utilisateur repasse par le pipeline
> entrant normal (`agent.service.ask` + writables) et enregistre la donnée. Le
> LLM n'est **jamais** appelé à l'envoi — uniquement à la réponse.
>
> Parcours : `docs/parcours/PARCOURS_16_AGENT_PROACTIF_TELEGRAM.md`. Canal :
> [telegram.md](./telegram.md), socle agent : [agent.md](./agent.md).

## État synthétique

- **Backend** : `apps/pings/`
  - `registry.py` — `PingSpec` (`ping_type`, `build_message`, `default_send_at`,
    `module`), même philosophie que `agent.searchables`/`writables` : chaque app
    déclare ses pings depuis `apps.py::ready()`, zéro code ping-spécifique ici.
  - `models.py` — `PingPreference` (opt-in par user + heure locale, **off par
    défaut**), `PingLog` (une ligne par envoi, contrainte unique
    `(household, user, ping_type, sent_on)` = verrou d'idempotence du tick).
  - `services.py` — `send_due_pings()` (LE tick), `available_pings`,
    `upsert_preference`. Source de vérité unique : l'API et le scheduler
    appellent les mêmes fonctions.
  - `views.py` / `urls.py` — `GET /api/pings/` (pings dispo + préférences
    mergées), `PUT /api/pings/<ping_type>/` (toggle + heure).
  - `management/commands/send_scheduled_pings.py` — le tick en one-shot
    (cron-friendly) ou `--loop --interval 300` (mode du conteneur prod).
- **Envoi** : `apps/telegram/outbound.py::send_agent_message` — délivre via
  `client.send_message` PUIS persiste le tour assistant dans LA conversation
  canal `(household, user)` ; un échec de livraison ne persiste rien.
- **Prod** : service `scheduler` de `docker-compose.prod.yml` (même image que
  `web`, entrypoint remplacé par la command en `--loop`).
- **Frontend** : `ui/src/features/settings/components/ProactiveSection.tsx`
  (sous la carte Telegram), `ui/src/lib/api/pings.ts`, hooks `usePings` /
  `useUpdatePing` dans `ui/src/features/settings/hooks.ts`.
- **Locales** : clés `settings.pings.*` (4 langues) ; le texte des pings est
  côté serveur (`gettext`, rendu dans la langue du destinataire).
- **Tests** : `apps/pings/tests/` (tick, timezone, idempotence, gating, API),
  `apps/telegram/tests/test_outbound.py`, `apps/chickens/tests/test_pings.py`.

## Le tick — `send_due_pings()`

Pattern « scheduler bête, command intelligente » : peu importe qui appelle le
tick ni combien de fois, le résultat est le même.

```
toutes les préférences enabled=True
   │  par préférence (try/except individuel — un foyer ne bloque pas les autres)
   ▼
heure locale du foyer (Household.timezone, fallback UTC) ≥ send_at ?
   ▼
PingLog (household, user, type, jour local) existe ? → déjà envoyé, skip
   ▼
TelegramAccount lié ? module actif ?
   ▼
translation.override(locale user) → spec.build_message(household, user, today)
   │  None = rien à demander aujourd'hui (donnée déjà saisie…) → skip, ré-évalué au tick suivant
   ▼
PingLog.get_or_create  ← claim AVANT l'envoi (deux ticks concurrents se départagent en DB)
   ▼
telegram.outbound.send_agent_message  ← échec ⇒ le claim est libéré, retry au tick suivant
```

Propriétés : **idempotent** (contrainte unique), **rattrapage** (un tick raté →
le ping part au suivant, ex. 19h05 au lieu de 19h), **jamais de doublon**,
**jamais de question sur une donnée déjà saisie** (contrat des `build_message`).

## Ajouter un ping (~10 lignes)

Dans le `apps.py::ready()` de l'app concernée :

```python
from datetime import time as dt_time
from pings.registry import PingSpec, register as register_ping

register_ping(PingSpec(
    ping_type='tracker_entry',
    module='trackers',                      # gating modules existant
    build_message=build_tracker_ping,       # (household, user, *, today) -> str | None
    default_send_at=dt_time(19, 0),
))
```

Règles du `build_message` :
- retourner `None` quand il n'y a rien à demander (donnée du jour déjà là,
  module vide) — c'est lui qui porte la règle « ne jamais spammer » ;
- texte via `gettext` (le caller a déjà activé la locale du destinataire) ;
- rester **peu coûteux** : il tourne à chaque tick après l'heure d'envoi.

Ajouter la clé UI `settings.pings.types.<ping_type>` dans les 4 locales
(libellé du toggle dans les réglages). Rien d'autre : ni l'API, ni le
scheduler, ni le front ne changent.

## Pings enregistrés

| ping_type | app | module | question | skip |
|---|---|---|---|---|
| `egg_log` | chickens | chickens | « 🥚 Combien d'œufs ramassés aujourd'hui ? » (19h) | pas de poule au poulailler, ou `EggLog` du jour déjà saisi |

## La réponse de l'utilisateur

Aucun mode « formulaire » : le ping est persisté comme tour assistant dans la
conversation canal Telegram, donc quand l'utilisateur répond « 5 », le pipeline
entrant standard (`telegram/service.py` → `ask()` avec historique) voit la
question dans le contexte et enregistre via le writable existant (`egg_log` →
`chickens.services.log_eggs`, upsert idempotent) — avec le clavier « Annuler »
habituel. Répondre une deuxième fois le même soir **remplace** le compte.

## Hors scope V1 (→ parcours 16)

Plage de silence globale et plafond quotidien (garde-fous A4), « stop »
conversationnel, digest des alertes, rappels relevés eau/élec/trackers,
échéances de tâches, stock bas, pings générés par le LLM.
