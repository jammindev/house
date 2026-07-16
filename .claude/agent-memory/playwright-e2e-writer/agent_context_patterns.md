---
name: agent_context_patterns
description: Patterns for testing ContextPanel + AddContextDialog inside EntityAssistant
type: ui-pattern
---

# Agent Context Panel Patterns

## Route & Tab Navigation

- `EntityAssistant` est embarqué dans l'onglet "Assistant" de la page détail d'une entité (projet, zone, équipement…).
- Les onglets du `TabShell` sont des `FilterPill` qui se rendent comme `<button>` — chercher avec `getByRole('button', { name: 'Assistant' })`.
- Scope obligatoire à `page.getByRole('main')` pour éviter les collisions avec la sidebar.
- Route : `/app/projects/<id>` puis cliquer sur le bouton "Assistant".

## Agent Privacy

- Toujours pré-accepter via `addInitScript` avant toute navigation sur une page avec EntityAssistant :
  ```ts
  await page.addInitScript(([key]) => { localStorage.setItem(key, 'true'); }, ['agent.privacyAccepted.v2']);
  ```
- Si oublié, la modale de confidentialité bloque tout l'UI (h1, input, etc.).

## API Endpoints (projets)

- Le router DRF projets est monté sous `/api/projects/` avec un sous-routeur :
  - **Liste** : `GET /api/projects/projects/?limit=100`
  - **Création** : `POST /api/projects/projects/`
  - **Suppression** : `DELETE /api/projects/projects/<id>/`
- Ne pas utiliser `/api/projects/` seul — c'est la racine du router (200 bytes vide).

## Sélecteurs ContextPanel

- `data-testid="agent-context-toggle"` — le bouton collapsible; `aria-expanded="true/false"`.
- `data-testid="agent-context-chip"` — un chip; `data-origin` est un **attribut de l'élément lui-même** (pas un enfant).
  - Sélecteur CSS correct : `page.locator('[data-testid="agent-context-chip"][data-origin="anchor"]')`
  - FAUX : `.filter({ has: page.locator('[data-origin="anchor"]') })` — ne fonctionne pas quand l'attribut est sur le root de l'élément filtré.
- `data-testid="agent-context-add"` — bouton "Ajouter du contexte" (visible seulement si expanded).
- `data-testid="agent-context-remove"` — bouton X sur un chip pinned (enfant du chip).
- `data-testid="agent-context-search"` — input dans AddContextDialog.
- `data-testid="agent-context-result"` — bouton résultat dans AddContextDialog.

## AddContextDialog

- C'est un `SheetDialog` → `getByRole('dialog')` fonctionne.
- La recherche est déclenchée après ≥2 chars + debounce 250ms → toujours attendre le résultat avec `toBeVisible({ timeout: 5000 })`.
- Fermer via clic résultat ou `keyboard.press('Escape')`.

## Toasts — Strict-Mode

Les toasts "ajouté/retiré au contexte" apparaissent en double : un `div.text-sm` (visible) ET un `span[role=status]` (aria-live). Utiliser `.first()` :
```ts
await expect(page.getByText('« X » ajouté au contexte').first()).toBeVisible();
await expect(page.getByText('« X » retiré du contexte').first()).toBeVisible();
```

## Seeding pour les tests de contexte

- Ancre : utiliser "Rénovation salle de bain" (seedé par `seed_demo_data`).
- Entité à pinner : créer un projet unique via API dans `beforeEach`, supprimer dans `afterEach`.
- Hydrater le JWT AVANT les appels API : naviguer vers `/app/projects` d'abord.
- `findAnchorProjectId` : parser `GET /api/projects/projects/?limit=100` et chercher par titre.

## Contexte injected_context

- Le `for_context/?entity_type=project&object_id=<id>` renvoie `injected_context` avec tous les chips.
- Un projet "Rénovation salle de bain" avec des tâches liées retourne ~9 items (anchor + related tasks).
- Les items `origin: "anchor"` et `origin: "related"` sont read-only (pas de bouton X).
- Les items `origin: "pinned"` ont un bouton `agent-context-remove`.
