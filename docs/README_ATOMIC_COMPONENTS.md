# README — Guide composants atomiques (ajout progressif)

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

### Étape A — Créer le composant React UI
1. Créer le composant dans `ui/src/components/ui/<Nom>.tsx`.
2. Conserver une API simple (props minimales utiles).
3. Préserver les classes utilitaires existantes et l’accessibilité (`label`, `aria-*`, `disabled`, `focus`).

### Étape B — Exposer en Web Component
1. Créer `ui/src/web-components/<Nom>.tsx`.
2. Utiliser `createWebComponent()`.
3. Déclarer:
   - `tagName` (`ui-...`),
   - `propMapping` (`string`, `number`, `boolean`, `json`),
   - `events` si interactions (`ui-change`, `ui-click`, etc.).

### Étape C — Brancher la build
1. Ajouter l’entry dans `ui/vite.config.ts` (`rollupOptions.input`).

### Étape D — Démo Django
1. Ajouter un exemple dans `templates/app/components_demo.html`.
2. Ajouter l’asset `vite_asset` du Web Component dans `extra_js`.

### Étape E — Documentation
1. Mettre à jour `README_REACT_UI.md`:
	- tableau des composants actifs (statut),
	- journal d'implémentation,
	- prochaine étape.

### Étape F — Validation
1. Vérifier les erreurs TypeScript/lint éventuelles.
2. Exécuter le build frontend (`npm run build`).
3. Contrôler visuellement la page `/app/components/`.

---

## 3) Checklist rapide (copier/coller)

- [ ] Le composant est bien atomique (catégorie A)
- [ ] Fichier UI créé dans `ui/src/components/ui/`
- [ ] Web Component créé dans `ui/src/web-components/`
- [ ] Entry ajoutée dans `ui/vite.config.ts`
- [ ] Démo ajoutée dans `templates/app/components_demo.html`
- [ ] `README_REACT_UI.md` mis à jour (table + journal)
- [ ] Build frontend OK

---

## 4) Composants déjà existants (actifs)

### UI React (`ui/src/components/ui/`)
- `button.tsx`
- `input.tsx`
- `badge.tsx`
- `card.tsx`
- `textarea.tsx`
- `select.tsx`
- `alert.tsx`
- `skeleton.tsx`

### Web Components (`ui/src/web-components/`)
- `Button.tsx` → `ui-button`
- `Input.tsx` → `ui-input`
- `Badge.tsx` → `ui-badge`
- `Card.tsx` → `ui-card`
- `Textarea.tsx` → `ui-textarea`
- `Select.tsx` → `ui-select`
- `Alert.tsx` → `ui-alert`
- `Skeleton.tsx` → `ui-skeleton`

### Features complexes déjà migrées (montage direct, sans Web Component)
- `InteractionList`
   - template: `templates/app/interactions.html`
   - entry: `ui/src/pages/interactions.tsx`
   - fetch initial serveur: `apps/interactions/views_web.py`
- `InteractionCreateForm`
   - template: `templates/app/interaction_new.html`
   - entry: `ui/src/pages/interaction-new.tsx`
   - fetch initial serveur: `apps/interactions/views_web.py`

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
   - UI React: `ui/src/components/ui/<name>.tsx`
   - Web Component: `ui/src/web-components/<Name>.tsx`
  - tag HTML: `ui-<name>`
- Accessibilité obligatoire (`label`, `focus-visible`, `disabled`, rôles ARIA quand nécessaire).
- Pas de refactor large non demandé.
- Lots petits (1–2 composants max).
- Important: cette règle s’applique aux **composants atomiques**.
   Les composants **features complexes** (ex: formulaires métier) doivent être montés directement dans un `div` depuis `ui/src/pages/*`, avec données initiales fetch côté serveur, sans Web Component.

---

## 7) Système de notifications toast (Radix UI)

### Présentation

Un système de toast global est disponible pour toutes les mini-SPA React.
Il remplace les `<Alert>` inline et les états `*Msg` locaux dans les composants.

- Store : `ui/src/lib/toast.ts` (Zustand)
- Composant : `ui/src/design-system/toast.tsx` (Radix UI `@radix-ui/react-toast`)
- Variants : `default` | `destructive` | `success`
- Auto-dismiss : 4 secondes (configurable via `duration`)

### Usage dans un composant React

```tsx
import { useToast } from '@/lib/toast';

function MyComponent() {
  const { toast } = useToast();

  async function handleAction() {
    try {
      await doSomething();
      toast({ description: 'Succès !', variant: 'success' });
    } catch {
      toast({ description: 'Échec.', variant: 'destructive' });
    }
  }
}
```

Avec titre :

```tsx
toast({ title: 'Profil mis à jour', description: 'Vos modifications ont été sauvegardées.', variant: 'success' });
```

### Usage hors composant (catch utilitaire, fichier API…)

```ts
import { toast } from '@/lib/toast';

toast({ description: 'Erreur réseau.', variant: 'destructive' });
```

### Brancher le Toaster dans une nouvelle mini-SPA

**Cas standard** — app qui utilise `mountWithJsonScriptProps` :

```tsx
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';
import MyApp from './MyApp';

onDomReady(() => {
  mountWithJsonScriptProps('my-root', 'my-props', MyApp, { withToaster: true });
});
```

**Cas custom** — app qui lit plusieurs scripts JSON ou a une logique de montage particulière, utiliser `renderRoot` :

```tsx
import { createElement } from 'react';
import { onDomReady, renderRoot } from '@/lib/mount';
import MyApp from './MyApp';

onDomReady(() => {
  const mountNode = document.getElementById('my-root');
  if (!mountNode) return;
  // ... lecture/merge de plusieurs scripts ...
  renderRoot(mountNode, createElement(MyApp, props), { withToaster: true });
});
```

`withToaster` est `false` par défaut — ne rien passer si l'app n'a pas besoin de toasts.

**Important** : ne pas importer `<Toaster />` manuellement dans les `mount-*.tsx` — passer `{ withToaster: true }` suffit.

### Règle

Ne pas utiliser `<Alert>` inline pour des retours d'action utilisateur (save, delete, invite…).
Réserver `<Alert>` aux messages persistants liés à l'état de la page (ex: erreur de chargement initial).

---

## 8) Modèle d'entrée journal (rappel)

Date:
Lot:
Composants migrés:
Fichiers modifiés:
Décisions techniques:
Risques restants:
Prochaine étape:
