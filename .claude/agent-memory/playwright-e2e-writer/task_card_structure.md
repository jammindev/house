---
name: task-card-structure
description: Structure DOM de TaskCard et helpers pour scoper les interactions Playwright
type: feedback
---

Le composant TaskCard rend : Card > div.flex > div.flex-1 > div.flex > button(subject)
Le sujet est un `<button>` quand `onViewDetail` est fourni (cas TasksPage), sinon un `<span>`.

**Helpers disponibles dans e2e/fixtures.ts :**

```typescript
// Scoper une carte à partir du sujet (remonte 4 niveaux depuis le texte)
import { getTaskCard } from './fixtures';
const card = getTaskCard(page, 'Mon sujet');

// Ouvrir le menu CardActions (··· bouton, toujours le dernier button dans la carte)
import { openTaskMenu } from './fixtures';
await openTaskMenu(page, 'Mon sujet');
```

**Boutons dans une carte (de haut en bas) :**
1. `button` avec le sujet (si onViewDetail) → ouvre le détail
2. `button` status badge → `card.getByRole('button', { name: 'À faire' })`
3. `button` assignee badge
4. `button` attachments (si canEdit seulement)
5. `button` CardActions trigger (dernier) → `card.locator('button').last()`

**fixture createTask :** crée une tâche avec le sujet donné, statut "À faire" par défaut.
```typescript
await createTask('Mon sujet unique');
```
