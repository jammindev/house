---
name: form-error-state
description: Comment vérifier qu'un formulaire a échoué sans dépendre du texte d'erreur
type: feedback
---

Vérifier l'échec d'un formulaire en attendant que le bouton redevienne `enabled`, pas en cherchant le texte d'erreur.

**Why:** Le texte d'erreur dans 'house' utilise des classes Tailwind dynamiques (`text-red-600`) qui peuvent être difficiles à cibler. Le bouton submit est désactivé pendant le loading — quand il redevient actif, l'appel API est terminé (succès ou échec).

**How to apply:**
```typescript
await page.getByRole('button', { name: 'Se connecter' }).click();

// ✅ Attendre la fin du loading
await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled({ timeout: 10000 });
await expect(page).toHaveURL(/\/login/); // toujours sur login = échec confirmé

// ❌ Fragile
await expect(page.getByText('Email ou mot de passe incorrect')).toBeVisible();
await expect(page.locator('p.text-red-600')).toBeVisible();
```
