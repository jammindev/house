---
name: dropdown-radix-roles
description: Rôles ARIA des composants Radix UI utilisés dans 'house'
type: feedback
---

Les composants Radix UI ont des rôles ARIA spécifiques, différents de `role="option"`.

**How to apply:**
- `DropdownMenuItem` → `role="menuitem"` → `getByRole('menuitem', { name: '...' })`
- `DropdownMenuRadioItem` → `role="menuitemradio"` → `getByRole('menuitemradio', { name: '...' })`
- `DropdownMenuCheckboxItem` → `role="menuitemcheckbox"`

Dans 'house' :
- Menu CardActions (Modifier, Supprimer) → `getByRole('menuitem', { name: 'Modifier' })`
- Badge statut (DropdownSelect avec RadioItems) → `getByRole('menuitemradio', { name: 'En cours' })`
