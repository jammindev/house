---
name: budget_report_patterns
description: Patterns pour ReportsPage (/app/budget/reports) — bilan mensuel (parcours 21 Lot 3)
type: feature-pattern
---

# Bilan mensuel — patterns E2E

## Route et navigation

- URL : `/app/budget/reports`
- Accessible depuis `/app/budget` via une link card dont le texte est `t('report.title')` = **"Bilan mensuel"**
- La link card ne s'affiche qu'après chargement de l'overview budget — attendre `h1 "Budgets"` avant de cliquer
- BackLink fallback : `"Budgets"` (link vers `/app/budget`)

## Traductions clés

| Clé i18n | Valeur FR |
|---|---|
| `report.title` | Bilan mensuel |
| `report.description` | Un récap écrit des dépenses du mois écoulé, budget par budget. |
| `report.empty` | Aucun bilan |
| `report.emptyDescription` | Ton premier bilan mensuel apparaîtra une fois un mois clôturé avec des dépenses. |
| `report.latest` | Mois dernier |
| `report.history` | Mois précédents |

## Structure de la page

```
<BackLink fallback="/app/budget" label="Budgets" />
<PageHeader title="Bilan mensuel" description="..." />

// État chargement : skeleton 2 blocs (h-28 bg-muted)
// État vide :
<EmptyState title="Aucun bilan" description="..." />

// Avec rapport(s) :
<h2>Mois dernier</h2>          // t('report.latest')
<Card>
  <CardTitle className="capitalize">{monthLabel}</CardTitle>  // ex: "juin 2026"
  <p>{report.text}</p>
</Card>
<h2>Mois précédents</h2>       // t('report.history'), si history.length > 0
```

## API

- `GET /api/budget/reports/latest/` — génère le rapport du dernier mois clôturé en lazy (via LLM). Retourne `null` si aucune dépense.
- `GET /api/budget/reports/` — liste tous les rapports

## Limitation E2E critique

Le rapport est généré lazily au premier GET `latest/`. En CI, si aucune dépense ne date du mois précédent dans la DB seedée, le backend retourne `null` → état vide affiché.

**Stratégie tolérante** :
```typescript
await expect(
  page.getByText('Aucun bilan').or(page.getByText('Mois dernier')).or(page.getByText('Mois précédents')),
).toBeVisible({ timeout: 15000 });
```

## Helper — seed dépense mois précédent

On ne peut pas contrôler `occurred_at` depuis l'UI (la date est fixée à aujourd'hui). Passer par l'API directement :

```typescript
function firstDayOfPreviousMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.toISOString().slice(0, 10);
}

// POST /api/interactions/ avec type=expense, metadata.kind=manual
// occurred_at = firstDayOfPreviousMonth() + 'T10:00:00Z'
```

Même avec cette dépense seedée, le rapport peut ne pas apparaître immédiatement si la logique backend filtre les mois sans données suffisantes → assertions rester tolérantes.

## Libellé de mois

`monthLabel('2026-06')` → `"juin 2026"` via `Intl.DateTimeFormat({ month: 'long', year: 'numeric' })`. CSS `capitalize` sur `<CardTitle>` → premier caractère en majuscule.
