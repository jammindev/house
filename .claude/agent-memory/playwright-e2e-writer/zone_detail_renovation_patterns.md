---
name: zone_detail_renovation_patterns
description: Patterns E2E pour l'onglet Rénovation dans ZoneDetailPage (/app/zones/:id) — sélecteurs, pièges strict-mode, helpers API
type: ui-patterns
---

# ZoneDetailPage — Onglet Rénovation

## TabShell : boutons, pas tabs ARIA

`TabShell` rend des `FilterPill` qui sont des `<button>`, pas des éléments avec `role="tab"`.

```ts
// ✅ Correct
await page.getByRole('button', { name: 'Rénovation' }).click();

// ❌ Ne résout pas (rôle incorrect)
await page.getByRole('tab', { name: 'Rénovation' }).click();
```

La même règle vaut pour tous les autres onglets de ZoneDetailPage : Infos, Équipements, Tâches, Activité, Projets, Photos, Documents, Assistant.

## Strict-mode — toasts de rénovation

Les toasts de rénovation résolvent 2 éléments (div toast + span `aria-live`).
Toujours utiliser `{ exact: true }` :

```ts
await expect(page.getByText('Entrée de rénovation ajoutée', { exact: true })).toBeVisible();
await expect(page.getByText('Entrée mise à jour', { exact: true })).toBeVisible();
await expect(page.getByText('Entrée supprimée', { exact: true })).toBeVisible();
```

## Strict-mode — badge élément vs subject auto

Quand l'élément est "Sol" (ou tout autre label court), le subject auto-généré
contient lui aussi ce mot ("Sol — Maison"). `getByText('Sol')` résout 2 éléments.

```ts
// ✅ Cibler uniquement le badge
await expect(page.getByText('Sol', { exact: true })).toBeVisible();
```

## API helpers

### Récupérer la première zone
```ts
async function getFirstZone(page): Promise<{ id: string; name: string }> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/zones/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await resp.json() as unknown;
  const zones = Array.isArray(body) ? body : ((body as any).results ?? []);
  return zones[0];  // "Salon" dans les données demo (ordre alphabétique ou création)
}
```

### Créer une entrée de rénovation via API
```ts
await page.request.post('/api/interactions/interactions/renovation/', {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  data: {
    element: 'wall',           // paint|floor|wall|ceiling|joinery|plumbing|electrical|heating|furniture|other
    interaction_type: 'repair', // installation|replacement|upgrade|repair|maintenance
    product: 'Enduit de rebouchage',
    brand: 'Polyfilla',
    zone_ids: [zoneId],
    occurred_at: '2024-06-01T00:00:00.000Z',
  },
});
```

### Supprimer toutes les entrées de rénovation d'une zone
```ts
async function deleteAllRenovationEntries(page, zoneId): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get(
    `/api/interactions/interactions/?zone=${zoneId}&kind=renovation&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = await resp.json() as unknown;
  // La liste est dans .items (pas .results) pour cette API
  const items = (body as any).items ?? (body as any).results ?? [];
  for (const item of items) {
    await page.request.delete(`/api/interactions/interactions/${item.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
```

**Attention** : la réponse de `/api/interactions/interactions/` utilise `.items` et non `.results`.

## Sélecteurs du formulaire RenovationDialog

| Champ | Sélecteur |
|---|---|
| Élément | `dialog.locator('#reno-element')` (select natif) |
| Nature | `dialog.locator('#reno-type')` (select natif) |
| Produit | `dialog.locator('#reno-product')` |
| Marque | `dialog.locator('#reno-brand')` |
| Référence | `dialog.locator('#reno-reference')` |
| Date | `dialog.locator('#reno-date')` |
| Titre | `dialog.locator('#reno-subject')` |
| Notes | `dialog.locator('#reno-notes')` |
| Toute la maison | `dialog.getByRole('button', { name: 'Toute la maison' })` |
| Soumettre (create) | `dialog.getByRole('button', { name: 'Ajouter' })` |
| Soumettre (edit) | `dialog.getByRole('button', { name: 'Enregistrer' })` |

## Structure de la RenovationCard

La card expose deux badges en haut : badge élément (bg-primary/10) + badge type (bg-muted).
Le subject auto-généré est affiché en `text-sm font-medium` en dessous.
Le produit/marque/ref sont formatés `produit · marque · réf. xxx` sur la ligne suivante.

Pour ouvrir le menu CardActions (CardActions = bouton ⋯) d'une entrée :
```ts
const card = page.getByText('Enduit de rebouchage').locator('xpath=ancestor::*[5]');
await card.locator('button').last().click();
await page.getByRole('menuitem', { name: 'Modifier' }).click();
```

## Pattern beforeEach recommandé

```ts
test.beforeEach(async ({ page }) => {
  await page.goto('/app/zones');  // JWT chargé en localStorage
  const zone = await getFirstZone(page);
  zoneId = zone.id;
  await deleteAllRenovationEntries(page, zoneId);
  await page.goto(`/app/zones/${zoneId}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
```

## Build requis avant run E2E

Le serveur E2E (port 8002) sert les assets statiques depuis `/static/react/assets/`.
Si la feature renovation a été ajoutée après le dernier `npm run build`, le `ZoneDetailPage-*.js`
ne contiendra pas l'onglet Rénovation dans les tabs rendus.

Toujours faire `npm run build` depuis la racine du projet avant de lancer les tests E2E
sur une nouvelle feature.
