# Module — chickens

> Rôle : le poulailler familial — registre du troupeau (poules nominatives), relevé de ponte quotidien, journal d'événements (soins, couvaison, décès…), coût par œuf, lien vers le tracker de nourriture. Parcours 14 — cadrage : `docs/parcours/PARCOURS_14_GERER_LE_POULAILLER_FAMILIAL.md`.

## État synthétique

- **Backend** : `apps/chickens/` — modèles (`Chicken`, `EggLog`, `ChickenEvent`, `ChickenSettings`), services (point d'entrée unique des écritures), serializers, viewsets DRF + vues settings/summary, câblage agent complet dans `apps.py::ready()`.
- **Frontend** : `ui/src/features/chickens/` — `ChickensPage` (bandeau de ponte, stats, cards poules, journal), `ChickenDetailPage` (fiche + timeline + achat + assistant ancré), `ChickenDialog`, `ChickenEventDialog`, `ChickenPurchaseDialog` (wrap `PurchaseForm`), `EggLogBanner`, `EggStatsSection`, `EventTimeline`, `FeedCard`. Widget dashboard `ui/src/features/dashboard/ChickensCard.tsx` (masqué sans données).
- **Locales (en/fr/de/es)** : namespace `chickens` + `dashboard.metrics.chickens`.
- **Tests** : `apps/chickens/tests/` — `test_api_chickens.py`, `test_agent_integration.py` (111 tests, dont le verrou de non-duplication agent/REST).

## Modèle de données

- **`Chicken`** (`chickens`) : `name`, `breed`, `color`, `hatched_on`/`acquired_on` (dates approximatives, nullable), `status` (`active`/`broody`/`sick`/`deceased`/`gone` — `FLOCK_STATUSES` = les 3 premiers, seuls comptés dans l'effectif), `notes`, FK `zone` nullable. DELETE = hard delete (undo = toast différé côté front).
- **`EggLog`** (`chicken_egg_logs`) : `date`, `count` (≥ 0), `note`. **Une row par (foyer, jour)** — contrainte unique, la création est un **upsert** (`update_or_create`) : re-saisir le même jour remplace le compte. C'est aussi ce qui rend idempotent le « j'ai ramassé 4 œufs » de l'agent.
- **`ChickenEvent`** (`chicken_events`) : `chicken` nullable (**null = tout le troupeau**), `type` (`arrival`/`care`/`illness`/`broody`/`molt`/`predator`/`death`/`departure`/`other`), `occurred_on`, `title`, `notes`. CASCADE sur la poule.
- **`ChickenSettings`** (`chicken_settings`) : une row par foyer (get-or-create), FK `feed_tracker` vers un tracker **consumption** — la réserve/le rythme vivent dans le tracker (module trackers), ce modèle ne fait que pointer.

## Services — le point d'entrée unique des écritures

`apps/chickens/services.py` : `create_chicken`, `update_chicken`, `delete_chicken`, `log_eggs` (upsert), `delete_egg_log`, `create_event`, `delete_event`, `get_settings`, `egg_stats`, `flock_summary`. Les viewsets REST **et** les writables agent passent par ces fonctions.

- **`update_chicken`** : une transition vers `deceased`/`gone` **auto-crée le `ChickenEvent`** correspondant (death/departure) daté du jour — l'historique du troupeau reste complet quel que soit le canal (REST ou agent).
- **`create_event`** : si `reminder_due_date` est fourni (option « Me le rappeler » d'un soin), une **Task** est créée via `tasks.services.create_task` (jamais l'ORM) — le rappel bénéficie ensuite des alertes de retard existantes, aucune mécanique nouvelle.
- **`egg_stats`** : today, moyennes 7/30 j, total du mois, série de 30 points. Les jours sans relevé sont **absents (null), pas 0** — ils sont exclus des moyennes.
- **`flock_summary`** : effectif actif, œufs du jour/7 j, snapshot du tracker nourriture (runway = réserve ÷ rythme), coûts (`total`, `year`, `per_egg`), `has_data` (pilote l'affichage du widget dashboard).

## Dépenses & coût par œuf

- POST `/api/chickens/{id}/purchase/` (payload compatible `PurchaseForm` : `amount`, `supplier`, `occurred_at`, `notes`) → `interactions.services.create_expense_interaction(kind='chickens_purchase')`, zone de la poule héritée. Template enregistré dans `AUTO_SUBJECT_TEMPLATES` (même msgid « Purchase — {name} » que stock/equipment → déjà traduit dans les .po).
- Coût cumulé = somme des Interactions `metadata.kind == 'chickens_purchase'` ; coût par œuf = total ÷ œufs loggés. **Limite V1 assumée** : la nourriture achetée via le module Stock n'est pas attribuée au poulailler.

## API — `/api/chickens/`

- CRUD `''` (poules) — filtres `?status=`, `?in_flock=true` ; action `purchase`.
- CRUD `egg-logs/` — POST upsert (201 créé / 200 remplacé), filtres `?date_from=&date_to=`, action GET `stats/`.
- CRUD `events/` — filtres `?type=`, `?chicken=` ; `reminder_due_date` write-only à la création.
- GET/PUT `settings/` — `feed_tracker` (validation : tracker du foyer + kind=consumption).
- GET `summary/` — le payload du widget dashboard et de l'en-tête de page.

## Intégration agent (tout dans `apps.py::ready()`)

- `SearchableSpec('chicken')` — search sur name/breed/notes, `related` = 10 derniers événements (alimente l'assistant ancré de la fiche poule) ; `SearchableSpec('chicken_event')` — les soins sont citables (« quand a-t-on vermifugé ? »), deep-link `/app/chickens?event={id}`.
- `WritableSpec('chicken')` — create/update/delete ; anchor zone → pré-remplit la zone ; « Roussette est morte » → update status=deceased (+ event auto).
- `WritableSpec('egg_log')` — create = **upsert du jour** via `log_eggs` ; undo = hard delete de la row du jour (limite assumée : si l'agent a remplacé un compte existant, l'undo supprime la journée entière).
- `ListableSpec('chicken')` (status, in_flock) + `ListableSpec('egg_log')` (date_from/date_to) — « combien d'œufs cette semaine ? » passe par `list_entities`.
- Descriptions des tools étendues dans `apps/agent/tools.py` (create/update/list) — seule retouche dans `apps/agent/`.
- Front : entrées `chicken`/`egg_log` dans `UNDO_HANDLERS` + `chicken` dans `UPDATE_UNDO_HANDLERS` (`ui/src/features/agent/hooks.ts`).

## Hors scope V1 (assumé)

Photo de la poule, destination des œufs (consommés/donnés/vendus), incubation/poussins, multi-poulaillers, récurrence automatique des rappels de soins (tâches one-shot).
