---
name: select-native-options
description: Comment interagir avec les <option> d'un <select> natif dans les tests Playwright
type: feedback
---

Les `<option>` dans un `<select>` natif sont considérées "hidden" par Playwright. `waitFor()` sans état échoue.

**Why:** Playwright considère les `<option>` comme non visibles (elles ne sont visibles qu'à l'ouverture du select). Le composant `Select` du design system de 'house' est un `<select>` natif avec des `<option>` générées dynamiquement.

**How to apply:**
```typescript
// Attendre que les options chargent (async API)
const zoneSelect = page.locator('#task-zone');
const firstOption = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
await firstOption.waitFor({ state: 'attached', timeout: 10000 }); // ← 'attached', pas 'visible'
const value = await firstOption.getAttribute('value');
await zoneSelect.selectOption(value!);
```

Les selects dans 'house' ont des IDs prévisibles : `#task-zone`, `#task-priority`, `#task-status`, `#task-assigned`, `#task-project`.
