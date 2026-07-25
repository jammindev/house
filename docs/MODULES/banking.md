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
| 2 | Import CSV/XLSX (`StatementImport`, `BankTransaction`, dédup) | ⬜ #385 |
| 3 | Journal bancaire (liste, filtres, qualification, flux) | ⬜ #386 |
| 4 | Soldes, continuité & espèces | ⬜ #387 |
| 5 | Ventilation (FK `bank_transaction` sur `Interaction`) | ⬜ #388 |
| 6 | Rapprochement automatique | ⬜ #389 |
| 7 | Recettes, virements internes, couverture | ⬜ #390 |
| 8 | Intégration agent (lecture seule) | ⬜ #391 |
| 9 | Différé V2 — import PDF/photo | ⬜ #392 |

**Cette fiche décrit l'état livré (lot 1).** Les sections marquées *(à venir)*
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

## Ce que les lots suivants ajouteront *(à venir)*

- **Lot 2** — `StatementImport` + `BankTransaction`, adaptateurs d'import
  décalqués de `apps/electricity/importers/` (`BaseStatementImporter`, registry,
  `generic_csv` à mapping utilisateur mémorisé dans `BankAccount.import_options`).
  Idempotence par `UniqueConstraint(account, dedup_hash)`. **`DELETE` interdit sur
  `StatementImport`** : supprimer puis réimporter recrée les lignes avec de
  nouveaux UUID et perdrait toutes les ventilations.
- **Lot 5** — FK `Interaction.bank_transaction` (`SET_NULL`). **Il n'y a pas de
  table `Allocation`** : une `Interaction(type='expense')` *est* une ventilation.
  `amount` reste donc une colonne scalaire et les 9 `Sum("amount")` du projet ne
  bougent pas.
- **Règle transverse** — on n'additionne **jamais** un total banque et un total
  interactions. Le pont est un taux de couverture, pas une somme.

## Points d'attention

- La migration `interactions` du lot 5 devra déclarer `dependencies` sur la
  migration `banking` créant `BankTransaction`, et référencer le modèle par
  chaîne (`'banking.BankTransaction'`) pour éviter l'import circulaire.
- `apps/core/file_validation.py` n'autorise aujourd'hui ni CSV ni XLSX : à
  élargir au lot 2.
- `interactions.queries.sum_amount()` n'a encore aucun appelant — le « reste à
  ventiler » du lot 5 doit l'utiliser plutôt qu'un 10ᵉ `Sum("amount")` en dur.
