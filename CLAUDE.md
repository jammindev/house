# Règles du projet house

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
