---
name: stock_detail_patterns
description: Patterns E2E pour la page détail d'article de stock (/app/stock/:id)
type: ui-pattern
---

# Patterns — Page détail article de stock

## URL et routes

- Liste : `/app/stock`
- Détail : `/app/stock/:id`
- API articles : `POST/GET /api/stock/` (pas `/api/stock/items/`)
- API catégories : `POST /api/stock/categories/`
- API historique achat : `GET /api/interactions/interactions/?source_type=stock.stockitem&source_id=<id>&ordering=-occurred_at&limit=100`

## Gotchas critiques

### EntityAssistant bloque l'UI (comme dans chickens)

La page détail embarque un `EntityAssistant`. Si `localStorage['agent.privacyAccepted.v2']` n'est pas défini, la modale "Avant de commencer" s'ouvre en `aria-hidden` et intercepte tous les clics → les `expect(heading).toBeVisible()` échouent.

Toujours pré-accepter dans `beforeEach` :

```ts
const PRIVACY_KEY = 'agent.privacyAccepted.v2';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([key]) => {
    localStorage.setItem(key, 'true');
  }, [PRIVACY_KEY]);
  // ...
});
```

### Noms uniques par test

`Date.now()` au niveau du `describe` est évalué une seule fois. Les catégories ont une contrainte unique `(household_id, name)` → 500 au 2ème test.

Toujours générer les noms dans `beforeEach` avec des variables d'instance :

```ts
let categoryName: string;
let itemName: string;

test.beforeEach(async ({ page }) => {
  const ts = Date.now();
  categoryName = `Cat E2E ${ts}`;
  itemName = `Article E2E ${ts}`;
});
```

### BackLink : texte "Retour" vs nom de la liste

Le composant `BackLink` affiche :
- **"Stock"** (fallbackLabel) si accès direct par URL (`hasOrigin = false`)
- **"Retour"** (`t('common.back')`) si on vient d'une page parente avec `pushBack` (`hasOrigin = true`)

Cibler dans `getByRole('main')` pour éviter le conflit avec le lien "Stock" de la sidebar :

```ts
// Depuis la liste (pushBack actif) → texte "Retour"
await page.getByRole('main').getByRole('link', { name: 'Retour' }).click();

// Accès direct (pas de state.back) → texte "Stock"
await expect(page.getByRole('main').getByRole('link', { name: 'Stock' })).toBeVisible();
```

### Sélecteurs dans l'historique

Le fournisseur peut apparaître à deux endroits (grille d'infos ET historique). Scoper à la section :

```ts
const historySection = page.locator('section').filter({ hasText: 'Historique des achats' });
await expect(historySection.getByText('Grossiste E2E')).toBeVisible();
await expect(historySection.getByText('18.00 €')).toBeVisible();
```

## Helpers API réutilisables

```ts
async function createCategory(page, name: string): Promise<{ id: string; name: string }> {
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  const resp = await page.request.post('/api/stock/categories/', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { name, emoji: '📦', color: '#6366f1' },
  });
  return resp.json();
}

async function createStockItem(page, { name, categoryId, unit, quantity, supplier }) {
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  const resp = await page.request.post('/api/stock/', {  // PAS /api/stock/items/
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { name, category: categoryId, unit, quantity, supplier },
  });
  return resp.json();
}

async function deleteStockItem(page, itemId: string) {
  if (!itemId) return;  // Guard si déjà supprimé par le test
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  await page.request.delete(`/api/stock/${itemId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

## Chaînes FR clés

| Clé i18n | Valeur FR |
|---|---|
| `stock.detail.title` | Détails de l'article |
| `stock.detail.history_title` | Historique des achats |
| `stock.detail.no_history` | Aucun achat enregistré. |
| `stock.purchase.actions.add` | Achat |
| `stock.purchase.title` | Approvisionner — {{name}} |
| `stock.purchase.created` | Achat enregistré |
| `stock.status.in_stock` | En stock |
| `purchase.actions.confirm` | Enregistrer l'achat |
| `common.back` | Retour |
| `common.confirmDelete` | Êtes-vous sûr ? |

## afterEach safety pattern (suppression)

Quand un test supprime l'article via l'UI, marquer `itemId = ''` pour que `afterEach` ne tente pas une suppression 404 :

```ts
test('supprime...', async ({ page }) => {
  // ... suppression via l'UI ...
  itemId = '';  // evite 404 dans afterEach
});

test.afterEach(async ({ page }) => {
  await deleteStockItem(page, itemId);  // no-op si itemId = ''
});
```
