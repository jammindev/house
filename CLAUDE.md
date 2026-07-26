# Règles du projet house

## Workflow Git

- Trunk-based : `main` est la seule branche long-lived. Push sur `main` → auto-deploy prod.
- Pour les changements non-triviaux, créer une feature branch depuis `main`, ouvrir une PR vers `main`, merger.
- Pour les fix triviaux (typo, doc, micro-bug), commit direct sur `main` accepté.
- Nommage des branches : `<type>/<app>-<description-courte>` (ex: `fix/general-theme-logout`, `feat/tasks-delete`).
- Pas de branche `develop` ni d'environnement staging — tester localement (settings.production possible) avant de pusher.

### Format des commits — contrat pour le changelog

Les messages de commit alimentent **automatiquement** la page « Nouveautés »
(`/app/admin/changelog`, réservée au staff — voir plus bas). Le sujet DOIT être un commit conventionnel :

```
<type>(<scope>): <description>
```

- **`type`** : `feat`, `fix`, `perf` apparaissent dans le changelog ; `refactor`,
  `chore`, `docs`, `test`, `ci`, `build`, `style` sont ignorés (internes).
- **`scope`** = le module concerné (`projects`, `tasks`, `agent`…) → devient le
  **filtre/chip** de l'entrée. **Toujours mettre un scope** ; sans lui l'entrée
  tombe dans `general`.
- **`description`** : peut rester technique — elle est **repolie par l'IA** en
  phrase grand-public à la génération. Ce qui compte, c'est la **structure**
  (bon type, bon scope), pas la prose.

Le n° de PR de merge (`(#238)`) est extrait automatiquement pour le lien GitHub.

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
- renseigne les **colonnes** `amount`, `kind` (discriminateur), `supplier` (voir « Champs promus en colonnes » plus bas)
- ajoute `metadata.source_name`, `metadata.unit_price` + les extras feature (`delta`, `unit`, `brand`…)
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

Les deux fonctions (`create_expense_interaction` + `create_manual_expense_interaction`) flow through un helper interne `_build_expense_metadata` qui garantit le shape `metadata` uniforme : `{source_name, unit_price}` + extra optionnel. Les champs monétaires **requêtés** (`amount`, `kind`, `supplier`) ne sont **pas** dans `metadata` — ce sont des colonnes (voir juste en dessous).

### Champs promus en colonnes : `amount` / `kind` / `supplier`

Les trois champs **requêtés/agrégés** d'une dépense sont des **vraies colonnes**
sur `Interaction` (plus seulement dans `metadata`) : `amount`
(`DecimalField(14,2)`), `kind` (indexé), `supplier`. Raison : ils étaient castés
depuis le JSON (`Cast(KeyTextTransform(...))`) dans 4 agrégations dupliquées.
Voir `docs/fiches/CARTOGRAPHIE_DEPENSES.md`.

- **Toute lecture/agrégation passe par `interactions.queries.expenses()`** (helper
  unique) et somme la colonne `amount` — ne jamais réintroduire un cast JSON.
- Le write path renseigne les colonnes ; un `kind` non-standard (ex: `recurring`
  depuis `confirm_recurring_occurrence`) se passe via le **param `kind`** des
  créateurs, **jamais** via `extra_metadata`.
- **Le front et l'API consomment les colonnes** : `amount`/`kind`/`supplier` sont
  des champs de premier niveau du serializer (`InteractionSerializer`), lus et
  écrits directement. Ces clés ne sont **plus** dans `metadata` (strippées par la
  migration `interactions.0024`). `unit_price` et `source_name` restent en
  `metadata` (non requêtés), avec les extras feature (`delta`, `unit`, `brand`…).
- Le `kind` d'une entrée **non-dépense** (ex: `renovation`) reste en `metadata` —
  la colonne `kind` est propre aux dépenses ; l'endpoint liste générique filtre
  donc `Q(kind=…) | Q(metadata__kind=…)` pour couvrir les deux.

### Relevés bancaires — une dépense est une ventilation (parcours 25)

**Livré** (lots 1-6). Doc : `docs/parcours/PARCOURS_25_RELEVES_BANCAIRES.md` +
`docs/fiches/IMPORT_ET_RAPPROCHEMENT.md` + `docs/MODULES/banking.md`.

- **Il n'y a pas de table `Allocation`.** Une ligne de relevé (`banking.BankTransaction`)
  ventilée 80 € / 40 € produit **deux `Interaction(type='expense')`**, chacune avec
  son `amount` et son `budget`, reliées à la ligne par la FK nullable
  `Interaction.bank_transaction` (`SET_NULL`). Conséquence à préserver :
  **`amount` reste une colonne scalaire** — ne jamais le rendre dérivé, sous peine
  de réécrire les 9 `Sum("amount")` avec un risque de double comptage par JOIN 1-N.
- **`Interaction.amount` est toujours positif** ; `BankTransaction.amount` est
  **signé** (négatif = sortie). Un remboursement n'est jamais une interaction
  négative — ça casserait `top_expenses` et `_spent_by_budget`.
- **Ne jamais additionner un total « banque » et un total « interactions ».** Les
  agrégats budget/dépenses lisent les `Interaction` exclusivement ; les totaux
  bancaires (et les **recettes**, qui n'entrent pas dans le journal) sont une vue à
  part. Le pont est un **taux de couverture**, pas une somme.
- **Le solde n'est jamais dénormalisé** (même règle que le « dépensé » du parcours
  21) : calculé à la lecture, ancré sur `BankTransaction.balance_after`.
- Une dépense créée depuis une ligne bancaire prend `occurred_at` à **midi dans la
  tz du foyer** — à minuit, une opération du 1er ou du 31 changerait de mois, donc
  de budget.
- Toute écriture de montant sur une interaction rapprochée passe par
  `banking.validators.assert_allocation_fits` — y compris le PATCH générique de
  `InteractionSerializer`.

### Conformité de l'argent — aucun orphelin silencieux (parcours 26)

Doc : `docs/parcours/PARCOURS_26_CONFORMITE_ARGENT.md` + section « Conformité » de
`docs/MODULES/banking.md`. Règle structurante :

> Toute entité est soit **résolue**, soit **flaggée avec un motif**.
> Rien ne reste dans un entre-deux silencieux.

- **Ajouter un mécanisme à l'argent = ajouter son détecteur.** Le registre
  `banking.compliance.REGISTRY` est alimenté depuis `apps.py::ready()` (même modèle
  que `agent.searchables`). C'est cette règle — à vérifier en revue — qui empêche
  le catalogue des orphelins de prendre du retard sur le code.
- **Écarter n'est pas cacher.** Un écart s'arbitre via `banking.ComplianceWaiver` :
  motif **requis**, daté, signé, **révocable**. Ne jamais introduire un
  `dismissed_at` / `ignored` / `accepted` sur une table métier — des états
  hétérogènes qu'on ne peut pas compter ensemble sont exactement l'orphelin qu'on
  supprime.
- **Un arbitrage périme.** Le waiver stocke le `fingerprint` de ce qu'il arbitre ;
  quand la situation bouge, l'écart resurgit `is_stale`. Tout nouveau détecteur
  doit donc faire entrer dans son `fingerprint` ce qui *fonde* l'écart (le reste à
  ventiler, le montant manquant…) et **rien de cosmétique**, sinon chaque édition
  invaliderait chaque arbitrage.
- **Certains écarts ne s'arbitrent pas** (`waivable=False`) : solde d'ouverture
  manquant, espèces à découvert, double confirmation. Ce sont des incohérences ou
  des prérequis, pas des choix — le service répond 400.
- **La conformité est bornée.** Tout détecteur qui raisonne sur « de l'argent qu'on
  devrait connaître » se scope par `banking.coverage` : hors de la fenêtre
  `[opening_balance_date, dernière date connue]`, un écart n'est pas un écart. Sans
  cette borne le contrôle afficherait des centaines d'écarts irrésolubles, et une
  liste irrésoluble ne se lit pas.
- **Le badge doit rester bon marché** : `DetectorSpec.count` est un `COUNT(*)`
  indexé, `findings` est paginé et ne tourne que pour le groupe ouvert. Ne jamais
  matérialiser les écarts en Python pour les compter.
- Le libellé utilisateur d'un `kind` vit dans le namespace i18n **`money`** du
  front, pas en `gettext` backend : ajouter un détecteur ne doit pas imposer un
  passage dans quatre `.po`.

#### Le module « Argent » — une seule clé, cinq onglets

Comptes, dépenses et budgets sont **un seul module** (`money`, `/app/money`), à
onglets : Contrôle / À ranger / Comptes / Dépenses / Budgets. Doc :
`docs/MODULES/money.md`.

- **Ne pas recréer d'entrée de sidebar** pour `banking`, `expenses` ou `budget` :
  ces clés n'existent plus dans `MODULES` ni dans `households.modules`. `money` est
  **core** (non désactivable) — conséquence assumée : les comptes bancaires ne sont
  plus un opt-in.
- Toute nouvelle URL de la famille argent vit sous `/app/money`. Les trois
  anciennes redirigent via `LegacyMoneyRedirect` en **préservant la query string**
  (l'agent produit `/app/budget?b={id}`) — ne pas remplacer par un `<Navigate to>`
  en dur.
- Les panneaux (`AccountsPanel`, `ExpensesPanel`, `BudgetsPanel`) n'ont **pas** de
  `PageHeader` : la coque porte le titre. Un panneau qui en ajoute un produit deux
  `h1`.
- Une pastille de budget de la file « À ranger » n'apparaît que sur une ligne
  **entièrement** non ventilée : l'écriture d'une ventilation est un remplacement
  complet, donc un raccourci sur une ligne partielle détruirait le travail déjà
  fait. Même raison pour la sélection multiple.

#### Ventilation — budget et projet sont deux axes indépendants

Une ligne de ventilation porte un **budget** *et* un **objet** (projet, équipement,
article de stock) *et* des **zones**. 90 € des 150 € dépensés chez Leroy Merlin
comptent dans le chantier **et** dans l'enveloppe « Bricolage ».

- **⚠️ La règle de propriété de l'éditeur de ventilation lit `kind` seul**
  (`OWNED_BY_ALLOCATION_EDITOR`). Ne jamais y rajouter une clause sur
  `source_content_type_id` : avec elle, une ligne rattachée à un projet cesse
  d'être « possédée » et se retrouve *détachée* au lieu d'être supprimée à la
  ré-édition — **chaque ré-édition laisse une dépense fantôme** toujours comptée
  dans le coût du projet. Test de régression :
  `banking/tests/test_allocation_axes.py::TestOwnershipRuleRegression`.
- `kind` reste `bank` même avec une source : il dit *d'où vient* la dépense, pas
  *sur quoi elle porte*.
- Toute résolution de source passe par
  `interactions.services.resolve_allocation_source`, qui **vérifie le foyer** —
  sans ça un client gonflerait le coût d'un projet qu'il ne peut pas voir.
- `set_allocations` convertit les `ValueError` du créateur en **400 préfixé du
  numéro de ligne**. Ne pas les laisser remonter : un mauvais id de zone donnait un
  500 sur une simple erreur client.

#### Recettes, mouvements internes, taux de couverture

- **`banking.rules` produit des valeurs de départ, jamais des vérités.** `is_internal`
  décide si l'argent compte comme dépense : une devinette appliquée comme vérité fait
  disparaître une vraie dépense des totaux, en silence. `guess_internal` renvoie
  `False` sur l'inconnu (défaut sûr), l'utilisateur corrige, et l'idempotence de
  l'import protège son choix. Ne pas grossir la liste de motifs pour « mieux faire » :
  une liste maligne finit par mal étiqueter la seule ligne de l'année qui compte.
- **`inflow_nature == ""` n'est pas `"other"`.** Vide = personne n'a regardé (écart) ;
  `other` = choix de l'utilisateur. Confondre les deux rend le détecteur aveugle.
- **Un remboursement est une ligne bancaire avec une nature, jamais une dépense
  négative.** `Interaction.amount` reste toujours positif.
- **Le pont banque ↔ interactions est `coverage_ratio`, jamais une somme.** Il vaut
  `1.0` quand rien n'est sorti — rien à expliquer n'est pas un reproche.
  `unallocated_outflow` se calcule **par différence sur la requête bancaire**, jamais
  en soustrayant une somme de dépenses.
- Le bloc `bank` du bilan mensuel est **additionnel** : ne jamais modifier les clés
  existantes du snapshot, le rendu et le digest les lisent.

#### Récurrences confirmées par le relevé

- **`Interaction.recurring_expense` est une FK, pas `metadata['recurring_id']`.** La
  clé JSON reste pour l'affichage, mais tout **groupement ou filtre** passe par la
  FK : le détecteur de double confirmation fait un `GROUP BY`, ce qu'une clé JSON ne
  permet ni d'indexer ni de contraindre. Ne jamais réintroduire un filtre
  `metadata__recurring_id`.
- **Auto-confirmer exige un montant strictement égal.** Une facture qui varie de
  cinq centimes reste non confirmée : la confirmer écrirait une occurrence à un
  montant que l'utilisateur n'a jamais vu.
- **Ordre à l'import : dépenses d'abord, récurrences ensuite**, sur ce qui reste
  libre. Une dépense déjà saisie est une information plus sûre qu'une échéance
  prévue.
- Une confirmation ventile **intégralement** la ligne. Sinon confirmer créerait un
  écart « sortie partiellement ventilée » — l'app fabriquerait son propre travail.
- Le passage sur les lignes libres se fait en **une requête**
  (`interactions__isnull=True`), jamais un `exists()` par ligne : la version naïve
  coûtait 160 allers-retours sur un relevé réel.

### Ajouter un nouveau template d'auto-subject

1. Ajouter l'entrée dans `AUTO_SUBJECT_TEMPLATES` (`apps/interactions/services.py`)
2. `python manage.py makemessages -l fr -l de -l es`
3. Éditer les 3 `.po` (`locale/fr|de|es/LC_MESSAGES/django.po`) pour ajouter la traduction
4. `python manage.py compilemessages`

> **`makemessages` est overridé** (`apps/core/management/commands/makemessages.py`) :
> `venv/`, `node_modules/` et `htmlcov/` sont ignorés par défaut. Sans ça, la
> commande scanne le venv (présent dans le repo) et injecte des centaines de
> `#:` vers Django/DRF dans les `.po`. Ne jamais réintroduire ces refs : si un
> diff `.po` fait apparaître des chemins `venv/lib/...`, c'est que l'override a
> été contourné. **Ne pas traduire les strings tierces** — Django fournit les
> siennes.

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

### Interaction vs modèle dédié — règle de décision

`Interaction` est le **journal du foyer**, pas une table générique. Une entrée y a sa
place parce qu'elle bénéficie gratuitement des quatre consommateurs transverses :
fil d'activité du dashboard, page dépenses + agrégations (`Project.actual_cost`),
RAG de l'agent (recherche/citation/`sum_amount`), liaisons génériques (zones M2M,
documents, tâches).

**Utiliser `Interaction`** (type existant + discriminateur `metadata.kind`) tant que
l'entrée est **un fait daté, plat, sans invariant** : dépenses (`*_purchase`,
`manual`), notes, carnet de rénovation (`renovation`).

**Créer un modèle dédié** dès qu'UN de ces besoins apparaît :

- machine à états / transitions (ex : `Task`, historiquement **extraite**
  d'`Interaction` — voir `Task.source_interaction`) ;
- contrainte DB (unicité, check) sur les données métier — impossible dans
  `metadata` JSON (ex : `EggLog` et son `unique(household, date)` qui fonde l'upsert) ;
- FK typée avec cascade / timeline par objet (ex : `ChickenEvent.chicken`) ;
- types métier sans équivalent dans `INTERACTION_TYPES` (couvaison, mue…) ;
- requêtes ou filtres sur les champs structurés (dans `metadata`, ils doivent rester
  **affichés, jamais requêtés ni contraints** — c'est la limite du carnet de rénovation).

Coûts du pattern à garder en tête : `metadata.kind` est stringly-typed (aucune
contrainte DB, une faute de frappe crée une catégorie silencieuse), les invariants ne
tiennent que si toutes les écritures passent par `interactions/services.py`, et les
filtres `metadata__kind=` sont dispersés dans plusieurs apps (renommer un kind est un
chantier transverse). Le type `todo` (et le champ `status` qui l'accompagnait) a été
retiré d'`Interaction` — les données ont été purgées vers `Task`
(`interactions.0018_purge_todo_interactions`).

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

### Retour contextuel (`BackLink` + `pushBack`)

Toute page de détail utilise `BackLink` : le lien retour ramène à la **page
d'origine** (ex: détail projet) si elle est connue, sinon à la liste par défaut.
L'origine circule via une pile d'URLs dans `location.state.back` — elle survit
aux reloads mais pas à un accès direct par URL (→ fallback).

```tsx
// Page de détail — lien retour + navigation après suppression
import BackLink from '@/components/BackLink';
import { useNavigateBack } from '@/lib/backNavigation';

<BackLink fallback="/app/tasks" fallbackLabel={t('tasks.title')} />
const navigateBack = useNavigateBack('/app/tasks');   // deleteMutation onSuccess

// Page d'origine — tout Link/navigate() vers une page de détail empile l'URL courante
import { pushBack } from '@/lib/backNavigation';
const location = useLocation();
<Link to={`/app/tasks/${id}`} state={pushBack(location)}>
navigate(`/app/tasks/${id}`, { state: pushBack(location) });
```

Ne jamais utiliser `navigate(-1)` pour un lien retour de page de détail (casse
sur accès direct / nouvel onglet) ni coder la liste en dur si la page peut être
ouverte depuis un autre contexte.

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

### Montants — un seul formatter

Tout affichage de montant passe par **`formatAmount` de `@/lib/format`** (Intl
devise EUR, locale-aware, option `{ fractionDigits }` pour les montants ronds).
Ne jamais réintroduire un `formatAmount` local ni un `.toFixed() + ' €'` /
`Intl.NumberFormat` inline (dette ② de `docs/fiches/CARTOGRAPHIE_DEPENSES.md`).

```tsx
import { formatAmount } from '@/lib/format';
formatAmount('12.50')                      // « 12,50 € » (fr)
formatAmount(420, { fractionDigits: 0 })   // « 420 € »
```

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

Boutons du footer — **ne jamais désactiver « Annuler »/« Fermer » pendant
`isPending`** : si la mutation traîne ou reste bloquée, l'utilisateur doit
toujours pouvoir sortir du dialog. Seul le bouton submit se désactive :

```tsx
<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
  {t('common.cancel')}
</Button>
<Button type="submit" disabled={isPending}>
  {t('common.save')}
</Button>
```

---

## Assistant IA ancré sur une entité (agent générique)

L'agent conversationnel (`apps/agent/`, RAG + function calling) peut être embarqué
dans la vue de détail de n'importe quelle entité, avec **tout le contexte de
l'objet pré-injecté au démarrage** (l'IA connaît déjà l'entité sans chercher).
Première intégration : onglet « Assistant » du détail projet.

### Brancher une nouvelle entité (zone, équipement…)

Une seule ligne côté UI — poser le composant générique dans la vue de l'entité :

```tsx
import EntityAssistant from '@/features/agent/EntityAssistant';

<EntityAssistant entityType="zone" objectId={zone.id} />
```

**Prérequis** : l'entité doit être enregistrée dans `agent.searchables` (via
`apps.py::ready()`). Un `related` sur le `SearchableSpec` enrichit le contexte
injecté (items liés), mais reste optionnel. Aucune modification de `apps/agent/`
n'est nécessaire.

### Sous le capot

- `AgentConversation` porte une ancre optionnelle
  `(context_entity_type, context_object_id)` — mêmes strings que l'adressage des
  tools (`entity_type:id`).
- `EntityAssistant` appelle
  `GET /api/agent/conversations/for_context/?entity_type=&object_id=` qui
  **get-or-create** l'unique conversation `(household, user, entité)` (pas de
  sidebar : 1 conversation persistante par entité et par user).
- À chaque `ask`, `service.ask(..., context_entity=(type, id))` pré-injecte le
  contexte via `agent.context.build_entity_context` (contenu complet + items liés,
  rendu citable) et bascule sur un system prompt ancré : le modèle répond et cite
  directement, sans appeler `search_household` pour l'objet courant.

Doc complète : `docs/MODULES/agent.md` + section « conversation ancrée » de
`docs/fiches/RAG.md`.

---

## Agent — actions d'écriture (`create_entity`)

L'agent peut **créer** des items du foyer depuis le chat via un unique tool
générique `create_entity` (pas un `create_<type>` par entité — on ne gonfle pas le
nombre de définitions de tools). Il est adossé au registry `agent.writables`,
miroir écriture de `agent.searchables`. Entités créables : **tâche**, **note**
(`Interaction` type=note).

### Rendre une nouvelle entité créable (~5 lignes)

Dans le `apps.py::ready()` de l'app, en plus du `SearchableSpec` :

```python
from agent.writables import WritableSpec, register as register_writable

register_writable(WritableSpec(
    entity_type='task',
    create=_create_task_from_agent,   # (household, user, fields, *, anchor) -> instance
    label_attr='subject',
    url_template='/app/tasks/{id}',
))
```

Règles :
- **`create` réutilise le service métier de l'app, jamais l'ORM brut.** Ex.
  `tasks/services.py::create_task` passe par `TaskSerializer` (validation, scope
  foyer, fallback zone racine). Créer un service dédié si absent.
- `create` reçoit l'`anchor` de la conversation ancrée `(entity_type, object_id)`
  → l'utiliser pour pré-remplir un lien (ancre `project` → item lié au projet).
- Étendre aussi la **description** du tool `create_entity` (`apps/agent/tools.py`)
  pour lister les champs de la nouvelle entité.

### Sécurité : créer + Undo

Une écriture est un **effet de bord réversible**, pas un brouillon à valider :
l'item est créé immédiatement, remonté dans `metadata.created_entities`, et le
front affiche un toast « Annuler » (`useAgentCreatedUndo`) qui le supprime. Ajouter
l'undo d'une nouvelle entité = une entrée dans `UNDO_HANDLERS`
(`ui/src/features/agent/hooks.ts`). Garde-fous : prompt strict (créer seulement sur
demande explicite) + anti-doublon par tour dans `service.ask`.

Doc complète : `docs/MODULES/agent.md` + `docs/parcours/PARCOURS_07_LOT8_ACTIONS_ECRITURE.md`.

---

## Page Tutoriel (`ui/src/features/tutorials/`)

Page `/app/tutorial` (sidebar, section Compte) : checklist « Bien démarrer » +
un guide pas à pas par module. Le contenu est **du code** : registre typé
`content.ts` + prose dans le namespace `tutorials` des 4 locales — aucune table
backend. La progression est une liste de clés opaques sur
`User.completed_tutorials` (validation de forme uniquement : ajouter un guide ne
touche jamais le backend). Les guides adossés à un module (`moduleKey`) héritent
de son icône et sont masqués si le module est désactivé pour le foyer.

**Règle : toute feature qui change le parcours utilisateur met à jour les
tutoriels dans la même PR** — skill `/tutorials` (étape intégrée au skill
`/new-feature`). Doc : `docs/MODULES/tutorials.md`.

---

## Changelog / « Nouveautés » (`apps/releases/`)

Page `/app/admin/changelog` (**réservée au staff/superuser Django**, section Admin
de la sidebar) : liste, à un coup d'œil, ce qui a été livré en prod, avec un résumé
lisible par changement. Alimentée **automatiquement** par le `git log` — pas de
saisie manuelle. C'est de l'infra applicative : modèle **global** (pas
household-scoped), lecture seule via l'API (permission `IsAdminUser`).

### Comment ça marche

- `ChangelogEntry` = un commit user-facing (`feat`/`fix`/`perf`) sur `main`.
- La command `python manage.py generate_changelog` parse le `git log`, extrait
  `type(scope): description (#PR)`, repolit la description via Claude (SDK direct,
  fallback = description brute si pas de clé), et persiste. Idempotent.
- `ChangelogState` (singleton) garde le tip de `main` à la dernière génération →
  carte « Production à jour » en tête de page.
- Le contrat de forme des commits est documenté plus haut (« Format des commits »).

### Générer

```bash
python manage.py generate_changelog            # incrémental (nouveaux commits)
python manage.py generate_changelog --all      # backfill historique complet
python manage.py generate_changelog --dry-run  # aperçu sans écrire ni appeler l'IA
python manage.py generate_changelog --rebuild  # purge + reconstruit
```

**Câblé au déploiement** : le job `deploy` de `.github/workflows/ci.yml` lance
`generate_changelog --from-stdin` après chaque push sur `main` (le conteneur n'a
pas le `.git` : le runner pipe le `git log`). `continue-on-error` — un échec de
génération ne bloque jamais le deploy. Voir `docs/MODULES/releases.md`.
