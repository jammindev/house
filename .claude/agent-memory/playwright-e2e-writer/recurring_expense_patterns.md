---
name: recurring_expense_patterns
description: Patterns module Dépenses récurrentes — parcours 21 Lot 2
type: ui-pattern
---

# Dépenses récurrentes (`/app/budget/recurring`)

## URLs & routing
- Page liste : `/app/budget/recurring`
- API list/create/delete : `/api/budget/recurring/`
- API due list : `/api/budget/recurring/due/`
- API projection : `/api/budget/recurring/projection/`
- API confirm : `/api/budget/recurring/{id}/confirm/`

## Chaînes FR clés
- Titre page : `"Dépenses récurrentes"` (`recurring.title`)
- Bouton créer : `"Nouvelle récurrence"` (`recurring.new.action`)
- État vide : `"Aucune dépense récurrente"` (`recurring.empty`)
- Section due : `"À confirmer (N)"` (`recurring.due.heading`)
- Section upcoming : `"À venir"` (`recurring.upcoming.heading`)
- Toast création : `"Récurrence créée"` (`recurring.created`)
- Toast suppression : `"Récurrence supprimée"` (`recurring.deleted`)
- Toast confirmation : `"« {{label}} » confirmée"` (`recurring.confirmed`) — interpolé
- Bouton confirmer sur la card : `"Confirmer"` (`recurring.confirm.action`)
- Titre dialog confirm : `"Confirmer cette dépense"` (`recurring.confirm.title`)
- Champ montant payé : `"Montant payé"` (`recurring.confirm.amount`) — ID `#confirm-amount`

## IDs de champs du SheetDialog de création
- `#rec-label` — libellé
- `#rec-amount` — montant (number input)
- `#rec-cadence` — cadence (select: monthly/quarterly/yearly)
- `#rec-due` — prochaine échéance (date input, pré-rempli à `todayIso()`)
- `#rec-supplier` — fournisseur
- `#rec-notes` — notes (textarea)
- `#rec-budget` — budget (select, seulement si des budgets nommés existent)

## Cadences (libellés FR)
- `monthly` → `"Mensuelle"`
- `quarterly` → `"Trimestrielle"`
- `yearly` → `"Annuelle"`

## Link card depuis BudgetPage
- Texte cliquable : `"Dépenses récurrentes"`
- Visible seulement une fois que l'overview est chargé (attendre `h1 Budgets`)
- Navigue vers `/app/budget/recurring`

## Projection trésorerie
- Visible seulement quand au moins une récurrence existe
- Cards : `"30 prochains jours"` / `"90 prochains jours"`
- Texte interstitiel : `"N échéance(s)"`

## Section "À confirmer"
- Récurrence apparaît ici si `next_due_date <= today`
- Bouton `"Confirmer"` sur la card via `page.getByRole('button', { name: 'Confirmer' })`
- Titre de section format : `"À confirmer (1)"` — utiliser `getByText(/À confirmer/)` pour souplesse

## ConfirmOccurrenceDialog
- Role : `dialog`
- Titre : `"Confirmer cette dépense"`
- Input `#confirm-amount` pré-rempli avec le montant de la récurrence (string `"10"` car amount est string côté API)
- Bouton submit : `"Confirmer"` (rôle button dans le dialog)

## Suppression (CardActions)
- Même pattern que les autres modules : dernier `<button>` dans `ancestor::*[4]`
- Menuitem : `"Supprimer"`
- Toast undo : `"Récurrence supprimée"` + bouton `"Annuler"` pour restaurer

## Helper `apiCreateRecurring`
```typescript
async function apiCreateRecurring(
  page,
  label: string,
  amount: number,
  nextDueDate: string,
  cadence: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
) {
  const token = await getAccessToken(page);
  return page.request.post('/api/budget/recurring/', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { label, amount, cadence, next_due_date: nextDueDate, supplier: '', notes: '', budget_id: null },
  });
}
```

## Isolation
- `deleteAllRecurring` helper via `GET /api/budget/recurring/` + `DELETE` sur chaque item
- Toujours appeler dans `beforeEach` après `page.goto('/app/budget')` (JWT nécessaire avant les appels API)
- Recharger (`page.goto(...)`) après création API pour afficher les nouvelles données

## Piège : toast "confirmée" interpolé
- Le toast contient `« Netflix » confirmée` — utiliser `getByText(/confirmée/)` pour matcher sans connaître le libellé exact
- Le texte complet est `t('recurring.confirmed', { label })` → vérifier avec une regex

## Piège : état après confirmation
- Après confirmation, la carte Spotify sort de "À confirmer"
- Si c'était la seule carte due, `"À confirmer (1)"` disparaît entièrement — vérifier avec `toBeHidden()`
- La carte peut migrer dans "À venir" avec la prochaine échéance calculée
