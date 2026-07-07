---
name: electricity_tariffs_patterns
description: Patterns E2E spécifiques aux tarifs de compteur électrique (TariffsDialog, bandeau coût €)
type: ui_pattern
---

# Tarifs de compteur — patterns E2E

## Ouvrir le SheetDialog "Gérer les tarifs"

L'action "Gérer les tarifs" est dans le CardActions du compteur (barre compteur).
Le bouton CardActions (icon-only, sans texte) est dans le LEFT container du meter bar.

Le LEFT container contient :
- `<select aria-label="Choisir un compteur">` (multi-compteurs) ou `<span class="truncate">` (mono)
- `<Badge>` texte "Base" ou "HP/HC"
- `<button>` icon-only (CardActions trigger) ← celui qu'on cherche

**Pattern fiable (confirmé par DOM snapshot) :**
```typescript
const meterSelect = page.locator('[aria-label="Choisir un compteur"]');
const hasSelect = (await meterSelect.count()) > 0;

let leftContainer;
if (hasSelect) {
  leftContainer = meterSelect.locator('xpath=ancestor::*[2]');
} else {
  const meterNameSpan = page.locator('span.truncate').first();
  leftContainer = meterNameSpan.locator('xpath=parent::*');
}

const cardActionsBtn = leftContainer.locator('button').last();
await cardActionsBtn.click();
await page.getByRole('menuitem', { name: 'Gérer les tarifs' }).click();
```

## Fermer le SheetDialog

L'Escape ne ferme pas toujours le SheetDialog de façon fiable dans les tests E2E.
Utiliser le bouton Close explicite :
```typescript
await page.getByRole('button', { name: 'Close' }).click();
await expect(page.getByText(/Tarifs —/)).not.toBeVisible({ timeout: 5_000 });
```

## Identifier un tarif dans la liste

Les tarifs sont des Cards avec le prix affiché en format local (ex: "0,2516" en FR).
Localiser par regex sur le prix :
```typescript
const priceText = page.getByText(/0,26|0\.26/).first();
// Tariff card = ancestor[3] from the price paragraph
const tariffCard = priceText.locator('xpath=ancestor::*[3]');
const actionsBtn = tariffCard.locator('button').last();
```

## Undo de suppression de tarif

L'undo toast (`useDeleteWithUndo`) peut être masqué par le Sheet overlay.
Toujours fermer le Sheet avant d'interagir avec le toast Annuler :
```typescript
await page.getByRole('menuitem', { name: 'Supprimer' }).click();
await expect(priceText).not.toBeVisible({ timeout: 5_000 }); // optimistic remove

// Close sheet first — toast may be behind the sheet z-index overlay
await page.getByRole('button', { name: 'Close' }).click();
await expect(page.getByText(/Tarifs —/)).not.toBeVisible({ timeout: 5_000 });

// Now the undo button is accessible
await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible({ timeout: 5_000 });
```

## Granularité et navigation temporelle — PIÈGE COURANT

Dans l'onglet Consommation, les granularités ont des labels de période différents :

| Granularité (key) | Bouton FR | Label de période | Navigation unitaire |
|---|---|---|---|
| `hour` | "Heure" | "samedi 1 juin 2026" (1 jour) | 1 jour |
| `day` | "Jour" | "juin 2025" (1 mois) | 1 mois |
| `month` | "Mois" | "2025" (1 an, juste le chiffre) | 1 an |
| `year` | "Année" | "2016 – 2025" (décennie) | 1 an |

**Erreur fréquente** : utiliser "Mois" et chercher un label `/juin.*2025/` — ça ne matchera
jamais car "Mois" affiche juste "2025".

**Pour naviguer vers un mois précis** (ex: juillet 2025), utiliser "Jour" :
```typescript
await page.getByRole('button', { name: 'Jour', exact: true }).click();
let attempts = 0;
while (attempts < 30) {
  const label = await page.locator('span.capitalize').textContent() ?? '';
  if (/juil.*2025/i.test(label)) break;
  await page.getByRole('button', { name: 'Période précédente' }).click();
  attempts++;
}
```

**Pour naviguer vers une année** (ex: 2025), utiliser "Mois" :
```typescript
await page.getByRole('button', { name: 'Mois', exact: true }).click();
while (!/^2025$/.test(await page.locator('span.capitalize').textContent() ?? '')) {
  await page.getByRole('button', { name: 'Période précédente' }).click();
}
```

## Bandeau coût € (total_cost_eur)

Le bandeau apparaît dans la card graphe (Card > div.flex.items-baseline) SEULEMENT
si `summary.total_cost_eur !== null`. Il est null tant qu'aucun tarif n'est configuré.

Textes FR à chercher :
- "dont conso X €" → `page.getByText(/dont conso/).first()`
- "dont abonnement X €" → `page.getByText(/dont abonnement/).first()`

Pour que le bandeau apparaisse, le tarif doit avoir `valid_from` antérieur aux relevés.

## API helpers tarifs

```typescript
async function apiCreateTariff(page, meterId, payload) {
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  const resp = await page.request.post('/api/electricity/meter-tariffs/', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { meter: meterId, price_base: null, price_hp: null, price_hc: null,
            subscription_eur_month: null, ...payload },
  });
  return (await resp.json()).id;
}
```

## Champs du formulaire de tarif

- `#tariff-valid-from` — date d'effet (input[type=date], format YYYY-MM-DD)
- `#tariff-price-base` — prix €/kWh tarif base (visible seulement si tariff_type=base)
- `#tariff-price-hp` — prix HP (visible seulement si tariff_type=hp_hc)
- `#tariff-price-hc` — prix HC (visible seulement si tariff_type=hp_hc)
- `#tariff-subscription` — abonnement €/mois (optionnel)
- Bouton submit : `getByRole('button', { name: 'Enregistrer' })`
- Bouton annuler (form only) : `getByRole('button', { name: 'Annuler' })` dans la form view
- Bouton "Nouveau tarif" (list view) : `getByRole('button', { name: 'Nouveau tarif' })`
