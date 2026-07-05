# Parcours 11 — Backlog technique V1

> **V1 livrée le 2026-07-05** — cadrage réalisé le 2026-07-04, implémentation en 3 PR (#209 lots 1+2, #213 lots 3+4, #212 lot 5). Reste : recette manuelle du chat agent + E2E Playwright éventuels. Fiche module : `docs/MODULES/trackers.md`.

## Tableau de bord

| Lot | Sujet | Statut | Issue |
|---|---|---|---|
| 1 | Socle backend `apps/trackers` — modèles Tracker / TrackerEntry | ✅ Livré (#209) | #192 |
| 2 | Services + API DRF (cache dénormalisé, target générique via registry, sparkline) | ✅ Livré (#209) | #193 |
| 3 | Frontend `/app/trackers` — page, card + saisie rapide, détail, Sparkline maison | ✅ Livré (#213) | #194 |
| 4 | Embed projet — onglet Trackers dans le détail projet | ✅ Livré (#213) | #195 |
| 5 | Intégration agent — Searchable/Listable/Writable `tracker` + Writable `tracker_entry` | ✅ Livré (#212) | #196 |
| 6a | **V1.1 consommation** — backend : `kind`, réserve, rythme, autonomie | ⏳ À démarrer | #214 |
| 6b | V1.1 consommation — frontend : choix du type, rythme + autonomie, Réapprovisionner | ⏳ À démarrer | #215 |
| 6c | V1.1 consommation — agent : scénario « j'ai donné 3 verres aux poules » | ⏳ À démarrer | #216 |

**Lot 6 (V1.1)** : avenant cadré le 2026-07-05 — voir [PARCOURS_11_LOT6_TRACKERS_CONSOMMATION.md](./PARCOURS_11_LOT6_TRACKERS_CONSOMMATION.md).

**Issue annexe** : **#197** — capture des sujets V2 délibérément différés (graphes riches, agrégats par période, rappels de relevé, panneaux sur pages entités, seuils, import CSV, historique des recharges, réserve adossée à un article de stock).

## Doc associée

- Doc produit : [PARCOURS_11_TRACKER_DES_VALEURS.md](./PARCOURS_11_TRACKER_DES_VALEURS.md)
- CLAUDE.md, sections « Agent — actions d'écriture » et « Pattern standard — Feature page »
- Pattern de référence backend : `apps/tasks/` (services partagés viewset + agent, `apps.py::ready()` avec les 3 specs)
- Pattern GenericFK : `Interaction.source_*` (`apps/interactions/models.py`)

## Flow cible

1. créer un tracker (nom, unité, emoji) — général, dans un projet, ou lié à une entité (équipement, zone, stock…)
2. saisir une valeur depuis la carte (saisie rapide inline) ou en dialog complet (antidatage, note)
3. lire la tendance : dernière valeur + date relative + sparkline sur la card ; liste chronologique avec deltas sur le détail
4. onglet Trackers dans le détail projet (contrat `TasksPanel`)
5. agent : « note 148.2 sur le compteur d'eau » (écriture avec undo) et « où en est le compteur d'eau ? » (lecture citée)

## Décisions de cadrage MVP (toutes appliquées V1)

- **Un modèle unique valeur numérique, pas de types de tracker** — `name + unit + emoji` couvrent tous les cas identifiés (compteur, niveau, durée, budget, poids). Pas de champ `kind` ; le typage cumulatif vs instantané viendra seulement si les agrégats V2 l'exigent (#197).
- **Double ancrage : FK `project` + GenericFK `target`** — le projet est une FK dédiée (comme `Task.project`, il alimente l'onglet du détail projet) ; toute autre entité passe par la liaison polymorphe `target_*`, nommage calqué sur `Interaction.source_*`. Ni l'un ni l'autre = tracker général. CheckConstraint : les deux champs target null ensemble ou renseignés ensemble.
- **La cible générique s'appuie sur le registry `agent.searchables`** — résolution `entity_type → modèle` via `find_spec`, label et URL gratuits via `resolve_label`/`url_template`. Tout ce qui est cherchable par l'agent est liable à un tracker, sans table de correspondance dédiée. Attention : registry peuplé après `ready()` → résolution paresseuse dans le serializer, jamais au chargement du module.
- **Caches dénormalisés `last_value` / `last_entry_at`** — la liste de cards les affiche systématiquement et le `describe()` du ListableSpec en a besoin sans requête. **Recalculés depuis la DB** (jamais incrémentés) par `refresh_tracker_cache` à chaque écriture d'entrée → aucun risque de dérive. `last_value` = entrée max `occurred_at` (l'antidatage est un cas normal), pas la dernière créée.
- **`Tracker.entries_summary` est le pont vers l'agent** — texte régénéré à chaque écriture d'entrée (create/update/delete, même transaction), inclus dans les `search_fields` du `SearchableSpec` : les valeurs deviennent citables via le RAG standard, **zéro modification de `apps/agent/`**. Même mécanisme validé par `Device.state_summary` au parcours 09. Format : en-tête unité + dernière valeur, puis 10 dernières entrées avec **delta vs précédente** — c'est ce qui permet à l'agent de répondre « combien depuis le mois dernier » sans tool dédié.
- **Ajout d'entrée par l'agent = `WritableSpec('tracker_entry')` séparé** — pas un update du tracker : le tool générique `create_entity` couvre le geste, l'écriture est réversible → undo naturel (`UNDO_HANDLERS`), contrairement au `control_device` du parcours 09. Fallback anchor : conversation ancrée sur un tracker → « ajoute 82.4 » sans nommer le tracker.
- **DELETE tracker = archive (`is_active=False`), DELETE entrée = hard delete** — l'historique d'un tracker a de la valeur (pattern `TaskViewSet.perform_destroy`) ; une saisie erronée doit disparaître.
- **Pas de règle creator-only** — un relevé est un bien commun du foyer : tout membre crée, édite, supprime (contrairement aux tâches).
- **Sparkline SVG maison, zéro dépendance** — composant `ui/src/components/Sparkline.tsx` (~40 lignes), x proportionnel au temps (relevés irréguliers honnêtes), réutilisable ailleurs (électricité, dépenses). Une lib de chart n'entrera qu'avec les graphes riches V2 (#197).
- **Sparkline servie par l'API en 1 requête** — le serializer liste embarque les 30 dernières entrées `{value, occurred_at}` via sliced `Prefetch` (Django 5.x) : pas de N+1 sur la grille de cards.

## Lot 1 — Socle backend `apps/trackers` (#192)

### But

Poser l'app et les deux modèles, sans services ni API.

### Modèles (tous `HouseholdScopedModel`, PK UUID)

- **`Tracker`** (`trackers`) : `name` (200), `description`, `unit` (50, libre), `emoji` (16), `is_active` default True, `project` FK SET_NULL `related_name='trackers'`, `target_content_type`/`target_object_id`/`target` (GenericFK, pattern `Interaction.source_*`), caches `last_value` Decimal(12,3) null / `last_entry_at` null, `entries_summary` TextField. Ordering `['-last_entry_at', 'name']` ; index `(household, is_active)`, `(project)`, `(target_content_type, target_object_id)` ; CheckConstraint `tracker_target_integrity`.
- **`TrackerEntry`** (`tracker_entries`) : `tracker` FK CASCADE `related_name='entries'`, `value` Decimal(12,3) signe libre, `occurred_at` DateTimeField, `note` (500). Ordering `['-occurred_at', '-created_at']` ; index `(tracker, -occurred_at)`.

### Fichiers

`apps/trackers/` (app complète), `config/settings/base.py` (INSTALLED_APPS), `config/urls.py`, admin (Tracker + inline entries), tests factories + modèles.

## Lot 2 — Services + API DRF (#193)

### But

La logique métier — **point d'entrée unique viewset + agent** — et ses endpoints. Livrable : tracker + valeurs via curl.

### Services (`apps/trackers/services.py`)

`create_tracker`, `update_tracker`, `add_entry` (occurred_at défaut now), `update_entry`, `delete_entry`, `refresh_tracker_cache` (recalcul DB : last_value = max occurred_at + entries_summary, en transaction avec chaque écriture), `build_entries_summary` (en-tête + 10 dernières entrées avec deltas).

### Endpoints (`/api/trackers/`, deux viewsets flat, `IsHouseholdMember`)

CRUD `trackers/` (DELETE = archive ; filtres `?project=`, `?target_type=&target_id=`, `?general=true`, `?include_archived=1`, `search=` ; `sparkline` embarquée via sliced Prefetch) ; CRUD `entries/` (`?tracker=`, ordre `-occurred_at`). Target générique : écriture `target_type`+`target_id` validés via le registry searchables (400 si inconnu ou autre foyer), lecture `target_label`+`target_url`.

### Critères

Cache juste après create/update/delete d'entrée, antidatage compris ; target autre household → 400 ; filtres corrects ; sparkline en 1 requête ; DELETE tracker archive / DELETE entry hard.

## Lot 3 — Frontend `/app/trackers` (#194)

### But

**Preuve V1 du parcours : saisir un relevé en moins de dix secondes depuis la carte, sparkline et delta à l'appui.**

### Fichiers

`ui/src/components/Sparkline.tsx`, `ui/src/lib/api/trackers.ts`, `ui/src/features/trackers/{hooks.ts, TrackersPage.tsx, TrackerCard.tsx, TrackerDetailPage.tsx, TrackerDialog.tsx, EntryDialog.tsx}`, `router.tsx` (2 routes lazy), `Sidebar.tsx` (groupe Suivi), i18n 4 locales `trackers.*`, `npm run gen:api:refresh`.

### Points clés

Pattern Feature page du CLAUDE.md strictement (référence `features/tasks/`) ; **saisie rapide inline** sur la card (bouton `+` → input numérique, Enter = maintenant) ; détail avec liste chronologique + deltas + `EntityAssistant entityType="tracker"` (actif au lot 5) ; `BackLink`/`pushBack` ; tokens design-system uniquement ; badge projet/target cliquable.

## Lot 4 — Embed projet (#195)

### But

Les trackers d'un chantier vivent dans le détail projet, comme les tâches.

### Contenu

`TrackersPanel.tsx` (contrat de `TasksPanel` : props `projectId`, `stateKeyPrefix`), onglet `'trackers'` dans `TABS` de `ProjectDetailPage.tsx`, clé `projects.tabs.trackers`, création pré-liée au projet, `TrackersPage` refactorée pour réutiliser le panel (zéro duplication).

### Critères

Onglet filtré au projet ; création depuis l'onglet pré-rattachée ; saisie rapide OK ; filtres de session isolés par projet.

## Lot 5 — Intégration agent (#196)

### But

L'agent lit les valeurs (RAG standard) et écrit trackers + entrées via `create_entity`. Tout depuis `apps/trackers/apps.py::ready()`, zéro logique modifiée dans `apps/agent/`.

### Contenu

- `SearchableSpec('tracker')` : `search_fields=('name','description','entries_summary')`, `url_template='/app/trackers/{id}'`, `related=lambda t: [x for x in (t.project, t.target) if x]`
- `ListableSpec('tracker')` : filtres `project`, `general` ; `describe` = « 148.2 m³ le 2026-07-01 » ; `order_by=('-last_entry_at',)`
- `WritableSpec('tracker')` : create/update via services ; anchor projet → `project`, tout autre anchor searchable → `target`
- `WritableSpec('tracker_entry')` : fields `{tracker_id, value, occurred_at?, note?}`, fallback anchor=tracker, `update` (value/occurred_at/note), label callable « Compteur d'eau : 148.2 m³ », `url_template='/app/tracker-entries/{id}'` + micro-route front redirect vers le tracker parent
- Descriptions `_CREATE_ENTITY_SCHEMA`/`_UPDATE_ENTITY_SCHEMA` dans `apps/agent/tools.py` + vérif `prompts.py` (seule retouche `apps/agent/`)
- Front : `tracker` et `tracker_entry` dans `UNDO_HANDLERS`/`UPDATE_UNDO_HANDLERS` (`ui/src/features/agent/hooks.ts`)

### Critères

« note 148.2 sur le compteur d'eau » → entrée + toast Annuler (l'undo rafraîchit le cache) ; « ajoute 82.4 » en conversation ancrée tracker ; anchor équipement pré-remplit le target d'un tracker créé ; valeurs citées via `search_household`/`get_entity` ; `list_entities('tracker')` ; le create agent et le create REST produisent le même résultat (test anti-duplication).

## Ordre recommandé d'implémentation

1. Lot 1 — socle (tables + admin)
2. Lot 2 — services + API (premier tracker via curl)
3. Lot 3 — frontend (**preuve V1 : le relevé en dix secondes**)
4. Lot 4 — embed projet
5. Lot 5 — agent (« note 148.2 sur le compteur d'eau » dans le chat)

Branches : une feature branch par lot ou par paire de lots (`feat/trackers-socle`, `feat/trackers-api`, `feat/trackers-front`, `feat/trackers-agent`), PR vers `main`.

## Points de vigilance

- `entries_summary` + caches régénérés sur les **trois** écritures d'entrée (create/update/delete), et l'antidatage doit être couvert par un test (le `last_value` = max `occurred_at`, pas la dernière créée)
- ne jamais résoudre `target_type` via le registry au chargement d'un module (registry vide avant `ready()`) — import paresseux dans le serializer
- le handler agent appelle **le service**, jamais l'ORM ni le serializer directement — même contrat que `tasks` ; c'est le test « create agent = create REST » qui verrouille
- la sparkline de la liste doit rester en 1 requête (sliced Prefetch) — vérifier par `assertNumQueries`
- l'undo d'une entrée créée par l'agent doit repasser par le service de suppression (recalcul du cache), pas un DELETE ORM
- `pytest` local : penser à `TEST_DATABASE_NAME=test_house` (cf. mémoire projet)

## Définition de done technique

1. un tracker général, un tracker de projet et un tracker lié à un équipement se créent et se listent avec leurs filtres
2. la saisie rapide depuis la carte fonctionne, sparkline et deltas justes, antidatage compris
3. l'onglet Trackers du détail projet ne montre que les trackers du projet
4. l'agent enregistre une entrée dictée (avec undo fonctionnel) et cite les valeurs en réponse à une question
5. cache dénormalisé toujours cohérent après toute écriture (tests dédiés)
6. i18n 4 langues, lint propre, tests pytest des 5 lots verts
