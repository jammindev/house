# Module — trackers

> Rôle : séries de valeurs numériques datées (relevés de compteur, poids, niveau de cuve, heures de fonctionnement, budget de chantier…). Un tracker peut être **général** ou **inséré dans un projet** (onglet du détail projet). Parcours 11 — cadrage : `docs/parcours/PARCOURS_11_TRACKER_DES_VALEURS.md`. Le kind `consumption` (réserve/rythme/autonomie, lot 6) et la cible générique ont été **retirés au lot 7** (`docs/parcours/PARCOURS_11_LOT7_RETRAIT_CONSOMMATION_STOCK_POULES.md`) : les consommables se suivent dans le module **stock**.

## État synthétique

- **Backend** : `apps/trackers/` — modèles (`Tracker`, `TrackerEntry`), services (point d'entrée unique des écritures), serializers, viewsets DRF, câblage agent complet dans `apps.py::ready()`.
- **Frontend** : `ui/src/features/trackers/` — `TrackersPage`/`TrackersPanel` (grille de cards, filtres, embed projet), `TrackerCard` (saisie rapide inline + sparkline), `TrackerDetailPage` (deltas + assistant ancré), `TrackerDialog`, `EntryDialog`, `TrackerEntryRedirect`. Composant partagé `ui/src/components/Sparkline.tsx` (SVG maison, zéro dépendance).
- **Locales (en/fr/de/es)** : namespace `trackers` + `projects.tabs.trackers`.
- **Tests** : `apps/trackers/tests/` — `test_models.py`, `test_services.py`, `test_api_trackers.py`, `test_agent_integration.py`.

## Modèle de données

- **`Tracker`** (`trackers`) : `name`, `unit` (libre), `emoji`, `description`, `is_active` (le DELETE API **archive**, l'historique a de la valeur), FK `project` nullable (comme `Task.project`).
- **`TrackerEntry`** (`tracker_entries`) : `value` Decimal(12,3) signe libre, `occurred_at`, `note`. DELETE = **hard delete** (une saisie erronée doit disparaître).
- **Caches dénormalisés** sur `Tracker` : `last_value`, `last_entry_at`, `entries_summary` — recalculés **depuis la DB** par `services.refresh_tracker_cache` à chaque écriture d'entrée (create/update/delete, même transaction). La dernière valeur = max `occurred_at`, pas la dernière saisie (l'antidatage est un cas normal).
- **Migration lot 7** (`0003`) : drop de `kind`/`reserve`/`rate_per_day`/cible générique — les anciens trackers consommation deviennent des trackers mesure, historique intact ; un RunPython final reconstruit tous les `entries_summary` (l'en-tête rythme/réserve/autonomie disparaît du RAG).

## Services — le point d'entrée unique des écritures

`apps/trackers/services.py` : `create_tracker`, `update_tracker`, `add_entry`, `update_entry`, `delete_entry`, `refresh_tracker_cache`, `build_entries_summary`. Les viewsets REST **et** les handlers agent passent par ces fonctions — ne jamais écrire une `TrackerEntry` ailleurs, le cache doit être rafraîchi dans la même transaction.

`build_entries_summary` rend les 10 dernières entrées en texte : une ligne par entrée avec le **delta vs précédente** (« combien depuis le mois dernier »).

## API — `/api/trackers/`

- CRUD `trackers/` — filtres `?project=`, `?general=true` (= sans projet), `?include_archived=1` (défaut : actifs seuls), `search=`. Le serializer de liste embarque `sparkline` (30 dernières entrées) via **sliced `Prefetch`** — 1 requête pour toute la grille (verrouillé par test).
- CRUD `entries/` — filtre `?tracker=`, ordre `-occurred_at`. Les `perform_*` délèguent aux services.
- Pas de règle creator-only : un relevé est un bien commun du foyer.

## Intégration agent (tout dans `apps.py::ready()`)

- `SearchableSpec('tracker')` — `search_fields=('name', 'description', 'entries_summary')` : le **pont RAG** (même mécanisme que `Device.state_summary` du parcours 09), les valeurs sont citables via `search_household`/`get_entity`. `related` = projet.
- `ListableSpec('tracker')` — filtres `project`, `general` ; describe « 148.2 m³ on 2026-07-01 ».
- `WritableSpec('tracker')` — anchor projet → `project`.
- `WritableSpec('tracker_entry')` — « note 148.2 sur le compteur d'eau » : tracker par nom/id, fallback anchor tracker (conversation ancrée de la page détail) puis tracker unique du foyer ; `occurred_at` optionnel (antidatage) ; `update` pour corriger une saisie. Écritures **réversibles** → `UNDO_HANDLERS`/`UPDATE_UNDO_HANDLERS` côté front (l'undo repasse par l'API, le cache est recalculé serveur).
- Seule retouche à `apps/agent/` : les descriptions des tools (`tools.py`) et la paraphrase du prompt.
- Les entrées n'ont pas de page propre : `url_template='/app/tracker-entries/{id}'` + route front `TrackerEntryRedirect` → page du tracker parent.

## Frontend — gestes clés

- **Saisie rapide** sur la card : bouton `+` → input pré-rempli avec la dernière valeur, Enter = enregistré à maintenant, Échap = annule. C'est le geste de référence du parcours (« le relevé en dix secondes »).
- Sparkline : x proportionnel au temps (`occurred_at`), honnête sur les relevés irréguliers.
- Page détail : liste chronologique avec deltas calculés client-side, édition/suppression d'entrée avec undo, `EntityAssistant entityType="tracker"`.
- `TrackersPanel` embarquable (contrat de `TasksPanel` : `projectId`, `stateKeyPrefix`) — utilisé par l'onglet `trackers` de `ProjectDetailPage`, création pré-liée au projet.

## Différé V2 (issue #197)

Graphes riches (Recharts est entré dans le projet avec electricity/consommation — la page détail pourrait l'adopter), agrégats par période, rappels de relevé (module alerts), seuils/objectifs, import CSV, typage compteur cumulatif vs mesure.
