# Parcours 08 — Backlog technique V1

> **À démarrer** — la fondation est posée par la branche `feat/interaction-source-polymorphic` (FK polymorphe sur `Interaction`, service `create_expense_interaction`, composant frontend partagé `PurchaseForm`). Issue parente du chantier de fondation : **#119**. Issue qui définit le périmètre de **non-traitement** (catégorisation différée) : **#120**.

## Tableau de bord

| Lot | Sujet | Statut | Issue |
|---|---|---|---|
| 1.0 | Vue dépense agrégée + endpoint summary | ⏳ À démarrer | #122 |
| 1.1 | Quick-add depuis Project | ⏳ À démarrer | #123 |
| 1.2 | Dépense ad-hoc + split du service | ⏳ À démarrer | #124 |

**Issues annexes liées** :

- **#119** — Généraliser auto-création d'interactions : FK polymorphe + service helper (fondation, à merger avant les lots ci-dessous)
- **#120** — Catégorisation des dépenses : itérer avec données réelles (déclencheur d'un parcours 09 ultérieur quand 20-30 dépenses seront enregistrées)
- **#118** — Suite parcours achat de stock : FAB global, édition/suppression, historique sur la card (pas un blocant, peut être traité en parallèle)

## Philosophie d'implémentation V1

**Posture YAGNI explicite** : on livre la vue agrégée et le quick-add depuis projects **avant** de coder le mode ad-hoc, parce que c'est seulement en utilisant la vue qu'on saura :

- si le breakdown `by_kind` est utile ou trop grossier
- si le mode ad-hoc est vraiment réclamé ou si toutes les dépenses se rattachent à un objet
- ce qui doit vraiment vivre dans `metadata` (peut-être `currency`, peut-être pas)

L'ordre 1.0 → 1.1 → 1.2 n'est pas neutre : il maximise l'apprentissage avant le moment où on doit trancher l'extraction de `_build_expense_metadata` et la signature de `create_manual_expense_interaction`.

## Doc associée

- Doc produit : [PARCOURS_08_SUIVRE_LES_DEPENSES.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_08_SUIVRE_LES_DEPENSES.md)
- CLAUDE.md, section « Auto-création d'`Interaction` — pattern write-time + service helper » — toutes les règles de localisation et de service helper sont déjà documentées
- Mémoire projet : `project_expense_taxonomy_deferred.md` (rappel : pas de `nature`, pas de découplage de `kind`)

## Décisions de cadrage MVP (toutes appliquées V1)

- **Pas de modèle `Expense` dédié** — `Interaction(type='expense')` reste le socle. Justification : RAG agent, tags, documents liés, contacts/structures M2M déjà branchés ; pas de duplication.
- **Aucun champ de catégorisation en V1** — pas de `nature`, pas de `category` typée, pas de `ExpenseCategory` modèle. Cf #120.
- **`metadata.amount` reste un str(Decimal)** dans le JSON — convention déjà imposée par `services.py::create_expense_interaction`. Pas de migration de schéma.
- **L'agrégation passe par Postgres `Cast`** depuis JSONField — acceptable jusqu'à plusieurs milliers de dépenses. Si la latence devient un sujet (peu probable pour un foyer solo), on dénormalisera via un `ExpenseDetail` OneToOne dans un parcours ultérieur.
- **Frontend** : nouvelle feature `ui/src/features/expenses/` avec son propre dossier — la vue dépense est une lecture par-dessus interactions, pas une variante d'`InteractionsPage`.
- **Lecture seule en V1 sur la vue agrégée** — la modification/suppression d'une dépense reste sur les pages source (cf. #118 pour stock). Le parcours 08 V1 ne livre pas d'édition transverse.

## Lot 1.0 — Vue dépense agrégée + endpoint summary

### But

Livrer la première lecture transversale des dépenses du foyer : une page qui répond à « combien j'ai dépensé ce mois-ci, et d'où ça vient ».

### Fichiers principaux

**Backend** :
- `apps/interactions/views.py` — ajouter une `@action(detail=False, methods=['get'], url_path='expenses/summary')` sur `InteractionViewSet`
- `apps/interactions/aggregations.py` (nouveau) — fonction `compute_expense_summary(household_id, from_dt, to_dt)`
- `apps/interactions/tests/test_api_expense_summary.py` (nouveau)

**Frontend** :
- `ui/src/features/expenses/ExpensesPage.tsx` (nouveau)
- `ui/src/features/expenses/ExpenseSummaryCards.tsx` (nouveau) — KpiCards pour total + breakdown
- `ui/src/features/expenses/ExpenseList.tsx` (nouveau) — liste paginée (réutilise `InteractionCard` ou variante allégée)
- `ui/src/features/expenses/ExpenseFilters.tsx` (nouveau) — period selector + supplier autocomplete + source-type pills
- `ui/src/features/expenses/hooks.ts` (nouveau) — `useExpenseSummary`, `useExpenseList`
- `ui/src/lib/api/expenses.ts` (nouveau) — wrappers fetch
- `ui/src/AppLayout.tsx` (modifié) — entrée sidebar
- `ui/src/locales/{en,fr,de,es}/translation.json` — namespace `expenses.*`

### Contrat backend

**Requête** : `GET /api/interactions/expenses/summary/?from=2026-05-01&to=2026-05-31&supplier=&kind=`

**Réponse** :

```json
{
  "period": {"from": "2026-05-01", "to": "2026-05-31"},
  "total": "1247.83",
  "count": 18,
  "by_kind": [
    {"kind": "stock_purchase", "total": "342.00", "count": 5},
    {"kind": "equipment_purchase", "total": "549.00", "count": 2},
    {"kind": "project_purchase", "total": "356.83", "count": 11}
  ],
  "by_supplier": [
    {"supplier": "Leroy Merlin", "total": "612.40", "count": 3},
    {"supplier": "Engie", "total": "142.67", "count": 1},
    {"supplier": "", "total": "492.76", "count": 14}
  ],
  "by_month": [
    {"month": "2026-05", "total": "1247.83", "count": 18}
  ]
}
```

Notes d'implémentation :

- Utiliser `Cast(F('metadata__amount'), DecimalField())` pour sommer côté Postgres. Filtrer en amont les rows où `metadata->>'amount' IS NULL`.
- `from`/`to` optionnels — défaut = mois courant.
- Le filtrage sur `supplier` se fait via `metadata__supplier=...`.
- Le filtrage sur `kind` via `metadata__kind=...`.
- `by_month` n'a qu'une ligne quand la période courante est < 31j, mais doit être rempli quand la période couvre plusieurs mois (vue annuelle).

### Tâches

1. **Backend** :
   1. `aggregations.compute_expense_summary(household_id, from_dt, to_dt, supplier=None, kind=None)` — retourne le dict ci-dessus
   2. `@action` `expenses_summary` sur `InteractionViewSet`
   3. Ajouter `metadata__kind` et `metadata__supplier` au `filterset_fields` du viewset (pour la liste paginée)
   4. Tests pytest : totaux corrects, scope household, dates, période vide, supplier filter, kind filter
2. **Frontend** :
   1. `useExpenseSummary(filters)` query key, fetcher
   2. `useExpenseList(filters)` réutilise l'endpoint `/api/interactions/?type=expense&...` (pas un endpoint dédié)
   3. `ExpensesPage` layout : `PageHeader` + `ExpenseFilters` + `ExpenseSummaryCards` + `ExpenseList`
   4. `ExpenseSummaryCards` : KPI total + chips par kind (cliquables, posent un filtre)
   5. `ExpenseFilters` : period selector (présets + custom range), supplier autocomplete, kind pills
   6. Skeleton via `useDelayedLoading` (pattern du CLAUDE.md "Feature page")
   7. État vide via `EmptyState`
   8. Sidebar : ajouter route `/app/expenses/` avec icône `Receipt`
   9. i18n 4 locales (`expenses.title`, `expenses.empty`, `expenses.filters.*`, `expenses.summary.*`)
3. **Tests E2E Playwright** :
   1. `e2e/expenses-summary.spec.ts` — golden path : naviguer, voir un total, filtrer par supplier
   2. Mettre à jour `e2e/COVERAGE.md` (cf. mémoire `feedback_coverage_update`)
4. **Régénération API** : `npm run gen:api:refresh` après le backend
5. **Doc** : ajouter une mention dans `docs/MODULES/interactions.md` si la fiche existe

### Critères de validation

- `GET /api/interactions/expenses/summary/` sur un foyer avec 5 dépenses retourne un total cohérent (vérifié manuellement via shell)
- `/app/expenses/` affiche le total du mois, le breakdown par kind, et la liste
- Filtrer sur supplier='Engie' modifie le total et la liste de manière cohérente
- Tests pytest et E2E verts
- Scope household enforced (foyer A ne voit pas les dépenses du foyer B)

### Hors scope du lot

- Édition / suppression des dépenses depuis cette vue (reste sur les pages source — cf. #118)
- Export CSV
- Graphes / visualisations avancées (les KPI cards suffisent en V1)

## Lot 1.1 — Quick-add depuis Project

### But

Permettre d'enregistrer une dépense liée à un projet directement depuis sa fiche, comme c'est déjà possible pour stock et equipment. Met à jour `Project.actual_cost` en cohérence.

### Fichiers principaux

**Backend** :
- `apps/projects/views.py` — nouvelle action `register_purchase` sur `ProjectViewSet`
- `apps/projects/serializers.py` — `ProjectPurchaseSerializer` (miroir d'`EquipmentPurchaseSerializer`)
- `apps/interactions/services.py` — étendre `AUTO_SUBJECT_TEMPLATES` : `"project_purchase": _("Purchase — {name}")`
- `apps/projects/tests/test_api_project_purchase.py` (nouveau)

**Frontend** :
- `ui/src/features/projects/ProjectPurchaseDialog.tsx` (nouveau) — wrappe `PurchaseForm` (sans `withDelta`)
- `ui/src/features/projects/ProjectCard.tsx` (modifié) — action « + Dépense » dans `CardActions`
- `ui/src/features/projects/ProjectDetailPage.tsx` (modifié) — bouton « + Dépense » dans le `PageHeader`
- `ui/src/features/projects/hooks.ts` (modifié) — `useRegisterProjectPurchase`
- `ui/src/lib/api/projects.ts` (modifié)
- `ui/src/locales/{en,fr,de,es}/translation.json` — clés `projects.purchase.*` miroir de `equipment.purchase.*`

### Décisions tranchées

- `kind = "project_purchase"` (convention `<app_label>_purchase`, cohérente avec stock/equipment)
- Subject template `_("Purchase — {name}")` réutilisé tel quel — `project.title` est consommé par le service via `_source_name` (qui essaie `name`, puis `title`, puis `str()`)
- Le snapshot sur `Project.actual_cost` se fait **en addition** (pas en remplacement) : `actual_cost = (actual_cost or 0) + amount`. Si `amount=None`, on ne touche pas `actual_cost`.
- Une dépense liée à un projet peut être attachée à une zone via la M2M existante — pour l'instant on ne porte rien depuis le projet, l'utilisateur peut éditer après-coup.

### Tâches

1. **Backend** :
   1. Étendre `AUTO_SUBJECT_TEMPLATES` (1 ligne)
   2. `ProjectPurchaseSerializer` : `amount`, `supplier`, `occurred_at`, `notes`
   3. `@action(detail=True, methods=['post'], url_path='register-purchase')` sur `ProjectViewSet`
   4. Snapshot `actual_cost` en transaction
   5. Tests pytest : succès, isolation tenant, scope household, snapshot `actual_cost`, projet inexistant, payload invalide, projet d'un autre foyer
   6. **gettext** : `python manage.py makemessages -l fr -l de -l es` puis traduire le template (déjà traduit pour stock/equipment, normalement même chaîne — vérifier que le nouvel usage est bien picked up sinon ajouter)
3. **Frontend** :
   1. `ProjectPurchaseDialog` qui wrappe `PurchaseForm` (sans `withDelta`)
   2. Action « + Dépense » sur la `ProjectCard` (via `CardActions`)
   3. Bouton « + Dépense » sur `ProjectDetailPage` dans le `PageHeader`
   4. Mutation `useRegisterProjectPurchase` avec invalidation : `projectKeys.detail(id)`, `projectKeys.list()`, `interactionKeys.all`, `expenseKeys.all`
   5. i18n 4 locales (`projects.purchase.*`)
4. **Régénération API** : `npm run gen:api:refresh`
5. **Tests E2E Playwright** : `e2e/project-purchase.spec.ts` (miroir de `e2e/equipment-purchase.spec.ts`)
6. **COVERAGE.md** : mettre à jour

### Critères de validation

- Sur un projet, je peux cliquer « + Dépense », saisir 450 € + supplier Leroy Merlin, valider.
- L'`Interaction(type=expense, source=project, kind='project_purchase')` est créée avec subject auto-localisé.
- `Project.actual_cost` est incrémenté de 450 €.
- La dépense apparaît dans la timeline du projet (via `Project.interactions.all()`) et dans `/app/expenses/` (via le filtre `kind=project_purchase`).
- Tests verts.

### Hors scope du lot

- Lien automatique entre `Project.planned_budget` et la somme des dépenses (alerte budget dépassé) — sujet d'un parcours budget ultérieur
- Édition / suppression des dépenses projet
- Décomposition des dépenses projet par groupe de projet — utile mais reportable

## Lot 1.2 — Dépense ad-hoc + split du service

### But

Permettre d'enregistrer une dépense « libre » (resto, cinéma, cadeau…) sans rattachement à un objet du foyer. Tirer profit de l'écriture de cette deuxième fonction pour extraire `_build_expense_metadata` et garantir un shape `metadata` uniforme.

### Posture (validée avec l'utilisateur, à ne pas perdre)

> Option (c) : split en deux fonctions qui partagent un metadata builder.
>
> - `create_expense_interaction(*, source, user, ...)` : ce qui existe — auto-template via gettext + `source.name`, héritage household/zone, kind dérivé du source.
> - `create_manual_expense_interaction(*, household, user, subject, ...)` : nouveau — subject saisi user, `source=None`, `kind="manual"`.
> - `_build_expense_metadata(...)` : helper interne, **extrait au moment où on écrit la 2e fonction, pas avant**.
>
> Justification : les deux opérations sont conceptuellement différentes (auto-template vs subject user-saisi, source-bound vs household-direct). Forcer une signature unique avec moitié des paramètres en `Optional` mentirait sur le contrat. La factorisation se fait au niveau du shape `metadata`, pas du flow.

### Fichiers principaux

**Backend** :
- `apps/interactions/services.py` (modifié) — extraire `_build_expense_metadata` puis ajouter `create_manual_expense_interaction`
- `apps/interactions/views.py` — nouvelle `@action(detail=False, methods=['post'], url_path='expenses/manual')` sur `InteractionViewSet`
- `apps/interactions/serializers.py` — `ManualExpenseSerializer` (subject + amount + supplier + occurred_at + notes + zone_ids optionnels)
- `apps/interactions/tests/test_services.py` (étendu)
- `apps/interactions/tests/test_api_expense_manual.py` (nouveau)

**Frontend** :
- `ui/src/features/expenses/ExpenseAdHocDialog.tsx` (nouveau) — champ `subject` libre + `PurchaseForm` (sans `withDelta`)
- `ui/src/features/expenses/ExpensesPage.tsx` (modifié) — bouton « + Dépense » qui ouvre le dialog
- `ui/src/features/expenses/hooks.ts` (modifié) — `useCreateManualExpense`
- `ui/src/locales/{en,fr,de,es}/translation.json` — clés `expenses.adhoc.*`

### Décisions tranchées

- **Ordre d'implémentation strict** :
  1. Écrire `create_manual_expense_interaction` à côté de `create_expense_interaction` avec son **propre `metadata = {...}` inliné** — ne pas refactor avant
  2. Lire les deux fonctions côte à côte. Vérifier ce qui est vraiment commun (peut-être que `source_name` ne sert à rien en manual et qu'on veut le retirer plutôt que mettre `None`)
  3. **À ce moment seulement**, extraire `_build_expense_metadata(*, kind, source_name, amount, unit_price, supplier, extra=None)` avec la forme effectivement observée
- `kind = "manual"` — sentinel honnête. Quand l'issue #120 ouvrira la catégorisation user-driven, `manual` sera le terrain naturel pour expérimenter (puisque c'est le seul cas sans signal métier auto).
- Pas d'entrée dans `AUTO_SUBJECT_TEMPLATES` — le subject est saisi par l'user, pas templaté.
- `source_content_type=None`, `source_object_id=None` — la FK polymorphe accepte déjà `null=True` (cf migration 0015).
- Zone optionnelle — le formulaire ad-hoc peut proposer un select de zones (réutiliser `ZonePicker` existant si disponible) mais la zone n'est pas obligatoire en V1 pour ce flow (à arbitrer en codant).

### Contrat backend

**Requête** : `POST /api/interactions/expenses/manual/`

```json
{
  "subject": "Restaurant Le Bistrot",
  "amount": "32.00",
  "supplier": "",
  "occurred_at": "2026-05-03T12:00:00Z",
  "notes": "Déjeuner avec Sophie",
  "zone_ids": []
}
```

**Réponse** : `201 Created` avec l'`Interaction` complète sérialisée.

### Tâches

1. **Backend** :
   1. Écrire `create_manual_expense_interaction(*, household, user, subject, amount=None, supplier="", occurred_at=None, notes="", extra_metadata=None)` avec `metadata` inliné
   2. Tests pytest pour la nouvelle fonction (subject obligatoire, scope household, `kind="manual"`, `source_content_type IS NULL`)
   3. Refactor : extraire `_build_expense_metadata` une fois les deux fonctions visibles
   4. Vérifier que `create_expense_interaction` continue de passer ses tests (régression)
   5. `ManualExpenseSerializer` + `@action expenses_manual`
   6. Tests pytest endpoint
2. **Frontend** :
   1. `ExpenseAdHocDialog` : `subject` (input texte obligatoire) + `PurchaseForm` (sans `withDelta`, sans pré-fill)
   2. Bouton « + Dépense » dans `PageHeader` de `/app/expenses/`
   3. Mutation `useCreateManualExpense` avec invalidation summary + list
   4. i18n 4 locales
3. **Régénération API** : `npm run gen:api:refresh`
4. **Tests E2E Playwright** : `e2e/expense-adhoc.spec.ts`
5. **COVERAGE.md** : mettre à jour
6. **Doc** : étendre la section CLAUDE.md « Auto-création d'`Interaction` » pour mentionner `create_manual_expense_interaction` et le builder partagé

### Critères de validation

- Depuis `/app/expenses/`, je peux cliquer « + Dépense », saisir un subject libre + 32 € + date, valider.
- L'`Interaction(type=expense, source=None, kind='manual')` est créée avec mon subject tel-quel (pas de gettext).
- La dépense apparaît dans `/app/expenses/` et dans `/app/interactions/` (filtre `type=expense`).
- Le total mensuel est mis à jour (cohérent avec le breakdown : `by_kind` montre une ligne `manual`).
- Tests verts.
- `_build_expense_metadata` est extrait dans `services.py` et utilisé par les deux fonctions de création.

### Hors scope du lot

- Catégorisation user-driven du `kind` manuel — sujet de #120, à traiter quand le signal sera là
- Édition du subject auto post-création (déjà couvert par `InteractionEditPage` existante, à vérifier que ça marche bien pour les dépenses)
- Multi-currency — `metadata.currency` reste optionnel, non consommé en V1

## Points de vigilance

- **Ne pas refactor preemptivement** `_build_expense_metadata` au lot 1.0 ou 1.1 — la règle est : extraction au moment d'écrire la 2e fonction (lot 1.2), pas avant.
- **Ne pas casser l'invariant** `metadata.amount = str(Decimal)` — c'est ce qui garantit la stabilité du shape pour le RAG, l'admin, les exports.
- **Ne pas exposer un endpoint `/expenses/` au top-level** côté API — l'agrégation reste sous `/api/interactions/expenses/...` parce qu'une dépense **est** une interaction. Pas de duplication conceptuelle au niveau routes.
- **Ne pas glisser vers la catégorisation** — si pendant l'implémentation l'envie revient d'ajouter `nature` ou `category`, relire #120 et résister. Le signal n'est pas encore là.
- **Ne pas supprimer les actions « + Achat » existantes sur stock/equipment** au profit de la vue unique « + Dépense ». Le quick-add depuis la card de l'objet source est plus rapide pour le user, on garde les deux.
- **Mention dans `apps/agent/searchables.py`** : `Interaction` est déjà enregistrée. Pas de nouveau modèle à enregistrer (cohérent avec mémoire `feedback_register_new_models_in_agent`).

## Définition de done — V1

1. `/app/expenses/` est accessible depuis la sidebar et affiche un total mensuel + breakdown.
2. L'endpoint `GET /api/interactions/expenses/summary/` est documenté dans le schéma OpenAPI et testé.
3. Une dépense projet peut être créée via `POST /api/projects/{id}/register-purchase/` (parallèle à equipment).
4. Une dépense ad-hoc peut être créée via `POST /api/interactions/expenses/manual/`.
5. `_build_expense_metadata` existe et factorise les deux fonctions de création — shape `metadata` garanti uniforme.
6. Tests pytest et E2E essentiels verts.
7. i18n 4 locales partout.
8. `COVERAGE.md` à jour.

## Suite recommandée après V1

Une fois la V1 livrée et 20-30 dépenses réelles enregistrées :

1. **#120** — réouvrir la conversation catégorisation avec des données concrètes (poste budgétaire ? nature comptable ? tags libres ?)
2. **Édition / suppression transverse** — généraliser ce que #118 fait pour stock à equipment + project + manual (un seul flow d'édition de dépense, peu importe le source)
3. **Module Budget** — modèle `Budget` (mensuel/annuel), comparaison budget vs réel, alertes via `apps/alerts`. À traiter en parcours 09 dédié quand la taxonomie sera tranchée.
4. **Réconciliation bancaire** — import CSV banque, matching automatique. Sujet de niveau supérieur, hors V1.
