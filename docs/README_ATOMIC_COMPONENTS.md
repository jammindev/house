# README — Guide composants atomiques (ajout progressif)

> **⚠️ Document partiellement obsolète** — Les sections décrivant `mountWithJsonScriptProps`, `onDomReady` et `renderRoot` de `@/lib/mount` correspondent à l'ancienne architecture hybride Django templates + React islands. Ce fichier (`mount.tsx`) a été supprimé. L'app est désormais une SPA complète (React Router). Seules les sections sur les composants atomiques (`design-system/`) restent d'actualité.

Ce guide explique comment ajouter des composants atomiques **au fil de l'eau** dans l'architecture Django hybride.

Objectif:
- garder des lots petits et sûrs,
- éviter les régressions,
- conserver la compatibilité Django templates + React ciblé.

---

## 1) Définition d'un composant atomique

Un composant atomique est un composant UI réutilisable, autonome, sans logique métier complexe:
- pas d'appel API,
- pas de dépendance auth,
- pas de couplage routeur/app métier,
- focus accessibilité + style + ergonomie.

Exemples: `Button`, `Input`, `Badge`, `Card`, `Textarea`, `Select`, `Alert`, `Skeleton`, `Dialog`, `DropdownMenu`, `SheetDialog`, `Toast`.

---

## 2) Architecture des composants

### Composants atomiques (`ui/src/design-system/`)

Les composants atomiques sont dans `ui/src/design-system/` et sont importés directement par les composants métier React. Ils ne sont **pas** exposés en tant que Web Components.

### Composants métier (`apps/<app>/react/`)

Les composants contenant la logique métier restent dans `apps/<app>/react/`, à proximité des modèles Django et serializers correspondants:
- `apps/interactions/react/`: `InteractionList.tsx`, `InteractionCreateForm.tsx`
- `apps/electricity/react/`: `ElectricityBoardNode.tsx`
- `apps/projects/react/`: `ProjectList.tsx`, `ProjectDetail.tsx`, `ProjectForm.tsx`
- `apps/directory/react/`: `DirectoryPage.tsx`, `ContactCreateForm.tsx`, `ContactDetailsView.tsx`
- `apps/zones/react/`: `ZonesNode.tsx`, `ZoneDetailNode.tsx`
- `apps/tasks/react/`: `TasksPage.tsx`
- etc.

### Points d'entrée de montage (`ui/src/pages/<app>/`)

Les fichiers de montage qui hydratent les composants sont organisés par app dans `ui/src/pages/`:

```
ui/src/pages/
  interactions/
    list.tsx          # monte InteractionList
    new.tsx           # monte InteractionCreateForm
  projects/
    list.tsx, detail.tsx, new.tsx, edit.tsx
    groups.tsx, group-detail.tsx
  equipment/
    list.tsx, detail.tsx, new.tsx, edit.tsx
    stock-list.tsx, stock-detail.tsx, stock-new.tsx, stock-edit.tsx
  contacts/
    list.tsx, new.tsx, detail.tsx, edit.tsx
  structures/
    new.tsx, detail.tsx, edit.tsx
  zones/
    list.tsx, detail.tsx
  electricity/
    board.tsx
  tasks/
    list.tsx
  photos/
    list.tsx
  documents/
    list.tsx
  settings/
    index.tsx
```

Chaque fichier de montage:
1. Importe le composant depuis `apps/<app>/react/`
2. Utilise `mountWithJsonScriptProps` et `onDomReady` de `@/lib/mount`
3. Cible un root DOM spécifique (ex: `'projects-list-root'`)
4. Les props initiales sont hydratées côté Django via `ReactPageView.get_props()` — **zéro fetch API au premier rendu**

---

## 3) Workflow standard (à répéter pour chaque composant)

### Étape A — Créer le composant React UI
1. Créer le composant dans `ui/src/design-system/<nom>.tsx`.
2. Conserver une API simple (props minimales utiles).
3. Préserver les classes utilitaires existantes et l'accessibilité (`label`, `aria-*`, `disabled`, `focus`).
4. Utiliser TypeScript strictement typé.

### Étape B — Brancher la build (si entry dédiée nécessaire)
1. Ajouter l'entry dans `ui/vite.config.ts` (`rollupOptions.input`) si le composant est utilisé comme point d'entrée standalone.
2. Pour les composants atomiques simples, ce n'est généralement pas nécessaire — ils sont importés directement.

### Étape C — Documentation
1. Mettre à jour `README_REACT_UI.md`:
	- tableau des composants actifs (statut),
	- journal d'implémentation,
	- prochaine étape.

### Étape D — Validation
1. Vérifier les erreurs TypeScript/lint éventuelles: `npm run build`.
2. Tester l'intégration dans un composant métier existant.

---

## 4) Checklist rapide (copier/coller)

- [ ] Le composant est bien atomique (pas de logique métier)
- [ ] Fichier créé dans `ui/src/design-system/`
- [ ] TypeScript strictement typé
- [ ] Accessibilité respectée (ARIA, focus, keyboard)
- [ ] `README_REACT_UI.md` mis à jour (table + journal)
- [ ] Build frontend OK (`npm run build`)
- [ ] Testé dans un composant métier

---

## 5) Composants déjà existants (actifs)

### Design System (`ui/src/design-system/`)
- `alert.tsx` — messages d'alerte (variants: default, destructive)
- `badge.tsx` — badges (variants: default, secondary, destructive, outline)
- `button.tsx` — boutons (variants: default, destructive, outline, secondary, ghost, link)
- `card.tsx` — cartes (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- `dialog.tsx` — modales (Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter)
- `dropdown-menu.tsx` — menus déroulants (DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, etc.)
- `input.tsx` — champs de texte
- `select.tsx` — sélecteurs (Select, SelectTrigger, SelectContent, SelectItem, SelectValue)
- `sheet-dialog.tsx` — panneaux latéraux (Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription)
- `skeleton.tsx` — placeholders de chargement
- `textarea.tsx` — champs de texte multi-lignes
- `toast.tsx` — notifications toast (Toaster, système Radix UI)

### Composants métier déjà migrés (exemples)
- `InteractionList` (`apps/interactions/react/`)
   - template: `templates/app/interactions.html`
   - entry: `ui/src/pages/interactions/list.tsx`
   - vue Django: `apps/interactions/views_web.py`
- `InteractionCreateForm` (`apps/interactions/react/`)
   - template: `templates/app/interaction_new.html`
   - entry: `ui/src/pages/interactions/new.tsx`
   - vue Django: `apps/interactions/views_web.py`
- `ElectricityBoardNode` (`apps/electricity/react/`)
   - entry: `ui/src/pages/electricity/board.tsx`
- `ProjectList`, `ProjectDetail`, `ProjectForm` (`apps/projects/react/`)
- `ZonesNode`, `ZoneDetailNode` (`apps/zones/react/`)
- `ContactCreateForm`, `ContactDetailsView` (`apps/directory/react/`)
- etc.

---

## 6) Suggestions de prochains composants

### Priorité haute (quick wins)
1. `label.tsx`
   - très simple, utile partout dans les formulaires, complète les champs input/textarea/select.
2. `separator.tsx`
   - séparateur horizontal/vertical simple (div stylée).
3. `spinner.tsx`
   - indicateur de chargement simple (SVG animé).
4. `progress.tsx`
   - barre de progression (version simple CSS).

### Priorité moyenne (avec adaptation)
5. `slider.tsx`
   - slider via input range stylé.
6. `table.tsx`
   - table avec composants atomiques (Table, TableHeader, TableBody, TableRow, TableCell).
7. `tabs.tsx`
   - onglets (Tabs, TabsList, TabsTrigger, TabsContent).
8. `checkbox.tsx`
   - case à cocher stylée.
9. `radio-group.tsx`
   - groupe de boutons radio.
10. `switch.tsx`
    - interrupteur on/off.

### Priorité basse / à cadrer (complexité supérieure)
11. `popover.tsx`, `tooltip.tsx`
    - interactions avancées + positionnement.
12. `calendar.tsx`, `date-picker.tsx`
    - sélection de date.
13. `command.tsx`
    - palette de commandes (recherche rapide).
14. `context-menu.tsx`
    - menu contextuel (clic droit).

---

## 7) Règles de qualité minimales

- API simple et stable (`props` explicites).
- Nommage cohérent: `ui/src/design-system/<name>.tsx`
- Accessibilité obligatoire (`label`, `focus-visible`, `disabled`, rôles ARIA quand nécessaire).
- Pas de refactor large non demandé.
- Lots petits (1–2 composants max).
- Important: cette règle s'applique aux **composants atomiques**.
   Les composants **features complexes** (ex: formulaires métier) doivent être montés directement dans un `div` depuis `ui/src/pages/<app>/`, avec données initiales fetch côté serveur.

---

## 8) Système de notifications toast (Radix UI)

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

**Important** : ne pas importer `<Toaster />` manuellement dans les fichiers de montage — passer `{ withToaster: true }` suffit.

### Règle

Ne pas utiliser `<Alert>` inline pour des retours d'action utilisateur (save, delete, invite…).
Réserver `<Alert>` aux messages persistants liés à l'état de la page (ex: erreur de chargement initial).

---

## 9) Modèle d'entrée journal (rappel)

Date:
Lot:
Composants migrés:
Fichiers modifiés:
Décisions techniques:
Risques restants:
Prochaine étape:
