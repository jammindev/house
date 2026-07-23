# Module — budget (budgets mensuels & suivi de dépassement)

> Rôle : **cadrer les dépenses**. L'utilisateur crée plusieurs budgets mensuels
> nommés (enveloppes : « Courses », « Loisirs »…) et suit, en temps réel, le
> dépensé vs le plafond de chacun. Une dépense se rattache optionnellement à un
> budget ; ce qui n'est pas rattaché tombe dans « hors budget ». Un budget
> global optionnel plafonne l'ensemble (filet de sécurité).
>
> Le dépensé n'est **jamais dénormalisé** : il est recomposé à la volée depuis le
> journal (`interactions.Interaction` type `expense`, montant dans
> `metadata.amount`). Parcours : `docs/parcours/PARCOURS_21_BUDGETS_ET_RECURRENCES.md`.
> Socle réutilisé : [interactions.md](./interactions.md), [agent.md](./agent.md).

## État synthétique

- **Backend** : `apps/budget/`
  - `models.py` — `Budget(HouseholdScopedModel)` : `name`, `monthly_amount`
    (Decimal 12,2), `is_global`. Contraintes DB : un seul `is_global=True` par
    foyer (`one_global_budget_per_household`), nom unique par foyer
    (`unique_budget_name_per_household`).
  - `services.py` — **source de vérité des écritures** : `create_budget`,
    `update_budget`, `delete_budget`. Passe par `BudgetSerializer` (montant > 0,
    nom non vide) ; mappe les collisions d'unicité en `ValidationError` 400.
    Le viewset REST **et** l'agent appellent ces fonctions (jamais l'ORM brut).
  - `aggregations.py` — `compute_budget_overview(household=...)` : plafond/dépensé
    par budget pour le **mois courant dans le fuseau du foyer**
    (`current_month_range`), total « hors budget », budget global, drapeau
    `named_exceeds_global`. États `ok` / `warning` (≥ `BUDGET_WARNING_RATIO`) /
    `over` (≥ 100 %).
  - `views.py` — `BudgetViewSet` (CRUD + action `overview`). `perform_create`/
    `perform_update` délèguent au service et rebindent l'instance sur le
    serializer pour la réponse. Permission `IsHouseholdMember` (tout membre).
  - `urls.py` — router `/api/budget/budgets/` (+ `/overview/`).
- **Rattachement dépense → budget** : FK nullable `Interaction.budget`
  (`on_delete=SET_NULL`, `related_name='interactions'`, migration
  `interactions.0021`). Supprimer un budget **ne supprime pas** les dépenses :
  elles repassent « hors budget ». Résolution/validation centralisées dans
  `interactions.services._resolve_expense_budget` (scope foyer, refus du budget
  global comme cible). Exposé côté API : `budget_id` en écriture sur
  `ManualExpenseSerializer` et `InteractionSerializer`, `budget` (`{id, name}`)
  en lecture.
- **Agent** (`apps/budget/apps.py::ready()`, zéro modif de `apps/agent/`) :
  - `SearchableSpec(entity_type='budget')` — RAG par nom, lien vers `/app/budget`.
  - `WritableSpec(entity_type='budget')` — `create`/`update`/`delete` (undo),
    adaptateurs minces vers `budget.services`. Description du tool `create_entity`
    étendue dans `apps/agent/tools.py`.
- **Frontend** : `ui/src/features/budget/` (`BudgetPage`, `BudgetCard`,
  `BudgetDialog`, `hooks.ts`, `format.ts`), client `ui/src/lib/api/budget.ts`,
  route `/app/budget` + entrée sidebar (registre `lib/modules.ts`, groupe Suivi,
  clé `budget`, épinglable). Sélecteur de budget optionnel ajouté à
  `ExpenseAdHocDialog`. Undo agent (create + update) câblé dans
  `features/agent/hooks.ts` (`UNDO_HANDLERS` / `UPDATE_UNDO_HANDLERS`).
- **Locales (en/fr/de/es)** : namespace `budget` + `expenses.adhoc.budget` /
  `expenses.adhoc.budgetNone`.
- **Réglage** (`config/settings/base.py`) : `BUDGET_WARNING_RATIO` (défaut `0.8`).
- **Module de nav** : clé `budget` dans `apps/households/modules.py`
  (`PINNABLE_MODULES`) et `ui/src/lib/modules.ts` — core (toujours visible),
  épinglable.
- **Tests** : `apps/budget/tests/` (modèle/service/viewset/overview/agent) +
  couverture du rattachement dans `apps/interactions/tests`.

## Modélisation — pourquoi `Budget` est un modèle dédié (pas une `Interaction`)

Un budget porte une **contrainte DB** (un seul global par foyer, nom unique) et
est la cible d'une **FK typée** requêtée/agrégée (`Interaction.budget`) — deux
critères qui, par la règle « Interaction vs modèle dédié » du CLAUDE.md, imposent
un modèle dédié. Le rattachement dépense→budget est une **vraie colonne** (et non
`metadata`) précisément parce qu'on l'agrège (SUM par budget/mois).

## Décisions clés

- **Budgets multiples nommés = la dimension de regroupement** (pas de taxonomie
  de catégories séparée). Rattachement d'une dépense **optionnel** ; « hors
  budget » toujours visible.
- **Budget global optionnel** = filet couvrant tout (budgeté + hors budget).
- **Tout membre** gère les budgets (aligné sur la saisie de dépenses).
- **Dépensé calculé à la volée** : pas d'historique dénormalisé, toujours à jour.

## Limites V1 assumées

- **Budget reconduit tel quel** chaque mois (pas d'override par mois).
- **Sélecteur de budget seulement sur la dépense manuelle** (`/app/expenses`) et
  l'édition d'interaction. Les dépenses auto-créées (achats stock/équipement)
  acceptent un `budget_id` côté service mais leurs dialogs ne l'exposent pas
  encore.
- **Pas de page détail par budget** : une seule vue d'ensemble ; les liens agent
  pointent vers `/app/budget`.
- Lots suivants du parcours 21 : récurrences + prévision de trésorerie (#313),
  bilan mensuel IA (#314).
