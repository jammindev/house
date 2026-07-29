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
- **Frontend** : sous-page `/app/money/recurring` (`RecurringPage` : projection,
  section « à confirmer » avec confirm 1-clic, liste, dialogs, undo compound) ;
  carte d'accès depuis `BudgetPage` ; `committed` affiché sur les cards budget.
  i18n namespace `recurring.*` + `budget.committed`/`budget.recurringAccess.*` +
  `settings.pings.types.recurring_due`.

## Bilan mensuel (lot 3)

- **Modèle `BudgetReport`** : un snapshot **figé** par (foyer, mois `YYYY-MM`),
  `stats` JSON. Les chiffres sont calculés une fois à la clôture du mois et ne
  sont jamais recalculés (l'historique ne bouge pas si un budget/dépense change
  après coup). La prose n'est **pas** stockée : elle est rendue depuis `stats` au
  read-time dans la langue du lecteur.
> **Ce mécanisme est généralisé par le parcours 27** (récap mensuel du foyer) :
> `apps/recap/` élargit l'instantané d'argent en récit multi-modules et **lit** ce
> `BudgetReport` gelé pour son chapitre Argent — il ne resomme jamais les dépenses.
> Le concept est expliqué dans [../fiches/SNAPSHOT_ET_RECIT.md](../fiches/SNAPSHOT_ET_RECIT.md).

- **Sous-package `apps/budget/report/`** (miroir de `agent/digest/`) :
  - `stats.py::compute_month_stats` — total, par-budget vs plafond, hors budget,
    top 5 dépenses, récurrences payées (`metadata.kind='recurring'`), tendance vs
    mois précédent, ligne globale. Réutilise le cast montant du journal.
  - `render.py` — prose **déterministe localisée** via `gettext` (le fallback
    « chiffres bruts »).
  - `polish.py::polish_report` — réécriture LLM optionnelle
    (`BUDGET_REPORT_AI_POLISH_ENABLED`, fallback `None` → déterministe), miroir
    exact de `digest.polish`.
  - `service.py` — `get_or_generate_report` (idempotent, fige le snapshot),
    `render_report` (déterministe + polish **mémoïsé par langue** dans
    `stats['_polished'][lang]` → au plus 1 appel LLM par mois+langue),
    `last_closed_month`.
  - `ping.py` — `build_monthly_report_message` : le 1er du mois, assure le rapport
    du mois écoulé et le pousse ; `None` sinon / si mois vide.
- **API** (`/api/budget/reports/`, read-only) : `list` (historique, texte
  déterministe), `latest` (lazy-génère le dernier mois clos + narration IA),
  `retrieve` par mois (`/2026-06/`). Texte rendu dans la langue de la requête.
- **Ping** : `PingSpec('monthly_budget_report')` (le digest est quotidien ; ici
  mensuel, la cadence est portée par le `build_message` qui ne renvoie qu'au 1er).
- **Frontend** : sous-page `/app/money/reports` (`ReportsPage` : dernier bilan +
  historique) + carte d'accès depuis `BudgetPage`. i18n namespace `report.*` +
  `settings.pings.types.monthly_budget_report`.
- **Réglage** : `BUDGET_REPORT_AI_POLISH_ENABLED` (défaut `False`).

## Le budget **est** la catégorie — et le plafond est optionnel

`Interaction.budget` est le **seul axe qui classe un euro**. Projet, zone et
source disent *sur quoi* / *où* / *depuis quoi*, jamais « bouffe ou bricolage ».
Et le contrôle de conformité réclame un budget sur chaque dépense de la fenêtre
(`expense_without_budget`).

Conséquence longtemps subie : pour obtenir une catégorie, il fallait **inventer
un plafond**. « Cadeaux », « Santé », « Vacances » se retrouvaient avec des
montants fictifs — et un panneau de plafonds inventés rend *toutes* les barres
illisibles, y compris les vraies.

D'où : **`monthly_amount` est nullable**. `NULL` = « catégorie suivie, non
plafonnée ».

- L'état `uncapped` est **un état à part**, jamais `ok` : une catégorie sans
  plafond ne peut être ni respectée ni dépassée, et une barre verte à 0 % sur
  quelque chose qui n'a pas d'échelle est un mensonge. Même raisonnement que la
  fenêtre de conformité — « rien à signaler » et « rien à mesurer » ne sont pas
  le même zéro.
- Le payload renvoie `"amount": null`, **jamais `"0.00"`** : une fois
  sérialisés, un plafond absent et un plafond à zéro se ressemblent, et le second
  est perpétuellement dépassé.
- Une catégorie sans plafond **n'entre pas** dans `named_total_amount` : elle ne
  promet rien, elle ne peut donc pas faire déborder le plafond global sur le
  papier.
- **Le budget global garde son montant obligatoire** : plafonner est son unique
  raison d'être ; sans montant il trônerait en tête du panneau sans rien dire.
  Refus explicite (400) à la création comme à l'édition.
- Un plafond à **zéro reste refusé** (`min_value=0.01`) : ce n'est pas « pas de
  plafond », c'est un plafond infranchissable.
- Le bilan mensuel écrit « Cadeaux : 180 € » au lieu de « 180 € / 0 € —
  dépassé ». ⚠️ Les snapshots **déjà figés** portent une string : `render.py`
  doit accepter les deux formes pour toujours.

## Les catégories de budget — un type à part, jamais un budget

`BudgetCategory` est un **modèle distinct** ; `Budget.category` (`SET_NULL`) range
« Bricolage » et « Énergie » sous « Maison ». La thèse tient en une phrase :

> **Une catégorie n'est pas un budget.** Aucune dépense ne peut s'y ranger, parce
> que `Interaction.budget` pointe vers un `Budget` et qu'une catégorie n'en est
> pas un.

C'est structurel, pas une règle à faire respecter — et c'est ce qui laisse les
neuf agrégations de montants intactes : `spent` garde exactement un sens, et les
**bilans mensuels déjà figés**, qui ignorent la notion de catégorie, restent
lisibles pour toujours.

- **Ce qu'une catégorie affiche est un total, calculé une fois côté serveur**
  (`_category_row`), resommé depuis les lignes de budget déjà calculées et jamais
  d'une seconde requête : « dépensé » y a la même définition que dans le panneau,
  l'analyse et le Contrôle. Le front ne recalcule rien.
- **Le plafond d'une catégorie est optionnel et il *remplace* la somme de ses
  budgets**, il ne s'y ajoute pas. Sans plafond propre, elle vaut cette somme ;
  et `null` quand aucun de ses budgets n'en a — un sous-total de rien n'est pas un
  plafond de 0 €. `has_own_amount` dit lequel des deux est affiché, pour ne pas
  laisser croire qu'un chiffre a été saisi quelque part.
- ⚠️ **`named_total_amount` somme les catégories + les budgets sans catégorie.**
  Compter « Maison 500 € » *et* ses « Bricolage 200 € / Énergie 250 € » compterait
  deux fois le même engagement et crierait « les enveloppes dépassent le plafond
  global » à un foyer parfaitement cohérent. Régression :
  `budget/tests/test_categories.py::TestTheGlobalCeilingIsNotCountedTwice`.
- Supprimer une catégorie **libère** ses budgets (`SET_NULL`) : un intitulé qui
  disparaît ne doit jamais emporter les enveloppes qui portent l'argent.
- Côté front, `budget/tree.ts` reste le **point unique** : `selectableBudgets`
  (tous les budgets nommés, libellés « Maison › Bricolage ») et `categoryOptions`.
  Sept sélecteurs filtraient les budgets à la main — sept endroits à corriger à
  chaque règle nouvelle, donc sept occasions d'en oublier un.

### Pourquoi pas `Budget.parent` — la leçon de la PR #432

La première version faisait d'un budget un groupe **par effet de bord** : il en
devenait un en recevant des enfants (`Budget.parent`, FK sur soi). Elle a été
livrée **morte** et remplacée le lendemain. Ce qu'il faut en retenir :

- **Un type avec un mode se paie partout.** Il a fallu quatre règles de
  validation, un `is_group` dérivé (`children.exists()` à chaque écriture de
  dépense), une contrainte « deux niveaux », un refus pour les parents portant
  déjà des dépenses, et un filtrage dans six sélecteurs — le tout pour
  rétablir une séparation que deux modèles donnent gratuitement. Ici : zéro
  règle de forme, parce qu'il n'y a rien à séparer.
- **Ranger une enveloppe ne doit rien lui retirer.** Dans l'ancien design, un
  budget qui recevait des enfants cessait en silence d'être une cible de dépense,
  et un budget portant déjà des dépenses ne pouvait pas être groupé du tout — les
  deux cas les plus naturels étaient les deux cas interdits. Régressions :
  `test_categories.py::TestACategoryIsNotABudget`.
- **⚠️ Le vrai défaut était ailleurs, et il est le plus instructif : le champ
  n'était jamais enregistré.** `create_budget` a une signature en **allowlist**,
  la vue recopiait trois clés à la main, et `update_budget` filtrait sur
  `{"name", "monthly_amount", "is_global"}`. Le sérialiseur validait le groupe, le
  panneau le proposait, l'API répondait 200 — et le choix était jeté en silence,
  à la création comme à l'édition. Les seize tests étaient verts parce qu'ils
  construisaient tous leurs parents par `Budget.objects.create(parent=…)`.
  **Un test qui écrit par l'ORM ne teste pas le chemin d'écriture** ; c'est ce que
  couvre `test_categories.py::TestTheChoiceIsActuallySaved`, qui passe par l'API
  et relit en base.
- La colonne `budgets.parent_id` survit **un déploiement** (voir la règle
  « on migre avant de basculer » de `CLAUDE.md`) : plus rien ne la lit, la
  migration `budget.0007` a converti les groupes existants en catégories, et sa
  suppression est une livraison à part.

## Ce que le relevé atteste, et ce qui attend de l'être

Chaque ligne de l'aperçu porte `spent_attested` et `spent_pending` **en plus** de
`spent` (idem `total_attested` / `total_pending` au niveau du foyer) : la part de
la dépense qu'une ligne de relevé justifie, et le reste. Sans eux, « 340 € / 400 € »
mélange sans le dire une dépense prouvée et une dépense seulement affirmée.

- **`spent` ne change pas** : c'est lui que le plafond mesure, et sept agrégations
  le lisent. La distinction est **additive**, comme le bloc `bank` du bilan.
- **Pas de filtre `bank_transaction__isnull=False`.** Une dépense saisie hier est
  réelle même si le relevé de fin de mois n'est pas importé ; ne compter que le
  prouvé ferait *reculer* le compteur au fil du mois pour remonter d'un coup à
  l'import. Un plafond qui recule est pire qu'un plafond incertain.
- **`spent_pending` est calculé par différence.** Deux sommes indépendantes
  divergeraient d'un centime d'arrondi, et un total qui ne se recompose pas ne se
  lit pas. L'invariant `attested + pending == spent` est testé.
- **Un seul `GROUP BY`** (`Sum(filter=Q(…))` conditionnel) : l'aperçu est rechargé
  à chaque visite de l'onglet, et une requête par chiffre est la façon dont un
  panneau devient lent une addition honnête à la fois.
- La barre le montre en **deux nuances de la même couleur** — une autre teinte
  laisserait croire à une autre nature de dépense — et sa longueur totale reste
  celle de `spent`.

Régression : `budget/tests/test_api_budget.py::TestWhatTheStatementAttests`.

## Ouvrir un budget sur ses dépenses

`/app/money/budgets/:id` (`features/money/BudgetDetailPage`). Le panneau affiche
« 340 € / 400 € » ; la question suivante est toujours *lesquelles*. Jusqu'ici il
fallait partir dans l'onglet Dépenses et refaire le filtre à la main, sans
garantie de retomber sur le même chiffre.

- La période par défaut est **le mois en cours**, celle du panneau : le total de
  la page est celui sur lequel on vient de cliquer. Changer de période est
  ensuite explicite.
- **Le plafond ne s'affiche que sur le mois en cours.** Le comparer à un total
  annuel donnerait « 4 200 € / 400 € » — un dépassement qui n'existe pas.
- **« Hors budget » s'ouvre comme une enveloppe** (`/app/money/budgets/none`) :
  c'est le seau où l'on cherche le plus souvent ce qu'il y a dedans. D'où le
  paramètre `budget=none` sur la liste **et** sur le résumé : dans une query
  string, l'absence de filtre et « aucun budget » sont deux demandes
  différentes.
- Le lien porte le **corps** de la carte, pas la carte entière : le dropdown
  d'actions est un enfant, et l'imbriquer dans un `<a>` en ferait un
  déclencheur de navigation.

⚠️ **Une date de fin nue veut dire « fin de cette journée ».** Le filtre est un
`__lte` : lue à minuit, `to=2026-07-31` excluait toutes les dépenses du 31 — le
dernier jour de chaque période disparaissait des totaux **et** de la liste, en
silence. Corrigé dans `_parse_period` et dans le filtre `end_date`, avec un test
de régression (`TestTheLastDayOfThePeriodCounts`). Un instant explicite
(`...T12:00:00Z`) reste respecté tel quel.

## Analyse fine — la lecture longue (`analysis.py`)

`GET /api/budget/budgets/analysis/?months=12&budget=<id>` →
`{months, series, breakdown, suppliers, biggest, total, monthly_average}`.
Front : `/app/money/analysis` (`features/money/AnalysisPage`), accessible depuis
le panneau Budgets.

**Pourquoi une page à part.** Le panneau Budgets ne sait poser qu'une question :
« ce mois-ci tient-il dans l'enveloppe ». Une catégorie qui dérive de 15 % par
mois y reste donc invisible jusqu'au jour où elle franchit son plafond — et une
catégorie **sans plafond** n'y produit aucun signal du tout. C'est exactement le
trou qu'ouvre le plafond optionnel, et cette page le referme.

Ce que le module refuse de faire, et qui vaut d'être retenu :

- **Quatre requêtes groupées**, quelle que soit la fenêtre. Jamais une par mois :
  c'est la première chose qui dégénère sur deux ans d'historique. Le test
  `TestItStaysCheap` borne le compte.
- **Pas de part sur un total nul.** `breakdown` est vide plutôt que rempli de
  `0 %` — sans dépense il n'y a pas de répartition, pas une répartition nulle.
- **La moyenne compte les mois vides.** Les écarter la gonflerait d'un facteur
  arbitraire ; un mois à zéro est une information.
- **Un budget qui n'a rien dépensé n'entre pas dans la légende.** Douze entrées
  mortes cacheraient l'information qu'aucune n'a servi — ce que le panneau
  Budgets dit déjà.
- **Le libellé « hors budget » n'est pas produit ici** : le backend renvoie
  `budget_id: null`, le front le nomme. Ajouter une langue ne doit pas imposer un
  passage par les `.po`.
- **`months` est borné** (36) et un `budget` inconnu du foyer est un **400** —
  le filtre s'applique après le scope, il ne peut jamais l'élargir. Un UUID
  malformé aussi : il crashe le driver avant d'être une requête.
- **On lit les `Interaction`, jamais les totaux bancaires.** Règle transverse du
  CLAUDE.md : le pont entre les deux mondes est le taux de couverture.

Côté rendu : `ConsumptionBarChart` est **réutilisé** (même librairie, mêmes
tokens de couleur, même infobulle que l'électricité), avec une prop
`formatValue` ajoutée pour que les montants passent par `formatAmount` au lieu
d'un `${value} €` recollé. Le classement fournisseurs est en CSS pur — huit
`div` dont la largeur est une règle de trois ne valent pas un axe recharts.

## Décisions clés

- **Budgets multiples nommés = la dimension de regroupement** (pas de taxonomie
  de catégories séparée) — et depuis que le plafond est optionnel, c'est
  assumé : le budget *est* la catégorie (voir ci-dessus). Rattachement d'une
  dépense **optionnel** ; « hors budget » toujours visible.
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
