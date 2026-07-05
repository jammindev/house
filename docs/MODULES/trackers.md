# Module — trackers

> Rôle : séries de valeurs numériques datées (relevés de compteur, poids, niveau de cuve, heures de fonctionnement, budget de chantier…). Un tracker peut être **général**, **inséré dans un projet** (onglet du détail projet) ou **lié à n'importe quelle entité du foyer** via une cible générique. Parcours 11 — cadrage : `docs/parcours/PARCOURS_11_TRACKER_DES_VALEURS.md`.

## État synthétique

- **Backend** : `apps/trackers/` — modèles (`Tracker`, `TrackerEntry`), services (point d'entrée unique des écritures), serializers (cible générique via le registry `agent.searchables`), viewsets DRF, câblage agent complet dans `apps.py::ready()`.
- **Frontend** : `ui/src/features/trackers/` — `TrackersPage`/`TrackersPanel` (grille de cards, filtres, embed projet), `TrackerCard` (saisie rapide inline + sparkline), `TrackerDetailPage` (deltas + assistant ancré), `TrackerDialog`, `EntryDialog`, `TrackerEntryRedirect`. Composant partagé `ui/src/components/Sparkline.tsx` (SVG maison, zéro dépendance).
- **Locales (en/fr/de/es)** : namespace `trackers` + `projects.tabs.trackers`.
- **Tests** : `apps/trackers/tests/` — `test_models.py`, `test_services.py`, `test_api_trackers.py`, `test_agent_integration.py`.

## Modèle de données

- **`Tracker`** (`trackers`) : `name`, `unit` (libre), `emoji`, `description`, `kind` (**`measure`** — état ponctuel, défaut — ou **`consumption`** — quantités consommées ; immuable après création), `is_active` (le DELETE API **archive**, l'historique a de la valeur), FK `project` nullable (comme `Task.project`), cible générique `target_content_type`/`target_object_id`/`target` (nommage calqué sur `Interaction.source_*`, contrainte `tracker_target_integrity` : les deux null ou les deux renseignés).
- **Consommation (lot 6, V1.1)** : `reserve` (quantité restante, fait externe **ajusté incrémentalement** par les écritures d'entrées — jamais recalculé, peut être négatif) et `rate_per_day` (cache, fenêtre glissante 14 jours par `occurred_at`, plancher 1 jour de couverture). L'autonomie (`runway_days`/`runway_until` au serializer) = réserve ÷ rythme. Réapprovisionner = PATCH `reserve` (nouveau total ; le front fait l'addition). Chaque entrée décrémente la réserve en transaction ; update ajuste le delta ; delete (= chemin d'undo) re-crédite.
- **`TrackerEntry`** (`tracker_entries`) : `value` Decimal(12,3) signe libre, `occurred_at`, `note`. DELETE = **hard delete** (une saisie erronée doit disparaître).
- **Caches dénormalisés** sur `Tracker` : `last_value`, `last_entry_at`, `entries_summary` — recalculés **depuis la DB** par `services.refresh_tracker_cache` à chaque écriture d'entrée (create/update/delete, même transaction). La dernière valeur = max `occurred_at`, pas la dernière saisie (l'antidatage est un cas normal).

## Services — le point d'entrée unique des écritures

`apps/trackers/services.py` : `create_tracker`, `update_tracker`, `add_entry`, `update_entry`, `delete_entry`, `refresh_tracker_cache`, `build_entries_summary`. Les viewsets REST **et** les handlers agent passent par ces fonctions — ne jamais écrire une `TrackerEntry` ailleurs, le cache doit être rafraîchi dans la même transaction.

`build_entries_summary` rend les 10 dernières entrées en texte. Tracker **mesure** : une ligne par entrée avec le **delta vs précédente** (« combien depuis le mois dernier »). Tracker **consommation** : l'en-tête porte **rythme — réserve — autonomie** (« Rate: ≈3 verres/day — reserve: 33 verres — runway: ~11 days (until …) ») — c'est ce qui permet à l'agent de répondre « combien de temps je tiens ? » par simple retrieval.

## Cible générique via le registry `agent.searchables`

La cible d'un tracker s'écrit `target_type` (un entity_type du registry : `equipment`, `zone`, `stock_item`, …) + `target_id`. Le serializer résout le modèle via `find_spec` (**import paresseux** — le registry n'est peuplé qu'après `ready()`), valide existence + foyer (400 sinon), et sert en lecture `target_label` + `target_url` gratuits via le spec. Tout ce qui est cherchable par l'agent est liable à un tracker, sans table de correspondance.

## API — `/api/trackers/`

- CRUD `trackers/` — filtres `?project=`, `?target_type=&target_id=`, `?general=true`, `?include_archived=1` (défaut : actifs seuls), `search=`. Le serializer de liste embarque `sparkline` (30 dernières entrées) via **sliced `Prefetch`** — 1 requête pour toute la grille (verrouillé par test).
- CRUD `entries/` — filtre `?tracker=`, ordre `-occurred_at`. Les `perform_*` délèguent aux services.
- Pas de règle creator-only : un relevé est un bien commun du foyer.

## Intégration agent (tout dans `apps.py::ready()`)

- `SearchableSpec('tracker')` — `search_fields=('name', 'description', 'entries_summary')` : le **pont RAG** (même mécanisme que `Device.state_summary` du parcours 09), les valeurs sont citables via `search_household`/`get_entity`. `related` = projet + cible.
- `ListableSpec('tracker')` — filtres `project`, `general` ; describe « 148.2 m³ on 2026-07-01 ».
- `WritableSpec('tracker')` — anchor projet → `project`, anchor entité searchable → `target`.
- `WritableSpec('tracker_entry')` — « note 148.2 sur le compteur d'eau » : tracker par nom/id, fallback anchor tracker (conversation ancrée de la page détail) puis tracker unique du foyer ; `occurred_at` optionnel (antidatage) ; `update` pour corriger une saisie. Écritures **réversibles** → `UNDO_HANDLERS`/`UPDATE_UNDO_HANDLERS` côté front (l'undo repasse par l'API, le cache est recalculé serveur).
- Seule retouche à `apps/agent/` : les descriptions des tools (`tools.py`) et la paraphrase du prompt.
- Les entrées n'ont pas de page propre : `url_template='/app/tracker-entries/{id}'` + route front `TrackerEntryRedirect` → page du tracker parent.

## Frontend — gestes clés

- **Saisie rapide** sur la card : bouton `+` → input pré-rempli avec la dernière valeur, Enter = enregistré à maintenant, Échap = annule. C'est le geste de référence du parcours (« le relevé en dix secondes »).
- Sparkline : x proportionnel au temps (`occurred_at`), honnête sur les relevés irréguliers.
- Page détail : liste chronologique avec deltas calculés client-side, édition/suppression d'entrée avec undo, `EntityAssistant entityType="tracker"`.
- `TrackersPanel` embarquable (contrat de `TasksPanel` : `projectId`, `stateKeyPrefix`) — utilisé par l'onglet `trackers` de `ProjectDetailPage`, création pré-liée au projet.

## Différé V2 (issue #197)

Graphes riches (Recharts est entré dans le projet avec electricity/consommation — la page détail pourrait l'adopter), agrégats par période, rappels de relevé (module alerts), panneaux « trackers liés » sur les pages équipement/zone/stock (l'API `?target_type=&target_id=` est prête), seuils/objectifs, import CSV, typage compteur cumulatif vs mesure.
