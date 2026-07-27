# Module — zones

> Audit : 2026-07-27. Rôle : organisation spatiale hiérarchique (pièces, étages, bâtiments) servant de contexte de navigation à toute l'app.

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet — `ui/src/features/zones/` (`ZonesPage`, `ZoneRow`, `ZoneDetailPage`, `ZoneDialog`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok — namespace `zones` présent dans les 4 fichiers de traduction
- **Tests** : `test_api_zones_extra.py`, `test_zone_content_counts.py`, `test_import_supabase_zones.py`, `test_import_supabase_zone_documents.py` + `tests.py` legacy (73 lignes) à la racine ; E2E `e2e/zones.spec.ts`
- **Migrations** : 6
- **Agent** : `SearchableSpec('zone')` avec `related` (`apps/zones/apps.py`)
- **Couverture parcours métier** : parcours 05 (navigation par zone)

## Modèles & API

- Modèles principaux : `Zone` (HouseholdScopedModel, parent self-FK pour hiérarchie, `color` hex validé, `surface` Decimal optionnelle, `note`) — `apps/zones/models.py`
- Endpoints exposés sous `/api/zones/` :
  - `GET|POST /`, `GET|PATCH|DELETE /{id}/` (DELETE refuse si `children.exists()` → 409)
  - `GET /tree/?household_id=<id>` — racines + enfants imbriqués via `ZoneTreeSerializer`
  - `GET /{id}/children/`, `GET /{id}/photos/`, `POST /{id}/attach_photo/`
  - Optimistic concurrency : champ `last_known_updated_at` accepté en update → 409 si stale
- Permissions : `IsAuthenticated, IsHouseholdMember` ; pas de permission custom propre au module
- Commands de gestion : `import_supabase_zones`, `import_supabase_zone_documents` (migration depuis l'ancienne stack)
- `full_path` et `depth` sont des **properties récursives** sur `parent` : elles coûtent une requête par niveau si le parent n'est pas déjà chargé. Elles sont sérialisées, donc `select_related('parent')` reste nécessaire sur toute liste.
- **`partial_update` doit réinjecter `kwargs['partial'] = True`.** Il route vers `update()` pour réutiliser la garde `last_known_updated_at` ; sans ce flag, `UpdateModelMixin.update` retombe sur `partial=False` et **tout PATCH est validé comme un PUT complet** — un PATCH d'un seul champ repartait en 400 pour `name` manquant. Non-régression : `test_zone_content_counts.py::TestZoneSurfaceValidation::test_patch_is_really_partial`.

## Les compteurs de contenu — `zones.queries.with_content_counts`

La liste des zones doit dire, sans clic, si une zone est vivante ou vide. Quatre
compteurs sont donc annotés sur **tout** queryset du viewset (pas seulement
`list`, pour que détail, `children` et `tree` racontent la même chose) :

| Champ | Périmètre | Miroir front |
|---|---|---|
| `children_count` | enfants **directs** | — |
| `equipment_count` | tous les équipements, tous statuts | `useEquipmentByZone` |
| `open_task_count` | tâches hors `done`/`archived` | `useZoneTasks` |
| `active_project_count` | projets `status='active'` | `useZoneProjects` |

Trois règles à préserver :

- **Chaque compteur est une `Subquery` corrélée, jamais un `Count`.** Quatre
  `Count` sur quatre relations inverses dans la même requête produisent un produit
  cartésien : `distinct=True` rétablit la justesse mais fait exploser le coût.
  Chaque sous-requête tape un index existant (`idx_equipment_zone`,
  `task_zones.zone_id`, `project_zones.zone_id`, `zones.parent_id`). Non-régression :
  `test_zone_content_counts.py::TestZoneListQueryCount`.
- **Le périmètre d'un compteur est calqué sur l'onglet du détail correspondant.**
  Deux chiffres différents pour la même zone dans deux écrans font perdre leur
  crédit aux deux — même règle que le marqueur du journal et le compteur du
  Contrôle côté `banking`. Élargir un onglet du détail impose d'élargir son
  compteur, et réciproquement.
- **Un compteur ne sort jamais `null`.** Une sous-requête corrélée renvoie `NULL`
  quand la zone n'a rien ; le serializer normalise en `0`. Le front n'afficherait
  pas la même chose pour « zéro » et « inconnu ».

Le repli par requête dans `ZoneSerializer._counted` n'existe que pour les
instances non annotées (création, `get_object` hors viewset) : il ne doit jamais
devenir le chemin d'une liste, sinon on retombe sur un N+1 par zone.

## Frontend — l'arborescence dense (`/app/zones`)

Le rendu précédent posait une `Card` autonome par zone, indentée au
`marginLeft` : autant de bordures et d'ombres que de zones, ~56 px par ligne, et
aucun moyen de replier. Passé une vingtaine de zones la page devenait illisible.

Le rendu actuel est **un seul conteneur** (`Card` + `divide-y`) contenant des
lignes de **36 px** (`ZoneRow`) :

- **Traits d'arborescence** plutôt qu'une simple indentation. `ZoneTreeRow.guides`
  porte, pour chaque niveau d'ancêtre, « cet ancêtre a-t-il encore un frère après
  lui ? » ; la colonne `j` d'une ligne de profondeur `d` lit `guides[j+1]`, la
  colonne `d-1` dessinant le coude. Sans ces traits, les profondeurs ≥ 3 ne se
  rattachent visuellement à rien.
- **Pliage par branche**, persisté en `sessionStorage` (`zones.collapsed`) : c'est
  une préférence de lecture, elle survit à un aller-retour vers une page de détail.
  « Replier tout » lit `expandableZoneIds` sur l'arbre **complet**, pas sur les
  lignes affichées — sinon l'état de pliage dépendrait de ce qu'un filtre laissait
  voir au moment du clic.
- **Recherche** insensible à la casse et aux accents. Elle conserve les **ancêtres**
  d'un résultat (sinon il flotterait hors de sa hiérarchie) *et* ses **descendants**
  (sinon un parent trouvé s'afficherait comme une feuille). Une recherche active
  **ignore le pliage** : un résultat qu'il faut déplier pour voir n'est pas un
  résultat — d'où le bouton Déplier/Replier désactivé pendant une recherche.
- **Méta-infos à droite** : surface puis les quatre compteurs, chacun rendu
  **seulement s'il est non nul**. Une ligne de zéros ne porte aucune information et
  ruine la densité gagnée. Les compteurs affichent la zone **elle-même**, jamais un
  total roulé sur le sous-arbre : un total ambigu contredirait l'onglet du détail.
- Les traits d'arborescence sont purement décoratifs (`aria-hidden`) : la hiérarchie
  est donnée aux lecteurs d'écran par `aria-label={zone.full_path}` sur le lien. La
  page ne revendique **pas** `role="tree"` — sans navigation aux flèches, ces rôles
  dégradent l'expérience au lieu de l'améliorer.

Points d'architecture à ne pas défaire :

- **Un seul `ZoneDialog` monté, au niveau de la page.** L'ancien `ZoneItem` en
  montait un *par zone*, chacun appelant `useZones()` — 40 zones = 40 dialogs et 40
  abonnements au cache pour un seul formulaire visible à la fois. C'est pourquoi
  `ZonesPage` porte l'état `editing` et le passe en `existing`.
- **`surface` est normalisée dans `lib/api/zones.ts`.** DRF sérialise un
  `DecimalField` en **string** (`COERCE_DECIMAL_TO_STRING`), donc `surface` arrive
  en `"18.50"`. La coercition vit dans la couche d'accès API pour que l'UI n'ait
  qu'une forme à connaître. Le type TS annonçait `number` depuis le début — le
  décalage était invisible car le champ n'était affiché nulle part.
- **Surface vide ≠ surface à zéro.** « Non renseignée » se dit `null` ; sinon toute
  zone non mesurée pèserait 0 m² et le total de tête serait faux. Le serializer
  borne la surface à `min_value=0` : le modèle ne la protège que par un
  `CheckConstraint`, donc sans cette borne une valeur négative repartait en
  `IntegrityError` 500 au lieu d'un 400 lisible.

## Notes / décisions produit

- **P3 (commit e540d6f)** : zone racine unique par household, créée automatiquement au signal `post_save(Household)`. `Zone.save()` auto-attache les nouvelles zones à cette racine si aucun parent fourni. `TaskViewSet.perform_create()` utilise aussi cette racine comme fallback côté API. Contrainte DB : `UniqueConstraint` partiel sur `(household, parent IS NULL)`. Données legacy (ex. seed Mercier : 10 racines) normalisées par data-migration avant application de la contrainte.
- Conséquence pour les tests : un `Zone.objects.create(household=h, name="X")` produit un **enfant de la racine**, jamais une seconde racine — récupérer la racine via `Zone.objects.get(household=…, parent__isnull=True)`.
- **Frontend P3** : `findRootZone()` helper dans `ui/src/lib/api/zones`; pré-sélection de la racine dans `NewTaskDialog`, `BoardDialog`, `UsagePointDialog`, `InteractionNewPage`.
- `Zone` hérite de `HouseholdScopedModel` (`apps/core/models.py`) → audit timestamps + `household` FK obligatoire au save.
- Validation custom dans `Zone.save` : un parent doit appartenir au même household, sinon `ValueError`.
- Suppression bloquée si la zone a des enfants (409) — pas de cascade UI offerte ; côté front un toast `zones.cannotDeleteWithChildren` l'annonce avant l'appel. Le `CASCADE` du modèle emporterait sinon silencieusement tout le sous-arbre.
- L'endpoint `tree` exige un `household_id` query param ; `IsHouseholdMember` vérifie alors la membership via header/query/body.
- `Zone.color` est validé deux fois : `RegexValidator` au niveau du champ + `CheckConstraint` DB (`zones_color_hex_check`).
- Historique : `ZoneDocument` a été supprimé (migration `0006`) au profit du `DocumentLink` polymorphe partagé — `ZoneDocumentSerializer` conserve la *forme* de l'ancien payload pour ne pas casser le front photos.
