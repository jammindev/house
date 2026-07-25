# 2026-07-25 — Parcours 25 cadrage initial

## Contexte

Session de cadrage du vingt-cinquième chantier de House : faire des **relevés
bancaires importés** la source de vérité des dépenses, à la place de la saisie
déclarative.

Déclencheur : à l'usage, le journal des dépenses est structurellement incomplet.
Une dépense n'existe que si quelqu'un a pensé à la saisir, et rien ne la confronte
jamais à ce qui sort réellement du compte. C'est la limite qui plafonne toute la
valeur du parcours 21 (budgets) — un budget « Courses » à 400 € ne veut rien dire
si la moitié des courses n'a jamais été saisie.

L'utilisateur a **deux banques**, d'où l'exigence d'un mécanisme générique, et
demande aussi la gestion des **recettes**, des **espèces**, du **split** d'une
ligne, et du **solde** de ses comptes.

Le but explicite de la session : **produire uniquement de la documentation, des
specs et les issues GitHub** — pas de code.

## Ce qui a été confirmé (décisions)

- **Deux couches, pas une.** « Le relevé est la source unique » ne peut pas être
  littéral : une ligne bancaire sait *combien* et *quand*, jamais *quoi*. La ligne
  bancaire est la vérité **financière**, l'`Interaction` reste la vérité
  **métier** (celle qui alimente `Project.actual_cost`, le RAG, les zones, les
  documents). Le relevé ne remplace pas la dépense, il la **justifie**.

- **Il n'y a pas de table `Allocation` — une `Interaction(type='expense')` EST une
  ventilation.** Décision structurante de tout le chantier. Une ligne de 120 €
  splittée 80/40 produit deux interactions pointant la même `BankTransaction` via
  une FK nullable. Gain direct : **`amount` reste une colonne scalaire**, donc les
  9 `Sum("amount")` du projet ne bougent pas et aucune agrégation ne somme
  par-dessus une jointure 1-N (source classique de double comptage silencieux).
  L'alternative (« `amount` devient dérivé ») obligerait les 6 producteurs
  existants à fabriquer une « allocation orpheline » pour chaque achat de stock
  sans contrepartie bancaire — preuve que l'allocation n'est pas une entité, mais
  la dépense elle-même. Justification par la règle « Interaction vs modèle dédié »
  du `CLAUDE.md` : une ventilation a besoin des **quatre** consommateurs
  transverses que le journal offre gratuitement.

- **`BankAccount` / `StatementImport` / `BankTransaction` sont des modèles
  dédiés** (app `banking`), eux, parce qu'ils cochent quatre des cinq critères de
  la même règle — au premier rang desquels `unique(account, dedup_hash)`, qui
  **fonde l'idempotence de l'import** (même rôle que `unique(household, date)` sur
  `EggLog`).

- **Le pattern d'import existe déjà et sera décalqué, pas réinventé.**
  `apps/electricity/importers/` (`BaseImporter` + registry + `generic_csv` à
  mapping utilisateur) est exactement l'architecture multi-fournisseurs
  recherchée, et `import_consumption_file` donne le service idempotent de
  référence (validation intégrale avant écriture, `bulk_create(ignore_conflicts)`,
  trace d'import, « échec métier = 201 avec `status='failed'` »). Découverte qui a
  divisé le coût estimé du chantier. Seule divergence assumée : le mapping de
  colonnes est **mémorisé sur le compte** (l'électricité le redemande à chaque
  import).

- **Générique = un adaptateur par format, pas par banque.** La N-ième banque coûte
  30 secondes d'interface, pas une PR.

- **Déduplication sans identifiant natif** : `sha256` de la clé naturelle +
  discriminant, par ordre de préférence `external_id` → **`balance_after`** (deux
  opérations identiques le même jour ont forcément des soldes différents — astuce
  la plus utile, et la plupart des exports FR portent la colonne) → index
  d'occurrence **intra-fichier**. Le mot *intra-fichier* est le point subtil :
  compter les occurrences déjà en base détruirait l'idempotence.

- **Auto-rapprochement seulement sur montant strictement égal.** Score sur
  montant (0.50) + date (0.30, fenêtre −7/+3 j) + libellé (0.20, `difflib`, forcé
  au max si le fournisseur est une sous-chaîne du libellé). Tout écart produit une
  **suggestion**, jamais un lien silencieux : un appariement à 5 centimes près
  casserait l'invariant de ventilation et laisserait des résidus inexplicables.
  Affectation par **glouton stable**, pas `argmax` par ligne, sinon deux achats de
  20 € face à deux lignes de 20 € produisent des appariements croisés.

- **On n'additionne jamais un total banque et un total interactions.** Les recettes
  vivent hors du journal (une entrée d'argent n'est pas un fait du foyer). Le pont
  entre les deux vues est un **taux de couverture**, pas une somme.

- **Soldes suivis** (décision révisée en séance — le cadrage initial retenait
  « flux seulement »). Ancrés sur `balance_after` quand la banque l'exporte,
  dérivés de `opening_balance + Σ` sinon, **jamais dénormalisés** (même règle que
  le « dépensé » du parcours 21). Contrepartie : le solde impose la continuité des
  imports, d'où un **contrôle de chaîne** qui détecte les relevés manquants — un
  solde faux affiché avec aplomb serait pire que pas de solde.

- **Espèces = un `BankAccount(kind='cash')`** alimenté par une contrepartie de
  retrait (`transfer_counterpart`), les deux côtés `is_internal=True`. Le suivi de
  solde rend cette contrepartie **obligatoire** : sans elle, le solde espèces
  plonge en négatif dès la première dépense en liquide.

## Périmètre V1 vs différé

**V1** : comptes, import CSV/XLSX, journal bancaire, soldes + continuité + espèces,
ventilation, rapprochement automatique, recettes/virements internes, agent en
lecture seule.

**Différé** : import PDF/photo (lot 9 — les deux banques exportent du CSV, donc non
bloquant ; il manque un extracteur vision qui rende du **JSON structuré** et une
exécution hors requête HTTP), formats normalisés OFX/CAMT, catégorisation apprise,
remboursements rattachés à leur dépense d'origine, multi-devises, agrégateurs DSP2.

## Découpage

9 lots, ordre 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

Deux choix d'ordonnancement méritent d'être notés :

- **Le lot 4 (soldes) est placé avant la ventilation**, alors qu'il n'est pas un
  prérequis technique. Motif : le solde est le meilleur **test de l'import**. S'il
  tombe juste sur le relevé papier, l'import est bon — et on le sait avant d'avoir
  ventilé six mois de dépenses sur des données fausses.
- **Le lot 6 (rapprochement) décide de la survie du système.** Deux banques, c'est
  ~160 lignes par mois ; si chaque ligne exige une action manuelle, l'utilisateur
  décroche en deux mois. À prototyper sur des données réelles avant d'investir dans
  les lots 7-8.

## Livrables de la session

- Doc produit : `docs/parcours/PARCOURS_25_RELEVES_BANCAIRES.md`
- Fiche concept : `docs/fiches/IMPORT_ET_RAPPROCHEMENT.md` (+ index `fiches/README.md`)
- Backlog technique : `docs/parcours/PARCOURS_25_BACKLOG_TECHNIQUE.md`
- Mises à jour : `CLAUDE.md` (règles transverses dépenses), `CARTOGRAPHIE_DEPENSES.md`
  (limite « pas de split » levée, règle de non-addition), `NEXT_STEPS.md`
- Issues GitHub : 1 parente + 9 lots, label `app:banking` créé

## Suite

Checkpoint de validation avant tout code (règle du skill `/prepare-feature`).
L'implémentation du lot 1 se fera avec `/new-feature`, qui consomme ce backlog
comme point de départ.
