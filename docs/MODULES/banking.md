# Module — banking (comptes, relevés & rapprochement)

> Rôle : faire des **relevés bancaires importés la source de vérité des
> dépenses**, à la place de la saisie déclarative. L'utilisateur déclare ses
> comptes, dépose l'export de sa banque, et chaque ligne devient une dépense ou
> une recette — ventilable en plusieurs postes, et rapprochée automatiquement des
> achats déjà saisis dans l'app.
>
> Parcours : `docs/parcours/PARCOURS_25_RELEVES_BANCAIRES.md`.
> Fiche concept : `docs/fiches/IMPORT_ET_RAPPROCHEMENT.md`.
> Backlog : `docs/parcours/PARCOURS_25_BACKLOG_TECHNIQUE.md`.
> Socle réutilisé : [interactions.md](./interactions.md), [budget.md](./budget.md),
> [electricity.md](./electricity.md) (le pattern d'import).

## État d'avancement

| Lot | Sujet | Statut |
|---|---|---|
| 1 | `BankAccount` + CRUD + module UI | ✅ **Livré** (#384) |
| 2 | Import CSV/XLSX (`StatementImport`, `BankTransaction`, dédup) | ✅ **Livré** (#385) |
| 3 | Journal bancaire (liste, filtres, qualification, flux) | ✅ **Livré** (#386) |
| 4 | Soldes, continuité & espèces | ✅ **Livré** (#387) |
| 5 | Ventilation (FK `bank_transaction` sur `Interaction`) | ✅ **Livré** (#388) |
| 6 | Rapprochement automatique | ✅ **Livré** (#389) |
| 8 | Intégration agent (lecture seule) | ⬜ #391 |
| 9 | Différé V2 — import PDF/photo | ⬜ #392 |

Le lot 7 du parcours 25 (recettes, virements internes, couverture — #390) est
**absorbé par le parcours 26**, qui le reprend dans un cadre de conformité.

### Parcours 26 — conformité Comptes / Dépenses / Budget

| Lot | Sujet | Statut |
|---|---|---|
| 1 | Socle de conformité (`ComplianceWaiver`, détecteurs, API) | ✅ **Livré** |
| 2 | Module « Argent » à onglets + file de rangement | ✅ **Livré** — voir [money.md](./money.md) |
| 3 | Une ventilation porte projet, zone et budget | ✅ **Livré** |
| 4 | Tout est une ligne de compte (espèces) | ✅ **Livré** |
| 5 | Recettes et mouvements internes | ✅ **Livré** |
| 6 | Le relevé confirme les récurrences | ✅ **Livré** |
| 7 | Continuité des relevés et provenance | ✅ **Livré** |
| 8 | Retrouver le solde d'ouverture | ✅ **Livré** |

**Cette fiche décrit l'état livré.** Les sections marquées *(à venir)* annoncent le
contrat que les lots suivants devront respecter.

## État synthétique (lot 1)

- **Backend** : `apps/banking/`
  - `models.py` — `BankAccount(HouseholdScopedModel)` : `name`, `bank_label`,
    `kind` (`bank`/`cash`), `currency`, `iban_last4`, `opening_balance` +
    `opening_balance_date`, `default_provider` + `import_options` (mémorisés par
    le lot 2), `archived`. Contrainte DB : nom unique par foyer
    (`uq_bank_account_name_per_hh`). Index `(household, archived)`.
  - `serializers.py` — `BankAccountSerializer` : nom non vide, devise ISO 3
    lettres normalisée en majuscules, `iban_last4` refusé au-delà de 4 caractères,
    et **compte espèces vidé de ses champs bancaires** dans `validate()`.
    `default_provider` / `import_options` sont en **lecture seule**.
  - `services.py` — **source de vérité des écritures** : `create_account`,
    `update_account` (allowlist `UPDATABLE_FIELDS`), `archive_account`. Mappe la
    collision d'unicité en `ValidationError` 400 (`_save_scoped`, miroir de
    `budget.services`).
  - `views.py` — `BankAccountViewSet` (CRUD), permission `IsHouseholdMember`
    (tout membre : l'argent est une affaire de foyer, comme les budgets).
    `perform_create`/`perform_update`/`perform_destroy` délèguent au service.
  - `urls.py` — router `/api/banking/accounts/`.
  - **Pas de `ready()`** : les registries agent arrivent au lot 8, et resteront
    **en lecture seule**.
- **Frontend** : `ui/src/features/banking/` (`BankingPage`, `AccountCard`,
  `AccountDialog`, `hooks.ts`), client `ui/src/lib/api/banking.ts`, route
  `/app/banking` sous `ModuleRoute`.
- **Module de nav** : clé `banking` dans `apps/households/modules.py`
  (`OPTIONAL_MODULES` **et** `PINNABLE_MODULES`) et `ui/src/lib/modules.ts`
  (groupe `tracking`, icône `Landmark`, désactivable et épinglable).
- **Locales (en/fr/de/es)** : namespace `banking`.
- **Tests** : `apps/banking/tests/` — 39 tests (modèle, service, API).

## Décisions de conception

### `DELETE` archive, il ne détruit pas

Le verbe `DELETE` de l'API mappe sur `archive_account`. Dès le lot 2, un compte
possède les transactions importées qui constituent l'historique financier du
foyer : le détruire les emporterait. Fermer un compte doit rester réversible —
d'où le champ `archived`, le filtre `?archived=true` et l'action « Rouvrir ».

Côté front, l'archivage passe par `useDeleteWithUndo`, qui **diffère l'appel
API** de 5 s : annuler ne touche jamais le serveur.

### Le nom reste réservé même archivé

La contrainte d'unicité ignore `archived` : on ne peut pas recycler le nom d'un
compte fermé. Délibéré — le nom est ce qui permet à l'utilisateur de distinguer
deux comptes dans l'historique d'imports, et le réutiliser rendrait un ancien
relevé ambigu. L'échappatoire est de renommer le compte archivé.
Verrouillé par `test_archived_account_still_holds_its_name`.

### Aucun IBAN complet, jamais

Seuls les 4 derniers caractères sont stockés (`iban_last4`), et le serializer
**refuse** une valeur plus longue plutôt que de la tronquer silencieusement — une
troncature masquerait un client qui envoie l'IBAN entier. Réserve connue et
assumée : à partir du lot 2, le `label_raw` d'un virement peut contenir un IBAN,
puisqu'on ne réécrit jamais le libellé de la banque.

### Le solde n'est jamais stocké

`opening_balance` est un **point de départ de calcul**, pas un solde. Le solde
courant est recomposé à la lecture au lot 4, ancré sur le `balance_after` des
transactions — même règle que le « dépensé » du parcours 21. Une colonne
`current_balance` mise à jour à l'écriture serait une source de vérité
concurrente qui dérive au premier import partiel.

`opening_balance` **peut être négatif** (découvert) : ni le modèle ni le
serializer ne contraignent son signe.

### Un compte espèces est un compte comme un autre

`kind='cash'` plutôt qu'un modèle séparé : les espèces ont un solde, des
dépenses, et recevront (lot 4) la contrepartie des retraits DAB. Ses champs
bancaires sont vidés par le serializer, donc un client qui les envoie ne pollue
pas la base.

## API (lot 1)

| Méthode | URL | Action |
|---|---|---|
| GET | `/api/banking/accounts/` | Liste (actifs seuls ; `?archived=true` inclut les archivés) |
| POST | `/api/banking/accounts/` | Création |
| GET | `/api/banking/accounts/{id}/` | Détail |
| PATCH | `/api/banking/accounts/{id}/` | Mise à jour (allowlist) |
| DELETE | `/api/banking/accounts/{id}/` | **Archive** (204), ne supprime pas |

## Import de relevés (lot 2)

### Un adaptateur par **format**, jamais par banque

`apps/banking/importers/` décalque `apps/electricity/importers/` :

```
BaseStatementImporter (ABC)   key, label, detect(raw), parse(raw, *, options),
                              columns(raw), sample_lines(raw)
    ├── generic_csv           detect() → False : un CSV ne dit pas quelle colonne
    │                         porte le montant, le mapping utilisateur est requis
    └── generic_xlsx          detect() → magic ZIP ; openpyxl rend des cellules
                              date/nombre natives, donc zéro devinette de format
                    ↓
        NormalizedTransaction  booked_on, label_raw, amount SIGNÉ, currency,
                               value_on?, balance_after?, external_id?
                    ↓
        services.import_statement_file → dédup → BankTransaction
```

- `importers/mapping.py` porte **toute** la logique commune (validation des
  options, détection de la ligne d'en-tête, ligne → transaction) : CSV et XLSX ne
  diffèrent que par la production des lignes. Un bug de parsing se corrige à un
  seul endroit.
- `importers/parsing.py` — `parse_amount` (espaces insécables, `1.234,56` vs
  `1,234.56`, parenthèses comptables, moins suffixe, symboles collés),
  `parse_date`, `normalize_label`.
- **Le mapping est mémorisé sur le compte** (`default_provider` +
  `import_options`, écrits par `remember_import_mapping` après un import réussi)
  → le 2ᵉ dépôt est un simple glisser-déposer. L'électricité redemande le mapping
  à chaque fois ; on ne reproduit pas ça.

### L'idempotence, en trois pièces

1. `dedup.assign_discriminants` — discriminant par ordre de qualité :
   `external_id` → **`balance_after`** (deux opérations identiques le même jour
   ont forcément des soldes différents) → **index d'occurrence intra-fichier**.
   Le mot *intra-fichier* est essentiel : compter les lignes déjà en base
   décalerait l'index au réimport et dupliquerait tout.
2. `dedup.compute_dedup_hash` — `sha256("v1"|account|date|label_norm|montant|
   devise|discriminant)`, calculé par le **service** (l'adaptateur ignore le
   compte, qui fait partie de la clé). `editable=False`, **jamais recalculé**.
3. `UniqueConstraint(account, dedup_hash)` + `bulk_create(ignore_conflicts=True)`.

Limite assumée et documentée : un export *partiel ultérieur* ne contenant que la
3ᵉ occurrence d'une ligne identique lui donnerait l'index `#0` et serait ignoré à
tort. Le cas disparaît dès que le fichier porte un solde ou une référence, et
`skipped_count` rend l'anomalie visible.

### Tout ou rien

`parse` valide le fichier **entier** avant que le service n'écrive quoi que ce
soit. Une ligne illisible produit un `StatementImport(status='failed')` avec zéro
transaction et un message portant le **numéro de ligne** — jamais un relevé à
moitié importé. Un mapping erroné n'écrase pas non plus le mapping qui marchait.

### API

| Méthode | URL | Action |
|---|---|---|
| GET | `/api/banking/imports/` | Historique (`?account=` pour filtrer) |
| POST | `/api/banking/imports/` | Dépôt d'un relevé (multipart : `account`, `provider`, `file`, `options`) |
| POST | `/api/banking/imports/preview/` | Colonnes + premières lignes, pour bâtir le mapping |

Deux contrats à ne pas casser :

- **Un échec métier est un 201**, pas un 4xx. Fichier illisible ou mauvais
  mapping → la trace créée avec `status='failed'` et `error`. Seules les requêtes
  malformées (compte manquant, provider inconnu, JSON invalide) sont 400.
- **`DELETE` et `PATCH` n'existent pas** (`ReadOnlyModelViewSet` +
  `http_method_names`). Supprimer un import puis réimporter recréerait les
  transactions avec de nouveaux UUID et perdrait silencieusement toutes les
  ventilations du lot 5.

### Frontend

`StatementImportDialog` en 3 étapes (fichier → mapping → résultat), pré-rempli
depuis `account.import_options`. Le résultat distingue **trois** issues, parce
qu'elles n'ont pas le même sens : lignes ajoutées, *rien de nouveau* (le
réimport, qui est un succès), et fichier illisible. `ImportHistoryCard` affiche
l'historique, échecs compris — c'est la seule trace qui explique pourquoi un
relevé n'est pas dans les comptes.

## Journal bancaire (lot 3)

### `queries.py` — le point de lecture unique

Miroir de `interactions/queries.py`, et pour la même raison : dès que deux modules
écrivent leur propre filtre, ils divergent. Tout ce qui lit des transactions (le
journal, les flux, les soldes du lot 4, le matcher du lot 6) passe par là.

**La convention de signe y vit, et nulle part ailleurs.** `BankTransaction.amount`
est signé alors que `Interaction.amount` est toujours positif : `outflow_expr()` /
`inflow_expr()` expriment le pont en SQL. Un `Sum("amount")` naïf sur un queryset
mixte compenserait les entrées avec les sorties et sous-estimerait les deux.

- `transactions(*, household_id, base)` — queryset de base scopé foyer
- `spendable(qs)` — retire les mouvements internes
- `sum_outflow(qs)` / `sum_inflow(qs)` — totaux positifs
- `search(qs, term)` — recherche sur `label_norm`, insensible à la casse **et aux
  accents** sans appel à `unaccent` : le libellé est déjà normalisé à l'import,
  c'est précisément la raison d'être de la colonne.
- `with_allocation(qs)` / `allocation_state(txn, …)` — où en est une ligne
  (voir juste en dessous)

### Le marqueur « où en est cette ligne »

Chaque ligne du journal porte son état de traitement : **ventilée**, **reste
X €**, **non ventilée**, ou **hors période contrôlée**. Sans lui, savoir s'il
restait quelque chose à dire d'une opération demandait de l'ouvrir — sur 116
lignes, personne ne le fait, et le relevé redevient une liste morte.

Trois règles tiennent ce marqueur :

- **Le verdict est calculé par le serveur, jamais par le client.** Il dépend de
  la fenêtre de conformité du compte, que le journal n'a pas à re-dériver.
- **Le journal et l'onglet Contrôle lisent la même fonction**
  (`queries.allocation_state`, adossée à `queries.with_allocation`). Une ligne
  verte ici et un écart là-bas, et les deux écrans perdent leur crédit — d'où le
  test `test_journal_marker.py::TestTheMarkerAgreesWithTheControl`, qui compare
  les deux lectures nombre par nombre.
- **Hors fenêtre, le marqueur est gris, pas rouge** (`out_of_scope`) : House
  n'exige rien là où elle ne peut rien exiger. Même raison que
  `coverage.window_status` — un reproche irrésoluble est ce qui fait abandonner
  le contrôle. Exception assumée : une ligne **entièrement** ventilée lit
  « ventilée » même hors fenêtre. Être fait est un fait ; être exigé est un
  périmètre.

Une recette, un mouvement interne et une contrepartie espèces n'ont **pas** de
marqueur (état `""`) : il n'y a rien à ventiler, et un badge y serait un faux
reproche.

**Le marqueur symétrique existe côté dépense** — `queries.reconciliation_state`,
même fenêtre, mêmes règles, même exception (« être fait est un fait »). Il répond
à la question depuis l'autre rive : *cette dépense, une ligne de relevé la
justifie-t-elle ?* Voir `docs/MODULES/money.md`, section « Une dépense dit si le
relevé la justifie ».

⚠️ `refresh_from_db()` ne rafraîchit **pas** une annotation. Après un
`PUT allocations/`, la réponse se relit par `get_object()` sur le queryset
annoté, sinon elle renvoie l'état d'avant l'écriture.

### `aggregations.py` — la vue « banque »

`compute_account_flow(*, household, account, date_from, date_to)` →
`{outflow, inflow, net, transaction_count, internal_count}`.

Les mouvements internes sont comptés à part et exclus des deux totaux : un retrait
DAB n'est pas une dépense, c'est du liquide qui change de poche — et il serait
compté une seconde fois quand ce liquide est dépensé.

### API

| Méthode | URL | Action |
|---|---|---|
| GET | `/api/banking/transactions/` | Liste paginée (`LimitOffset`, 50/200), filtres `account`, `date_from`, `date_to`, `direction`, `is_internal`, `q` |
| GET | `/api/banking/transactions/{id}/` | Détail |
| PATCH | `/api/banking/transactions/{id}/qualify/` | **Seule écriture admise** : `is_internal` et/ou `notes` |
| GET | `/api/banking/transactions/flow/` | Flux de la période |

Une ligne de relevé est **immuable sur le fond** : `label_raw`, `amount`,
`booked_on` et `direction` sont ce que dit la banque, et le serializer les marque
en lecture seule. D'où une action `qualify` étroite plutôt qu'un PATCH générique —
l'ensemble des champs écrivables est une décision, pas un oubli. `DELETE` n'existe
pas.

Un filtre de date malformé est un **400**, jamais un paramètre silencieusement
ignoré : une liste filtrée à tort est pire qu'une erreur.

### Frontend

Sous-page `/app/money/transactions` (`TransactionsPage`) : `FlowSummaryCards` en
tête, `TransactionFilters` (recherche, compte, période, pills direction/interne),
`TransactionList` + `TransactionRow` avec les deux actions de qualification et la
pastille d'état (`AllocationBadge`). Les filtres sont persistés en session.

Le libellé d'une ligne mène à **`/app/money/transactions/:id`**
(`TransactionDetailPage`) : l'opération en entier — montant, dates, compte, solde
imprimé, référence — et surtout **ce qu'elle justifie**, c'est-à-dire les dépenses
qui la ventilent avec le reste à ventiler. C'est la destination des badges de
rapprochement du module Argent ; elle tient en une requête
(`GET …/transactions/{id}/allocations/`, qui renvoie déjà la ligne, ses
ventilations et les deux totaux).

## Soldes, continuité & espèces (lot 4)

### Le solde est le test de l'import

Ce n'est pas d'abord une fonctionnalité de confort : si le chiffre calculé tombe
sur celui du relevé papier, l'import est juste ; s'il dérive, quelque chose
manque — et il vaut mieux le savoir **avant** d'avoir ventilé six mois de
dépenses sur des données fausses. D'où le placement du lot avant la ventilation.

### Deux modes, par ordre de confiance

`balances.compute_balance(*, account, as_of=None) -> BalanceResult`

1. **Ancré** — on prend la ligne la plus récente portant un `balance_after` et on
   ajoute ce qui est venu après. **Aucune hypothèse de continuité** : un janvier
   manquant ne corrompt pas un solde de mars.
2. **Dérivé** — `opening_balance` + tous les mouvements depuis
   `opening_balance_date`. Exact seulement si rien ne manque, d'où
   `is_reliable=False` quand la date d'ouverture n'est pas renseignée : sommer
   depuis un départ supposé est une supposition, et le dire coûte moins cher que
   d'avoir tort.

Le solde n'est **stocké nulle part** — verrouillé par un test qui vérifie
l'absence de colonne `balance` / `current_balance` sur `BankAccount`.

### Le contrôle de chaîne, gratuit

`check_balance_chain(*, account) -> list[ChainGap]` : entre deux lignes
consécutives portant un solde, `précédent.balance_after + courant.amount` doit
égaler `courant.balance_after`. Sinon des opérations manquent, et ce sont les
chiffres de la banque eux-mêmes qui nous le disent. L'UI affiche l'intervalle et
le montant manquant plutôt qu'un solde plausible et faux.

Les lignes sans solde sont **ignorées** plutôt que traitées comme une rupture :
un fichier sans colonne solde ne peut simplement pas être vérifié ainsi, et
inventer un trou serait pire qu'admettre qu'on ne sait pas.

**`BankTransaction.line_no`** a été ajouté pour ça : deux opérations du même jour
doivent garder l'ordre du relevé, sinon la chaîne compare des soldes qui ne se
sont jamais suivis — et `created_at` n'est pas fiable pour ça après un
`bulk_create`. Il sert aussi de traçabilité vers la ligne du fichier source.

### La contrepartie espèces

`services.record_cash_withdrawal(*, user, transaction, cash_account, amount=None)`
crée le miroir créditeur du retrait sur le compte espèces, marque **les deux
jambes** `is_internal` et les relie par `transfer_counterpart` (self-FK
`SET_NULL`, donc supprimer une jambe ne laisse jamais l'autre pointer dans le
vide).

Sans elle, suivre un solde espèces n'a aucun sens : l'argent quitte le compte
bancaire mais n'**arrive** jamais dans le compte liquide, qui plonge en négatif
dès le premier café payé en pièces. Les deux jambes étant internes, l'argent est
compté **une seule fois** — plus tard, quand ce liquide est réellement dépensé.

Proposée, jamais imposée : tous les retraits ne finissent pas dans le pot commun,
donc c'est une action explicite, et le montant est ajustable.

`unlink_counterpart` ne supprime que la jambe **qu'on a générée** (pas de
`source_import`, sur un compte espèces) ; une ligne importée est seulement
détachée — même règle que l'éditeur de ventilation du lot 5.

### API

| Méthode | URL | Action |
|---|---|---|
| GET | `/api/banking/accounts/{id}/balance/` | Solde, sa source, sa fiabilité et les ruptures (`?as_of=`) |
| POST | `/api/banking/transactions/{id}/withdraw-to-cash/` | Crée la contrepartie espèces |
| DELETE | `/api/banking/transactions/{id}/unlink-cash/` | Défait la contrepartie |

Le verbe `DELETE` n'est ouvert que pour `unlink-cash` : le viewset n'a pas de
`destroy`, donc un `DELETE` sur une transaction reste un 405 (testé).

### Frontend

`BalanceBadge` sur chaque card de compte (montant + pastille « à vérifier »),
`ChainGapAlert` détaillant les ruptures, `WithdrawToCashDialog` depuis le journal.

## Rapprochement automatique (lot 6)

### Le problème, et pourquoi ce lot décide de tout

L'utilisateur achète des granulés le 12 et le saisit le 12 ; la ligne
`CB LECLERC` arrive sur le relevé le 14. Deux traces d'un même fait. Ne pas les
réunir, c'est compter deux fois ; exiger le relevé pour saisir, c'est tuer le
geste immédiat qui fait la valeur de l'app.

Deux banques, c'est ~160 lignes par mois. Si chacune demande un clic,
l'utilisateur décroche en deux mois — d'où l'importance disproportionnée de ce
lot par rapport à sa taille.

### Le score

| Dimension | Poids | Règle |
|---|---|---|
| Montant | 0.50 | exact → plein ; sinon décroissant jusqu'à la tolérance (max de 5 c et 0,5 %) |
| Date | 0.30 | fenêtre **asymétrique** −7 / +3 jours : une carte est débitée *après* l'achat, mais l'utilisateur saisit parfois avec un jour de retard |
| Libellé | 0.20 | `difflib.SequenceMatcher`, **forcé au maximum si le fournisseur est une sous-chaîne du libellé** — le `LECLERC` dans `CB LECLERC 12/07 123456`, de loin le cas le plus fréquent |

Aucune dépendance ajoutée : `difflib` est dans la bibliothèque standard.

### Les deux règles qui protègent l'utilisateur

**Auto-lien uniquement sur montant strictement égal**, en plus du seuil (0.85) et
de la non-ambiguïté. Un appariement à cinq centimes près est probablement bon,
mais il casserait l'invariant de ventilation et laisserait des résidus
inexplicables sur des centaines de lignes. Un écart devient une **suggestion**,
tranchée par un clic humain.

**Affectation par glouton stable**, jamais un `argmax` par ligne : deux achats de
20 € face à deux lignes de 20 € produiraient sinon des appariements croisés ou
doubles. Les paires sont triées par score (puis par écart de date) et retenues
tant que les deux côtés sont libres.

L'ambiguïté est jugée sur ce qui **change les comptes** : deux rivaux
interchangeables (même score, même écart de montant) se rapprochent quand même,
puisque l'un ou l'autre donne des livres identiques. Deux rivaux réellement
différents — une boulangerie et une pharmacie à 20 € le même jour — ne sont
jamais liés automatiquement : l'attribution au budget diffère, donc on demande.

### Deux points d'entrée

- **À l'import**, dans la même transaction, sur les seules lignes créées.
  `StatementImport.auto_matched_count` porte le chiffre qui compte pour
  l'utilisateur : ce qu'il n'a **pas** eu à trier à la main.
- **À la demande** (`POST /api/banking/transactions/reconcile/`), pour l'autre
  sens du décalage : la dépense saisie *après* l'import.

Idempotent : tout ce qui est déjà rapproché est hors du pool de candidats.

Pas de hook dans les six producteurs de dépense — six points de couplage pour un
gain marginal, alors que le bouton et la passe d'import couvrent les deux sens.

### API

| Méthode | URL | Action |
|---|---|---|
| POST | `/api/banking/transactions/reconcile/` | Lance le matcher (`date_from`/`date_to` optionnels) |
| GET | `/api/banking/transactions/{id}/suggestions/` | Meilleurs candidats pour cette ligne |

### Réglages

`BANKING_MATCH_WINDOW_BEFORE_DAYS` (7), `BANKING_MATCH_WINDOW_AFTER_DAYS` (3),
`BANKING_MATCH_AUTO_THRESHOLD` (0.85), `BANKING_MATCH_SUGGEST_THRESHOLD` (0.55).

## Conformité — le socle (parcours 26, lot 1)

> Parcours : `docs/parcours/PARCOURS_26_CONFORMITE_ARGENT.md`.

### La règle structurante

> Toute entité est soit **résolue**, soit **flaggée avec un motif**.
> Rien ne reste dans un entre-deux silencieux.

Le parcours 25 a rendu les relevés source de vérité. Ce qui manquait n'était pas
une fonctionnalité mais une **garantie** : de l'argent sorti que personne n'a
affecté, des dépenses que la banque n'a jamais vues, des chaînes de soldes rompues
— autant d'**orphelins silencieux**. Le contrôle les rend comptables.

### ⚠️ Un zéro a deux sens — et les confondre a produit un silence total

**Bug trouvé à la recette du parcours 26, corrigé après coup.** À retenir avant de
toucher à `coverage.py` ou à un détecteur.

Un compte dont la date de solde d'ouverture était **postérieure à ses propres
lignes** (cas réel : compte créé aujourd'hui, relevé couvrant les mois passés) n'avait
aucune fenêtre de conformité. Conséquence en chaîne :

1. tous les détecteurs de lignes voyaient zéro ligne ;
2. le prérequis bloquant ne se déclenchait pas — la date *était* renseignée ;
3. la file « À ranger » affichait une **coche verte** : « Toutes vos opérations sont
   affectées ou arbitrées » ;
4. le panneau Contrôle affichait « Rien à signaler » sur chaque groupe.

C'est-à-dire : **le silence produit par le mécanisme qui existe pour empêcher le
silence.** Le test `test_no_window_when_everything_predates_the_opening_balance`
disait déjà « une fenêtre vide, c'est *on ne sait rien* » — mais rien ne rapportait
« on ne sait rien ».

Les deux règles qui en découlent :

- **`coverage.window_status()` renvoie une raison, pas seulement `None`.** Un compte
  sans données (`no_data`) est normal ; un compte dont la date postdate les lignes
  (`opening_date_after_data`) est hors de portée du contrôle et doit le dire. Ne
  jamais revenir à un booléen : c'est la confusion des deux cas qui a shippé.
- **Un compteur à zéro ne se lit « conforme » que si le contrôle a pu s'exécuter.**
  Côté front, `money/prerequisites.ts` distingue *rien à signaler* de *rien
  d'évaluable*, et la file comme le panneau l'affichent. Tout nouveau compteur doit
  passer par là.

### L'horizon de conformité — `coverage.py`

Sans borne, le contrôle serait inutilisable dès le premier jour : les dépenses
saisies avant le premier relevé n'ont **aucune** ligne bancaire à laquelle se
rattacher, et n'en auront jamais. Des centaines d'écarts irrésolubles, et la
réaction rationnelle devant une liste irrésoluble est d'arrêter de la lire.

La fenêtre d'un compte est donc `[opening_balance_date, dernière date connue]` :

- **avant** : de l'historique, hors périmètre ;
- **après** le dernier relevé : pas encore de relevé, c'est normal ;
- **entre les deux** : l'exigence est totale — et « zéro écart » devient atteignable.

Un compte sans fenêtre est signalé seul, en **prérequis bloquant**
(`account_without_window`), et les détecteurs dépendants sont rendus « non
évaluable » — jamais « conforme ». Deux raisons le déclenchent : solde d'ouverture
absent, ou daté **après** les lignes du compte. Une action rend le reste signifiant.

`_latest_known_date` prend le **maximum** entre le `period_end` des imports
`completed` et le `booked_on` le plus récent — ce second signal est le seul qu'un
compte espèces possède. Conséquence assumée : une ligne bancaire est toujours dans
sa propre fenêtre (détenir la ligne, c'est détenir le relevé), donc seule la borne
basse peut exclure une ligne. La borne haute mord sur les **dépenses**.

### Le registre de détecteurs — `compliance.py`

Modèle de contribution identique à `agent.searchables` : le registre ne sait rien,
chaque app déclare ses détecteurs depuis `apps.py::ready()`. **Ajouter un
mécanisme à l'app, c'est ajouter son détecteur** — la règle de revue qui empêche le
catalogue de prendre du retard sur le code.

`DetectorSpec` sépare **`count`** de **`findings`** : le badge de la coque est lu à
chaque navigation, il doit coûter un `COUNT(*)` indexé par détecteur, jamais un
scan matérialisé en Python. `findings` est paginé et ne tourne que pour le groupe
ouvert.

`waivable=False` porte la colonne « aucun flag légitime » du catalogue et devient
un **400**, pas un commentaire : un solde d'ouverture manquant est un prérequis,
pas un arbitrage.

### `ComplianceWaiver` — l'arbitrage, et pourquoi il peut périmer

Un modèle **unique et polymorphe** plutôt que des `dismissed_at` / `ignored` /
`accepted_gap` éparpillés : des états hétérogènes que personne ne peut compter
ensemble seraient exactement l'orphelin qu'on supprime.

- `reason` **requis** — un flag sans motif est un bouton « cacher » ;
- **révocable** — supprimer le waiver fait resurgir l'écart à l'identique ;
- **`fingerprint`** — le hash de ce qui *fonde* l'écart au moment de l'arbitrage.

Ce dernier point est le garde-fou central. Arbitrer « le reste de cette ligne de
150 € ne m'intéresse pas », puis ventiler 90 € : sans péremption, 60 € resteraient
couverts par un motif qui ne décrit plus rien — **le flag deviendrait la meilleure
cachette de l'app**. Quand le fingerprint ne correspond plus, l'écart réapparaît
`is_stale`, motif d'origine affiché pour contexte, et un `POST` ré-arbitre.

Trois états, et l'identité comptable `ouverts + arbitrés = détectés` (les périmés
sont un sous-ensemble des ouverts : ils sont revenus sur la pile).

Un waiver dont l'écart est résolu est **dormant** : listé nulle part, conservé en
base pour ne pas avoir à arbitrer deux fois la même situation.

### Les cinq détecteurs du lot — `detectors.py`

| Clé | Sévérité | Arbitrable | Lot |
|---|---|---|---|
| `account_without_window` | `blocker` | ❌ prérequis | 1 |
| `transaction_unallocated` | `error` | ✅ | 1 |
| `transaction_partially_allocated` | `error` | ✅ | 1 |
| `expense_unreconciled` | `warning` | ✅ | 1 |
| `account_chain_broken` | `error` | ✅ | 1 |
| `expense_without_budget` | `warning` | ✅ | 3 |
| `account_cash_negative` | `error` | ❌ incohérence | 4 |
| `inflow_unclassified` | `warning` | ✅ | 5 |
| `internal_without_counterpart` | `error` | ✅ | 5 |
| `recurring_overdue` | `warning` | ✅ | 6 |
| `recurring_double_confirmed` | `error` | ❌ bug de données | 6 |
| `statement_period_gap` | `error` | ✅ | 7 |
| `import_skipped_lines` | `warning` | ✅ | 7 |

Les sorties « à affecter » excluent les recettes (leur détecteur arrive au lot 5),
les mouvements internes et leurs contreparties (l'argent est compté une fois, plus
tard, quand les espèces sont dépensées — même règle que
`validators.assert_allocation_fits`), et tout ce qui sort de la fenêtre.

`account_chain_broken` est le seul détecteur en Python : la vérification est une
marche arithmétique sur des soldes consécutifs, qu'aucun `COUNT(*)` n'exprime. Coût
borné par le **nombre de comptes**, pas de lignes.

### API

| Verbe | URL | Rôle |
|---|---|---|
| `GET` | `/api/banking/compliance/` | compteurs seuls — ce que lit le badge |
| `GET` | `/api/banking/compliance/{kind}/` | écarts d'un groupe, paginés |
| `GET` | `…/{kind}/?waived=true` | la liste d'audit, motifs inclus |
| `GET` | `/api/banking/waivers/` | les arbitrages du foyer |
| `POST` | `/api/banking/waivers/` | arbitrer (ou ré-arbitrer) |
| `DELETE` | `/api/banking/waivers/{id}/` | révoquer → l'écart resurgit |

Pas de `PATCH` sur un waiver : éditer le motif seul laisserait un fingerprint
périmé derrière lui — un arbitrage qui a l'air à jour mais couvre une situation qui
a bougé.

Le libellé utilisateur de chaque `kind` vit dans le namespace i18n `money` du
front, pas en `gettext` backend : ajouter un détecteur ne doit pas imposer un
passage dans quatre `.po`.

## Ventilation multi-axes (parcours 26, lot 3)

### Budget et projet sont deux axes **indépendants**

Le cas réel : 150 € chez Leroy Merlin, dont 90 € pour le chantier salle de bain et
60 € sans rapport. Ces 90 € comptent dans le chantier **et** dans l'enveloppe
« Bricolage » — ce ne sont pas deux façons de dire la même chose.

Avant ce lot une ligne de ventilation ne portait qu'un budget. Or
`projects/services.py::_expense_amounts` agrège les coûts par la **FK polymorphe
source**, et `create_bank_expense_interaction` ne la posait pas : ces 90 € ne
remontaient donc dans **aucun** coût de projet.

`create_bank_expense_interaction` accepte désormais `source_type`/`source_id`
(valeurs de `ALLOWED_SOURCE_TYPES`) et `zone_ids` (qui existait déjà).
`resolve_allocation_source` fait la résolution — et **vérifie le foyer** : sans ce
contrôle un client pourrait gonfler le coût d'un projet qu'il ne peut même pas voir.

`kind` reste `bank` même avec une source : le kind dit *d'où vient* la dépense (une
ligne de relevé), pas *sur quoi elle porte*.

### ⚠️ La règle de propriété lit `kind` seul

`set_allocations` et `delete_transaction` décidaient qu'une dépense leur
« appartenait » si `kind='bank'` **et** qu'elle n'avait pas d'objet source. La
seconde clause était redondante (un achat de stock a `kind='stock_purchase'`,
jamais `'bank'`) — et devient **activement fausse** dès qu'une ligne de ventilation
porte un projet : la ligne cessait d'être possédée, donc elle était *détachée* au
lieu d'être supprimée à la ré-édition. **Chaque ré-édition d'un découpage laissait
une dépense fantôme derrière elle**, toujours comptée dans le coût du projet.
Exactement l'orphelin que le parcours 26 supprime.

L'asymétrie qui justifiait la règle est préservée : une dépense qui **préexiste** au
relevé (achat de stock rapproché sur la ligne) est toujours seulement détachée —
la supprimer emporterait ses documents, tags, zones et parfois une tâche.

### Rattacher une dépense existante — ce que le matcher refuse de deviner

Un achat de 90 € saisi depuis une page projet ne sera **jamais** proposé par
`matching.score_pair` pour une ligne de 150 € : l'écart de montant dépasse la
tolérance, par construction, et c'est bien ainsi — 60 € d'écart n'est pas un
appariement plausible. Mais les 90 € sont bien *une partie* de la ligne.

D'où `UnreconciledPicker` (dans `SuggestionsDialog`) : un sélecteur **explicite**
alimenté par le détecteur `expense_unreconciled`, qui est déjà l'inventaire exact
des candidates. Les dépenses plus grosses que le reste à ventiler sont masquées —
`assert_allocation_fits` les refuserait, et proposer un bouton qui échoue est pire
que ne rien proposer. **C'est ce qui ferme l'orphelin « dépense non rapprochée »
dans le cas partiel.**

### Une erreur de référence est un 400 qui nomme la ligne

`create_bank_expense_interaction` signale les mauvaises références (zone inconnue,
budget d'un autre foyer, source hors foyer) par un `ValueError`. Laissé tel quel il
remontait en **500** sur une simple erreur client. `set_allocations` le convertit en
400 en préfixant le numéro de ligne — sur un découpage à cinq lignes, c'est le
numéro qui rend le message actionnable.

## Tout est une ligne de compte (parcours 26, lot 4)

### Pourquoi la dépense en espèces devait changer de nature

Un billet donné au marché ne laisse aucune ligne de relevé. Avant ce lot, une telle
dépense ne pouvait exister que comme `Interaction` nue — donc comme une **dépense
que la banque n'a jamais vue**, que le contrôle de conformité ne peut que
*signaler*, sans que personne puisse la résoudre. Chaque mois, la même liste
d'écarts inarbitrables : le meilleur moyen de faire abandonner le contrôle.

En faire une vraie opération de compte supprime l'orphelin **par construction**,
plutôt que d'apprendre à l'utilisateur à l'arbitrer tous les mois.

### `create_manual_transaction`

Le `dedup_hash` porte un discriminant `manual:{uuid4}`. Deux conséquences, toutes
deux voulues :

- une saisie manuelle n'est **jamais** un doublon d'elle-même — deux fois 20 € en
  liquide, ce sont deux dépenses, et seul l'utilisateur sait si c'est une erreur ;
- elle ne peut **jamais** entrer en collision avec une ligne importée, dont le
  discriminant vient toujours du fichier (référence, solde, index d'occurrence).

### `record_cash_expense` — atomique par nécessité

L'opération et sa ventilation naissent **dans la même transaction**. Créer la ligne
puis laisser l'utilisateur la ventiler plus tard déposerait une opération
fraîchement créée directement dans la file « à ranger » : l'app fabriquerait ses
propres écarts. Ici il n'existe aucun instant où la ligne est non affectée — et un
budget invalide fait rouler l'ensemble en arrière, opération comprise.

`amount` est **donné positif** (ce que l'utilisateur a dépensé) et **stocké signé**,
comme toute sortie.

### Détecteur `account_cash_negative` — non arbitrable

Un compte espèces dans le rouge est **physiquement impossible** : on ne donne pas un
billet qu'on n'a pas. Ça ne veut donc jamais dire « découvert », ça veut dire qu'un
retrait n'a pas été déclaré. D'où `waivable=False` : aucun motif ne rend acceptable
de l'argent impossible, il y a une opération à enregistrer.

Un **compte bancaire** à découvert n'est pas concerné — un découvert est légitime.
Seuls les comptes `kind='cash'` sont vérifiés.

### `CashExpenseDialog` — pas de cul-de-sac

Sans compte espèces il n'y a rien à écrire. Mais renvoyer l'utilisateur vers un
autre onglet au moment où il veut noter une dépense serait un cul-de-sac : le dialog
propose de créer le compte **sur place, en un clic** (solde d'ouverture à zéro,
daté du jour — qui est aussi le prérequis de conformité). La contrainte est tenue
sans que la saisie soit interrompue.

`ExpenseAdHocDialog` n'est plus utilisé par l'UI. L'endpoint `expenses_manual`
reste pour compatibilité API.

### API

`POST /api/banking/transactions/cash-expense/` → `{transaction, allocations}`.
Un montant non numérique est un **400**, pas un 500.

## Recettes et mouvements internes (parcours 26, lot 5)

Les deux familles d'orphelins les plus **silencieuses**, laissées ouvertes par le
parcours 25.

### `inflow_nature` — dire ce qu'est une recette

Un crédit de 2 100 € peut être un salaire, le remboursement de quelque chose déjà
compté comme dépense, ou le retour du propre virement du foyer. Les trois disent des
choses **complètement différentes** sur l'argent réellement disponible. Laisser le
champ vide n'est donc pas un détail cosmétique.

Les recettes n'entrent pas dans le journal des dépenses (un salaire n'est pas une
`Interaction`), mais `refund` est le cas intéressant : c'est la seule recette qui
*compense* une dépense — et c'est pourquoi `Interaction.amount` ne devient jamais
négatif. Un remboursement est une **ligne bancaire qui a une nature**, pas une
dépense négative (qui casserait `top_expenses` et tous les `Sum("amount")`).

**`""` ≠ `other`.** `other` est un **choix** de l'utilisateur (« cette recette n'a
pas de catégorie qui compte ») ; vide veut dire « personne n'a regardé ». Confondre
les deux rendrait le détecteur aveugle.

### `rules.py` — des valeurs de départ, jamais des vérités

`is_internal` décide si l'argent compte comme dépense. Une devinette appliquée comme
vérité fait donc **disparaître une vraie dépense des totaux, en silence**. D'où trois
garde-fous :

- la devinette est écrite à l'import comme **valeur initiale** ;
- l'utilisateur la corrige depuis le journal, et l'idempotence de l'import protège
  son choix — la ligne existe déjà, donc un ré-import ne re-devine rien ;
- un mouvement interne sans contrepartie est un **écart signalé**, donc une mauvaise
  devinette remonte au lieu de se cacher.

`guess_internal` renvoie `False` sur tout ce qu'il ne reconnaît pas : c'est le défaut
sûr. Un mouvement interne non flaggé apparaît comme sortie non affectée — donc
l'utilisateur en est informé ; une vraie dépense flaggée à tort disparaîtrait sans un
mot. La liste de motifs est volontairement **petite** : une liste qui essaie d'être
maligne finit par mal étiqueter la seule ligne de l'année qui compte.

### `internal_without_counterpart` — la promesse rompue

Un mouvement interne est exclu des dépenses **sur la promesse** que l'argent
réapparaît ailleurs (en liquide dans une poche, ou en crédit sur un autre compte).
Contrepartie manquante = promesse rompue : l'argent a quitté le monde suivi et rien
ne l'explique. C'est la façon la plus discrète de perdre quelques centaines d'euros,
d'où un détecteur plutôt qu'une note.

### Le taux de couverture — un ratio, jamais une somme

`compute_account_flow` expose `unallocated_outflow` et `coverage_ratio`. Le ratio
répond à « quelle part de ce qui est sorti est expliquée » — exactement la question
à laquelle le contrôle répond ligne par ligne.

**Rien sorti ⇒ ratio 1.0.** Rien à expliquer n'est pas un reproche ; renvoyer 0
dirait « personne n'a rien rangé ».

`unallocated_outflow` est calculé **par différence sur la même requête** que les
totaux, pas par une somme de dépenses : mélanger les deux sources est précisément ce
que la règle transverse interdit.

### Le bloc `bank` du bilan mensuel

`budget/report/stats.py` gagne une clé `bank` **additionnelle** — aucune clé
existante ne change (le rendu du bilan et le digest les lisent). Sa borne haute est
la **veille** de la borne exclusive des interactions : les lignes bancaires sont
datées au jour, et se tromper d'un jour ferait disparaître les opérations du 31.

## Le relevé confirme les récurrences (parcours 26, lot 6)

### Le problème, tel qu'il se vit

Une douzaine de prélèvements tombent chaque mois. Les confirmer un par un est la
corvée qui fait qu'on **arrête** de confirmer — après quoi « échéance passée non
confirmée » s'empile, `next_due_date` n'avance plus, et la projection de trésorerie
comme l'« engagé à venir » de chaque budget se mettent à mentir. Le relevé sait déjà
que ces prélèvements ont eu lieu.

### ⚠️ Prérequis modèle : `recurring_id` promu en FK

`Interaction.recurring_expense` (FK `SET_NULL`, index partiel). Le détecteur de
**double confirmation** doit `GROUP BY` la récurrence — et CLAUDE.md interdit de
requêter `metadata` : une clé JSON ne peut être ni indexée ni contrainte, donc le
détecteur aurait été à la fois lent et invérifiable.

Migration de données `interactions.0027` : la clé JSON est **conservée** (elle ne
coûte rien, c'est ce que lit l'affichage existant, et la retirer dans la même
migration rendrait le rollback destructeur). Un id qui pointe dans le vide est
**ignoré, pas levé** : `recurring_id` était une string sans intégrité référentielle,
et faire échouer un déploiement pour une donnée déjà perdue serait absurde.

### `match_recurrences` — mêmes protections que le matcher de dépenses

- **auto-confirmation sur montant strictement égal seulement.** Une facture qui
  varie de cinq centimes est probablement la même facture, mais la confirmer
  écrirait une occurrence que l'utilisateur n'a pas vérifiée, **à un montant qu'il
  n'a jamais vu**. Elle reste non confirmée et visible ;
- **affectation greedy stable**, jamais un argmax par ligne : deux abonnements à
  15 € face à deux lignes à 15 € se croiseraient.

Fenêtre plus large que pour un achat carte (±10 jours contre −7/+3) : un prélèvement
tombe au calendrier de la banque, pas au jour où l'utilisateur a noté quelque chose.

**La ligne est intégralement ventilée** à la confirmation — sinon on créerait un
écart « sortie partiellement ventilée » en confirmant, l'app fabriquant son propre
travail.

### L'ordre à l'import compte

`auto_reconcile` **puis** `match_recurrences`, sur ce qui reste libre. Une dépense
déjà saisie par l'utilisateur est une information plus sûre qu'une échéance prévue,
donc elle gagne la ligne ; la récurrence sera confirmée par le relevé du mois
suivant.

Le bouton « Rapprocher » fait les deux passes, pour la même raison qu'au parcours 25 :
l'utilisateur a pu créer la récurrence **après** l'import.

### `recurring_double_confirmed` — non arbitrable

Seule la course entre une confirmation manuelle et un import peut le produire.
Compter une facture deux fois n'est jamais acceptable : l'une des deux doit partir.

`match_recurrences` s'en protège en amont (une occurrence existant déjà pour cette
date fait sauter la récurrence), mais le détecteur reste — la confirmation manuelle
est un autre chemin, et le contrôle ne fait pas confiance aux garde-fous, il vérifie.

## Continuité des relevés et provenance (parcours 26, lot 7)

Le dernier lot. Le catalogue des orphelins est complet : **13 détecteurs**.

### `statement_period_gap` — l'angle mort du contrôle de chaîne

Le contrôle de chaîne attrape les opérations manquantes **à l'intérieur** d'une
période importée, par l'arithmétique des soldes. Un février que personne n'a jamais
déposé, lui, ne laisse **aucune trace arithmétique** — seulement un trou dans le
calendrier. Les deux détecteurs sont complémentaires et ni l'un ni l'autre ne voit
l'angle mort de l'autre.

Seuls les imports `completed` comptent : un import échoué n'a rien écrit, prétendre
couvrir sa période serait un mensonge. Les périodes qui se chevauchent sont normales
(ré-importer un mois est la façon de rattraper) — seul un trou **strictement
positif** est signalé.

### `import_skipped_lines` — la limite de la dédup, rendue visible

`skipped_count > 0` est normalement la **bonne** nouvelle : c'est à quoi ressemble un
ré-import. Ça devient un avertissement **uniquement** sur un fichier sans référence
bancaire ni solde courant, parce que c'est exactement la limite documentée de la
recette de dédup (`docs/fiches/IMPORT_ET_RAPPROCHEMENT.md` §3.2) : le discriminant
retombe sur l'index d'occurrence *dans le fichier*, donc un export partiel ultérieur
d'une ligne identique peut être ignoré comme doublon alors qu'il est vraiment neuf.

La présence de ces colonnes est **dérivée des lignes créées**, pas stockée : une
colonne qui n'a produit aucune valeur était, du point de vue de la dédup, absente —
et c'est cette propriété-là qui compte.

### Le solde d'ouverture, requis à l'entrée

`BankAccountSerializer` refuse une création sans `opening_balance_date`. Sans elle le
compte n'a **pas de fenêtre de conformité** : son solde est une supposition, et aucun
autre contrôle ne peut rien affirmer à son sujet.

**Uniquement à la création.** Sur l'existant, le détecteur du lot 1 fait le travail ;
exiger le champ à chaque PATCH rendrait un simple renommage impossible tant que
l'utilisateur ne l'a pas rempli — une contrainte qui punit la mauvaise personne.

Côté UI la date est **pré-remplie à aujourd'hui** : le cas fréquent est « je commence
à suivre ce compte maintenant », et proposer une valeur juste vaut mieux qu'exiger
une saisie de plus.

### Provenance et couverture

`ExpenseList` porte un badge de provenance — **relevé**, **espèces**, ou **en attente
de rapprochement**. Seule la troisième appelle une action : une dépense que la banque
n'a jamais confirmée est un écart, pas un état normal. Le dire dans la liste où on la
lit, pas seulement dans l'onglet Contrôle.

`ExpenseSummaryCards` gagne la carte **Couverture** : « X rangés sur Y sortis du
compte ». C'est ce qui rend « 340 € dépensés » interprétable — sur combien réellement
sorti ? Et c'est **un ratio, jamais une somme** des deux mondes.

Nettoyé au passage : trois `t()` avec `defaultValue` dans les composants de dépenses,
que CLAUDE.md interdit précisément parce qu'ils masquent les traductions manquantes.
Les clés `bank`, `recurring` et `chickens_purchase` manquaient effectivement.

## Retrouver le solde d'ouverture (parcours 26, lot 8)

### Le problème : on demandait la seule information que personne ne détient

Le solde dérivé part d'un solde à une date **passée**. Or une appli bancaire
n'affiche que celui d'**aujourd'hui**, et une bonne moitié des exports français —
celui du Crédit Agricole en tête — **ne porte aucune colonne solde**. Le chiffre que
le modèle réclame est donc précisément celui que l'utilisateur ne peut pas obtenir.

Conséquence observée en production : la date d'ouverture est renseignée à
*aujourd'hui* (la seule que l'on puisse remplir honnêtement), ce qui place la fenêtre
de conformité après toutes les lignes, `OPENING_DATE_AFTER_DATA`, et éteint tout le
contrôle. Le lot 7 avait rendu le champ obligatoire à la création ; il restait à le
rendre **remplissable**.

### Deux voies, la plus sûre d'abord — `anchoring.py`

`anchor_context(account)` choisit, il ne demande pas :

- **`statement`** — une ligne porte le solde courant de la banque. Le solde
  d'ouverture est alors une soustraction sur des lignes détenues : on remonte au
  premier solde imprimé et on le défait. Aucune saisie, aucune attestation, rien à se
  tromper. Demander un chiffre qu'on sait lire est le meilleur moyen de perdre la
  confiance de l'utilisateur.
- **`attestation`** — aucune ligne ne porte de solde. L'utilisateur lit son solde du
  jour, House retranche les mouvements. Exact **si** toutes les opérations de
  l'intervalle sont importées : c'est exactement ce qu'il ne faut pas croire sur
  parole.

### Le partage entre ce qu'on vérifie et ce qu'on fait attester

**Ce que House peut réfuter, il le refuse** (`AnchorError`, 400 portant son `code`) :

| Code | Pourquoi c'est un refus et pas un avertissement |
|---|---|
| `as_of_before_last_line` | Le solde lu ignore des lignes déjà détenues : elles seraient comptées deux fois. |
| `as_of_in_future` | Un solde ne se lit pas à une date qui n'est pas arrivée. |
| `period_gap` | Une période jamais importée **dans l'intervalle** rend la soustraction courte d'un montant inconnu, définitivement enfoui dans le solde d'ouverture. |
| `no_transactions` | Rien à retrancher — saisir le solde directement est plus honnête. |

Le trou de période est cherché **borné à l'intervalle reconstruit**
(`coverage.period_gaps(account, between=…)`) : un février manquant ne dit rien d'un
solde reconstruit sur juin–juillet, et refuser pour lui recréerait l'écart
irrésoluble que la fenêtre de conformité existe pour éviter.

**Ce que seul l'utilisateur peut attester** — « rien n'a bougé depuis que mon relevé
ne montre pas » — est demandé explicitement, **à côté de la dernière opération
détenue**. Une case à cocher dans le vide ne vaut rien ; comparée à une ligne datée et
chiffrée, elle est vérifiable en deux secondes sur l'appli bancaire.

Et le calcul est montré **avant** d'écrire : « 3 000 € lus, moins 1 870 € de
mouvements → 1 130 € au 01/06 ». Un chiffre qu'on ne peut pas refaire à la main est un
chiffre qu'on ne peut pas vérifier.

### ⚠️ L'attestation est conservée — c'est tout l'intérêt

`BankAccount.attested_balance` / `attested_on` ne dénormalisent pas un solde : comme
`opening_balance`, ce sont des **saisies**, pas des calculs. Les garder transforme une
reconstruction ponctuelle en **ancrage re-vérifiable** :

> `opening_balance + Σ mouvements jusqu'à attested_on == attested_balance`

Vrai par construction à l'écriture. Faux dès que les lignes bougent — une semaine
oubliée importée après coup, une opération supprimée. Le détecteur
**`account_anchor_stale`** le dit, au lieu de laisser **tous** les soldes du compte
faux d'une constante que rien ne rattraperait sur un fichier sans colonne solde.

C'est la **troisième jambe** de la famille continuité, et les trois sont
complémentaires : `account_chain_broken` pour les banques qui impriment leurs soldes,
`statement_period_gap` pour les périodes jamais importées, `account_anchor_stale` pour
la reconstruction que les deux premiers ne peuvent pas voir.

**Non arbitrable** (`waivable=False`) : un solde attesté que l'arithmétique contredit
n'est pas un choix de gestion. Il manque un relevé, ou la lecture était fausse.

Une reconstruction qu'on ne peut pas re-vérifier serait exactement l'orphelin
silencieux que le parcours 26 existe pour supprimer.

### API

- `GET /api/banking/accounts/{id}/balance-anchor/` — `source`, `last_operation`,
  `movements`, `earliest_line` / `latest_line`, `gaps`, et la valeur proposée quand
  le relevé la porte.
- `POST /api/banking/accounts/{id}/balance-anchor/` — sans corps en mode `statement` ;
  `{balance, as_of, from_date?}` en mode `attestation`. `from_date` omise ⇒ la plus
  ancienne ligne, ce que l'utilisateur veut presque toujours.

`attested_balance` / `attested_on` sont **lecture seule** sur
`BankAccountSerializer` : les écrire séparément permettrait de stocker une attestation
qui contredit le solde d'ouverture qu'elle est censée justifier.

### Frontend

`BalanceAnchorDialog`, ouvert depuis trois endroits : l'écart
« compte hors de portée du contrôle » (dès que le compte porte des lignes — sinon
seul « Corriger » a un sens), l'écart `account_anchor_stale`, et le menu de la carte
de compte.

## Règle transverse
- On n'additionne **jamais** un total banque et un total interactions. Le pont est un
  taux de couverture, pas une somme.
- **Ne jamais demander une information que House peut calculer.** Le solde
  d'ouverture se lit dans le relevé quand il y est, se retrouve par soustraction
  sinon. Le formulaire nu du lot 7 était un cul-de-sac pour toute banque qui
  n'exporte pas ses soldes.

## Points d'attention

- La migration `interactions` du lot 5 devra déclarer `dependencies` sur la
  migration `banking` créant `BankTransaction`, et référencer le modèle par
  chaîne (`'banking.BankTransaction'`) pour éviter l'import circulaire.
- `apps/core/file_validation.py` reste **hors du chemin** : comme l'électricité,
  l'import lit le fichier uploadé sans créer de `Document`, donc la validation
  par magic bytes ne s'applique pas. La garde est une **limite de taille**
  (`views.STATEMENT_MAX_SIZE`, 10 Mo) plus la validation de l'adaptateur.
- Faire évoluer la recette de hachage impose de bumper `HASH_RECIPE_VERSION` et
  d'écrire une commande de recalcul — jamais une data migration silencieuse.
- `interactions.queries.sum_amount()` n'a encore aucun appelant — le « reste à
  ventiler » du lot 5 doit l'utiliser plutôt qu'un 10ᵉ `Sum("amount")` en dur.
