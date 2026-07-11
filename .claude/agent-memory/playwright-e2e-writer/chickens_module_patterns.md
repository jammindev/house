---
name: chickens_module_patterns
description: Patterns E2E pour le module Poulailler (/app/chickens, /app/chickens/:id)
type: module_patterns
---

# Poulailler — patterns E2E

## URLs API

- Liste/création des poules : `GET/POST /api/chickens/` (DefaultRouter root, PAS `/api/chickens/chickens/`)
- Détail/suppression : `GET/DELETE /api/chickens/{id}/`
- Événements : `GET/POST /api/chickens/events/`
- Egg logs : `GET/POST /api/chickens/egg-logs/`
- Stats ponte : `GET /api/chickens/egg-logs/stats/`
- Résumé : `GET /api/chickens/summary/`
- Settings : `GET/PATCH /api/chickens/settings/`

## Page principale (/app/chickens)

- Heading : `getByRole('heading', { name: 'Poulailler' })`
- Bouton principal (en-tête) : `getByRole('button', { name: 'Nouvelle poule' }).first()`
  → ATTENTION : quand la liste est vide, DEUX boutons "Nouvelle poule" existent (PageHeader + EmptyState action). Toujours utiliser `.first()`.
- Bouton événement : `getByRole('button', { name: 'Événement' })`
- Filters : getByRole('button') avec noms 'Troupeau', 'Toutes', 'Historique'

## Dialog création poule (ChickenDialog)

- Titre dialog création : "Ajouter une poule"
- Titre dialog édition : "Modifier la poule"
- Champs : `#chicken-name`, `#chicken-breed`, `#chicken-color`, `#chicken-hatched`, `#chicken-acquired`, `#chicken-status` (édition seulement), `#chicken-zone`, `#chicken-notes`
- Bouton submit création : "Créer"
- Bouton submit édition : "Enregistrer"
- Toast succès création : "Poule ajoutée"
- Toast succès édition : "Poule mise à jour"

## Bandeau de ponte (EggLogBanner)

- Bouton incrément : `getByRole('button', { name: 'Un œuf de plus' })`
- Bouton décrément : `getByRole('button', { name: 'Un œuf de moins' })`
- Compteur : texte `/^N\s*🥚/` (regex)
- Toast : "Ponte enregistrée" — peut se stacker (plusieurs toasts), utiliser `.first()`
- Sémantique : re-soumettre le même jour = UPSERT (pas de doublon), la valeur remplace

## ChickenCard

- Les cartes rendent le nom avec l'emoji : `🐔 ${chicken.name}` (CardTitle)
- `getByText(chickenName)` NE matche PAS la card car le texte inclut l'emoji préfixé
- Pour naviguer vers la fiche depuis la liste : créer la poule via API et utiliser `page.goto('/app/chickens/${id}')`

## Page détail (/app/chickens/:id)

- Heading h1 : `getByRole('heading', { level: 1 })` — texte = `🐔 ${chicken.name}`
  → Utiliser `.toContainText(chickenName)` (sous-chaîne, sans l'emoji)
- ATTENTION : la page embarque `EntityAssistant` qui ouvre une modale de consentement au premier usage
  → Pré-accepter dans `beforeEach` via `localStorage.setItem('agent.privacyAccepted.v2', 'true')`
  → Sinon la modale Radix bloque l'accès au heading (aria-hide)
- Bouton édition : `getByRole('button', { name: 'Modifier' })`
- Bouton nouvel événement : `getByRole('button', { name: 'Événement' })`
- Status badges : textes "Active", "En couvaison", "Malade", "Décédée", "Partie"

## Dialog événement (ChickenEventDialog)

- Titre création : "Nouvel événement"
- Titre édition : "Modifier l'événement"
- Champs : `#event-type`, `#event-date`, `#event-title`, `#event-chicken` (optionnel), `#event-notes`
- Type par défaut : "care" (Soin)
- Bouton submit création : "Créer"
- Bouton submit édition : "Enregistrer"
- Toast succès création : "Événement ajouté"
- Toast succès édition : "Événement mis à jour"

## EventTimeline

- Chaque événement est dans une Card, accéder via `page.getByText(eventTitle).locator('xpath=ancestor::*[4]')`
- CardActions (bouton ⋯) : `.locator('button').last()` sur la card ancêtre
- Suppression avec undo :
  - Toast : "Événement supprimé"
  - Bouton undo : `getByRole('button', { name: 'Annuler' }).first()` (peut coexister avec d'autres)
- Évènement "Décès" auto-créé par le backend quand status → deceased : vérifié via `getByText('Décès')` (label du type dans la timeline)

## Statuts poule

- API values : 'active', 'broody', 'sick', 'deceased', 'gone'
- FR labels : "Active", "En couvaison", "Malade", "Décédée", "Partie"
- Transition deceased/gone auto-crée un ChickenEvent de type death/departure

## Pattern beforeEach robuste

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/app/chickens');
  await expect(page).toHaveURL(/\/app\/chickens/);
  // Utiliser les vrais URLs API (pas /api/chickens/chickens/)
  await deleteAllChickens(page);  // DELETE /api/chickens/{id}/
  await deleteAllEggLogs(page);   // DELETE /api/chickens/egg-logs/{id}/
  // Pré-accepter le consentement agent pour les tests sur les pages de détail
  await page.evaluate(([key]) => localStorage.setItem(key, 'true'), ['agent.privacyAccepted.v2']);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Poulailler' })).toBeVisible();
});
```

## Piège strict-mode

- "Ponte enregistrée" : peut apparaître 2x si deux + clics rapides stacks les toasts → `.first()`
- "Nouvelle poule" : apparaît 2x quand la liste est vide (PageHeader + EmptyState) → `.first()`
