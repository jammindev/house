---
name: budget_module_patterns
description: Patterns for writing E2E tests for the Budget module (/app/budget, parcours 21)
type: module-patterns
---

# Budget Module — Playwright Patterns

## API endpoints

- List / create: `GET|POST /api/budget/budgets/`
- Detail / update / delete: `GET|PATCH|DELETE /api/budget/budgets/{id}/`
- Overview (spent/ceiling per budget): `GET /api/budget/budgets/overview/`

## Module status

- `optional: false` → always in the sidebar, never needs enabling
- Sidebar group: `tracking` (Suivi)
- Sidebar link: `getByRole('link', { name: 'Budgets' })`

## Helper pattern

```ts
async function deleteAllBudgets(page): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/budget/budgets/', { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok()) return;
  const body = await resp.json();
  const items = Array.isArray(body) ? body : (body.results ?? []);
  for (const item of items) {
    await page.request.delete(`/api/budget/budgets/${item.id}/`, { headers: { Authorization: `Bearer ${token}` } });
  }
}

async function apiCreateBudget(page, name, monthlyAmount) {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/budget/budgets/', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { name, monthly_amount: monthlyAmount, is_global: false },
  });
  return resp.json();
}
```

## BudgetDialog field IDs

- Name: `#budget-name`
- Monthly amount: `#budget-amount`
- Global checkbox: `#budget-is-global` (only shown when no global exists — `allowGlobal: true`)

## UI strings (FR)

- Page heading: `"Budgets"`
- Empty state: `"Aucun budget"`, `"Crée un budget pour suivre tes dépenses du mois."`
- New button: `"Nouveau budget"` (appears in PageHeader AND EmptyState CTA)
- Dialog title (create): `"Nouveau budget"`, (edit): `"Modifier le budget"`
- Toast success create: `"Budget créé"` (exact: true — strict-mode with aria-live)
- Toast delete: `"Budget supprimé"`
- Global checkbox label: `"Budget global (plafonne toutes les dépenses)"`
- Cancel/Save buttons: `"Annuler"` / `"Enregistrer"`
- Section heading (named): `"Budgets"` (h2)
- Section heading (global): `"Budget global"` (h2)
- Unbudgeted card: `"Hors budget"` + hint `"Dépenses non rattachées à un budget."`
- Validation error (amount): `"Saisis un montant positif."`

## BudgetCard structure

- Card displays: `{name}` + `{spent} / {amount}` + progressbar (role="progressbar") + percentage or overBy text
- Amount format with `fr-FR` locale: `0,00 €`, `400,00 €`
- Regex pattern for amount display: `/0,00\s*€\s*\/\s*400,00\s*€/`
- CardActions = last `<button>` inside the card → `card.locator('button').last().click()`
- Ancestor selector depth: `page.getByText('Name').locator('xpath=ancestor::*[4]')` for card wrapper

## Key behaviors

- Empty state visible only when `!hasAnyBudget` (no global, no named budgets)
- "Hors budget" card always visible once any budget exists
- `allowGlobal=true` (checkbox shown) when no global budget exists yet
- `allowGlobal=false` (checkbox hidden) when a global already exists
- Optimistic delete: card disappears immediately on delete, `"Budget supprimé"` toast + `"Annuler"` undo button appears

## beforeEach isolation pattern

```ts
test.beforeEach(async ({ page }) => {
  await page.goto('/app/budget');           // hydrater le JWT
  await deleteAllBudgets(page);             // état vide garanti
  await page.reload();                      // refléter dans l'UI
  await expect(page).toHaveURL(/\/app\/budget/);
});
```

## Expenses integration

When named budgets exist, `ExpenseAdHocDialog` shows:
- Label: `"Budget"` (getByLabel or #adhoc-budget)
- Select ID: `#adhoc-budget`
- Placeholder option: `"Aucun budget"`
- Options: only non-global budgets (`is_global: false`)
- After assigning a budget to an expense, BudgetPage shows incremented `spent`
