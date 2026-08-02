# Module — chickens

> Rôle : le poulailler familial — registre du troupeau (poules nominatives), relevé de ponte quotidien, journal d'événements (soins, couvaison, décès…), corvées récurrentes avec rappel, coût par œuf, lien vers l'article de stock « nourriture ». Parcours 14 — cadrage : `docs/parcours/PARCOURS_14_GERER_LE_POULAILLER_FAMILIAL.md`.

## État synthétique

- **Backend** : `apps/chickens/` — modèles (`Chicken`, `EggLog`, `ChickenEvent`, `ChickenChore`, `ChickenSettings`), services (point d'entrée unique des écritures), serializers, viewsets DRF + vues settings/summary, câblage agent complet dans `apps.py::ready()`.
- **Frontend** : `ui/src/features/chickens/` — `ChickensPage` (bandeau de ponte, stats, cards poules, journal), `ChickenDetailPage` (fiche + timeline + achat + assistant ancré), `ChickenDialog`, `ChickenEventDialog`, `ChickenPurchaseDialog` (wrap `PurchaseForm`), `EggLogBanner`, `EggStatsSection` + `EggChart` (courbe SVG), `EventTimeline`, `FeedCard`, `ChoresPanel` + `ChoreDialog` (corvées récurrentes). Widget dashboard `ui/src/features/dashboard/ChickensCard.tsx` (masqué sans données).
- **Locales (en/fr/de/es)** : namespace `chickens` + `dashboard.metrics.chickens`.
- **Tests** : `apps/chickens/tests/` — `test_api_chickens.py`, `test_agent_integration.py`, `test_chores.py` (le verrou de non-duplication agent/REST, et celui de l'échéance dérivée).

## Modèle de données

- **`Chicken`** (`chickens`) : `name`, `breed`, `color`, `hatched_on`/`acquired_on` (dates approximatives, nullable), `status` (`active`/`broody`/`sick`/`deceased`/`gone` — `FLOCK_STATUSES` = les 3 premiers, seuls comptés dans l'effectif), `notes`, FK `zone` nullable. DELETE = hard delete (undo = toast différé côté front).
- **`EggLog`** (`chicken_egg_logs`) : `date`, `count` (≥ 0), `note`. **Une row par (foyer, jour)** — contrainte unique, la création est un **upsert** (`update_or_create`) : re-saisir le même jour remplace le compte. C'est aussi ce qui rend idempotent le « j'ai ramassé 4 œufs » de l'agent.
- **`ChickenEvent`** (`chicken_events`) : `chicken` nullable (**null = tout le troupeau**), `type` (`arrival`/`care`/`illness`/`broody`/`molt`/`predator`/`death`/`departure`/`other`), `occurred_on`, `title`, `notes`. CASCADE sur la poule.
- **`ChickenChore`** (`chicken_chores`) : `name`, `emoji`, `interval_days` (≥ 1, contrainte DB), `starts_on`, `is_active`, `notes`. Porte la **cadence** d'un geste qu'on refait — nettoyer le poulailler, laver le mangeoir. **Aucune colonne `last_done_on` ni `next_due_on`** : voir « L'échéance est dérivée » plus bas.
- **`ChickenEvent.chore`** : FK nullable **`SET_NULL`** vers `ChickenChore`. Une corvée faite *est* une entrée du journal (`type=care`) — supprimer la corvée n'efface jamais la preuve qu'elle a été faite.
- **`ChickenSettings`** (`chicken_settings`) : une row par foyer (get-or-create), FK `feed_stock_item` (`SET_NULL`) vers un **`StockItem`** — la réserve (quantité), les seuils et les achats vivent dans le module stock, ce modèle ne fait que pointer (lot 7, remplace l'ancien `feed_tracker`).

## Services — le point d'entrée unique des écritures

`apps/chickens/services.py` : `create_chicken`, `update_chicken`, `delete_chicken`, `log_eggs` (upsert), `delete_egg_log`, `create_event`, `delete_event`, `create_chore`, `update_chore`, `delete_chore`, `complete_chore`, `chore_status`, `chores_with_status`, `overdue_chores`, `get_settings`, `egg_stats`, `flock_summary`. Les viewsets REST **et** les writables agent passent par ces fonctions.

- **`update_chicken`** : une transition vers `deceased`/`gone` **auto-crée le `ChickenEvent`** correspondant (death/departure) daté du jour — l'historique du troupeau reste complet quel que soit le canal (REST ou agent).
- **`create_event`** : si `reminder_due_date` est fourni (option « Me le rappeler » d'un soin), une **Task** est créée via `tasks.services.create_task` (jamais l'ORM) — le rappel bénéficie ensuite des alertes de retard existantes, aucune mécanique nouvelle.
- **`egg_stats(period=30)`** : today, moyennes 7/30 j, total du mois, + (lot 6.1) `period` ∈ {7,30,90,365}, `series` (un point/jour, `count=null` si non relevé), `coverage {logged_days,total_days,rate}`, `period_total`, `period_avg`, `best_day`. Les jours sans relevé sont **absents (null), pas 0** — exclus des moyennes ; le **taux de relevé** rend cette honnêteté chiffrée.
- **`flock_summary`** : effectif actif, œufs du jour/7 j, snapshot de l'article de stock nourriture (quantité, unité, statut, seuil bas — pas de runway), coûts (`total`, `year`, `feed_total`, `flock_total`, `per_egg`), `has_data` (pilote l'affichage du widget dashboard).

## Corvées récurrentes (issue #519)

Le poulailler demande des gestes qu'on refait indéfiniment. Ce qui manquait
n'était pas la liste des gestes — c'était **la date du dernier**.

### L'échéance est dérivée, jamais stockée

`chore_status(chore, today, last_done_on)` calcule :

```
next_due_on = (dernier ChickenEvent lié  OU  starts_on) + interval_days
```

C'est la même règle que le solde bancaire et le « dépensé » du parcours 21, et elle se paie ici comptant :
une échéance stockée dérive **dès qu'une entrée du journal est corrigée ou
supprimée**, et un rappel qui se déclenche sur une date périmée est pire que pas
de rappel. Régression : `test_chores.py::TestTheDueDateIsDerivedAndNeverStored`,
qui recule la date d'une entrée et vérifie que l'échéance recule avec elle.

- **`starts_on` est l'ancre d'une corvée jamais faite.** Sans elle, une corvée
  neuve n'a pas de dernier événement, donc pas d'échéance, donc reste muette pour
  toujours — précisément l'état où le rappel est le plus utile. Éditable : « je
  l'ai fait hier, compte à partir de là » n'oblige pas à fabriquer une fausse
  entrée de journal.
- **Due aujourd'hui n'est pas en retard** (`days_overdue == 0`, `is_due == True`).
- **`chores_with_status` annote `Max('completions__occurred_on')`** : lister N
  corvées coûte une requête, pas N. Et le serializer lit le `today` du contexte
  **sans toucher `obj.household`**, sinon le foyer est chargé une fois par ligne —
  un N+1 invisible sur un foyer à une corvée. Régression :
  `test_chores.py::TestTheApi::test_listing_chores_costs_the_same_whatever_the_number_of_chores`.

### Un seul verdict « en retard », lu par trois écrans

Le panneau (serializer), le rappel (`pings.build_chore_ping`) et l'alerte du
dashboard (`alerts.services._due_chores`) lisent **la même** fonction
`services.overdue_chores` / `chore_status`. Un panneau qui affiche une corvée à
jour pendant que la notification la dit en retard fait perdre leur crédit aux
deux — c'est la règle « un écart ne se dit jamais deux fois avec deux voix »
appliquée à une date. Régression :
`test_chores.py::TestTheReminderAndTheDashboardAgreeWithThePanel`.

### Le rappel — aucun nouveau cron

`PingSpec('chicken_chore')` (défaut 9 h, opt-in par utilisateur) sur le patron de
`weather/pings.py` : le `build_message` dépose **aussi** une notification in-app
(cloche + web push) avant de renvoyer le texte Telegram. Il ride le tick
`send_scheduled_pings` existant — `PingLog` assure l'idempotence du jour.

- **Un seul message pour toutes les corvées en retard**, jamais un par corvée :
  quatre corvées qui traînent produiraient quatre pings le même matin, et quatre
  notifications sur le poulailler, c'est le moment où un rappel devient du bruit.
- **`dedup_key` porte le jour, pas les corvées** — la clé dit « on t'a parlé du
  poulailler aujourd'hui ». Un jeu d'ids re-notifierait dès qu'une cinquième
  corvée glisse, c'est-à-dire au pire moment.
- **`Notification.Type.CHICKEN_CHORE_DUE` est dans `MUTABLE_TYPES`** : récurrent
  par définition, donc coupable. Le libellé vit dans `notifications.type.*` des 4
  locales — un test le vérifie.
- **Une corvée en pause n'est jamais dite en retard** : elle a été sortie de la
  cadence exprès.

### Agent

- `SearchableSpec('chicken_chore')` — « à quelle fréquence on nettoie le
  poulailler ? » ; `ListableSpec` avec les filtres `due` / `active`, et le filtre
  `due` passe par `chore_status` plutôt qu'un SQL réécrit, pour que la réponse de
  l'assistant ne puisse pas diverger de la notification.
- `WritableSpec('chicken_chore')` — créer / modifier la cadence / mettre en pause.
- **`WritableSpec('chicken_chore_done')`** — « j'ai nettoyé le poulailler ». Ce
  n'est pas une édition de la corvée mais **un fait nouveau** ; c'est ce qui donne
  un sens à l'undo, qui supprime l'entrée de journal et laisse l'échéance revenir
  d'elle-même. Le nom se résout par `iexact` puis `icontains`, et une
  **ambiguïté est refusée, jamais devinée** : deux corvées « nettoyage »
  remettraient sinon à zéro la mauvaise, en silence.

### Ce qui a été écarté, et pourquoi

- **La récurrence générique des tâches (#75)** : `apps/tasks/` n'a **aucune**
  notification (#266 est ouverte), donc coupler n'offrait pas le rappel
  gratuitement — il fallait l'écrire dans les deux cas, et l'écrire ici coûte un
  `PingSpec`.
- **Générer une `Task` par occurrence** : une corvée hebdomadaire produit 52
  tâches par an, et il faut trancher le sort de l'occurrence non faite quand la
  suivante tombe — soit elle s'empile, soit l'app archive toute seule ce que
  l'utilisateur n'a pas fait. Ni l'un ni l'autre ne se pose si la corvée dit
  simplement « en retard de 3 jours ».
- **Un module transverse** : le besoin n'a qu'un client. Une deuxième famille de
  corvées (jardin, piscine) imposera d'extraire ce moteur — c'est un déplacement
  de modèle, pas une réécriture. **Limite assumée, à relire le jour venu.**

## Dépenses & coût par œuf

- POST `/api/chickens/{id}/purchase/` (payload compatible `PurchaseForm` : `amount`, `supplier`, `occurred_at`, `notes`) → `interactions.services.create_expense_interaction(kind='chickens_purchase')`, zone de la poule héritée. Template enregistré dans `AUTO_SUBJECT_TEMPLATES` (même msgid « Purchase — {name} » que stock/equipment → déjà traduit dans les .po).
- Coût cumulé = somme des Interactions `metadata.kind == 'chickens_purchase'` **plus** les `stock_purchase` dont la source polymorphe est l'article de stock lié (lot 7 — la nourriture achetée via Stock est attribuée au poulailler) ; coût par œuf = total ÷ œufs loggés. Limite acceptée : changer d'article lié désattribue les achats de l'ancien.
- **Décision produit (lot 6.2) : coût = alimentation + soins**, hors équipement durable. Traduit sans nouveau champ : `feed_total` = achats de l'article nourriture ; `flock_total` = `chickens_purchase` (véto, vermifuge, acquisition). L'équipement durable vit dans son module, n'est jamais un `chickens_purchase` → naturellement exclu. La répartition `{feed_total, flock_total}` est renvoyée pour l'afficher (transparence).

## Stats, santé & alerte de chute (lot 6)

- **Courbe de ponte** (`EggStatsSection` + `EggChart`) : sélecteur 7/30/90/365 j, taux de relevé affiché, courbe SVG sans dépendance. Le pivot rendu visible : jour relevé = point (un vrai 0 = point sur l'axe), jour non relevé = ligne interrompue, bande « couverture » (une case/jour) dessous.
- **Alerte de chute anormale** (`chickens/alerts.py::evaluate_egg_drop_alert`, fonction **pure** sur le modèle de `weather/alerts.py`) : baseline `[J-37..J-8]` vs récent `[J-6..J]` (moyennes sur jours relevés only) ; garde-fous couverture `MIN_BASELINE_DAYS=10` / `MIN_RECENT_DAYS=3` (anti-faux-positif) ; seuil −40 % (`critical` à −60 %) ; **cause** qualifiée : `molt` (ChickenEvent mue < 45 j) > `weather` (`evaluate_weather_alerts` frost/heatwave) > `unknown`. Câblée on-read dans `alerts.services.build_alerts_summary` (`egg_drop_alerts`, gaté `chickens` in `disabled_modules`), rendue client-side dans `AlertsPage`. Pas de ping en V1.

## API — `/api/chickens/`

- CRUD `''` (poules) — filtres `?status=`, `?in_flock=true` ; action `purchase`.
- CRUD `egg-logs/` — POST upsert (201 créé / 200 remplacé), filtres `?date_from=&date_to=`, action GET `stats/?period=` (7/30/90/365).
- CRUD `events/` — filtres `?type=`, `?chicken=` ; `reminder_due_date` write-only à la création.
- CRUD `chores/` — filtre `?active=false` (inclut les corvées en pause ; par défaut seules les actives). Chaque row porte un bloc `status` **lecture seule** (`last_done_on`, `next_due_on`, `days_overdue`, `is_due`, `never_done`). Action POST `chores/{id}/complete/` (`occurred_on`, `notes` optionnels) → crée le `ChickenEvent` et renvoie `{chore, event}`, la corvée **relue** pour que l'appelant reçoive l'échéance déjà repoussée.
- GET/PUT `settings/` — `feed_stock_item` (validation : article du foyer) + snapshot `feed_stock_item_detail`.
- GET `summary/` — le payload du widget dashboard et de l'en-tête de page.

## Intégration agent (tout dans `apps.py::ready()`)

- `SearchableSpec('chicken')` — search sur name/breed/notes, `related` = 10 derniers événements (alimente l'assistant ancré de la fiche poule) ; `SearchableSpec('chicken_event')` — les soins sont citables (« quand a-t-on vermifugé ? »), deep-link `/app/chickens?event={id}`.
- `WritableSpec('chicken')` — create/update/delete ; anchor zone → pré-remplit la zone ; « Roussette est morte » → update status=deceased (+ event auto).
- `WritableSpec('egg_log')` — create = **upsert du jour** via `log_eggs` ; undo = hard delete de la row du jour (limite assumée : si l'agent a remplacé un compte existant, l'undo supprime la journée entière).
- `ListableSpec('chicken')` (status, in_flock) + `ListableSpec('egg_log')` (date_from/date_to) — « combien d'œufs cette semaine ? » passe par `list_entities`.
- **Tool agent `get_chicken_stats`** (lot 6.4, `chickens/agent.py`, enregistré depuis `apps.py`) : agrégats (effectif, ponte jour/7 j/30 j, taux de relevé, coût au œuf, état de l'alerte de chute + cause) — comme `get_weather`, un tool dédié plutôt qu'un searchable, **zéro modif de `apps/agent/`**.
- Descriptions des tools étendues dans `apps/agent/tools.py` (create/update/list) — seule retouche dans `apps/agent/`.
- Front : entrées `chicken`/`egg_log` dans `UNDO_HANDLERS` + `chicken` dans `UPDATE_UNDO_HANDLERS` (`ui/src/features/agent/hooks.ts`).

## Hors scope V1 (assumé)

Photo de la poule, destination des œufs (consommés/donnés/vendus), incubation/poussins, multi-poulaillers.

Sur les corvées : pas d'assignation à un membre (le pont vers une `Task` reste le geste explicite de `create_event(reminder_due_date=…)`), pas de corvée rattachée à une poule précise (elles sont toutes à l'échelle du troupeau), et pas d'historique de ponctualité.
