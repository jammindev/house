# Cartographie du mécanisme de dépenses

> **MàJ 2026-07-24 — dette ① résolue (PR « expense columns »).** `amount`, `kind`
> et `supplier` sont désormais de **vraies colonnes** sur `Interaction`
> (nullable, `kind` indexé `idx_int_hh_kind`), backfillées depuis `metadata`
> (migrations `interactions.0022` + `0023`). Les 4 agrégations lisent la colonne
> `amount` via le helper partagé `interactions.queries.expenses()` — plus aucun
> `Cast(KeyTextTransform("amount", "metadata"), Decimal)`. Le write path
> (`create_expense_interaction` / `create_manual_expense_interaction`, param
> `kind` explicite) renseigne les colonnes **et** garde `metadata` (le front lit
> encore `metadata` ; le serializer resynchronise les colonnes à chaque édition).
> **Reste (PR2)** : basculer le front sur les colonnes, unifier `formatAmount`
> (dette ②), puis migration de nettoyage qui strippe `amount/kind/supplier` de
> `metadata`. Le reste de la fiche décrit l'état AVANT ce refactor.
>
> État : 2026-07-24. Photo de l'existant avant chantier d'amélioration.
> Le mécanisme « dépense » s'est diffusé dans toute l'app depuis le parcours 08
> (socle dépenses) puis le parcours 21 (budgets & récurrences). Cette fiche
> cartographie **tous** les points d'écriture et de lecture pour cadrer les
> améliorations à venir. Références `file:line` données à titre indicatif
> (vérifier avant d'agir, le code bouge).

## Fondation : un seul modèle

Tout repose sur **`Interaction` avec `type='expense'`** (`apps/interactions/models.py`).

- **Montant** : stocké dans `metadata['amount']` **sous forme de chaîne** (`str(Decimal)`, ex. `"25.00"`), jamais en colonne dédiée. `unit_price` idem.
- **Discriminateur** : `metadata['kind']` distingue l'origine.
- **Source** : FK polymorphe `(source_content_type, source_object_id)` + `GenericForeignKey('source')` → relie la dépense à l'objet déclencheur (StockItem, Equipment, Project, Chicken). `null` pour les dépenses manuelles.
- **Budget** : FK `budget` (`SET_NULL`, migration `interactions.0021`) → budget optionnel du parcours 21. `null` = « hors budget ».
- **Zones** : M2M héritée du modèle Interaction.

### Shape `metadata` d'une dépense

```json
{
  "kind": "stock_purchase | equipment_purchase | project_purchase | chickens_purchase | manual | recurring",
  "source_name": "<nom de l'objet source> | null",
  "amount": "<Decimal en string> | null",
  "unit_price": "<Decimal en string> | null",
  "supplier": "<fournisseur ou chaîne vide>"
  // + clés extra_metadata feature-spécifiques (delta, unit, brand, recurring_id, category…)
}
```

Point de vérité du shape : **`_build_expense_metadata`** (`apps/interactions/services.py`). Les deux entrées publiques passent par lui → forme uniforme garantie.

## Producteurs (6 points d'écriture)

Deux fonctions de service seulement créent des dépenses :
`create_expense_interaction` (source-liée) et `create_manual_expense_interaction` (ad-hoc).

| Origine | Fichier | Fonction | `kind` | `extra_metadata` | Side-effects sur la source |
|---|---|---|---|---|---|
| Achat stock | `apps/stock/services.py:133` | `purchase_stock_item()` | `stock_purchase` | `stock_item_name`, `brand`, `delta`, `unit` | qty, unit_price, supplier, purchase_date, last_restocked_at + `StockLevelReading` |
| Achat équipement | `apps/equipment/views.py:77` | `register_purchase()` | `equipment_purchase` | `equipment_name` | purchase_price, purchase_vendor, purchase_date |
| Achat poule | `apps/chickens/views.py:90` | `purchase()` | `chickens_purchase` | — | aucun |
| Achat projet | `apps/projects/views.py:106` | `register_purchase()` | `project_purchase` | `project_title` | aucun (actual_cost recalculé) |
| Confirmation récurrence | `apps/budget/services.py:226` | `confirm_recurring_occurrence()` | `recurring` | `recurring_id` | avance `RecurringExpense.next_due_date` |
| Dépense manuelle | `apps/interactions/views.py:231` | `expenses_manual()` (REST) | `manual` | libre | aucun |

Helpers de service associés (`apps/interactions/services.py`) :
`_purchase_kind_for_source` (`{app_label}_purchase`), `_resolve_expense_budget`, `_resolve_household_zones`, `AUTO_SUBJECT_TEMPLATES` (subjects localisés write-time).

## Lecteurs / agrégations (4 arbres indépendants)

| Périmètre | Fichier | Fonction | Technique |
|---|---|---|---|
| Coût réel projet | `apps/projects/services.py:36` | `_expense_amounts` → `annotate_actual_cost` / `project_actual_cost` | Cast JSON + subquery, filtré sur source=Project |
| Vue budgets | `apps/budget/aggregations.py:70` | `_spent_by_budget` (+ `_committed_by_budget`) | Cast JSON, group by `budget_id` |
| Bilan mensuel | `apps/budget/report/stats.py:56` | `compute_month_stats` | Cast JSON, multi-groupes, top 5, tendance |
| Résumé dépenses | `apps/interactions/aggregations.py:34` | `compute_expense_summary` | Cast JSON, group by kind/supplier/mois |

Endpoints : `GET /api/interactions/expenses/summary/` (résumé), overview budget, `/api/budget/reports/`.
Agrégation agent : `list_entities` **somme en Python** via `_interaction_amount` (`apps/interactions/apps.py:218`), cap `LIST_AGGREGATION_SCAN_CAP` (~2000), **pas de SQL**.

Filtres directs sur `metadata` : `interactions/views.py:141-149` (`metadata__kind`, `metadata__supplier`), `stock/services.py:296` (undo_purchase filtre `stock_purchase`), `chickens/services.py:304` (historique dépenses volaille).

## Intégration agent

- **Searchables** : `interaction` (subject+content, **PAS le montant**), `budget` (name), `recurring_expense` (label+supplier). Déclarés dans les `apps.py::ready()`.
- **Writables** : `budget` (create/update/delete + undo), `recurring_expense` (create/delete, **pas d'update**). **L'agent ne crée PAS de dépense brute.**
- **Tools** : `create_entity` supporte `budget` + `recurring_expense` ; `list_entities` agrège les montants ; `search_household` ne trouve pas par montant.
- **Undo front** (`ui/src/features/agent/hooks.ts`) : `UNDO_HANDLERS` pour `budget`, `recurring_expense`, `stock_purchase` ; `UPDATE_UNDO_HANDLERS` pour `budget` seulement.
- **Aucune relation budget↔dépense** (`related=None`) : `get_related(budget)` ne remonte pas les dépenses liées.

## Frontend

- **Form partagé** : `ui/src/features/interactions/PurchaseForm.tsx` (prix total/unitaire, fournisseur, marque, delta, date, notes), wrappé par `StockPurchaseDialog`, `EquipmentPurchaseDialog`, `ChickenPurchaseDialog`, `ProjectPurchaseDialog`, `ShoppingCommitDialog`.
- **Dépense manuelle** : `ui/src/features/expenses/` (ExpensesPage + ExpenseAdHocDialog avec sélecteur budget + ExpenseSummaryCards + ExpenseList).
- **Budgets** : `ui/src/features/budget/` (BudgetPage, RecurringPage, ReportsPage, cards, dialogs, hooks).
- **API client** : `ui/src/lib/api/budget.ts` + `expenses.ts` — montants **string en réponse**, **number en payload**.

## Dette & hotspots d'amélioration (par ROI décroissant)

### ① Cast JSON→Decimal dupliqué 4× (dette n°1)
Le pattern
```python
Cast(KeyTextTransform("amount", "metadata"), DecimalField(max_digits=14, decimal_places=2))
```
est réécrit à l'identique dans `projects/services.py:36`, `budget/aggregations.py:70`, `budget/report/stats.py:56`, `interactions/aggregations.py:34`. Chaque module a son propre `_expense_qs()`. **Aucun helper partagé.** → candidat : un `interactions/expense_query.py` (ou méthode de manager `Interaction.objects.expenses().with_amount()`) réutilisé partout.

### ② `formatAmount()` front dupliqué 4× + affichage incohérent
- 4 implémentations : `@/lib/format.ts` (partagé, safe null), `features/budget/format.ts`, `ExpenseSummaryCards.tsx`, `ExpenseList.tsx`.
- 12+ fichiers affichent des montants : projets/dashboard en `.toFixed(0)` (0 déc.), reste en `Intl` 2 déc., equipment/interactions en concat brute `amount + " €"`.
- Parsing `Number(...).replace(',', '.')` réimplémenté dans 4+ dialogs.
→ candidat : un seul `formatAmount` + `parseAmount` partagés, précision paramétrable.

### ③ Typage montant incohérent (string en lecture / number en écriture)
API renvoie string (précision Decimal), payloads envoient number, state formulaire en string. → clarifier un contrat unique.

### ④ Asymétries fonctionnelles
- `metadata.amount` non indexé RAG + agrégation agent en Python (cap 2000, pas SQL).
- Agent ne peut ni créer ni éditer une dépense, ni éditer une récurrence.
- Aucune relation budget↔dépense côté RAG.
- `Project.actual_cost_cached` existe mais n'est **jamais écrit** (vérité = annotation calculée) → dette morte à nettoyer.

### ⑤ `kind` stringly-typed
6 valeurs dispersées dans producteurs + filtres + rapports, aucune contrainte DB (cf. CLAUDE.md « Interaction vs modèle dédié »). Renommer un `kind` = chantier transverse.

## Limites structurelles assumées (héritées)

- Montant en JSON string → agrégations obligatoirement via Cast SQL (pas d'index natif sur le montant).
- Une dépense = au plus un budget (pas de split).
- Pas de dénormalisation du « dépensé » : tout recalculé à la lecture (choix parcours 21).
