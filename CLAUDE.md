# Règles du projet house

## Workflow Git

- Trunk-based : `main` est la seule branche long-lived. Push sur `main` → auto-deploy prod.
- Pour les changements non-triviaux, créer une feature branch depuis `main`, ouvrir une PR vers `main`, merger.
- Pour les fix triviaux (typo, doc, micro-bug), commit direct sur `main` accepté.
- Nommage des branches : `<type>/<app>-<description-courte>` (ex: `fix/general-theme-logout`, `feat/tasks-delete`).
- Pas de branche `develop` ni d'environnement staging — tester localement (settings.production possible) avant de pusher.

## Commandes utiles

### Backend Django

Toujours activer le venv avant toute commande Python/Django :

```bash
source venv/bin/activate
```

Installation des dépendances (3 niveaux) :

```bash
pip install -r requirements/base.txt   # prod uniquement
pip install -r requirements/test.txt   # base + pytest/coverage/factories
pip install -r requirements/dev.txt    # test + ipython et outils dev
```

```bash
python manage.py runserver          # démarre sur 127.0.0.1:8001
python manage.py migrate
python manage.py makemigrations
python manage.py shell
```

### Frontend React

```bash
npm run dev          # serveur Vite (dev, HMR)
npm run dev:watch    # rebuild continu des assets (mode prod watch)
npm run build        # build production
npm run lint         # ESLint sur ui/src
```

### Tests

Venv requis pour pytest (voir ci-dessus).

```bash
pytest                          # tous les tests Python (coverage inclus)
pytest apps/<app>/              # tests d'une app spécifique
pytest -k "nom_du_test"         # filtre par nom
pytest -m "not slow"            # exclure les tests lents
```

Tests E2E Playwright (serveur Django requis sur :8001) :

```bash
npm run test:e2e                # headless
npm run test:e2e:headed         # navigateur visible
npm run test:e2e:ui             # interface interactive
```

### Génération de types API

```bash
npm run gen:api:refresh   # régénère ui/src/gen/api depuis le schéma OpenAPI (serveur doit tourner sur :8001)
```

## Traductions (i18next)

Ne jamais utiliser de `defaultValue` dans les appels `t()` :

```ts
// ❌ Interdit
t('tasks.title', 'Tasks')

// ✅ Correct
t('tasks.title')
```

**Pourquoi :** les `defaultValue` masquent les traductions manquantes. Sans eux, une clé absente du fichier JSON affiche la clé brute, ce qui permet de repérer immédiatement ce qui n'est pas traduit.

## Auto-création d'`Interaction` — pattern write-time + service helper

Quand une action utilisateur auto-crée une `Interaction` (ex: achat de stock ou d'équipement → interaction `expense`), le titre est rendu **dans la langue de l'utilisateur au moment de la création**, puis stocké en clair dans `subject`. Pas de localisation à l'affichage — admin, RAG, citation, CSV, `__str__`, edit user : tout consomme `interaction.subject` brut.

### Liaison polymorphe

`Interaction` est lié à son objet source via une FK polymorphe `(source_content_type, source_object_id)` + un `GenericForeignKey('source')`. Cela permet à n'importe quel modèle (`StockItem`, `Equipment`, `Project`, etc.) d'être source d'une interaction sans toucher au schéma.

### Service helper `create_expense_interaction`

Pour le cas standard « achat sur un objet », utiliser le service partagé :

```python
from interactions.services import create_expense_interaction

interaction = create_expense_interaction(
    source=stock_item_or_equipment,        # n'importe quel HouseholdScopedModel
    user=request.user,
    amount=Decimal("199.00"),
    supplier="Wood Co.",
    occurred_at=timezone.now(),
    notes="...",
    kind="stock_purchase",                 # optionnel, défaut = "<app_label>_purchase"
    extra_metadata={"delta": "3.8", "unit": "stère"},  # contexte feature-spécifique
)
```

Le service :
- localise le subject via `gettext_lazy` + le template enregistré dans `apps/interactions/services.py::AUTO_SUBJECT_TEMPLATES`
- ajoute `metadata.kind` (discriminateur), `metadata.source_name`, `metadata.amount`, `metadata.unit_price`, `metadata.supplier`
- lie via la FK polymorphe
- attache la zone du source si elle existe

Les **side-effects** spécifiques au modèle source (ajuster une quantité, snapshot prix sur l'objet, etc.) restent dans la view appelante — le service ne touche pas à l'objet source.

### Service helper `create_manual_expense_interaction` (dépense ad-hoc)

Pour les dépenses **sans objet source** (resto, cinéma, cadeau…) — saisies depuis `/app/expenses/` :

```python
from interactions.services import create_manual_expense_interaction

interaction = create_manual_expense_interaction(
    household=request.household,
    user=request.user,
    subject="Restaurant Le Bistrot",   # saisi par l'user, pas templaté
    amount=Decimal("32.00"),
    supplier="Le Bistrot",
    occurred_at=timezone.now(),
    notes="...",
    zone_ids=[zone_id],                # optionnel
)
```

Différences vs `create_expense_interaction` :
- `subject` est **saisi par l'user**, pas templaté via gettext (le texte est stocké tel-quel)
- `metadata.kind = "manual"`, `metadata.source_name = None`
- Pas de FK polymorphe (`source_content_type=None`, `source_object_id=None`)
- `household` doit être passé explicitement (pas dérivé d'un source)

### Builder partagé `_build_expense_metadata`

Les deux fonctions (`create_expense_interaction` + `create_manual_expense_interaction`) flow through un helper interne `_build_expense_metadata` qui garantit le shape `metadata` uniforme : `{kind, source_name, amount, unit_price, supplier}` + extra optionnel. Ajouter une clé standard (ex: `currency`) = touche un seul endroit.

### Ajouter un nouveau template d'auto-subject

1. Ajouter l'entrée dans `AUTO_SUBJECT_TEMPLATES` (`apps/interactions/services.py`)
2. `python manage.py makemessages -l fr -l de -l es`
3. Éditer les 3 `.po` (`locale/fr|de|es/LC_MESSAGES/django.po`) pour ajouter la traduction
4. `python manage.py compilemessages`

### Frontend — formulaire partagé

Pour la partie UI, `ui/src/features/interactions/PurchaseForm.tsx` est le composant partagé (champs prix/fournisseur/date/notes + delta optionnel). Chaque feature wrappe ce form dans son propre dialog (`StockPurchaseDialog`, `EquipmentPurchaseDialog`, etc.) qui gère :
- son contexte (item courant, mutation appelée)
- le titre du dialog
- les éventuels affichages spécifiques (quantité courante pour stock)

Les clés i18n `purchase.*` (génériques au form) sont **shared** ; les clés `stock.purchase.*` / `equipment.purchase.*` sont **feature-spécifiques** (titre, message créé, libellé du bouton sur la card).

### Pourquoi ce pattern

- 1 user = 1 langue (pas de multi-langue par user dans le projet)
- Le subject reste lisible dans la DB pour l'admin Django, l'agent RAG (search vector), les exports CSV
- L'user édite son subject via `InteractionEditPage` → son texte écrase l'auto, sans logique de flag/snapshot
- FK polymorphe → toute feature peut auto-créer une interaction liée à n'importe quel objet, sans migration de schéma à chaque fois

**Limite acceptée** : si l'user change sa langue plus tard, ses anciennes interactions auto-créées restent dans l'ancienne langue. Acceptable car rare.

## Composants UI

### Cartes (`Card`)

Toujours utiliser le composant `Card` du design-system pour les éléments de type carte, jamais un `<div>` avec des classes manuelles :

```tsx
// ❌ Interdit
<div className="rounded-lg border bg-white p-3 shadow-sm">...</div>

// ✅ Correct
import { Card } from '@/design-system/card';
<Card className="p-3">...</Card>
```

### Titre de carte (`CardTitle`)

Toujours utiliser `CardTitle` pour le titre principal d'une card. Supporte une prop `emoji` optionnelle qui reste immune aux styles hover/underline du parent (ex: quand le titre est dans un `<Link>`) :

```tsx
import { Card, CardTitle } from '@/design-system/card';

// Statique
<CardTitle>Mon équipement</CardTitle>

// Avec emoji — détecté automatiquement depuis le texte
<CardTitle>🔧 Mon équipement</CardTitle>

// Interactif — l'emoji ne bouge pas au hover
// NE PAS mettre hover:underline sur le Link (underline tous les spans y compris emoji)
// Utiliser group + [&>span:last-child]:group-hover:underline pour cibler uniquement le texte
<Link to="/app/equipment/123" className="group text-foreground hover:text-primary">
  <CardTitle className="text-inherit [&>span:last-child]:group-hover:underline">🔧 Mon équipement</CardTitle>
</Link>
```

### Actions en bout de carte (`CardActions`)

Pour les actions contextuelle (éditer, supprimer…) en bout de carte, utiliser le composant générique `CardActions` qui expose un dropdown `MoreHorizontal` :

```tsx
import CardActions, { type CardAction } from '@/components/CardActions';

const actions: CardAction[] = [
  { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(item) },
  { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(item.id), variant: 'danger' },
];

<CardActions actions={actions} />
```

### Couleurs — pas de hardcode

Toujours utiliser les tokens CSS du design-system, jamais des classes Tailwind à couleur fixe :

```tsx
// ❌ Interdit
<div className="bg-white border-slate-200 text-slate-900">
<span className="bg-blue-100 text-blue-700">
<div className="bg-slate-100 animate-pulse">  // skeleton

// ✅ Correct
<div className="bg-card border-border text-foreground">
<span className="bg-primary/10 text-primary">
<div className="bg-muted animate-pulse">  // skeleton
```

Tokens disponibles : `bg-card`, `bg-background`, `bg-muted`, `bg-primary/10`, `bg-destructive/10`, `text-foreground`, `text-muted-foreground`, `text-primary`, `text-destructive`, `border-border`, `border-destructive/30`.

---

## Pattern standard — Feature page

Toutes les nouvelles features doivent suivre ce pattern, établi sur Tasks et Electricity.

### Structure de fichiers

```
ui/src/features/<feature>/
  <Feature>Page.tsx     # page principale
  <Feature>Card.tsx     # card item (ou inline si simple)
  <Feature>Dialog.tsx   # dialog create/edit (ou un par entité)
  hooks.ts              # query keys + hooks fetch/mutation
```

### 1. Data layer (`hooks.ts`)

```ts
// Factory de query keys
export const featureKeys = {
  all: ['feature'] as const,
  list: () => [...featureKeys.all, 'list'] as const,
  detail: (id: string) => [...featureKeys.all, id] as const,
};

// Mutations avec toast + invalidation
export function useCreateItem() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: ItemPayload) => createItem(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: featureKeys.list() });
      toast({ description: t('feature.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
```

### 2. Suppression — toujours avec undo

```tsx
const { deleteWithUndo } = useDeleteWithUndo({
  label: t('feature.deleted'),
  onDelete: (id) => deleteMutation.mutateAsync(id),
});
```

### 3. Page principale

```tsx
// Filtres persistés
const [activeFilter, setActiveFilter] = useSessionState<FilterKey>('feature.filter', 'all');

// Skeleton
const showSkeleton = useDelayedLoading(isLoading);
if (showSkeleton) return (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
  </div>
);

// Layout
<PageHeader title={t('feature.title')}>
  <Button onClick={() => setDialogOpen(true)}>{t('feature.new')}</Button>
</PageHeader>

<div className="flex flex-wrap gap-1.5 pb-4">
  {FILTERS.map((f) => <FilterPill key={f.key} ... />)}
</div>

{isEmpty ? <EmptyState ... /> : <div className="space-y-2">{items.map(...)}</div>}
```

### 4. Cards

```tsx
// Layout standard
<Card className="p-3">
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0 flex-1">
      {/* contenu principal */}
    </div>
    <CardActions actions={actions} />
  </div>
</Card>
```

### 5. Dialogs (create/edit)

```tsx
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: Item;  // undefined = create, défini = edit
}

export default function FeatureDialog({ open, onOpenChange, existing }: Props) {
  const isEditing = Boolean(existing);

  // Reset/init à l'ouverture
  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
    } else {
      setName('');
    }
  }, [open, existing]);
}
```
