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

## Dépenses récurrentes (lot 2)

- **Modèle dédié `RecurringExpense`** (app `budget`) : `label`, `amount`,
  `cadence` (`monthly`/`quarterly`/`yearly`), `next_due_date`, `supplier`,
  `notes`, FK optionnelle `budget` (`SET_NULL`). Dédié car il porte un
  **planning** (`next_due_date` avance à chaque confirmation = petite machine à
  états) **requêté** par date (projection + liste « à confirmer »).
- **Services** (`services.py`) : `create/update/delete_recurring_expense`,
  `advance_due_date` (arithmétique de mois avec **clamp fin de mois** : 31 jan
  +1 mois → 28 fév), et `confirm_recurring_occurrence` — crée une vraie
  `Interaction(type='expense')` via `interactions.services`
  (`metadata.kind='recurring'` + `recurring_id`), rattachée au budget, puis
  **avance l'échéance**. Montant surchargeable à la confirmation (une facture
  varie). **Jamais auto-matérialisé** : la confirmation est toujours explicite.
- **Agrégations** : `compute_cashflow_projection` (somme des occurrences à venir
  sur 30/90 j en dépliant chaque récurrence par sa cadence) ; l'overview budget
  gagne `committed` par budget + `total_committed` (« engagé à venir » = échéances
  du mois non encore confirmées).
- **API** (`/api/budget/recurring/`) : CRUD + `due/` (échéances du jour) +
  `projection/` + `{id}/confirm/` (retourne la récurrence avancée +
  `interaction_id` pour un undo exact = supprimer la dépense + restaurer la date).
- **Rappel** : `PingSpec('recurring_due')` — nudge Telegram **informatif** listant
  les échéances dues (pointe vers l'app ; la confirmation 1-clic reste in-app).
- **Agent** : entité `recurring_expense` searchable + writable (create + undo).
- **Frontend** : sous-page `/app/budget/recurring` (`RecurringPage` : projection,
  section « à confirmer » avec confirm 1-clic, liste, dialogs, undo compound) ;
  carte d'accès depuis `BudgetPage` ; `committed` affiché sur les cards budget.
  i18n namespace `recurring.*` + `budget.committed`/`budget.recurringAccess.*` +
  `settings.pings.types.recurring_due`.

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
- **Récurrences** : le rappel d'échéance est un **nudge Telegram informatif** (pas
  de confirmation interactive via Telegram en V1) ; la projection ne déplie que
  les occurrences futures (les échéances passées non confirmées restent dans « à
  confirmer »).
- Lot suivant du parcours 21 : bilan mensuel IA (#314).
