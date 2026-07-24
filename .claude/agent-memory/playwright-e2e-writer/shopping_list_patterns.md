---
name: shopping_list_patterns
description: Patterns module Liste de courses (shopping) — page /app/shopping-list
type: feature-patterns
---

# Module Liste de courses — patterns E2E

## URL et module key
- Page : `/app/shopping-list`
- Module key : `shopping` (optionnel, désactivable depuis /app/settings)
- Sidebar : `getByRole('link', { name: 'Liste de courses' })`

## API
- `GET /api/shopping/items/` — retourne un tableau ou `{ results: [] }` (normaliser avec `Array.isArray`)
- `POST /api/shopping/items/` — `{ label, checked? }` (checked=false par défaut)
- `PATCH /api/shopping/items/:id/` — `{ checked?, label?, quantity?, unit?, note? }`
- `DELETE /api/shopping/items/:id/`
- `POST /api/shopping/items/from-stock/` — `{ stock_item: id }` — réponse : `{ ...item, already_in_list: boolean }`
- `POST /api/shopping/items/bulk-delete/` — `{ ids: string[] }`

## Strings FR clés
- Placeholder quick-add : `'Ajouter un article…'`
- Bouton quick-add : `'Ajouter'` (rôle button, désactivé si champ vide)
- Section pris : `'Pris (N)'` (interpolé → regex `/Pris \(\d+\)/i`)
- Vider cochés : `'Vider les cochés'`
- Toast vider cochés : `'Articles cochés retirés'`
- Toast supprimé : `'Article retiré'`
- EmptyState : `'Votre liste de courses est vide'`
- Dialog titre edit : `"Modifier l'article"` (SheetDialog → `role="dialog"`)
- Champ label : `getByLabel('Article *')` (FormField label = `shoppingList.fields.label + ' *'`)
- Champ quantité : `getByLabel('Quantité')`
- Champ unité : `getByLabel('Unité')`
- Champ note : `getByLabel('Note')`
- Bouton save dialog : `getByRole('button', { name: 'Enregistrer' })`
- Badge stock : `getByText('Stock')` (chip sur les items liés à un stock item)
- Toast stock ajouté : regex `/ajouté à la liste de courses/i`
- Toast stock déjà là : regex `/déjà dans la liste/i`
- Action CardActions (stock card) : `'Ajouter à la liste de courses'`

## Checkbox
L'input[type=checkbox] a l'aria-label dynamique :
```
t('shoppingList.actions.toggle', { label: item.label })
// → "Cocher <label>"
```
Sélecteur : `page.getByRole('checkbox', { name: 'Cocher <label>' })`

## Line-through
Les items cochés ont la classe `line-through` sur le `<span>` interne :
```typescript
page.locator('span.line-through', { hasText: label })
```

## Isolation des tests
- Utiliser `clearShoppingList(page)` dans `beforeEach` pour partir d'un état vide.
- Toujours naviguer vers `/app/shopping-list` avant d'appeler `clearShoppingList`
  (le JWT doit être dans localStorage).
- Recharger après clear pour que la UI reflète l'état vide.

## Structure de carte ShoppingListItemRow
```
Card (flex, gap-3, p-3)
  ├── input[type=checkbox]         — aria-label "Cocher <label>"
  ├── button (text-left)           — clic = toggle
  │     └── span (.line-through si checked)
  │           └── span.truncate    — label
  ├── span badge "Stock"           — si stock_item présent
  └── CardActions (dernier bouton) — menuitem "Modifier" / "Supprimer"
```
Ancêtre card depuis le texte : `.locator('xpath=ancestor::*[4]')`

## Stock → shopping
- L'action "Ajouter à la liste de courses" est dans le dropdown `CardActions`
  sur chaque `StockItemCard` (liste + détail).
- Sur la page liste `/app/stock`, les cartes sont des `<li>`.
- Deuxième appel → `already_in_list = true` → toast différent.
- Module `shopping` doit être activé sinon l'action n'apparaît pas (guard `shoppingEnabled`).

## SheetDialog vs Dialog
- `ShoppingItemDialog` utilise `SheetDialog` (convention projet) → Radix Dialog → `role="dialog"`.
- `page.getByRole('dialog')` fonctionne comme sur les autres specs.
