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
- Second modèle : `ShoppingSuggestionDismissal` (**Lot 3**) — `(household, stock_item)` unique + `dismissed_at` — mémorise qu'une suggestion de stock bas a été ignorée. Pas de nettoyage sur restock (couplerait `stock` à `shopping`) : une dismissal est considérée **périmée** dès que `StockItem.last_restocked_at` est plus récent que `dismissed_at` → un nouveau cycle d'épuisement re-suggère naturellement.
- Endpoints : `/api/shopping/items/` (`ShoppingListItemViewSet`, CRUD) + actions `from-stock/` (ajout depuis un item stock, dédupliqué), `bulk-delete/` (suppression groupée), `suggestions/` (GET — items bas à proposer), `suggestions/dismiss/` (POST), `{id}/commit-to-stock/` (POST — **Lot 4**).
- Permissions : `IsHouseholdMember` ; tout est scopé au foyer actif (`request.household`).
- **Écritures via `apps/shopping/services.py`** — source de vérité partagée view + agent (jamais d'ORM brut dans le handler agent) :
  - `create_list_item` (validation via `ShoppingListItemSerializer`) ;
  - `add_stock_item_to_list` (**Lot 2**) — **déduplique** : si une ligne *non cochée* lie déjà ce stock item, elle est renvoyée telle quelle (`created=False`), sinon une ligne liée est créée avec une quantité par défaut « de réappro » (`max_quantity − quantity` si positif, sinon `max`/`min`) ;
  - `update_list_item` (partial, le flag `checked` → timestamp `checked_at`) ;
  - `list_suggestions` / `dismiss_suggestion` (**Lot 3**) — items `low_stock`/`out_of_stock` pas déjà dans la liste (cochés inclus) et pas ignorés ;
  - `commit_item_to_stock` (**Lot 4**) — ligne liée → `purchase_stock_item` ; ligne libre → `create_stock_item` (catégorie requise) puis achat ; supprime la ligne au succès. Atomique, réutilise `stock.services` (réincrémente + crée la dépense) ;
  - `delete_list_item`, `resolve_list_item`, `resolve_stock_item_hint` (résolution best-effort d'un stock item par id ou nom, pour l'agent).

## Agent

- `SearchableSpec('shopping_item')` — l'agent cite un item par recherche plein-texte (`search_fields = label, note`).
- `ListableSpec('shopping_item')` (**Lot 5**) — répond à « qu'est-ce qu'il me manque ? » là où la recherche plein-texte échoue (rien de lexical à matcher, c'est une requête d'**état**). Filtres : `checked` (`false` = à acheter, `true` = pris) et `linked` (`true` = seulement les lignes liées au stock). `describe` rend « to buy | 2 kg | stock-linked ». Ordre = `sort_order, created_at`.
- `WritableSpec('shopping_item')` — create/update/delete, tous adossés à `services.py`. Le create (`_create_shopping_item_from_agent`) est **intelligent** : « ajoute du café à la liste » lie la ligne au `StockItem` « Café » existant (et déduplique) via `resolve_stock_item_hint` ; un libellé inconnu crée une ligne texte libre. L'ancre de conversation `stock_item` pré-sélectionne aussi la cible.
- Réversible : undo par hard-delete côté front (`UNDO_HANDLERS['shopping_item']` dans `ui/src/features/agent/hooks.ts`).
- Descriptions des tools `create_entity` **et** `list_entities` étendues dans `apps/agent/tools.py` (types supportés + filtres).

## Frontend

- `ui/src/features/shopping/` : `hooks.ts` (query keys + mutations, toasts), `ShoppingListPage.tsx` (quick-add, sections « à acheter » / « Pris (N) », vider les cochés, undo), `ShoppingListItemRow.tsx` (card + checkbox + `CardActions`), `ShoppingItemDialog.tsx` (édition label/quantité/unité/note via `SheetDialog`).
- Suppression avec undo (`useDeleteWithUndo`, cache optimiste via `setQueryData`) pour une ligne **et** pour « Vider les cochés » (snapshot des ids, bulk-delete différé).
- Toggle optimiste (flip immédiat de la checkbox, puis PATCH `checked`).
- Lien stock : action « Ajouter à la liste de courses » sur `StockItemCard` et `StockItemDetailPage`, **masquée si le module `shopping` est désactivé** pour le foyer (`useDisabledModules`). Toast « déjà dans la liste » si dédupliqué.
- **Suggestions (Lot 3)** : `ShoppingSuggestions.tsx` — section en tête de page listant les items bas non présents/non ignorés, avec « Ajouter » (qty conseillée pré-remplie), « Tout ajouter » et « Ignorer » (croix).
- **Commit (Lot 4)** : `ShoppingCommitDialog.tsx` — action « Enregistrer dans le stock » sur les lignes **cochées** (`onCommit` du row) → réutilise `PurchaseForm` (delta/prix/fournisseur/date/notes) ; ligne libre = sélecteur de catégorie en plus (création de l'article).
- Route lazy `/app/shopping-list` (`ModuleRoute moduleKey="shopping"`), entrée sidebar groupe « Suivi » (`ShoppingCart`).

## Limites V1 / suites (parcours 22)

- **Lots 1-5 livrés.** Lot 5 (agent) : writable + searchable + `ListableSpec`. Lot 3 (suggestions stock bas) + Lot 4 (commit → stock, création si absent) : livrés. Reste **Lot 6** (planification de repas adossée au stock) — issue #320, gardé en **V2**.
- Commit d'une ligne libre : crée toujours un nouvel article (pas de dédup par nom sur un article existant du même libellé) — acceptable V1, l'utilisateur a choisi le texte libre.
- Pas de page détail par ligne : le `url_template` des specs agent pointe la page liste avec l'id en query (`/app/shopping-list?item={id}`, `{id}` requis par le test de registry ; le param est inoffensif, la page peut l'ignorer).
- Concurrence : dernier écrivain gagne (pas de merge), acceptable pour une liste de foyer.
