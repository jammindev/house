# Import idempotent & rapprochement flou

> Fiche liée au [parcours 25](../parcours/PARCOURS_25_RELEVES_BANCAIRES.md) — les relevés bancaires comme source de vérité des dépenses.
> Voir aussi : [CARTOGRAPHIE_DEPENSES.md](./CARTOGRAPHIE_DEPENSES.md) (le mécanisme de dépense qu'on branche dessus).

## 1. Le problème

On veut importer un relevé bancaire, plusieurs fois, depuis plusieurs banques, sans jamais dupliquer une ligne — et coller ces lignes aux achats que l'utilisateur a déjà saisis à la main dans l'app.

Trois difficultés se cumulent, et aucune n'est celle qu'on croit :

**(a) Un CSV bancaire n'a pas d'identifiant.** Contrairement à une API, un export CSV ne fournit généralement aucune clé primaire. Deux cafés à 3,50 € le même jour au même endroit produisent deux lignes rigoureusement identiques. Il faut pourtant distinguer « la même ligne réimportée » (à ignorer) de « deux vraies opérations identiques » (à créer toutes les deux).

**(b) Chaque banque exporte différemment.** Colonnes nommées autrement, débit/crédit en deux colonnes ou en une colonne signée, `1 234,56` avec une espace insécable, dates en `JJ/MM/AAAA` ou en ISO, préambule de six lignes avant l'en-tête. Écrire un parser par banque ne passe pas à l'échelle — et il y en a déjà deux dans ce foyer.

**(c) Le relevé arrive en retard.** L'utilisateur achète un sac de granulés le 12, l'enregistre dans House le 12, et la ligne `CB LECLERC` apparaît sur le relevé le 14. Ce sont deux traces du même fait. Si on ne les réunit pas, le foyer compte deux fois ; si on exige le relevé pour saisir, on tue le geste immédiat qui fait la valeur de l'app.

## 2. Le concept en deux phrases

**L'idempotence d'import** consiste à dériver, pour chaque ligne, une **clé naturelle stable** — un hash de ses champs signifiants — de sorte que rejouer le même fichier produise les mêmes clés et donc zéro écriture. **Le rapprochement flou** consiste à apparier deux enregistrements qui décrivent le même fait sans partager d'identifiant, en **scorant** leur ressemblance sur plusieurs dimensions et en n'automatisant que les appariements certains.

## 3. Comment on l'a appliqué dans house

### 3.1 Un adaptateur par format, pas par banque

L'architecture est reprise telle quelle de `apps/electricity/importers/`, qui résout déjà le même problème pour les fournisseurs d'électricité :

```
BaseStatementImporter (ABC)     key, label, detect(raw)->bool,
                                parse(raw, *, options) -> list[NormalizedTransaction]
    ├── generic_csv             detect() renvoie toujours False → mapping utilisateur
    └── generic_xlsx            idem, via openpyxl
                    ↓
        NormalizedTransaction   la forme pivot : booked_on, label_raw, amount signé,
                                currency, balance_after?, external_id?
                    ↓
        services.import_statement_file  → dédup → BankTransaction
```

Le générique ne vient pas d'un parser universel — il vient du fait que **l'utilisateur décrit lui-même ses colonnes**, une fois. Le mapping est ensuite **mémorisé sur le compte** (`BankAccount.import_options`), donc les imports suivants sont un simple dépôt de fichier. C'est la seule différence assumée avec l'électricité, qui redemande le mapping à chaque fois.

Ajouter une troisième banque coûte alors trente secondes d'interface, pas une PR.

### 3.2 La recette du `dedup_hash`

```
sha256( "v1" | account_id | booked_on | label_norm | amount | currency | discriminant )
```

`label_norm` est le libellé décomposé en NFKD, sans diacritiques, en majuscules, espaces collapsés, ponctuation retirée **sauf les chiffres** — la référence de carte est souvent le seul discriminant réel d'une ligne.

Le `discriminant` répond au problème (a), par ordre de préférence :

1. **`external_id`** si la banque fournit une référence d'opération. Discriminant parfait.
2. **`balance_after`** si le fichier porte une colonne solde. C'est l'astuce la plus utile : *deux opérations identiques le même jour ont forcément des soldes courants différents*. La plupart des exports français (Crédit Agricole, LCL, BNP, Boursorama) portent cette colonne.
3. **L'index d'occurrence intra-fichier** (`#0`, `#1`…) sinon : parmi les lignes de clé naturelle identique **dans le fichier en cours**, dans l'ordre du fichier.

Le point subtil est le mot **intra-fichier**. Compter les occurrences déjà présentes en base pour décaler l'index détruirait l'idempotence : réimporter le même fichier produirait `#2`, `#3`, et dupliquerait tout. L'index intra-fichier est déterministe — même fichier, mêmes hash, zéro création — et les fichiers qui se chevauchent partagent naturellement leurs hash sur la période commune.

Le hash est calculé par le **service**, jamais par l'adaptateur (l'adaptateur ne connaît pas le compte), il est `editable=False` et **n'est jamais recalculé** : sinon nettoyer un libellé ferait ressurgir des doublons. Le préfixe `v1` rend toute évolution de la recette explicite — la changer invaliderait tous les hash existants et exigerait une commande de recalcul, pas une migration silencieuse.

L'unicité est ensuite garantie par la base : `UniqueConstraint(account, dedup_hash)` + `bulk_create(ignore_conflicts=True)`, exactement comme `ConsumptionRecord`.

### 3.3 Le scoring du rapprochement

Pour chaque ligne bancaire non ventilée, on présélectionne en SQL les dépenses non rapprochées dont le montant est proche et dont la date tombe dans une fenêtre **−7 / +3 jours** (une carte est débitée après l'achat, mais l'utilisateur saisit parfois avec un jour de retard). Puis on score :

| Dimension | Poids | Règle |
|---|---|---|
| Montant | 0.50 | exact → plein ; sinon décroissant jusqu'à la tolérance |
| Date | 0.30 | décroissant sur 7 jours d'écart |
| Libellé | 0.20 | `difflib.SequenceMatcher`, **forcé au maximum si le fournisseur est une sous-chaîne du libellé** — le cas `LECLERC` dans `CB LECLERC 12/07` est le plus fréquent de tous |

`difflib` est dans la bibliothèque standard : le rapprochement n'ajoute aucune dépendance.

**Deux seuils, et une règle qui compte plus que les seuils** :

- **Auto-match** : score ≥ 0.85 **et montant strictement égal** **et** candidat unique.
- **Suggestion** : au-dessus de 0.55, ou score élevé mais montant approché. Remonté à l'utilisateur, jamais écrit.

Le « montant strictement égal » est la décision structurante. Un appariement à cinq centimes près est probablement bon, mais il casserait l'invariant « la somme des ventilations ne dépasse pas la ligne » et introduirait des résidus impossibles à expliquer. Un écart se règle en un clic humain, pas en douce.

Enfin, l'affectation est un **glouton stable** et non un `argmax` par ligne : on trie toutes les paires candidates par score décroissant et on ne retient une paire que si ses deux côtés sont encore libres. Sans ça, deux achats de 20 € face à deux lignes de 20 € produiraient des appariements croisés ou doubles.

### 3.4 Le solde comme contrôle, pas comme fonctionnalité

Le solde d'un compte se calcule de deux façons, par ordre de confiance : **ancré** sur le `balance_after` de la ligne la plus récente quand la banque l'exporte, **dérivé** de `solde d'ouverture + Σ montants` sinon.

Quand `balance_after` est présent, on obtient gratuitement un **contrôle de chaîne** : sur deux lignes consécutives, `balance_after[n] − balance_after[n−1]` doit valoir `amount[n]`. Si ça ne tombe pas juste, il manque des opérations, et l'app le dit — « chaîne rompue entre le 3 et le 17 mars » — au lieu d'afficher un solde faux avec aplomb.

C'est le vrai rôle du solde dans ce parcours : il est le **test de non-régression de l'import**. Si le solde calculé tombe sur celui du relevé papier, l'import est bon.

## 4. Pourquoi cette implémentation

### 4.1 Une dépense *est* une ventilation — il n'y a pas de table `Allocation`

C'est la décision la plus lourde de conséquences du parcours.

Une ligne de 120 € ventilée 80/40 produit **deux `Interaction(type='expense')`**, chacune avec son `amount` et son `budget`, toutes deux pointant la même `BankTransaction` par une FK nullable. Pas de table intermédiaire.

Le gain est direct : `amount` **reste une colonne scalaire**. Les neuf `Sum("amount")` du projet — résumé des dépenses, vue budgets, bilan mensuel, coût réel d'un projet — ne bougent pas d'une ligne, et surtout aucune agrégation ne se retrouve à sommer par-dessus une jointure 1-N, ce qui est la source classique de double comptage silencieux. La non-modification de `budget/aggregations.py::_spent_by_budget` est le critère de succès de ce choix.

Le raisonnement de fond suit la règle « Interaction vs modèle dédié » du `CLAUDE.md`, qui rappelle qu'une entrée du journal obtient gratuitement quatre consommateurs transverses : fil d'activité, page dépenses et `Project.actual_cost`, RAG de l'agent, liaisons génériques (zones, documents, tâches). **Une ventilation a besoin des quatre.** « 80 € de courses le 12 juillet » est un fait daté, plat, sans invariant propre : la définition littérale d'une entrée de journal. Créer une table `Allocation`, c'était recâbler les quatre consommateurs sur une table parallèle.

En sens inverse, `BankAccount`, `StatementImport` et `BankTransaction` **sont** des modèles dédiés, et cochent quatre des cinq critères de la règle — au premier rang desquels une contrainte DB qui porte une garantie métier : `unique(account, dedup_hash)` **fonde l'idempotence**, exactement comme `unique(household, date)` fonde l'upsert d'`EggLog`.

### 4.2 Les conséquences qu'il faut accepter

Ce choix n'est pas gratuit, et les contreparties méritent d'être écrites.

**Le journal affiche deux lignes pour une opération splittée.** C'est correct sémantiquement — le journal liste *ce sur quoi on a dépensé*, pas les débits — mais le compteur de dépenses augmente d'une unité par split, et une opération de 120 € splittée ne remonte plus dans le « top 5 des dépenses » du bilan. Pour un bilan *par budget*, c'est plus juste.

**Éditer un split peut supprimer des `Interaction`.** D'où une règle de service stricte : l'éditeur de ventilation ne supprime que les dépenses qu'il a lui-même créées (`kind='bank'` et sans objet source) ; une dépense pré-existante — un achat de stock rapproché — n'est jamais supprimée, seulement **détachée**. Symétriquement, la FK est en `SET_NULL` : supprimer une ligne bancaire ne doit jamais détruire un fait journalisé.

**La surface de l'invariant s'élargit.** `Interaction.amount` est écrit par six producteurs, par `InteractionSerializer` en PATCH direct, et par `undo_purchase`. Aucun ne connaît la ligne bancaire. Un validateur partagé doit donc être appelé depuis le serializer autant que depuis le service de ventilation, sans quoi un PATCH de 80 € à 500 € casserait l'invariant en silence.

**Les recettes vivent hors du journal.** Une entrée d'argent n'est pas un fait du foyer au sens du journal ; elle reste une ligne bancaire, agrégée à part. Corollaire à respecter partout : **on n'additionne jamais un total banque et un total interactions**. Ce sont deux vues du même argent, et leur écart est précisément l'information utile — le taux de couverture.

### 4.3 Ce qui pourrit ce genre de système, et comment on l'évite

Trois pièges connus, tous adressés par une règle plutôt que par du code :

- **Supprimer un import.** Supprimer puis réimporter recrée les lignes avec de nouveaux UUID, donc **perd toutes les ventilations**. `DELETE` est simplement interdit sur `StatementImport`.
- **Le volume.** Deux banques, c'est environ 160 lignes par mois. Si chaque ligne exige une action, l'utilisateur décroche en deux mois. C'est le rapprochement automatique, puis la catégorisation apprise (différée), qui décident de la survie du système — pas le socle d'import.
- **Le décalage des dates.** Une dépense créée depuis une ligne bancaire prend `occurred_at` à **midi dans le fuseau du foyer**. À minuit, une opération du 1er ou du 31 basculerait de mois à la conversion UTC, et changerait de budget mensuel.

## 5. Ce qu'on a écarté et pourquoi

**Une table `Allocation` avec `Interaction.amount` dérivé.** Rejetée : elle obligerait les six producteurs existants (achat de stock, d'équipement, de projet, de poule…) à créer une « allocation orpheline » pour chaque dépense sans contrepartie bancaire — ce qui démontre que l'allocation n'est pas une entité, mais la dépense elle-même. Elle imposerait en prime de réécrire les neuf agrégations avec un risque de double comptage, et une cascade depuis la ligne bancaire ferait *disparaître de l'argent* du journal en silence.

**Une contrainte DB sur l'invariant de ventilation.** Impossible et, surtout, non discriminante : un `CHECK` est par ligne, jamais inter-lignes, et une table `Allocation` ne l'aurait pas rendu plus contraignable. Dans les deux architectures, l'invariant se tient par un service qui verrouille la ligne bancaire (`select_for_update`) avant de valider. Autant choisir l'architecture qui coûte le moins ailleurs.

**Un parser dédié par banque.** Rejeté au vu de l'expérience de `apps/electricity/` : les adaptateurs spécifiques (Enedis CSV, Enedis XLSX) ont une durée de vie courte, et c'est le `generic_csv` à mapping utilisateur qui absorbe tous les cas non prévus. On garde la possibilité d'ajouter un adaptateur détecté automatiquement, mais le générique est le chemin par défaut, pas le filet.

**La déduplication par index d'occurrence calculé sur la base.** Rejetée : elle casse l'idempotence, qui est l'objectif même du mécanisme.

**L'auto-rapprochement sur montant approché.** Rejeté : le gain de confort ne compense pas des résidus de quelques centimes impossibles à expliquer, répartis sur des centaines de lignes. L'écart devient une suggestion.

**Un hook de rapprochement dans les six producteurs de dépense.** Rejeté : six points de couplage pour un gain marginal. Le rapprochement se déclenche à l'import et à la demande, ce qui couvre les deux sens du décalage.

**La dénormalisation du solde** en colonne mise à jour à l'écriture. Rejetée pour la même raison que le « dépensé » du parcours 21 : une source de vérité concurrente qui dérive au premier import partiel. Le solde est recalculé à la lecture, borné par l'ancrage sur `balance_after`.

**Les agrégateurs bancaires (DSP2, type Bridge ou Powens).** Hors sujet produit : ils imposeraient un intermédiaire financier tiers, des identifiants bancaires confiés à un service externe, et un abonnement — pour une app de foyer auto-hébergée.

## 6. Pour aller plus loin

- [Idempotency in distributed systems — Stripe](https://stripe.com/blog/idempotency) — pourquoi la clé d'idempotence est fournie par l'appelant, et ce que ça change quand elle ne l'est pas (notre cas).
- [ISO 20022 / CAMT.053](https://www.iso20022.org/) — le format normalisé de relevé bancaire, et son identifiant d'opération natif. La cible si une banque le propose.
- [`difflib.SequenceMatcher`](https://docs.python.org/3/library/difflib.html) — l'algorithme derrière le score de libellé (Ratcliff-Obershelp).
- [Record linkage](https://en.wikipedia.org/wiki/Record_linkage) — le nom académique du rapprochement flou, et la distinction déterministe / probabiliste.
- [Comptabilité en partie double](https://fr.wikipedia.org/wiki/Comptabilit%C3%A9_en_partie_double) — ce qu'on ne fait volontairement pas ; la contrepartie retrait → espèces en est le seul emprunt.
