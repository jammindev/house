# Parcours 30 — Backlog technique V1

> **Cadré et livré le 2026-08-15**, en quatre PR (#604, #605, #612, #613).
> Compte rendu d'exécution — décisions prises en chemin, pièges rencontrés et ce
> qui a été laissé de côté : [CR_PARCOURS_30_VERGER.md](../comptes-rendus/CR_PARCOURS_30_VERGER.md).
>
> **Reste ouvert** : le widget dashboard (ORCH-11), les specs Playwright des lots
> 6 à 8, et le guide « Verger » de la page Tutoriel.

## Tableau de bord

Issue parente : **#593**.

| Lot | Sujet | Statut | Issue |
|---|---|---|---|
| 1 | Socle backend `apps/orchard` — modèles `Tree` / `TreeEvent` / `Harvest`, clé de module | ✅ Livré (#604) | #594 |
| 2 | Services + API DRF — point d'écriture unique viewset + agent | ✅ Livré (#604) | #595 |
| 3 | Frontend « Verger » — page, cards par zone, fiche du sujet, journal | ✅ Livré (#605) | #596 |
| 4 | Récoltes et séries par saison | ✅ Livré (#605) | #597 |
| 5 | Entretien saisonnier — `CareRule`, échéance dérivée, tâche en un clic | ✅ Livré (#612) | #598 |
| 6 | Argent et photos — achat, coût cumulé, onglets Documents/Photos | ✅ Livré (#613) | #599 |
| 7 | Le verger hors du module — widget dashboard, alerte gel × floraison | ✅ Livré (#613) | #600 |
| 8 | Intégration agent — Searchable / Listable / Writable + `get_harvest_stats` | ✅ Livré (#613) | #601 |

**Issue annexe** : **#602** — sujets V1.1 / V2 délibérément différés (DAR après
traitement, pollinisation croisée, base de variétés, plan du verger, crédit de la
récolte au stock, détection de déclin, GDD, potager annuel).

## Doc associée

- Doc produit : [PARCOURS_30_SUIVRE_LE_VERGER.md](./PARCOURS_30_SUIVRE_LE_VERGER.md)
- Fiche concept : [CADENCE_SAISONNIERE.md](../fiches/CADENCE_SAISONNIERE.md)
- Glossaire des user stories : [USER_STORIES.md](../USER_STORIES.md) — `ORCH-01` à
  `ORCH-14`, chacune adossée à une spec Playwright nommée dans son issue de lot
- `CLAUDE.md` — sections « Interaction vs modèle dédié », « Pattern standard —
  Feature page », « Agent — actions d'écriture », « Le fuseau du foyer », « Saisie
  d'un décimal », « Fraîcheur des données »
- Pattern de référence backend : `apps/chickens/` (module vivant complet : modèles,
  services, `apps.py::ready()` avec les trois specs, tool d'agrégats, pings)
- Pattern de référence frontend : `ui/src/features/chickens/`
- Pattern cadence par intervalle (celle qu'on **ne** réutilise **pas**, et pourquoi) :
  `apps/chickens/services.py::chore_status`

## Flow cible

1. créer une zone extérieure si le foyer n'en a pas, puis y planter des sujets
   (nom, type, variété, date de plantation si connue)
2. consigner ce qu'on fait : taille, traitement, observation — daté, typé, par sujet
3. déclarer les règles saisonnières du verger (« taille d'hiver : novembre → mars ») ;
   la page ouvre sur ce qui est à faire cette saison
4. peser les récoltes ; lire la série des saisons
5. être prévenu la veille d'un gel quand des sujets sont en période de floraison
6. agent : « quand a-t-on taillé le gros pommier ? » (lecture citée) et « note 12 kg
   de pommes sur le pommier du fond » (écriture avec undo)

## Décisions de cadrage

- **Une entité `Tree` avec un champ `kind`, pas quatre modèles.** `fruit_tree`,
  `berry_bush`, `vine`, `ornamental`. Tailler, traiter, récolter et noter est le même
  geste pour un pommier et pour un framboisier. `kind` pilote **l'affichage** (un
  ornemental ne propose pas la récolte) et les valeurs proposées, **jamais le schéma**.
- **`Tree.zone` est obligatoire, `on_delete=PROTECT`.** Demandé au cadrage. `PROTECT`
  et non `CASCADE` parce que la zone est un contenant et l'arbre un bien : supprimer
  « Jardin » ne doit pas effacer quinze ans de récoltes en silence. Un refus nommé vaut
  mieux qu'une perte silencieuse — même arbitrage que `restore_db.sh`. ⚠️ Le refus doit
  aussi tenir quand la zone part **en cascade depuis un parent** (voir Vigilance).
- **Le journal est un modèle dédié (`TreeEvent`), pas une `Interaction` générique.**
  Arbitré explicitement avec l'utilisateur. Trois raisons, toutes dans la règle
  « Interaction vs modèle dédié » du `CLAUDE.md` : l'échéance se dérive d'un
  `MAX(occurred_on)` **groupé par `CareRule`** (un `GROUP BY` sur une FK, interdit
  depuis `metadata`) ; le `type` est filtré et contraint (un `metadata.kind` est
  stringly-typed, une faute de frappe crée une catégorie fantôme) ; la FK typée donne
  la timeline et la cascade. **Contrepartie assumée** : les entrées du verger
  n'apparaissent pas dans le fil d'activité du foyer, exactement comme le poulailler —
  c'est un sujet transverse (issue #509), pas une raison de dupliquer le journal.
- **`Harvest` est un modèle dédié**, pas une `Interaction` ni un `Tracker`. Une récolte
  est agrégée et requêtée par saison, donc jamais du JSON ; et ce n'est pas une série de
  relevés — elle a une unité, une saison et plusieurs occurrences par saison.
- **La cadence est une fenêtre de mois, pas un intervalle de jours.** Voir la fiche
  concept. `next_due` est **dérivé à la lecture**, jamais stocké.
- **Une règle propose une tâche, elle n'en fabrique jamais en tâche de fond.** L'app a
  déjà trois définitions de « en retard » ; une quatrième les mettrait en contradiction.
  Les règles échues remontent dans `alerts.services`, comme les corvées de poulailler.
- **L'alerte gel réutilise `weather.alerts` sans réécrire un seul seuil.** Le module
  n'apporte que le croisement avec `flowering_months`.
- **`flowering_months` vide = non renseigné, pas « jamais en fleur ».** Quatrième
  occurrence dans ce dépôt du principe « le vide n'est pas une valeur » (après
  `inflow_nature == ""`, `Document.purpose` et le parcours 26) : aucune alerte, et
  l'écran **propose de renseigner** au lieu de se taire.
- **Pas de règle creator-only.** Un arbre est un bien commun du foyer : tout membre
  crée, édite, supprime — comme les trackers, contrairement aux tâches.
- **Module optionnel** (`orchard` dans `OPTIONAL_MODULES` **et** `PINNABLE_MODULES`),
  groupe **Maison**, comme le poulailler.
- **Le crédit d'une récolte au stock est différé.** Il pose une conversion d'unités et
  une question d'idempotence (supprimer une récolte doit-il décrémenter le stock ?) que
  la V1 n'a pas besoin de trancher.

## Lot 1 — Socle backend `apps/orchard` (#594)

### But

Poser l'app et les trois modèles du registre, sans services ni API. `CareRule` arrive
au lot 5 avec sa propre migration.

### Modèles (tous `HouseholdScopedModel`, PK UUID)

- **`Tree`** (`orchard_trees`) : `name` (200), `kind` (choices, défaut `fruit_tree`),
  `species` (200, blank), `rootstock` (200, blank), `planted_on` (Date, **nullable**),
  `flowering_start_month` / `flowering_end_month` (PositiveSmallInteger **nullables**,
  1-12), `status` (`alive` | `ailing` | `dead` | `removed`, défaut `alive`), `notes`,
  `zone` FK `zones.Zone` **non nullable**, `on_delete=PROTECT`,
  `related_name='trees'`, `document_links` `GenericRelation`.
  Ordering `['name']` ; index `(household, status)`, `(zone)` ; `CheckConstraint` sur
  `status`, sur `kind`, et sur les bornes de mois (1-12 ou nulles **ensemble**).
- **`TreeEvent`** (`orchard_tree_events`) : `tree` FK CASCADE `related_name='events'`,
  `type` (choices : `pruning`, `treatment`, `fertilizing`, `watering`, `training`,
  `observation`, `flowering`, `other`), `occurred_on` (Date), `title` (300), `notes`.
  Le champ `care_rule` est ajouté au **lot 5** — ne pas l'anticiper.
  Ordering `['-occurred_on', '-created_at']` ; index `(household, occurred_on)`,
  `(tree)`.
- **`Harvest`** (`orchard_harvests`) : `tree` FK CASCADE `related_name='harvests'`,
  `harvested_on` (Date), `quantity` `DecimalField(10, 3)`, `unit` (choices : `kg`,
  `piece`, `litre`), `notes`. Ordering `['-harvested_on']` ; index
  `(household, harvested_on)`, `(tree, -harvested_on)` ; `CheckConstraint`
  `quantity > 0`.

### Fichiers

`apps/orchard/` (app complète : `__init__.py`, `apps.py`, `models.py`, `admin.py`,
`migrations/0001_initial.py`), `config/settings/base.py` (`INSTALLED_APPS`),
`apps/households/modules.py` (`orchard` dans `OPTIONAL_MODULES` et
`PINNABLE_MODULES`), `apps/orchard/tests/factories.py`, tests de modèles et de
contraintes.

### Critères

- Les trois tables migrent sur une base vierge **et** sur une base existante.
- Créer un `Tree` sans zone est refusé au niveau base.
- Supprimer une zone qui porte un sujet lève `ProtectedError` (comportement brut ;
  la traduction en réponse HTTP est au lot 2).
- `orchard` apparaît dans les modules optionnels et épinglables ; le foyer peut le
  désactiver.

## Lot 2 — Services + API DRF (#595)

### But

La logique métier — **point d'entrée unique du viewset et de l'agent** — et ses
endpoints. Livrable : créer un sujet, un événement et une récolte via `curl`.

### Services (`apps/orchard/services.py`)

`create_tree`, `update_tree`, `delete_tree`, `create_event`, `update_event`,
`delete_event`, `create_harvest`, `update_harvest`, `delete_harvest`.
Toutes passent par leur serializer (validation, scope foyer) — **jamais l'ORM brut**.
Docstring rappelant le contrat : viewset et agent appellent ces fonctions et rien
d'autre.

`resolve_tree(household, raw)` — résolution **par nom ou par id**, scopée foyer, un
nom ambigu lève un `ValueError` qui **nomme les candidats**. Un seul endroit décide de
ce que « le prunier » désigne, sur le modèle de `zones.services.resolve_zone`.

### Endpoints (`/api/orchard/`, trois viewsets flat, `IsHouseholdMember`)

| Route | Contenu |
|---|---|
| `trees/` | CRUD ; filtres `?zone=`, `?kind=`, `?status=` (défaut : sujets vivants) ; `search=` |
| `events/` | CRUD ; filtres `?tree=`, `?type=`, `?from=`/`?to=` |
| `harvests/` | CRUD ; filtres `?tree=`, `?season=` |

`perform_create` / `perform_update` **délèguent aux services**.

### Fichiers

`apps/orchard/{serializers.py, services.py, views.py, urls.py}`, `config/urls.py`,
`apps/zones/views.py` (traduction de `ProtectedError` en **409 nommé**),
`apps/orchard/tests/{test_api_trees.py, test_api_events.py, test_api_harvests.py,
test_services.py}`.

### Critères

- Un membre d'un autre foyer reçoit 404 sur les trois routes.
- `DELETE` d'une zone portant des sujets → **409 avec un message qui compte les
  sujets**, jamais un 500 ; et le cas **cascade depuis une zone parente** est couvert
  par un test.
- Les filtres renvoient ce qu'ils annoncent ; le défaut de `trees/` masque les sujets
  `dead`/`removed` sans les supprimer.
- Le sérialiseur d'un sujet expose l'âge dérivé de `planted_on` (null si inconnue) —
  **jamais un âge stocké**.

## Lot 3 — Frontend « Verger » (#596)

### But

**Preuve V1 du parcours : planter un sujet dans une zone et consigner une taille en
moins de trente secondes, puis la retrouver un an plus tard.**

### Fichiers

`ui/src/lib/api/orchard.ts` (types + CRUD via `@/lib/axios`),
`ui/src/features/orchard/{hooks.ts, OrchardPage.tsx, TreeCard.tsx, TreeDialog.tsx,
TreeDetailPage.tsx, TreeEventDialog.tsx}`, `ui/src/router.tsx` (2 routes lazy via
`lazyWithReload`), `ui/src/lib/modules.ts` (entrée `orchard`, groupe `home`,
`optional: true`, icône `TreeDeciduous` de lucide),
`ui/src/lib/invalidate.ts` (**racine `orchard`** + entrées `DERIVED_FROM`),
`ui/src/locales/{en,fr,de,es}/translation.json` (`orchard.*`),
`npm run gen:api:refresh`.

### Points clés

- Pattern Feature page du `CLAUDE.md` **strictement** (référence
  `ui/src/features/chickens/`).
- **Groupement par zone** sur la page principale — c'est l'axe de lecture d'un verger.
- Zone **requise** dans le dialog ; si le foyer n'a aucune zone, proposer d'en créer
  une au lieu d'afficher un sélecteur vide.
- Fiche du sujet : `BackLink` + `pushBack`, identité, timeline du journal, onglets.
- Dates via `todayISO` / `toLocalISODate`, **jamais** `toISOString()`.
- Tokens du design-system uniquement ; `Card`, `CardTitle`, `CardActions`,
  `EmptyState`, `useDelayedLoading`, `useDeleteWithUndo`.
- Toute modale de formulaire est un `SheetDialog`.

### Critères

Création d'un sujet, édition, suppression avec undo ; journal consultable et
filtrable par type ; page vide explicite ; les 4 catalogues i18n ont les mêmes clés
et aucun `defaultValue`.

## Lot 4 — Récoltes et séries par saison (#597)

### But

Chiffrer ce que le verger donne, et rendre la série lisible — la seule façon de lire
une production qui alterne.

### Backend

`apps/orchard/queries.py` : helper **unique** d'agrégation des récoltes
(`harvest_totals(household, *, tree=None, season=None)`), qui somme la colonne
`quantity` **groupée par unité**. Aucune autre agrégation de récolte ailleurs — même
règle que `interactions.queries.expenses()`.

Endpoint `GET /api/orchard/harvests/summary/` : totaux par saison et par sujet.
La saison se calcule **en fuseau du foyer** (`core.timezones.household_today`).

### Frontend

`ui/src/features/orchard/{HarvestDialog.tsx, HarvestList.tsx, SeasonSeries.tsx}`,
onglet « Récoltes » sur la fiche du sujet, bloc « saison en cours » sur la page
principale.

### Points clés

- **`DecimalInput`** pour la quantité — jamais `<input type="number">` (la virgule d'un
  clavier français y produit un montant faux, cf. `CLAUDE.md`).
- **Deux unités ne s'additionnent jamais.** 12 kg et 40 pièces se comptent à part, et
  l'écran le dit — un total qui mélange les unités est un total faux.
- Plusieurs récoltes par saison et par sujet : **pas d'upsert**, contrairement au
  relevé de ponte.
- Un sujet `ornamental` ne propose pas la récolte.

### Critères

Somme juste par saison et par unité ; la série affiche au moins 5 saisons ; une
saison unique n'est pas présentée comme une comparaison ; `assertNumQueries` sur le
résumé (pas de N+1 par sujet).

## Lot 5 — Entretien saisonnier (#598)

### But

Le cœur du parcours, et sa seule mécanique neuve. Voir la fiche
[CADENCE_SAISONNIERE.md](../fiches/CADENCE_SAISONNIERE.md) — **à lire avant de coder
ce lot**.

### Backend

- Modèle **`CareRule`** (`orchard_care_rules`) : `name` (200), `emoji` (16),
  `start_month` / `end_month` (PositiveSmallInteger 1-12), `tree` FK **nullable**
  CASCADE (portée « un sujet »), `kind` (choices **nullable**, portée « tous les
  sujets d'un type »), `is_active`, `notes`. `CheckConstraint` : `tree` et `kind` ne
  peuvent pas être renseignés **ensemble** ; mois entre 1 et 12.
- Champ **`TreeEvent.care_rule`** FK `SET_NULL` `related_name='completions'`
  (migration `0002`) — le journal survit à la suppression de la cadence.
- Module **`apps/orchard/seasons.py`** — fonctions **pures**, aucun accès base :
  `season_of(rule, day)`, `window_bounds(rule, season)`,
  `rule_status(rule, *, today, last_event_on)` rendant `upcoming` | `due` | `done` |
  `missed`. Signature calquée sur `chickens.services.chore_status`.
- Service `complete_rule(household, user, rule, *, occurred_on, notes)` — écrit un
  `TreeEvent` lié ; c'est **le seul** chemin qui satisfait une règle.
- CRUD `/api/orchard/care-rules/`, filtre `?due=true` évalué **via `rule_status`** et
  non réécrit en SQL (même raison que `_filter_chore_due` : deux définitions de « à
  faire » finiraient par se contredire).
- `apps/alerts/services.py` : les règles `due` et `missed` entrent dans le résumé
  d'alertes, `missed` en `critical`.

### Frontend

`ui/src/features/orchard/{CareRuleDialog.tsx, SeasonPanel.tsx}` ; le `SeasonPanel`
ouvre la page principale. Bouton « Consigner » (appelle `complete_rule`) et bouton
« Créer une tâche » (passe par les hooks de `tasks`, service `create_task`).

### Critères

- Une fenêtre **novembre → mars** est juste : un entretien du 20 décembre et un du
  15 janvier satisfont **la même** saison ; un test dédié couvre le passage d'année.
- `next_due` n'est **stocké nulle part** — grep de vérification dans le test.
- Supprimer un événement fait **retomber** l'état de la règle sans écriture.
- Une règle `missed` ne propose pas de la faire maintenant, elle le **dit**.
- Aucune `Task` n'est créée sans un clic de l'utilisateur.
- Les alertes reculent quand l'entretien est consigné (`invalidate('orchard')` →
  `alerts` par `DERIVED_FROM`).

## Lot 6 — Argent et photos (#599)

### But

Deux réutilisations quasi gratuites : ce que le verger a coûté, et ce à quoi il
ressemblait l'an dernier.

### Fichiers

- `apps/interactions/services.py` : entrée `orchard_purchase` dans
  `AUTO_SUBJECT_TEMPLATES` ; `makemessages` + les 3 `.po` + `compilemessages`.
- `apps/orchard/views.py` : action d'achat déléguant à
  `interactions.services.create_expense_interaction(source=tree, kind='orchard_purchase')`.
- Coût cumulé d'un sujet lu via `interactions.queries.expenses()` — **jamais** un cast
  JSON.
- `ui/src/features/orchard/TreePurchaseDialog.tsx` wrappant le `PurchaseForm` partagé.
- Fiche du sujet : onglets via `ui/src/features/documents/EntityDocumentsTab.tsx` et
  `ui/src/features/photos/EntityPhotosTab.tsx` — **aucun composant neuf**.

### Critères

L'achat apparaît dans `/app/money/expenses`, porte la zone du sujet, et alimente les
budgets ; le template est traduit dans les 4 langues (test `test_prose_is_translated`
si le module y entre) ; les photos du verger sont visibles dans la galerie du foyer.

## Lot 7 — Le verger hors du module (#600)

### But

Ce que le foyer voit sans ouvrir le module — et l'alerte qui justifie le parcours.

### Fichiers

- `apps/orchard/alerts.py` : croisement de `weather.alerts.evaluate_weather_alerts`
  (`KIND_FROST`) avec les sujets dont la fenêtre de floraison couvre la date de
  l'alerte. **Aucun seuil de température réécrit.**
- `apps/alerts/services.py` : intégration au résumé.
- `ui/src/features/dashboard/OrchardCard.tsx` + branchement dans `DashboardPage.tsx`.

### Critères

- Aucune alerte si le module météo est désactivé, si le foyer n'a pas de localisation,
  ou si aucun sujet n'a de fenêtre de floraison — **dégradation silencieuse, jamais
  d'erreur**.
- Un foyer dont aucun sujet n'a de floraison renseignée voit une **invitation à la
  renseigner**, pas une coche verte (`flowering vide ≠ jamais en fleur`).
- La card du dashboard est masquée si le foyer n'a aucun sujet ; le clic empile
  `pushBack`.

## Lot 8 — Intégration agent (#601)

### But

L'agent lit le verger (RAG standard) et y écrit. **Tout depuis
`apps/orchard/apps.py::ready()`**, zéro logique modifiée dans `apps/agent/`.

### Contenu

- `SearchableSpec('tree')` — `search_fields=('name', 'species', 'notes')`,
  `url_template='/app/orchard/{id}'`, `module='orchard'`,
  `related` = derniers événements + récoltes.
- `SearchableSpec('tree_event')` — `url_template='/app/orchard/{tree_id}?event={id}'`.
- `ListableSpec('tree')` (filtres `zone`, `kind`, `status`) et `ListableSpec('harvest')`
  (filtres `tree`, `season`), avec leurs `describe` compacts.
- `WritableSpec('tree')`, `WritableSpec('tree_event')`, `WritableSpec('harvest')` —
  **minces adaptateurs** vers `orchard/services.py`. Résolution du sujet **par nom**
  via `resolve_tree` ; l'ancre est un **défaut**, un nom explicite prime.
- Tool `get_harvest_stats` construit dans `apps/orchard/agent.py`, enregistré via
  `agent.tools.register` — les agrégats ne sont pas des lignes listables (modèle :
  `chickens.agent.build_get_chicken_stats_tool`).
- `apps/agent/tools.py` : extension des **descriptions** `_CREATE_ENTITY_SCHEMA` /
  `_UPDATE_ENTITY_SCHEMA` — **seule retouche** de `apps/agent/`.
- `ui/src/features/agent/hooks.ts` : `tree`, `tree_event`, `harvest` dans
  `UNDO_HANDLERS` (+ miroir update).
- `ui/src/features/agent/entityIcons.ts` et clés `search.entity.*` des 4 locales.

### Critères

- « Quand a-t-on taillé le gros pommier ? » cite l'événement avec son lien.
- « Note 12 kg de pommes sur le pommier du fond » crée la récolte + toast Annuler.
- « Le prunier » quand il y en a deux → erreur qui **nomme les deux**, aucune écriture.
- Test « le create agent et le create REST produisent le même résultat » sur les trois
  writables — c'est lui qui verrouille la non-duplication.
- `test_global_search.py::TestThePaletteCoversTheRegistry` reste vert (icônes +
  libellés des nouveaux `entity_type`).

## Ordre recommandé d'implémentation

1. **Lot 1** — socle (tables + admin + clé de module)
2. **Lot 2** — services + API (premier sujet via `curl`)
3. **Lot 3** — frontend (**preuve V1**)
4. **Lot 4** — récoltes et séries
5. **Lot 5** — entretien saisonnier (le cœur ; lire la fiche avant)
6. **Lot 6** — argent et photos
7. **Lot 7** — dashboard et alerte gel
8. **Lot 8** — agent

Branches : une par lot ou par paire (`feat/orchard-socle`, `feat/orchard-api`,
`feat/orchard-front`, `feat/orchard-harvests`, `feat/orchard-seasons`,
`feat/orchard-money-photos`, `feat/orchard-alerts`, `feat/orchard-agent`), PR vers
`main`.

## Points de vigilance

- ⚠️ **`PROTECT` traverse la cascade.** Supprimer une zone **parente** cascade sur ses
  enfants ; si une zone enfant porte un sujet, Django lève `ProtectedError` **au
  milieu** de la suppression. Sans traitement, c'est un 500 sur un geste banal. Le test
  doit couvrir le cas parent, pas seulement le cas direct.
- ⚠️ **La fenêtre à cheval sur deux années est le cas normal, pas le cas limite.** Tout
  test qui n'utilise que « juin → août » passe en laissant le bug en place.
- **Le fuseau du foyer partout** : `core.timezones.household_today`, jamais
  `date.today()` ni `timezone.localdate()`. Une saison a une borne, et une borne décide
  de quelle saison relève une récolte.
- **`DecimalInput` pour toute quantité**, et aucun `.replace(',', '.')` au submit.
- **`invalidate('orchard')` + entrées `DERIVED_FROM`** dans `ui/src/lib/invalidate.ts` :
  au minimum `alerts: [..., 'orchard']`, `dashboard: [..., 'orchard']`,
  `zones: [..., 'orchard']`. Sans ces lignes, consigner une taille laisse la pastille
  rouge jusqu'à l'expiration du `staleTime` — un défaut invisible en dev, jamais en
  prod.
- **Le handler agent appelle le service**, jamais l'ORM ni le serializer directement.
- **Ne pas anticiper `TreeEvent.care_rule` au lot 1** : la FK arrive au lot 5, avec sa
  migration et son sens.
- **`kind` ne doit jamais gouverner le schéma** — seulement l'affichage et les valeurs
  proposées. Le jour où un foyer récolte des feuilles de tilleul, l'ornemental doit
  pouvoir porter une récolte sans migration.
- `pytest` local : `TEST_DATABASE_NAME=test_house`, et `--create-db` si le schéma de
  test est incohérent après une bascule de branche.

## Définition de done technique

1. Un sujet se crée dans une zone, s'édite et se supprime ; la suppression d'une zone
   occupée est **refusée avec un message qui compte les sujets**, cascade comprise.
2. Le journal se remplit, se filtre par type, et se relit un an plus tard.
3. Une règle « novembre → mars » est juste au passage d'année, et son échéance
   n'est stockée nulle part.
4. Les récoltes s'additionnent par saison **et par unité**, sans jamais mélanger les
   deux.
5. L'alerte gel ne se déclenche que sur des sujets en floraison déclarée, et se tait
   proprement quand la météo n'est pas disponible.
6. L'achat d'un sujet apparaît dans les dépenses et les budgets, sans double saisie.
7. L'agent cite un entretien et enregistre une récolte dictée, avec undo ; le create
   agent et le create REST produisent le même résultat (test).
8. i18n 4 langues sans `defaultValue`, lint propre, `pytest` vert.
9. **`docs/MODULES/orchard.md` créée**, sur le modèle de `docs/MODULES/chickens.md`.
10. **Guide « Verger » ajouté à la page Tutoriel** (skill `/tutorials` : registre +
    4 locales).
