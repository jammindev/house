# Parcours 08 — Voir et enregistrer ses dépenses depuis n'importe où dans le foyer

> **À démarrer** — la branche `feat/interaction-source-polymorphic` (PR à merger) pose la fondation technique : FK polymorphe sur `Interaction` + service helper `create_expense_interaction` + composant frontend `PurchaseForm` partagé. Le présent parcours capitalise dessus pour livrer la vue dépense + l'extension aux projets + la dépense ad-hoc. Backlog technique : [PARCOURS_08_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_08_BACKLOG_TECHNIQUE.md).

## Résumé

Le huitième usage fondamental du produit :

"Je veux pouvoir enregistrer une dépense depuis n'importe quel contexte (un item de stock, un équipement, un projet, ou rien du tout) et voir ensuite la somme de mes dépenses, agrégée et lisible."

Les sept premiers parcours ont fait du foyer une mémoire structurée et interrogeable. Mais une partie de cette mémoire — les dépenses — reste **dispersée** : aujourd'hui, quand l'utilisateur achète un item de stock ou un équipement, l'interaction `expense` est créée, mais il n'existe aucune vue agrégée qui les rassemble. Et il n'existe pas de moyen d'enregistrer une dépense « libre », sans objet déclencheur.

Ce parcours rend les dépenses **visibles et accessibles** sans toucher à leur représentation : `Interaction(type='expense')` reste le socle unique, on ouvre simplement une nouvelle lecture par-dessus.

## Positionnement produit

- Parcours 01 — Capturer un événement (l'`Interaction` est créée)
- Parcours 04 — Suivre un projet (le projet a `planned_budget` / `actual_cost`)
- Parcours 05 — Naviguer par zone ou équipement (l'historique d'un objet inclut ses dépenses)
- **Parcours 08** — Voir et enregistrer les dépenses **transversalement**

Ce parcours ne crée pas un nouveau modèle de domaine. Il consomme les `Interaction(type='expense')` existantes et ajoute une **surface dédiée** plus deux nouveaux points d'entrée pour la création.

## Concept interne

Aucune nouvelle source de vérité. On capitalise sur :

- `Interaction(type='expense')` — déjà persisté avec `metadata.amount`, `metadata.unit_price`, `metadata.supplier`, `metadata.kind`
- FK polymorphe `(source_content_type, source_object_id)` — déjà ajoutée par la branche `feat/interaction-source-polymorphic` ; permet de relier une dépense à n'importe quel `HouseholdScopedModel` (StockItem, Equipment, Project…)
- Service helper `apps/interactions/services.py::create_expense_interaction(source, user, amount, …)` — déjà livré ; centralise le shape `metadata` et le subject auto-localisé
- Composant frontend partagé `ui/src/features/interactions/PurchaseForm.tsx` — déjà livré ; à wrapper dans un dialog par feature

Ce que ce parcours ajoute :

1. Un endpoint d'agrégation `GET /api/interactions/expenses/summary/` qui retourne des totaux par mois × source (et par mois × supplier).
2. Une page React `/app/expenses/` qui affiche ces totaux et la liste filtrable.
3. Une nouvelle entrée de quick-add dans le module `projects` (parallèle à stock + equipment).
4. Une **fonction de service distincte** `create_manual_expense_interaction(household, user, subject, …)` pour la dépense ad-hoc (sans objet source), avec extraction d'un builder partagé `_build_expense_metadata` pour garantir un shape `metadata` uniforme.

## Concept visible côté utilisateur

- **Entrée nouvelle dans la sidebar** : `Dépenses`, icône `Receipt` (ou `Wallet`)
- **Vue par défaut** : mois courant, total + breakdown par source-type (`stock_purchase`, `equipment_purchase`, `project_purchase`, `manual`) + liste des dépenses
- **Filtres** : période (mois précédent / 30 derniers jours / cette année / personnalisé), supplier, source-type
- **Quick-add depuis n'importe où** : bouton « + Dépense » disponible
  - sur la `StockItemCard` (déjà livré)
  - sur l'`EquipmentCard` (déjà livré)
  - sur le `ProjectCard` (à livrer — lot 1.1)
  - sur la page `Dépenses` elle-même, en mode ad-hoc (à livrer — lot 1.2)

## Objectif produit

Permettre à un membre du foyer de :

1. enregistrer une dépense en moins d'une minute, depuis le contexte où il se trouve (item stock, équipement, projet, ou rien)
2. voir la somme de ses dépenses du mois sans navigation préalable
3. comprendre d'où viennent ces dépenses (par source-type, par supplier, par projet)
4. retrouver une dépense spécifique pour la modifier ou la supprimer (déjà couvert par #118 pour le cas stock)

## Ce que le projet a aujourd'hui

- ✅ `Interaction(type='expense')` avec `metadata.amount/unit_price/supplier/kind`
- ✅ FK polymorphe `source_content_type/source_object_id` (branche `feat/interaction-source-polymorphic`)
- ✅ Service `create_expense_interaction` (idem)
- ✅ Endpoint `POST /api/stock/{id}/purchase/` (#116, #117)
- ✅ Endpoint `POST /api/equipment/{id}/register-purchase/` (idem branche)
- ✅ `StockPurchaseDialog` + `EquipmentPurchaseDialog` qui wrappent `PurchaseForm` partagé (idem)
- ❌ Pas de vue agrégée des dépenses — le parcours 08 commence ici
- ❌ Pas d'endpoint summary
- ❌ Pas de quick-add depuis project ou ad-hoc

## Diagnostic actuel

Les dépenses existent dans la base mais n'ont **aucune lecture transversale**. L'utilisateur peut :

- voir la dépense d'un item de stock dans la liste de ses interactions (filtre `type=expense`)
- la voir sur la card de l'item (#118 prévu)
- la voir sur la fiche d'un équipement (à venir)

… mais il ne peut **pas** voir « combien j'ai dépensé ce mois-ci », ni « qui sont mes top suppliers », ni enregistrer une dépense qui ne se rattache à aucun objet.

C'est cette dispersion que le parcours 08 corrige.

## Problème utilisateur précis

Quand l'utilisateur se demande « combien j'ai dépensé ce mois-ci ? », il doit aujourd'hui :

1. ouvrir `/app/interactions`
2. filtrer sur `type=expense`
3. compter mentalement les `metadata.amount` des dépenses du mois

Avec le parcours 08, il ouvre `/app/expenses` et la réponse est sur la première ligne.

Inversement, quand il vient de payer 32 € au resto, il n'a aujourd'hui **aucun moyen** de l'enregistrer dans le produit (resto ≠ stock ≠ équipement ≠ projet). Il doit créer manuellement une `Interaction(type=expense)` via le formulaire générique `/app/interactions/new`, ce qui est friction maximale.

## Utilisateur cible

Le membre du foyer qui veut suivre ses dépenses domestiques sans tomber dans l'usine à gaz d'un YNAB-like. Cas d'usage solo principal aujourd'hui (cf. `project_solo_user_phase`).

## Scénarios prioritaires

### Scénario A — Vue mensuelle d'entrée

"J'ouvre `/app/expenses`, je vois immédiatement le total du mois, le breakdown par source-type, et les 10 dernières dépenses."

### Scénario B — Quick-add depuis un projet

"Je suis sur la page de mon projet 'Rénovation cuisine', je clique '+ Dépense', je saisis 450 € + supplier 'Leroy Merlin' + date d'aujourd'hui. La dépense apparaît dans la timeline du projet ET dans `/app/expenses`."

### Scénario C — Dépense ad-hoc

"Je viens de payer 32 € au restaurant. J'ouvre `/app/expenses`, je clique '+ Dépense', je tape 'Restaurant Le Bistrot' comme sujet, 32 €, date d'aujourd'hui. La dépense est enregistrée sans rattachement à un objet — `kind='manual'`."

### Scénario D — Comparaison entre suppliers

"Je veux savoir combien j'ai payé Engie cette année vs l'année dernière. Je filtre sur supplier=Engie, période=cette année. Je vois le total. Je change la période, je compare."

## Parcours cible

### Voir ses dépenses

1. L'utilisateur ouvre `/app/expenses` depuis la sidebar.
2. Il voit le total du mois courant + breakdown par source-type + liste paginée.
3. Il peut changer la période, filtrer par supplier, par source-type.

### Enregistrer une dépense depuis un contexte (parcours déjà partiellement livré)

1. Sur une `StockItemCard` / `EquipmentCard` / `ProjectCard`, il clique sur l'action « + Achat » ou « + Dépense ».
2. Le dialog `<Source>PurchaseDialog` s'ouvre avec `PurchaseForm` pré-rempli du contexte.
3. Il saisit montant + supplier + date + notes, valide.
4. L'interaction est créée, liée au source via la FK polymorphe.

### Enregistrer une dépense ad-hoc

1. Sur `/app/expenses`, il clique « + Dépense ».
2. Le dialog `ExpenseAdHocDialog` s'ouvre avec un champ libre `subject` (au lieu d'un nom dérivé).
3. Il saisit subject + montant + supplier + date + notes, valide.
4. L'interaction est créée avec `source=None`, `kind='manual'`.

## Règles produit

### Règle 1 — Pas de catégorisation pré-décidée

`metadata.nature`, taxonomie investment/consumption, modèle `ExpenseCategory` : tous **hors scope V1**. Cf. issue #120 — décision prise délibérément pour ne pas pré-engager une taxonomie qui sera fausse. La vue dépense V1 fournit volontairement un axe de groupement grossier (par `metadata.kind` = source app_label) ; on raffinera quand 20-30 dépenses réelles auront été enregistrées et qu'on aura le signal.

### Règle 2 — Une dépense reste une `Interaction`

Pas de modèle `Expense` dédié. Tous les bénéfices (RAG agent, tags, documents liés, contacts, structures, zones, M2M déjà branché) restent disponibles. La vue dépense est une **lecture** par-dessus.

### Règle 3 — Le `subject` reste la vérité user-facing

Pour une dépense source-bound, `subject` est auto-localisé via gettext (CLAUDE.md "Auto-création d'`Interaction`"). Pour une dépense ad-hoc, `subject` est saisi par l'user. Dans les deux cas, le `subject` est ce qui s'affiche partout — pas de re-localisation côté front.

### Règle 4 — Cohérence du shape `metadata`

`_build_expense_metadata` (extrait au moment où on écrit la 2e fonction de création — pas avant) garantit qu'une dépense source-bound et une dépense ad-hoc partagent la même forme `metadata`. Le jour où on ajoute `currency` ou `tax_amount`, on touche **un seul endroit**.

### Règle 5 — Le quick-add respecte l'arborescence des features

Pas de bouton flottant global FAB en V1 (à arbitrer plus tard, cf. #118 pour le cas stock). Le quick-add est sur la page de l'objet source (`StockItemCard`, `EquipmentCard`, `ProjectCard`) ou sur `/app/expenses` pour le mode ad-hoc.

### Règle 6 — Le scope household est enforced à tous les niveaux

L'endpoint summary scope par household (jamais d'export multi-foyer). La vue affiche uniquement les dépenses du household courant.

## Backlog produit V1

| Lot | But | Issues |
|---|---|---|
| 1.0 | Vue dépense agrégée + endpoint summary | #122 |
| 1.1 | Quick-add depuis Project (parallèle à stock + equipment) | #123 |
| 1.2 | Dépense ad-hoc (sans source) | #124 |

Détails par lot dans le [backlog technique](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_08_BACKLOG_TECHNIQUE.md).

### Story 1.0 — Vue dépense agrégée

En tant que membre du foyer,
je veux ouvrir une page qui me montre mes dépenses du mois et un breakdown par source-type,
afin de répondre à « combien j'ai dépensé » sans fouiller.

#### Critères d'acceptation

- Page React `/app/expenses/` accessible depuis la sidebar (icône `Receipt` ou équivalent).
- Vue par défaut = mois courant : total + breakdown par `metadata.kind` (= source app) + liste des dépenses du mois.
- Filtres : période (mois courant, mois précédent, 30 derniers jours, cette année, personnalisé), supplier (autocomplete), source-type.
- Endpoint backend `GET /api/interactions/expenses/summary/?from=&to=` qui retourne `{total, by_kind, by_supplier, by_month, count}`.
- Liste paginée des dépenses du filtre courant (réutilise l'endpoint `/api/interactions/?type=expense&...`).
- i18n complet en/fr/de/es (namespace `expenses`).
- Tests pytest pour l'endpoint summary (totaux, scope household, dates).
- Tests E2E Playwright golden path (navigation + filtre + breakdown).

### Story 1.1 — Quick-add depuis un projet

En tant que membre du foyer travaillant sur un projet de rénovation,
je veux pouvoir enregistrer une dépense liée au projet directement depuis sa fiche,
afin de ne pas perdre le fil et garder le `actual_cost` à jour automatiquement.

#### Critères d'acceptation

- Bouton « + Dépense » sur la `ProjectCard` et la page détail du projet.
- Dialog `ProjectPurchaseDialog` qui wrappe `PurchaseForm` (sans `withDelta`).
- Endpoint `POST /api/projects/{id}/register-purchase/` parallèle à `equipment/register-purchase`.
- Crée une `Interaction(type=expense)` via `create_expense_interaction(source=project, kind='project_purchase', …)`.
- Met à jour `Project.actual_cost = actual_cost + amount` en transaction (snapshot best-effort, comme l'`Equipment.purchase_price`).
- Nouvelle entrée dans `AUTO_SUBJECT_TEMPLATES`: `"project_purchase": _("Purchase — {name}")` (template réutilisable, déjà traduit).
- Tests pytest pour l'endpoint (succès, isolation tenant, scope household, snapshot `actual_cost`).
- Tests E2E Playwright miroir de `equipment-purchase.spec.ts`.

### Story 1.2 — Dépense ad-hoc

En tant que membre du foyer,
je veux pouvoir enregistrer une dépense « libre » qui ne se rattache à aucun objet du foyer (resto, cinéma, cadeau…),
afin que le total mensuel reflète mes vraies dépenses, pas seulement celles des modules.

#### Critères d'acceptation

- Bouton « + Dépense » sur `/app/expenses`.
- Dialog `ExpenseAdHocDialog` avec un champ `subject` libre (saisi par l'user, pas de template gettext) + `PurchaseForm` (sans `withDelta`).
- Service `create_manual_expense_interaction(*, household, user, subject, amount, supplier, occurred_at, notes, extra_metadata=None)` — fonction **distincte** de `create_expense_interaction`, qui partage uniquement `_build_expense_metadata` (extrait au moment d'écrire cette 2e fonction).
- Endpoint `POST /api/interactions/expenses/manual/` qui consomme le service.
- `metadata.kind = "manual"`, `metadata.source_name = None`.
- Pas de FK polymorphe (`source_content_type=None`, `source_object_id=None`).
- L'utilisateur peut éditer le `subject` après-coup via la page d'édition d'interaction existante.
- Tests pytest service + endpoint.
- Tests E2E Playwright golden path ad-hoc.

## Hors scope V1

- **Catégorisation** — `metadata.nature`, modèle `ExpenseCategory`, tags budgétaires : tout est en attente de signal (cf. #120). Le parcours 08 V1 livre **avant** d'avoir des données réelles, justement pour générer ce signal.
- **Module Budget** — pas de modèle `Budget`, pas de comparaison budget vs réel, pas d'alerte de seuil. À traiter dans un parcours 09 dédié quand la taxonomie sera tranchée.
- **Édition / suppression d'une dépense** depuis la vue Dépenses — déjà adressé pour le cas stock dans #118 ; à généraliser au cas equipment/project plus tard.
- **Export CSV** — utile mais non bloquant pour l'usage solo.
- **Receipt OCR** (upload d'un ticket de caisse → extraction du montant) — naturellement chez le parcours 02 (compréhension assistée de documents) une fois la couche IA ouverte.
- **Récurrence** (« cet abonnement Engie de 142 € se répète chaque mois ») — sujet à part, pas avant qu'on ait observé l'usage.
- **FAB global « + Dépense »** depuis le dashboard — sera tranché si l'usage le réclame ; aligné avec la décision prise pour stock dans #118.
- **Multi-currency** — `metadata.currency` existe potentiellement déjà mais n'est pas consommé ; à activer le jour où l'utilisateur en a besoin.
- **Réconciliation bancaire** — entrée import CSV bancaire, matching automatique : sujet de niveau supérieur, hors V1.

## Définition de done — V1

1. La page `/app/expenses/` affiche le total du mois courant + breakdown par source-type sans fouille.
2. L'endpoint `GET /api/interactions/expenses/summary/` retourne des totaux cohérents et scopés household.
3. Une dépense peut être enregistrée depuis StockItem, Equipment, Project, ou en mode ad-hoc — toutes via le shape `metadata` uniforme garanti par `_build_expense_metadata`.
4. La sidebar a une entrée `Dépenses` (i18n complet en/fr/de/es).
5. Les tests pytest et E2E essentiels passent (endpoint summary, register-purchase project, dépense ad-hoc).

## Recette manuelle (à pratiquer pendant 2-4 semaines après livraison)

1. Enregistrer 20-30 dépenses réelles via les 4 entrées (stock, equipment, project, ad-hoc).
2. Observer ce qui manque concrètement :
   - faut-il une catégorisation explicite ? (déclencheur de #120)
   - faut-il une vue par projet, par zone, par supplier ?
   - le mode ad-hoc est-il vraiment utilisé ou est-ce que toutes les dépenses se rattachent à un objet ?
   - le breakdown `by_kind` est-il signifiant ou trop grossier ?
3. Sur la base de ces observations, ouvrir des issues ciblées plutôt que de spéculer sur les fonctionnalités V2.
