# README — Guide composants atomiques (migration progressive)

Ce guide explique comment ajouter des composants atomiques **au fil de l’eau** dans l’architecture Django hybride.

Objectif:
- garder des lots petits et sûrs,
- éviter les régressions,
- conserver la compatibilité Django templates + React ciblé.

---

## 1) Définition d’un composant atomique

Un composant atomique est un composant UI réutilisable, autonome, sans logique métier complexe:
- pas d’appel API,
- pas de dépendance auth,
- pas de couplage routeur/app métier,
- focus accessibilité + style + ergonomie.

Exemples: `Button`, `Input`, `Badge`, `Card`, `Textarea`, `Select`, `Alert`, `Skeleton`.

---

## 2) Workflow standard (à répéter pour chaque composant)

### Étape A — Vérifier le candidat
1. Prendre le composant source dans `legacy/nextjs/src/components/ui/`.
2. Vérifier qu’il est bien catégorie A.
3. Identifier les dépendances bloquantes (`next/*`, `useRouter`, Supabase, Radix trop couplé, etc.).

### Étape B — Porter le composant React UI
1. Créer le composant dans `frontend/src/components/ui/<Nom>.tsx`.
2. Conserver une API simple (props minimales utiles).
3. Préserver les classes utilitaires existantes et l’accessibilité (`label`, `aria-*`, `disabled`, `focus`).

### Étape C — Exposer en Web Component
1. Créer `frontend/src/web-components/<Nom>.tsx`.
2. Utiliser `createWebComponent()`.
3. Déclarer:
   - `tagName` (`ui-...`),
   - `propMapping` (`string`, `number`, `boolean`, `json`),
   - `events` si interactions (`ui-change`, `ui-click`, etc.).

### Étape D — Brancher la build
1. Ajouter l’entry dans `frontend/vite.config.ts` (`rollupOptions.input`).

### Étape E — Démo Django
1. Ajouter un exemple dans `templates/app/components_demo.html`.
2. Ajouter l’asset `vite_asset` du Web Component dans `extra_js`.

### Étape F — Documentation migration
1. Mettre à jour `README_MIGRATION_REACT.md`:
   - tableau de tri (statut),
   - journal d’implémentation,
   - risques restants,
   - prochaine étape.

### Étape G — Validation
1. Vérifier les erreurs TypeScript/lint éventuelles.
2. Exécuter le build frontend (`npm run build`).
3. Contrôler visuellement la page `/app/components/`.

---

## 3) Checklist rapide (copier/coller)

- [ ] Le composant est bien atomique (catégorie A)
- [ ] Aucune dépendance runtime Next/Supabase
- [ ] Fichier UI créé dans `frontend/src/components/ui/`
- [ ] Web Component créé dans `frontend/src/web-components/`
- [ ] Entry ajoutée dans `frontend/vite.config.ts`
- [ ] Démo ajoutée dans `templates/app/components_demo.html`
- [ ] `README_MIGRATION_REACT.md` mis à jour (table + journal)
- [ ] Build frontend OK

---

## 4) Composants déjà existants (actifs)

### UI React (`frontend/src/components/ui/`)
- `button.tsx`
- `input.tsx`
- `badge.tsx`
- `card.tsx`
- `textarea.tsx`
- `select.tsx`
- `alert.tsx`
- `skeleton.tsx`

### Web Components (`frontend/src/web-components/`)
- `Button.tsx` → `ui-button`
- `Input.tsx` → `ui-input`
- `Badge.tsx` → `ui-badge`
- `Card.tsx` → `ui-card`
- `Textarea.tsx` → `ui-textarea`
- `Select.tsx` → `ui-select`
- `Alert.tsx` → `ui-alert`
- `Skeleton.tsx` → `ui-skeleton`

---

## 5) Suggestions de prochains composants

## Priorité haute (quick wins A)
1. `label.tsx`
   - très simple, utile partout dans les formulaires.
2. `separator.tsx`
   - version sans Radix (div + orientation via className).
3. `spinner.tsx`
   - utile pour états loading dans templates Django.
4. `progress.tsx`
   - version simple (barre CSS) pour éviter dépendances lourdes.

## Priorité moyenne (A avec adaptation)
5. `slider.tsx`
   - possible via input range stylé.
6. `table.tsx`
   - atomique utile, mais vérifier API minimale.

## Priorité basse / à cadrer (A complexe)
7. `dialog.tsx`, `alert-dialog.tsx`, `sheet-dialog.tsx`
   - gestion focus trap/portal/accessibilité plus délicate.
8. `popover.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`
   - interactions avancées + positionnement.
9. `calendar.tsx`, `date-picker.tsx`
   - surface fonctionnelle plus large.

---

## 6) Règles de qualité minimales

- API simple et stable (`props` explicites).
- Nommage cohérent:
  - UI React: `frontend/src/components/ui/<name>.tsx`
  - Web Component: `frontend/src/web-components/<Name>.tsx`
  - tag HTML: `ui-<name>`
- Accessibilité obligatoire (`label`, `focus-visible`, `disabled`, rôles ARIA quand nécessaire).
- Pas de refactor large non demandé.
- Lots petits (1–2 composants max).

---

## 7) Modèle d’entrée journal (rappel)

Date:
Lot:
Composants migrés:
Fichiers modifiés:
Décisions techniques:
Risques restants:
Prochaine étape:
