---
name: electricity_module_patterns
description: UI patterns, selectors and French strings for the Electricity module (/app/electricity)
type: feature-knowledge
---

# Electricity Module — E2E Patterns

## Page URL
`/app/electricity`

## French strings (from fr/translation.json)

### Page heading
- `'Électricité'`

### Tab pills (FilterPill buttons)
- `'Tableau'` — board tab (default)
- `'Circuits'`
- `'Points d\'usage'`
- `'Liens'`
- `'Recherche'`

### Empty state (no board)
- `'Aucun tableau électrique'`
- CTA button: `'Nouveau tableau'`

### BoardDialog
- Dialog heading create: `'Nouveau tableau'`
- Dialog heading edit: `'Modifier le tableau'`
- Name field label: `'Nom'`  → `getByLabel('Nom')` or `page.locator('#board-name')`
- Zone select: `page.locator('#board-zone')`
- Supply type select: `page.locator('#board-supply')` — options: `'Monophasé'` / `'Triphasé'`
- Location input: `page.locator('#board-location')`
- Inspection date: `page.locator('#board-inspection')`
- Compliance select: `page.locator('#board-compliance')` — options: `'Conforme'`, `'Non conforme'`, `'Partiel'`
- Save button: `'Enregistrer'`
- Cancel button: `'Annuler'`

### DeviceDialog (board tab → "Ajouter un appareil")
- Dialog heading create: `'Ajouter un appareil'`
- Dialog heading edit: `'Modifier l\'appareil'`
- Open button: `'Ajouter un appareil'`
- Label field: `getByLabel('Étiquette')` or `page.locator('#dev-label')` — placeholder `'BRK-01'`
- Type select: `page.locator('#dev-type')` — default `'Disjoncteur'`
  - options: `'Disjoncteur'`, `'Interrupteur différentiel'`, `'Combiné (ID + disjoncteur)'`, `'Disjoncteur de branchement'`
- Role select: `page.locator('#dev-role')` — default `'Divisionnaire'`
- Rating (A): `page.locator('#dev-rating')` — default `20`
- Curve select: `page.locator('#dev-curve')` — shown only for breaker/combined
- Sensitivity select: `page.locator('#dev-sensitivity')` — shown only for rcd/combined
- Type code select: `page.locator('#dev-typecode')` — shown only for rcd/combined
- Phase select: `page.locator('#dev-phase')` — shown only for three_phase boards
- Brand: `page.locator('#dev-brand')`
- Model ref: `page.locator('#dev-model')`
- Spare checkbox: `page.locator('#dev-spare')`

### CircuitDialog (circuits tab → "Ajouter un circuit")
- Dialog heading create: `'Ajouter un circuit'`
- Open button: `'Ajouter un circuit'`
- Label field: `getByLabel('Étiquette')` or `page.locator('#cir-label')` — placeholder `'CIR-01'`
- Name field: `getByLabel('Nom')` or `page.locator('#cir-name')` — placeholder `'ex. Prises cuisine'`
- Device select: `page.locator('#cir-device')` — placeholder `'Sélectionner un appareil'`
  - Only breaker/combined devices appear
- Phase select: `page.locator('#cir-phase')` — shown only for three_phase boards
- "Add circuit" is disabled if no devices exist

### UsagePointDialog (usage points tab → "Ajouter un point d'usage")
- Dialog heading create: `'Ajouter un point d\'usage'`
- Open button: `'Ajouter un point d\'usage'`
- Label field: `page.locator('#up-label')` — placeholder `'UP-01'`
- Kind select: `page.locator('#up-kind')` — options: `'Prise'`, `'Luminaire'`
- Name field: `page.locator('#up-name')` — placeholder `'ex. Prise salon mur nord'`
- Zone select: `page.locator('#up-zone')` — optional

### LinkDialog (links tab → "Nouveau lien")
- Dialog heading: `'Nouveau lien'`
- Open button: `'Nouveau lien'`
- Circuit select: `page.locator('#link-circuit')`
- Usage point select: `page.locator('#link-up')`
- Disabled when no circuits OR no usage points exist

### Links tab
- Disconnect button on each link card: `'Déconnecter'`
- Active link counter text: `N lien(s) actif(s)`

### Usage points kind filter pills
- `'Tous'`
- `'Prises'`
- `'Luminaires'`

## Key structural notes

### CardActions pattern for electricity
All electricity cards (board info, device, circuit, usage point) use the `CardActions` component,
which renders a MoreHorizontal dropdown. The pattern to open it and click a menu item is:

```typescript
async function openCardMenu(page, cardText, menuItem) {
  const cardAncestor = page.getByText(cardText, { exact: true }).locator('xpath=ancestor::*[4]');
  await cardAncestor.locator('button').last().click();
  await page.getByRole('menuitem', { name: menuItem }).click();
}
```

Menu item names: `'Modifier'` and `'Supprimer'` (danger variant).

### Delete confirmation
Deletions use `window.confirm`. Handle with:
```typescript
page.once('dialog', (d) => void d.accept());
await openCardMenu(page, text, 'Supprimer');
```

### Seeding
The E2E database has NO electricity data seeded by default (seed_demo_data does not
include electricity entities). Tests must create their own data from scratch.

### Board prerequisite guard pattern
Many tests require a board to exist before tabs appear. Guard pattern:
```typescript
const hasEmptyState = await page.getByText('Aucun tableau électrique').isVisible().catch(() => false);
if (hasEmptyState) {
  // create board inline
}
```

### Zone required for BoardDialog
Zone is required for both board and usage point creation. Always wait for options:
```typescript
const zoneSelect = page.locator('#board-zone');
const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);
```
