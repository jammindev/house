---
name: electricity_consumption_patterns
description: Sélecteurs, patterns et pièges spécifiques à l'onglet Consommation du module Électricité
type: ui_pattern
---

# Onglet Consommation — patterns E2E

## Accès à l'onglet

L'onglet Consommation n'est accessible que si un tableau électrique existe déjà.
Créer un tableau si `page.getByText('Aucun tableau électrique')` est visible, puis :

```typescript
await page.getByRole('button', { name: 'Consommation', exact: true }).click();
await expect(
  page.getByText('Aucun compteur').or(page.getByRole('button', { name: 'Nouveau relevé' })),
).toBeVisible({ timeout: 10_000 });
```

## Créer un compteur

Le bouton "Nouveau compteur" n'apparaît QUE dans l'EmptyState (aucun compteur).
Une fois un compteur créé, il n'y a plus de bouton pour en ajouter un via l'UI.

Pour créer un compteur isolé par test (sans conflit), utiliser l'API directement :

```typescript
async function apiCreateMeter(page, name, tariff = 'base') {
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  const resp = await page.request.post('/api/electricity/meters/', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { name, tariff_type: tariff, serial_number: '', notes: '', zone: null, timezone: 'Europe/Paris' },
  });
  return (await resp.json()).id;
}
```

## Sélectionner un compteur (multi-compteurs)

Quand plusieurs compteurs existent, un `<select aria-label="Choisir un compteur">` apparaît.
Sélectionner par id :

```typescript
await page.locator('select[aria-label]').selectOption(meterId);
```

## Validation d'index décroissant

Le serializer Django rejette un index inférieur au relevé précédent du même registre
avec le message anglais "Index is lower than the previous reading of this register."
L'erreur s'affiche dans `<p class="text-destructive">`.

```typescript
await expect(page.locator('p.text-destructive')).toBeVisible();
```

## Contrainte unique (meter, register, reading_at)

La DB a une contrainte UNIQUE sur `(meter, register, reading_at)`. Si le même triplet
est inséré lors d'un second run, l'API retourne "The fields meter, register, reading_at
must make a unique set." → le dialog reste ouvert.
Solution : créer un meter isolé via API pour chaque test qui insère des relevés.

## Bouton CardActions du compteur

La barre compteur a un bouton CardActions (MoreHorizontal, icon-only, sans texte).
Il est placé AVANT le bouton "Nouveau relevé" dans le DOM.
Trouver via preceding-sibling :

```typescript
const cardActionsBtn = page.getByRole('button', { name: 'Nouveau relevé' })
  .locator('xpath=preceding-sibling::button[1]');
await cardActionsBtn.click();
await page.getByRole('menuitem', { name: 'Modifier' }).click();
```

## Toast d'import

Le toast "Import terminé : X points ajoutés, Y déjà connus." génère une violation strict-mode
car le texte apparaît dans le toast Sonner ET dans un span aria-live.
Utiliser `.first()` :

```typescript
await expect(page.getByText(/Import terminé/).first()).toBeVisible({ timeout: 15_000 });
```

## Chart Recharts

Le chart Recharts rend un `.recharts-wrapper` dans la card.
Attention : il peut y en avoir plusieurs sur la page → utiliser `.first()`.

```typescript
await expect(
  page.locator('.recharts-wrapper').or(page.locator('svg.recharts-surface')).first(),
).toBeVisible({ timeout: 8_000 });
```

## Navigation de période (vue Heure)

La vue Heure affiche un seul jour. Le label est en français, ex : "samedi 1 juin 2026".
Pour naviguer vers une date précise, utiliser un regex qui évite les faux positifs sur "11", "21" :

```typescript
while (attempts < 60) {
  const label = await page.locator('span.capitalize').textContent() ?? '';
  if (/\b1\s+juin\s+2026\b/i.test(label)) break;
  await page.getByRole('button', { name: 'Période précédente' }).click();
  attempts++;
}
```

## Vérifier le nom d'un compteur après édition (select)

Après renommage d'un compteur avec plusieurs compteurs, le nom est dans un `<option>` (hidden).
Vérifier via `page.evaluate` :

```typescript
const text = await page.evaluate(() => {
  const sel = document.querySelector('select[aria-label]') as HTMLSelectElement;
  return sel?.options[sel.selectedIndex]?.text ?? null;
});
expect(text).toContain('nouveau nom');
```
