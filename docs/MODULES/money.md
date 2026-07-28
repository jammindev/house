# Module — money (la coque « Argent »)

> Rôle : réunir **comptes, dépenses et budgets** dans un seul module à onglets, et
> mettre devant eux les deux écrans qui manquaient — **Contrôle** et **À ranger**.
>
> Parcours : `docs/parcours/PARCOURS_26_CONFORMITE_ARGENT.md` (lot 2).
> Backend consommé : [banking.md](./banking.md) (conformité), [budget.md](./budget.md),
> [interactions.md](./interactions.md).

## Pourquoi un seul module

Comptes, dépenses et budgets étaient trois entrées de sidebar. Ce sont **trois
lectures d'un même fait** : ce qui est sorti du compte. Les séparer obligeait
l'utilisateur à faire lui-même le lien — et rendait invisible la question qui
compte avant toutes les autres :

> « Qu'est-ce qu'il me reste à faire pour que mes chiffres soient justes ? »

D'où l'ordre des onglets : **Contrôle**, **À ranger**, puis Comptes, Dépenses,
Budgets. La conformité passe devant le reporting.

## Structure

```
ui/src/features/money/
  MoneyPage.tsx        # la coque : TabShell + badges
  keys.ts              # query keys + clés de détecteurs (sans dépendance sortante)
  hooks.ts             # conformité : summary, groupe, arbitrer, révoquer
  CompliancePanel.tsx  # onglet Contrôle
  PendingQueue.tsx     # onglet À ranger
  PendingCard.tsx      # une opération à ranger
  WaiverDialog.tsx     # arbitrer (motif requis)
  AccountsPanel.tsx    # ex-banking/BankingPage
  ExpensesPanel.tsx    # ex-expenses/ExpensesPage
  BudgetsPanel.tsx     # ex-budget/BudgetPage
  AnalysisPage.tsx     # sous-page : analyse fine des dépenses par budget
  BudgetDetailPage.tsx # sous-page : de quoi un budget est fait
  BudgetShareChart.tsx # anneau de répartition + légende chiffrée
```

Les trois panneaux sont les anciennes pages, **`PageHeader` en moins** : la coque
porte le titre. Leur contenu n'a pas changé, et leurs actions restent dans le
panneau — elles connaissent l'état d'édition local (compte courant, import en
cours) qu'il aurait fallu remonter sans raison.

## Décisions de conception

### `keys.ts` séparé de `hooks.ts`

`banking/hooks.ts` doit invalider la conformité après une ventilation, et
`money/hooks.ts` importe déjà `bankingKeys`. Un import direct créerait un cycle.
Un module de clés **sans dépendance sortante** le casse, sans dupliquer la chaîne
`'compliance'` dans deux fichiers où elle finirait par diverger d'un caractère.

### Les pastilles de budget ne s'affichent pas sur une ligne partielle

L'enregistrement d'une ventilation est un **remplacement complet** (`PUT`, un
« set »). Imputer d'un clic une ligne déjà partagée écraserait donc le travail
déjà fait. Sur une ligne partielle, le seul chemin est le dialog, qui part de
l'existant — et la sélection multiple ne propose que des lignes entièrement non
ventilées, pour la même raison.

### « Plus tard » n'écrit rien

Quatre issues sur une carte, et aucune cinquième qui ferait disparaître la ligne :
une pastille, un découpage, un arbitrage motivé, ou un report. Le report est
volontairement **local à la session** — la ligne n'est pas résolue, elle revient.

### Un groupe à zéro reste visible

Coché, pas masqué. C'est ce qui distingue « contrôlé et conforme » de « pas encore
contrôlé » ; une liste vide serait indistinguable d'un détecteur en panne.

### Les prérequis bloquants passent en tête

Un compte sans solde d'ouverture n'a pas de fenêtre de conformité : ses dépendants
ne sont pas « conformes », ils ne sont **pas évaluables**. Le panneau les trie par
sévérité (`blocker` d'abord) et affiche `blocked_by` pour expliquer pourquoi un
contrôle ne porte peut-être pas sur tout.

### `AllocationDialog` prend un id, plus un objet

Le dialog charge déjà la ventilation courante, qui embarque la ligne. Passer
l'objet en plus obligeait chaque appelant à le détenir — or la file de rangement ne
connaît que des **écarts**, identifiés par un id.

## La fusion des clés de module — ce qu'elle a impliqué

`banking` était **optionnel**, `expenses` et `budget` étaient **core**. La clé
fusionnée `money` doit être core : un foyer ne peut pas désactiver `money` sans
perdre dépenses et budgets, qui n'ont jamais été désactivables.

**Conséquence assumée : les comptes bancaires ne sont plus un opt-in.** C'est
cohérent avec « les relevés sont la source de vérité », mais c'est une décision
produit, pas un effet de bord.

Deux data migrations, parce qu'une configuration stockée qui ne correspond plus à
rien est un orphelin :

- `households.0011` retire `'banking'` des `disabled_modules` existants ;
- `accounts.0014` replie `banking`/`expenses`/`budget` en `money` dans les
  `pinned_modules`, **en préservant la position** du premier des trois — un
  utilisateur qui avait « Dépenses » en tête retrouve « Argent » en tête.

## Navigation

| Ancienne URL | Devient | Onglet |
|---|---|---|
| `/app/banking` | `/app/money?tab=accounts` | Comptes |
| `/app/expenses` | `/app/money?tab=expenses` | Dépenses |
| `/app/budget` | `/app/money?tab=budgets` | Budgets |
| `/app/banking/transactions` | `/app/money/transactions` | *(sous-page)* |

`LegacyMoneyRedirect` (`ui/src/components/`) **préserve la query string** :
l'agent produit `/app/budget?b={id}`
(`apps/budget/apps.py::SearchableSpec.url_template`) et un favori peut porter
n'importe quel paramètre. Les `url_template` de l'agent ont aussi été mis à jour,
pour que les nouveaux liens soient directs plutôt que redirigés.

Le deep link `?tab=` est écrit dans la session **avant** que `TabShell` lise sa
valeur initiale — l'initialiseur d'état du parent s'exécute avant le montage de
l'enfant, ce qui rend le mécanisme fiable plutôt que fragile.

Sous-pages autonomes (avec `BackLink`) : `/app/money/transactions`,
`/app/money/transactions/:id`, `/app/money/analysis`, `/app/money/budgets/:id`,
`/app/money/recurring`, `/app/money/reports`.

Les deux dernières ont rejoint la famille en juillet 2026 ; `/app/budget/recurring`
et `/app/budget/reports` redirigent via `PreserveQueryRedirect`, qui conserve la
query string pour la même raison que `LegacyMoneyRedirect`. Un test tient la
règle côté serveur : `agent/tests/test_registry.py::test_the_money_family_links_stay_inside_the_money_module`
refuse tout `url_template` de la famille argent qui ne commence pas par
`/app/money` — une redirection rattrape un ancien lien, elle ne justifie pas d'en
produire de nouveaux.

`/app/money/analysis` est la **lecture longue** des dépenses (tendance mensuelle
par budget, répartition, fournisseurs, plus grosses dépenses) — le panneau
Budgets ne regarde que le mois en cours. Détail du calcul et de ce qu'il refuse
d'inventer : `docs/MODULES/budget.md`, section « Analyse fine ».

## i18n

Namespace **`money`** (coque, contrôle, file). Le libellé utilisateur de chaque
détecteur vit sous `money.compliance.kinds.<kind>.{title,hint,resolution}` — côté
front, pas en `gettext` backend : ajouter un détecteur ne doit pas imposer un
passage dans quatre `.po`.

Les namespaces `banking`, `expenses`, `budget` restent et leur contenu est réutilisé
tel quel par les panneaux.

⚠️ `expenses.adhoc.actions.add` est passé de « Dépense » à « **Nouvelle dépense** » :
dans la coque, le bouton et l'onglet « Dépenses » avaient des noms accessibles
confusables, ce qui est un problème d'ergonomie avant d'être un problème de test.

## Tests

`e2e/money.spec.ts` couvre ce que la fusion pouvait casser en silence : la coque,
les quatre redirections (dont la préservation de la query string), le deep link,
la sidebar, le panneau Contrôle, et l'identité `ouverts + arbitrés = détectés`
vérifiée directement sur l'API.

Les specs `budget`, `report`, `recurring`, `expense-adhoc`, `expenses-summary` ont
été retargetées sur les nouvelles URLs.

## L'audit de cohérence (juillet 2026)

Un passage complet sur les trois apps (`banking`, `budget`, `interactions`) et les
quatre features front. L'architecture tenait ; les défauts étaient tous **aux
jointures** — là où deux modules répondent à la même question sans passer par la
même fonction. Les conclusions valent au-delà de l'argent.

### Un compteur ne peut pas avoir deux définitions

« Ce mois-ci » était borné dans le fuseau du foyer par `budget.aggregations` et en
UTC par `interactions.views`. Deux heures d'écart — mais placées exactement sur la
frontière d'un mois, donc sur un budget. Cliquer sur « 340 € / 400 € » pouvait
ouvrir une page annonçant 352 €.

`apps/core/timezones.py` est désormais le seul endroit qui sait ce qu'est un mois,
une journée, ou « aujourd'hui » chez un foyer. Six copies locales du helper de
fuseau (dont deux correctes, quatre approximatives) sont devenues des alias.
Côté front, `toLocalISODate` / `todayISO` remplacent les
`toISOString().slice(0, 10)` — qui décalaient les quatre périodes d'un jour aux
deux bouts et proposaient « hier » comme date du jour entre minuit et 2 h.

Régressions : `interactions/tests/test_period_bounds.py`,
`ui/src/features/expenses/period.test.ts`.

### Un cache périmé est un compteur qui ment

Huit mutations touchent à l'argent, chacune déclarait sa propre liste
d'invalidations, et cinq en oubliaient au moins une. La pire : **importer un
relevé** n'invalidait que `banking`, alors que c'est le moment où les compteurs de
conformité passent de zéro à cent.

`useInvalidateMoney` remplace les huit listes. Invalider trop large coûte quelques
requêtes ; invalider trop étroit coûte la confiance dans les chiffres — et le bug
est invisible en revue, parce que chaque liste prise isolément a l'air réfléchie.

### La parité entre catalogues ne voit pas une clé écrasée

Le dialogue « dépense en espèces » (lot 4) a réutilisé le namespace
`banking.cash.*` et effacé les douze clés du dialogue « retirer vers les espèces ».
En production, le journal affichait `banking.cash.action` sur chaque ligne
sortante, et le dialogue de retrait portait le titre du dialogue de dépense.

Le contrôle de parité entre les quatre langues était vert : la clé manquait
**partout**. Comparer les langues entre elles ne suffit pas — il faut comparer le
**code** au catalogue. C'est ce que fait `ui/src/locales/keys.test.ts`, désormais
lancé par la CI (les tests unitaires du front n'étaient exécutés par personne).

Le retrait vit maintenant sous `banking.withdraw.*`.

### Le journal a un filtre « À traiter »

Le marqueur par ligne (#413) disait ce qu'il restait à ranger sans qu'on puisse
s'y rendre. `?allocation=todo` passe par `detectors.pending_outflows`, la même
fonction que les compteurs du Contrôle : une file dont le nombre contredirait le
badge ferait perdre leur crédit aux deux.

### Détacher est un geste, plus un effet de bord

L'endpoint `DELETE /transactions/{id}/unlink/{interaction_id}/` n'avait aucun
appelant. En cherchant où le brancher, on a trouvé pourquoi il était inutile : le
service le faisait déjà **tout seul**, au mauvais moment.

`set_allocations` détachait tout ce qu'il ne possède pas. Concrètement : 150 € chez
Leroy Merlin, dont 90 € déjà saisis comme achat de projet et rapprochés à la main ;
éditer les 60 € restants dé-rapprochait les 90 €. L'écart « dépense non rapprochée »
resurgissait sur une dépense que l'utilisateur avait résolue, et comme l'éditeur
chargeait *toutes* les ventilations dans son brouillon, enregistrer recréait une
dépense `kind='bank'` pour les mêmes 90 € — 180 € de dépenses sur 150 € d'argent,
et le chantier facturé deux fois pour le même carrelage.

Trois conséquences, symétriques de la règle de propriété du lot 3 :

- **la portée de l'éditeur s'arrête à ce qu'il a créé.** Il supprime ses lignes
  `kind='bank'`, et ne touche à rien d'autre — ni suppression, ni détachement ;
- **le montant rattaché est un plancher.** `set_allocations` le compte contre
  l'`outflow`, donc renvoyer la ligne rattachée dans le payload est un **400** au
  lieu d'un doublement silencieux ;
- **le geste existe** : le bloc « Dépenses déjà rattachées » de l'`AllocationDialog`
  les affiche en lecture seule avec un bouton « Détacher », qui appelle l'endpoint.

Régression : `banking/tests/test_allocation_axes.py::TestSavingASplitNeverUndoesAReconciliation`.

### « 340 € / 400 € » : deux chiffres, jamais un filtre

Une dépense jamais rapprochée gonfle une enveloppe sans qu'aucune ligne de relevé
ne l'atteste. Chaque ligne de l'aperçu porte donc `spent_attested` et
`spent_pending` **en plus** de `spent`, calculés en un seul `GROUP BY` (un
`Sum(filter=…)` conditionnel — l'aperçu est rechargé à chaque visite de l'onglet).

Ce qui n'a **pas** été fait, et pourquoi : filtrer `bank_transaction__isnull=False`
pour ne compter que le prouvé. Une dépense saisie hier est réelle même si le relevé
de fin de mois n'est pas importé ; le compteur reculerait au fil du mois pour
remonter d'un coup à l'import. **Un plafond qui recule est pire qu'un plafond
incertain.** Le plafond mesure donc toujours le total, et la barre dit la
différence en deux nuances de la même couleur — une autre teinte laisserait croire
à une autre nature de dépense.

`spent_pending` est calculé **par différence**, jamais par une seconde somme : deux
agrégats indépendants finissent par se contredire d'un centime d'arrondi, et un
total qui ne se recompose pas ne se lit pas. Régression :
`budget/tests/test_api_budget.py::TestWhatTheStatementAttests`.

### Une dépense dit si le relevé la justifie — et laquelle

Le marqueur du journal bancaire répondait « où en est cette **ligne** ». Il
manquait la même question depuis l'autre rive : « cette **dépense**, la banque
l'a-t-elle vue passer ? ». C'est `reconciliation_state`, servi par
`InteractionSerializer`, rendu par `ui/src/features/money/ReconciliationBadge.tsx`,
et posé partout où une dépense s'affiche — onglet Dépenses, journal des
interactions, détail d'une interaction, onglet Dépenses d'un projet.

Cinq états, miroir exact de `AllocationProgress` : `''` (pas une dépense),
`attested`, `cash`, `pending`, `out_of_scope`.

- **Le verdict est calculé côté serveur** (`banking.queries.reconciliation_state`),
  jamais dérivé de `bank_transaction === null` côté client. C'est la même règle que
  le marqueur bancaire, et pour la même raison : il dépend de la fenêtre de
  conformité. La première version du badge (lot 7 du parcours 26) lisait la FK et
  affichait « en attente de rapprochement » **en rouge** sur des dépenses
  antérieures au premier relevé — que le Contrôle, lui, ne réclamait pas. Deux
  écrans en désaccord sur le même fait. Régression :
  `banking/tests/test_expense_marker.py::TestTheMarkerAgreesWithTheControl`.
- **`cash` ne se déduit pas de `reconciled_by`.** L'ancienne règle
  (`reconciled_by === ''` → espèces) était morte : `create_bank_expense_interaction`
  écrit `manual` sur *tous* les rattachements, y compris ceux nés d'une dépense en
  liquide, et détacher remet la FK à `null` avant qu'on arrive au test. Le
  discriminant est le **type du compte** de la ligne — un fait, pas une trace.
- **Le badge mène à l'opération.** « Rapprochée » sans pouvoir aller voir *à quoi*
  reste une affirmation invérifiable. La destination est une vraie page,
  `/app/money/transactions/:id`, et non le journal filtré : sur un relevé de
  160 lignes, « elle est quelque part dans cette liste » ne vérifie rien. Ce que
  cette page montre et que le journal ne peut pas : les **autres** ventilations de
  la même opération — arriver là depuis une dépense de 90 €, c'est découvrir que la
  ligne en faisait 150.

Coût : trois requêtes fixes par réponse (la fenêtre du foyer), la ligne et son
compte arrivant par `select_related`. Borné par
`test_expense_marker.py::TestItStaysCheap`, qui compare cinq dépenses à quarante
plutôt que de plafonner le total de la page — la liste des interactions a un N+1
antérieur (documents, contacts, structures, équipements : sept requêtes par ligne)
qu'une borne globale mesurerait à la place.

### Un remboursement recrédite son enveloppe

Le cas qui a déclenché le mécanisme : un article de 40 € rendu à Leroy Merlin, une
cotisation bancaire remboursée. `inflow_nature='refund'` existait depuis le lot 5 —
et la docstring du modèle disait déjà qu'un remboursement « *offsets* an expense » —
mais **rien ne l'implémentait** : classer une recette en remboursement ne changeait
aucun chiffre. Le budget continuait d'afficher 150 € consommés sur un achat dont
40 € étaient revenus, pour toujours.

Ce qui manquait tient en un champ : **`BankTransaction.refund_budget`**.

- **Le remboursement reste une ligne bancaire.** Pas une `Interaction` à montant
  négatif — c'est ce qui protège les neuf `Sum("amount")` et `top_expenses`. Un
  `CheckConstraint` interdit le champ sur autre chose qu'une recette `refund`, et
  reclasser un remboursement en salaire efface le budget avec lui : sinon
  l'enveloppe reste créditée par une ligne qui ne rembourse plus rien.
- **`spent` reste le brut, `net_spent` est le chiffre du plafond.** `ratio` et
  `state` mesurent le net. Redéfinir `spent` aurait cassé ses sept lecteurs et vidé
  de son sens sa décomposition attesté / en attente.
- **La seule soustraction admise entre les deux mondes.** La règle « ne jamais
  additionner un total banque et un total interactions » tient toujours : ici on ne
  retranche pas un *total* bancaire, mais des lignes **désignées une par une** par
  l'utilisateur. Une recette sans budget ne retire rien à personne — c'est l'écart
  `refund_without_budget`, waivable (un frais bancaire jamais budgété ne recrédite
  rien, et le dire est l'arbitrage).
- **Le mois du remboursement, jamais celui de l'achat.** Imputer rétroactivement
  réécrirait un bilan mensuel déjà figé, que le rendu et le digest relisent. Le prix
  est un mois net négatif quand le remboursement arrive après — c'est un fait, et le
  cacher serait pire.
- **Le bilan mensuel recalcule son propre « dépensé »**, il a donc fallu l'y ajouter
  aussi : sans quoi il annonçait « dépassé » sur un budget que l'aperçu affichait
  « ok », le même mois. Régression :
  `budget/tests/test_refunds.py::TestTheMonthlyReportAgreesWithThePanel`.

Côté écran : le budget se choisit dans `ClassifyInflowDialog` quand la nature est
« remboursement », la ligne du journal affiche l'enveloppe qu'elle recrédite, et la
page d'un budget liste ses remboursements sous ses dépenses — « avoir la ligne sous
les yeux » était la moitié de la demande.

### Rattacher une dépense à une opération, depuis la dépense

Le rapprochement manuel n'existait que **depuis la ligne** (`UnreconciledPicker`,
action « Rapprocher » du journal). Or on part souvent de l'autre bout : on lit
« En attente de rapprochement » sur une dépense et on veut désigner l'opération.
Le constat était posé partout sans l'action à côté.

`AttachToTransactionDialog` est le miroir exact : au lieu de chercher une dépense
pour une ligne, il cherche une ligne pour une dépense.

- **Les candidates viennent du serveur** (`?fits=<montant>`) : seules les sorties
  non internes dont le **reste à ventiler** couvre le montant. Le reste est une
  annotation — le client ne peut pas le calculer — et proposer une ligne trop
  petite offrirait un bouton que `assert_allocation_fits` refuse, ce qui est pire
  que ne rien proposer.
- **Une dépense peut ne couvrir qu'une partie d'une ligne** : 90 € sur 150 €, les
  60 € restants attendent leur propre affectation. C'est précisément ce que le
  matcher automatique refuse de deviner (`score_pair` rejette au-delà de la
  tolérance, à raison), et le seul qui puisse trancher est l'utilisateur.
- Le tri est l'**écart en jours** avec la date de la dépense : à montants
  compatibles, c'est la seule indication qui distingue deux lignes plausibles.

Tests : `banking/tests/test_expense_marker.py::TestWhichLinesCouldCarryThisExpense`.

### …et s'en dédire au même endroit

Le détachement existait côté relevé (bloc « Dépenses déjà rattachées ») et nulle
part côté dépense : on pouvait donc désigner la mauvaise opération d'un clic sans
pouvoir revenir en arrière depuis l'écran où l'erreur se lit. **Un geste réversible
dont l'annulation vit dans un autre module n'est pas réversible en pratique.**
`LinkedLineActions` est posé partout où une dépense s'affiche avec son opération :
liste des dépenses, fiche d'une dépense, **et le formulaire d'édition** — c'est là
qu'un clic depuis la liste atterrit aujourd'hui, donc un geste absent de cette
page-là est un geste introuvable par le chemin le plus fréquenté.

⚠️ **Il y a deux gestes, pas un**, et ils ne portent pas sur la même chose :

| Dépense | Geste | Effet |
|---|---|---|
| rapprochée après coup (`manual`, `project_purchase`, `recurring`…) | **Détacher** | la dépense survit sans justification ; le fait préexistait au relevé |
| née de la ventilation (`bank`, espèces comprises) | **Supprimer la ventilation** | la dépense disparaît, **la ligne bancaire n'est jamais touchée** et redevient à ranger |

La seconde ligne est le cœur du sujet. Une dépense `kind='bank'` n'a pas été
rapprochée : elle **est** la ventilation. La détacher fabriquerait d'un seul coup
une dépense que plus rien ne justifie *et* une sortie redevenue partiellement
ventilée — deux écarts pour le même argent, ce que le module existe pour
supprimer. La supprimer, au contraire, rend exactement son état d'origine à la
ligne.

**La suppression ne porte que sur cette dépense.** Sur une ligne partagée en 90 € +
60 €, les 60 € restent et la ligne réapparaît dans « À ranger » avec 90 € à
replacer. Effacer tout le découpage pour corriger une de ses lignes détruirait un
travail fini. La suppression passe par `useDeleteWithUndo` : retrait optimiste,
appel API différé de 5 s, donc « Annuler » ne recrée rien — il n'a jamais rien
supprimé.

Deux itérations, deux leçons, la même origine. La première version renvoyait à
l'opération pour ces dépenses-là ; la version d'avant ne montrait **rien du tout**,
c'est-à-dire rien sur la quasi-totalité des dépenses d'un foyer qui importe ses
relevés. *Masquer* un geste inapplicable laisse un badge sans issue et envoie
l'utilisateur chercher ailleurs ce qu'il croit absent ; le renvoyer ailleurs pour
le geste évident lui fait traverser le module pour un clic. **Le geste juste se
nomme et s'exécute là où le constat s'affiche.**

La règle de propriété est donc désormais déclarée **une fois** côté front
(`banking/ownership.ts`, miroir de `interactions/kinds.py::OWNED_BY_ALLOCATION_EDITOR`)
et consommée par l'éditeur de ventilation comme par le bouton — elle était recopiée
dans `AllocationDialog`, et une règle recopiée est une règle qui divergera.
Régression : `ui/src/features/banking/LinkedLineActions.test.tsx` — un cas par geste,
plus un qui vérifie qu'**un geste est offert quel que soit le `kind`**.

### Le doublon de ventilation, et pourquoi le sélecteur a changé de source

Cas vécu en recette : une dépense saisie et jamais reliée ; au moment de ventiler
la ligne, l'utilisateur en crée une **nouvelle**, ayant oublié la première. La
ligne devient pleine, l'ancienne dépense ne peut plus s'y rattacher
(`assert_allocation_fits` refuse, à raison), et le même argent est compté deux
fois — plus un écart « dépense non rapprochée » que rien ne permet de résoudre.

Le correctif est **en amont** : `AllocationDialog` affiche, avant les lignes de
brouillon, les dépenses déjà saisies qui tiennent dans la ligne. Créer reste
possible, mais après avoir vu.

⚠️ **`UnreconciledPicker` ne lit plus le détecteur de conformité** mais
`?unreconciled=true&max_amount=`. C'était le piège, et il expliquait le doublon :
le détecteur est borné par la fenêtre, donc une dépense saisie *après* le dernier
relevé importé — celle qu'on vient de créer, donc précisément celle qu'on risque
de re-créer — n'était pas proposée. **« Qu'est-ce qui existe déjà ? » n'est pas
« qu'est-ce que je dois réclamer ? »** : la seconde question se borne, la première
jamais. Régression :
`banking/tests/test_expense_marker.py::TestTheForgottenExpenseIsOffered`.

### Le budget se saisit sur *tous* les formulaires de dépense

`Interaction.budget` est le seul axe qui classe un euro, et le détecteur
`expense_without_budget` en réclame un sur chaque dépense de la fenêtre. Or
**aucun** des cinq chemins d'achat ne proposait le champ : stock, équipement,
projet, poule, liste de courses créaient toutes des dépenses sans enveloppe. Ce
n'était pas un oubli d'ergonomie mais une **fabrique d'écarts** : chaque achat
naissait non conforme, et l'utilisateur devait aller réparer ailleurs ce que la
saisie venait de casser. Le formulaire d'édition, seul endroit où corriger après
coup, ne le proposait pas non plus — on pouvait donc lire « hors budget » sur une
dépense sans pouvoir y remédier depuis la page ouverte pour ça.

- Le champ vit dans **`PurchaseForm`**, le formulaire partagé, au même titre que
  le prix : c'est un champ générique de dépense, pas une particularité de
  feature. Les deux dialogs qui en avaient bricolé un (`ExpenseAdHocDialog`,
  `CashExpenseDialog`) l'ont perdu au profit du champ commun — deux sélecteurs
  pour une enveloppe, c'était la duplication qui allait diverger.
- Il reste **facultatif**. Exiger une enveloppe transformerait un achat pressé en
  cul-de-sac, et le Contrôle existe précisément pour rattraper ce qu'on n'a pas
  classé sur le coup.
- Le **plafond global n'est jamais proposé** : il couvre tout, donc il n'est la
  catégorie de rien, et le serveur le refuse. Offrir une option qui produit un
  400 est pire que ne pas l'offrir.
- Côté serveur, un budget étranger au foyer est un **400 nommé**, pas un 500 :
  `interactions.services.validate_expense_budget` traduit le `ValueError` du
  résolveur, une fois pour les cinq chemins. Même correction que
  `set_allocations` en son temps.
- L'édition envoie `budget_id: null` **explicitement** quand on retire
  l'enveloppe : omettre la clé laisserait l'ancienne en place, et « retirer le
  budget » serait un geste sans effet.

Tests : `interactions/tests/test_purchase_budget.py` — un cas par chemin, plus le
budget étranger, le budget global (qui ne doit **rien** écrire du tout, pas même
la quantité de stock) et l'achat sans budget qui reste permis.

### Aucune liste ne se termine par un mur

Les quatre listes du module s'arrêtaient à un plafond en dur — 50 pour le journal,
les dépenses et la file, 25 pour un groupe du Contrôle — **sans aucun moyen d'aller
plus loin**. Sur un relevé réel de 116 lignes, les deux tiers du travail étaient
hors d'atteinte, et le Contrôle allait jusqu'à afficher « et 66 de plus… » sans
offrir de les voir. **Un compteur qui nomme ce qu'il cache est pire qu'un compteur
muet.**

Deux mécanismes, et la distinction n'est pas cosmétique :

| Liste | Mécanisme | Pourquoi |
|---|---|---|
| Journal, Dépenses | **Pages** (`usePager` + `Pager`) | Ce sont des registres qu'on consulte : ils grandissent sans fin, leur parcours doit être sans plafond |
| À ranger, groupe du Contrôle | **« Voir plus »** (`useLoadMore` + `LoadMore`) | Ce sont des piles qu'on vide : les lignes disparaissent à mesure, et changer de page pendant que la précédente se vide fait sauter des lignes |

- **L'agrandissement de fenêtre ne pouvait pas servir aux registres** : le serveur
  plafonne à 100 (dépenses) et 200 (journal), donc le bouton aurait cessé
  d'avancer sans le dire — le mur déplacé, pas supprimé.
- **Et là où il sert, il ne ment pas non plus** : `LoadMore` reçoit le plafond
  serveur et, une fois atteint, remplace le bouton par une phrase (« 200 sur
  1 043 — traitez ces lignes pour voir la suite »).
- On agrandit la fenêtre plutôt que d'empiler des pages (`useInfiniteQuery`) pour
  deux raisons concrètes : la forme du cache reste `{items, count}`, celle que le
  retrait optimiste manipule (`LinkedLineActions`), et une invalidation rafraîchit
  *toute* la liste visible d'un coup — sur de l'argent, une page fraîche et trois
  périmées serait un piège.
- Le `Pager` annonce des **bornes** (« 51–100 sur 260 »), pas un numéro de page :
  c'est ce qui permet de dire « j'ai traité jusqu'au centième » et de reprendre.
- Une page vidée sous les doigts **ramène à la première** : rester sur une page
  vide afficherait « aucune dépense » à un foyer qui en a deux cents.

Tests : `ui/src/components/listNavigation.test.tsx`.

### Ventiler une recette — le miroir, enfin

Un remboursement ne créditait qu'**une** enveloppe, pour la totalité de la ligne.
Les 70 € qu'une amie rend pour sa part d'une soirée *et* d'un plein de courses
n'avaient donc pas de forme : il fallait choisir 40 ou 30, et « 150 € / 400 € »
restait faux.

`banking.RefundAllocation(transaction, budget, amount)` est le jumeau de la
ventilation d'une sortie, avec les mêmes propriétés : **remplacement complet**
(`PUT .../refund-allocations/`), somme bornée par ce que la recette a rapporté
(`validators.assert_refund_fits`), et un **reste** possible.

- **Pourquoi une table ici, alors qu'une ventilation de dépense n'en est
  délibérément pas une** : une ventilation de dépense est un fait du journal, donc
  c'est une `Interaction`. Un crédit de remboursement n'est pas une entrée du
  journal — il *corrige* une enveloppe. En faire une `Interaction` imposerait un
  montant négatif, la seule chose qui protège les neuf `Sum("amount")`.
- **`BankTransaction.refund_budget` a disparu** (migrations `banking.0009` +
  `0010`), replié en une ligne de ventilation du montant entier — ce que la
  colonne signifiait. Garder les deux aurait donné deux façons de dire la même
  chose, donc deux totaux à départager : l'écart « dit deux fois avec deux voix ».
- ⚠️ **La page d'un budget affiche la part attribuée, pas le montant de la ligne.**
  C'était le piège de ce lot : sommer la ligne annonçait 70 € rendus à une
  enveloppe qui n'en a récupéré que 40, et la page contredisait son propre total.
  Même correction dans `interactions.aggregations`.
- **Le reste est un écart arbitrable** (`refund_partially_allocated`), miroir de
  « sortie partiellement ventilée ». Souvent c'est normal — une amie qui arrondit —
  et c'est exactement ce qu'un arbitrage exprime : motif, daté, révocable. Ce qui
  n'est pas acceptable, c'est qu'un remboursement de 200 € dont 5 € sont attribués
  passe pour traité. Ne crédite **rien** reste `refund_without_budget` : deux
  écarts distincts, parce qu'ils ne se résolvent pas du même geste.
- Le `fingerprint` du nouveau détecteur porte le **reste**, pas le montant de la
  ligne : arbitrer « les 30 € qui traînent ne rendent rien » puis en attribuer 20
  fait resurgir l'arbitrage. Le montant d'une ligne bancaire, lui, ne bouge jamais
  — l'y mettre n'aurait rien périmé.
- **La nature d'abord** : le service refuse de créditer une enveloppe depuis une
  recette qui ne se déclare pas remboursement, et reclasser en salaire efface les
  attributions. L'ancien `CheckConstraint` n'est plus exprimable (il porte sur deux
  tables), donc l'invariant vit dans l'unique chemin d'écriture.

Tests : `banking/tests/test_refund_allocations.py` (14 cas) et
`budget/tests/test_refunds.py`, dont les 22 cas de netting tournent inchangés sur
le nouveau mécanisme — c'est ce qui prouve qu'aucun total n'a bougé.

### Les recettes entrent dans la file — même geste, pastilles différentes

« D'abord les recettes doivent être considérées comme des dépenses, ensuite un
seul endroit où l'on dispatch. » La file traite désormais **cinq** détecteurs :
les deux sorties, plus `inflow_unclassified`, `refund_without_budget` et
`refund_partially_allocated`. Les lignes se mélangent, triées par date — c'est le
relevé, pas deux listes, et deux écrans obligeaient à se souvenir lequel on avait
vidé.

⚠️ **Mêmes issues, pastilles différentes.** Ce qu'on demande à une recette n'est
pas un budget mais une **nature** : salaire, transfert interne, autre se règlent
d'un clic, et le remboursement ouvre son dialogue parce que lui seul demande de
désigner des enveloppes *et* des montants. Offrir des pastilles de budget sur une
recette aurait laissé croire qu'on la ventile comme une dépense — alors qu'elle ne
consomme rien, elle rend.

- **Actions groupées séparées par sens** : quinze virements internes se classent
  d'un geste (le cas réel après un import). Une barre commune aurait proposé des
  actions inapplicables à la moitié de la sélection.
- `PENDING_KINDS` se scinde en `PENDING_OUTFLOW_KINDS` / `PENDING_INFLOW_KINDS`.
  Le badge de la coque lit l'union ; **le Contrôle lit les sorties seules**, sans
  quoi il proposerait « Ventiler » sur un virement reçu — un éditeur qui ne sait
  pas les traiter.
- `PendingRow.outflow` devient `amount` (magnitude), le sens porté par
  `direction` : la file range des lignes, elle n'a pas à connaître la convention
  de signe des détecteurs (`outflow` pour les uns, `amount` pour les autres).

### Reste ouvert

Un seul point, et il attend de l'usage plutôt qu'un arbitrage : les **suggestions
de budget apprises** (`label_norm` + fournisseur + historique des budgets). C'est
le vrai levier sur l'effort de rangement, mais l'apprendre demande un mois réel de
données — le construire avant, c'est inventer les motifs qu'on croit avoir.
