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
| 7 | Recettes, virements internes, couverture | ⬜ #390 |
| 8 | Intégration agent (lecture seule) | ⬜ #391 |
| 9 | Différé V2 — import PDF/photo | ⬜ #392 |

**Cette fiche décrit l'état livré (lots 1-6).** Les sections marquées *(à venir)*
annoncent le contrat que les lots suivants devront respecter.

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

Sous-page `/app/banking/transactions` (`TransactionsPage`) : `FlowSummaryCards` en
tête, `TransactionFilters` (recherche, compte, période, pills direction/interne),
`TransactionList` + `TransactionRow` avec les deux actions de qualification. Les
filtres sont persistés en session.

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

## Ce que les lots suivants ajouteront *(à venir)*
- **Lot 5** — FK `Interaction.bank_transaction` (`SET_NULL`). **Il n'y a pas de
  table `Allocation`** : une `Interaction(type='expense')` *est* une ventilation.
  `amount` reste donc une colonne scalaire et les 9 `Sum("amount")` ne bougent pas.
- **Règle transverse** — on n'additionne **jamais** un total banque et un total
  interactions. Le pont est un taux de couverture, pas une somme.

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
