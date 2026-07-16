# Module — shopping

> Créé : 2026-07-16 (parcours 22, lots 1+2). Rôle : liste de courses partagée du foyer — cochable, alimentée en texte libre, depuis le stock, ou par l'agent.

## État synthétique

- **Backend** : Présent (`apps/shopping/`)
- **Frontend** : Complet dans `ui/src/features/shopping/`
- **Locales (en/fr/de/es)** : ok (namespace `shoppingList`)
- **Tests** : backend (`apps/shopping/tests/`) + E2E (`ui/tests/`)
- **Migrations** : 1 (`0001_initial`)
- **Module optionnel** : oui (`shopping` dans `OPTIONAL_MODULES`, désactivable par l'owner ; épinglable)

## Modèles & API

- Modèle : `ShoppingListItem` (`HouseholdScopedModel`) — `label` (texte libre), `quantity`/`unit` (optionnels), `note`, FK optionnelle `stock_item` (`SET_NULL`), `checked_at` (None = à acheter ; daté = pris), `sort_order`. Propriété `.checked = checked_at is not None`.
  - **Modèle dédié, pas `Interaction.metadata`** : la liste porte un état par ligne (coché/non), un ordre, et une FK typée vers le `StockItem` — trois choses *requêtées* (lignes non cochées, lignes liées à un item). Même règle de décision que `Task`/`EggLog`.
  - Une ligne est **libre** (`stock_item` null : « Café », « Piles AA ») ou **liée** à l'inventaire (bouton « Ajouter à la liste » depuis un `StockItem`). Le lien est optionnel et survit à sa cible (suppression du `StockItem` → FK nulle, la ligne reste en texte).
- Endpoints : `/api/shopping/items/` (`ShoppingListItemViewSet`, CRUD) + actions `from-stock/` (ajout depuis un item stock, dédupliqué) et `bulk-delete/` (suppression groupée — « Vider les cochés » + son undo).
- Permissions : `IsHouseholdMember` ; tout est scopé au foyer actif (`request.household`).
- **Écritures via `apps/shopping/services.py`** — source de vérité partagée view + agent (jamais d'ORM brut dans le handler agent) :
  - `create_list_item` (validation via `ShoppingListItemSerializer`) ;
  - `add_stock_item_to_list` (**Lot 2**) — **déduplique** : si une ligne *non cochée* lie déjà ce stock item, elle est renvoyée telle quelle (`created=False`), sinon une ligne liée est créée avec une quantité par défaut « de réappro » (`max_quantity − quantity` si positif, sinon `max`/`min`) ;
  - `update_list_item` (partial, le flag `checked` → timestamp `checked_at`) ;
  - `delete_list_item`, `resolve_list_item`, `resolve_stock_item_hint` (résolution best-effort d'un stock item par id ou nom, pour l'agent).

## Agent

- `SearchableSpec('shopping_item')` — l'agent liste/cite ce qu'il reste à acheter (`search_fields = label, note`).
- `WritableSpec('shopping_item')` — create/update/delete, tous adossés à `services.py`. Le create (`_create_shopping_item_from_agent`) est **intelligent** : « ajoute du café à la liste » lie la ligne au `StockItem` « Café » existant (et déduplique) via `resolve_stock_item_hint` ; un libellé inconnu crée une ligne texte libre. L'ancre de conversation `stock_item` pré-sélectionne aussi la cible.
- Réversible : undo par hard-delete côté front (`UNDO_HANDLERS['shopping_item']` dans `ui/src/features/agent/hooks.ts`).
- Descriptions du tool `create_entity` étendues dans `apps/agent/tools.py` (schéma + description).

## Frontend

- `ui/src/features/shopping/` : `hooks.ts` (query keys + mutations, toasts), `ShoppingListPage.tsx` (quick-add, sections « à acheter » / « Pris (N) », vider les cochés, undo), `ShoppingListItemRow.tsx` (card + checkbox + `CardActions`), `ShoppingItemDialog.tsx` (édition label/quantité/unité/note via `SheetDialog`).
- Suppression avec undo (`useDeleteWithUndo`, cache optimiste via `setQueryData`) pour une ligne **et** pour « Vider les cochés » (snapshot des ids, bulk-delete différé).
- Toggle optimiste (flip immédiat de la checkbox, puis PATCH `checked`).
- Lien stock : action « Ajouter à la liste de courses » sur `StockItemCard` et `StockItemDetailPage`, **masquée si le module `shopping` est désactivé** pour le foyer (`useDisabledModules`). Toast « déjà dans la liste » si dédupliqué.
- Route lazy `/app/shopping-list` (`ModuleRoute moduleKey="shopping"`), entrée sidebar groupe « Suivi » (`ShoppingCart`).

## Limites V1 / suites (parcours 22)

- **Lot 3** (suggestions depuis le stock bas), **Lot 4** (enregistrer les cochés → stock, créer l'item si absent), **Lot 5** (agent — déjà partiellement là via le writable), **Lot 6** (planification de repas adossée au stock) restent à faire — issues #317/#318/#319/#320.
- Pas de page détail par ligne : le `url_template` des specs agent pointe la page liste avec l'id en query (`/app/shopping-list?item={id}`, `{id}` requis par le test de registry ; le param est inoffensif, la page peut l'ignorer).
- Concurrence : dernier écrivain gagne (pas de merge), acceptable pour une liste de foyer.
