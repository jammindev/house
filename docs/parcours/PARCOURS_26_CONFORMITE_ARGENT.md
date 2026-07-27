# Parcours 26 — Conformité Comptes / Dépenses / Budget

> **Objectif** : une vision claire et précise de l'argent du foyer, **verrouillée**.
> Malgré le nombre de mécanismes, tout s'emboîte : **aucun orphelin ne subsiste
> sans être vu**.
>
> Suite directe du parcours 25 (`PARCOURS_25_RELEVES_BANCAIRES.md`), qui a fait des
> relevés la source de vérité. Ce parcours-ci n'ajoute pas une fonctionnalité, il
> ajoute une **garantie**.

## Le problème

`banking`, `expenses` et `budget` ont été conçus à trois moments différents. Chacun
fonctionne. Leur **articulation** laisse des états orphelins silencieux :

- de l'argent sorti du compte que personne n'a affecté ;
- des dépenses saisies que la banque n'a jamais confirmées ;
- des mouvements internes sans contrepartie ;
- des périodes de relevé jamais importées ;
- des échéances récurrentes ni confirmées ni annulées.

Aucun de ces états n'est visible. C'est ce qui les rend coûteux : on ne peut pas
faire confiance à un total dont on ignore la part manquante.

## La règle structurante

> Toute entité est soit **résolue**, soit **flaggée avec un motif**.
> Rien ne reste dans un entre-deux silencieux.

Quatre conséquences, non négociables :

1. **Un orphelin ne peut pas être masqué.** Écarter une anomalie n'est pas
   l'effacer : c'est enregistrer un arbitrage **motivé, daté, signé, révocable et
   visible**. Le compteur tombe à zéro parce que tout a été *arbitré*, jamais parce
   qu'on a caché quelque chose.
2. **Un arbitrage ne survit pas au changement de ce qu'il arbitre.** Sinon le flag
   devient la meilleure cachette de l'app — l'inverse du but.
3. **La conformité est mesurée, pas supposée**, et **bornée**. Un écart qu'on ne
   peut pas résoudre n'est pas un écart, c'est du bruit qui fait abandonner le
   contrôle.
4. **Le modèle ne doit pas permettre de créer de nouveaux types d'orphelins.**
   Chaque lot qui ajoute un mécanisme ajoute aussi son détecteur — point de revue.

## Décisions de cadrage

| Sujet | Décision |
|---|---|
| Saisie hors relevé | **Tout devient une ligne de compte.** La dépense ad hoc devient une opération sur le compte espèces — donc ventilable et contrôlable comme les autres. |
| Navigation | **Un module « Argent » à onglets** : Contrôle / À ranger / Comptes / Dépenses / Budgets. |
| Pré-catégorisation | **Différée.** La file est rapide par son ergonomie (raccourcis, actions groupées), pas par la devinette. |
| Récurrences | **Le relevé confirme.** La confirmation manuelle devient l'exception. |
| Soldes | **Suivis, et le solde d'ouverture est requis.** Sans lui le solde est une supposition — donc une non-conformité, pas une option. |

## L'horizon de conformité

Un contrôle non borné afficherait, au premier lancement, des centaines d'écarts
**structurellement irrésolubles** : les dépenses saisies avant le premier relevé
n'ont aucune ligne bancaire à laquelle se rattacher.

La fenêtre d'un compte est `[opening_balance_date, dernière date connue]`. Avant :
de l'historique. Après le dernier relevé : normal. **Entre les deux : exigence
totale** — c'est ce qui rend « zéro écart » atteignable, donc digne d'être visé.

Un compte sans solde d'ouverture n'a pas de fenêtre : ses dépendants ne sont **pas
évaluables** (jamais « conformes »), et le prérequis est signalé seul. Une action
au lieu de neuf cents sur le premier écran.

Implémenté une seule fois dans `apps/banking/coverage.py`.

## Le catalogue des orphelins

Le contrat du parcours. Chaque entrée a un **détecteur**, une **résolution**, et le
motif d'arbitrage légitime — ou l'absence de motif légitime quand c'est une
incohérence à corriger.

### Sur une ligne bancaire (sortie, non interne, dans la fenêtre)

| Écart | Détection | Résolution | Flag légitime | Lot |
|---|---|---|---|---|
| **Non ventilée** | 0 allocation | ventiler | « ne concerne pas le foyer » | 1 ✅ |
| **Partiellement ventilée** | `Σ allocations < outflow` | compléter | « le reste ne m'intéresse pas » | 1 ✅ |
| **Interne sans contrepartie** | `is_internal` et `transfer_counterpart IS NULL` | créer la contrepartie | « transfert vers un compte non suivi » | 5 ✅ |

### Sur une recette

| Écart | Détection | Résolution | Flag légitime | Lot |
|---|---|---|---|---|
| **Non classée** | `inflow_nature` vide | classer (revenu / remboursement / interne) | « sans objet » | 5 ✅ |

### Sur une dépense (`Interaction type='expense'`)

| Écart | Détection | Résolution | Flag légitime | Lot |
|---|---|---|---|---|
| **Non rapprochée** | `bank_transaction IS NULL` et date dans la fenêtre | rattacher à une ligne | « payé par un tiers » | 1 ✅ |
| **Hors budget** | `budget IS NULL` | affecter un budget | « hors de tout budget, volontairement » | 3 ✅ |

### Sur un compte

| Écart | Détection | Résolution | Flag légitime | Lot |
|---|---|---|---|---|
| **Hors de portée du contrôle** | pas de fenêtre : solde d'ouverture absent **ou** daté après les relevés | le renseigner, ou reculer sa date | **aucun — prérequis bloquant** | 1 ✅ (requis à la création : 7 ✅ · date postérieure : corrigé après recette) |
| **Chaîne de soldes rompue** | `balances.check_balance_chain` | importer le relevé manquant | « relevé indisponible » | 1 ✅ |
| **Période non couverte** | trou entre deux `StatementImport` | importer | « pas d'opération sur la période » | 7 ✅ |
| **Espèces à découvert** | solde espèces négatif | déclarer le retrait qui l'alimente | **aucun — incohérence** | 4 ✅ |
| **Solde constaté qui ne concorde plus** | `opening_balance + Σ mouvements ≠ attested_balance` | importer le relevé manquant, ou relire son solde | **aucun — incohérence** | 8 ✅ |

### Sur une récurrence

| Écart | Détection | Résolution | Flag légitime | Lot |
|---|---|---|---|---|
| **Échéance passée non confirmée** | `next_due_date < today` | confirmer, ou laisser le relevé le faire | « prélèvement arrêté » | 6 ✅ |
| **Double confirmation** | deux dépenses sur la même échéance | supprimer la doublonne | **aucun — bug de données** | 6 ✅ |

### Sur un import

| Écart | Détection | Résolution | Flag légitime | Lot |
|---|---|---|---|---|
| **Lignes ignorées** | `skipped_count > 0` sans référence ni solde | vérifier manuellement | « doublons confirmés » | 7 ✅ |

## Le mécanisme d'arbitrage

`banking.ComplianceWaiver` — **un seul modèle, uniforme**, plutôt que des
`dismissed_at` / `ignored` / `accepted_gap` éparpillés qui recréeraient des états
hétérogènes et incomparables.

- `finding_kind` + FK polymorphe `(content_type, object_id)`
- `reason` **requis** — un flag sans motif ne vaut rien
- `fingerprint` — **la garde anti-péremption**
- `UniqueConstraint(household, finding_kind, content_type, object_id)`

### Pourquoi un arbitrage doit pouvoir périmer

Chaque écart expose le hash de ce qui le **fonde** (le reste à ventiler, le montant
manquant…). Le waiver mémorise celui du moment de l'arbitrage. Quand il ne
correspond plus, l'écart réapparaît marqué **périmé**, motif d'origine visible.

Sans ce champ : arbitrer « le reste de cette ligne de 150 € ne m'intéresse pas »
puis ventiler 90 € laisserait 60 € couverts par un motif qui ne décrit plus rien.

## Les lots

| Lot | Sujet | Statut |
|---|---|---|
| 1 | **Socle de conformité** — `ComplianceWaiver`, `coverage.py`, registre de détecteurs, 5 détecteurs, API | ✅ Livré |
| 2 | **Module « Argent »** — coque à onglets, panneau Contrôle, file de rangement, actions groupées | ✅ Livré |
| 3 | **Une ventilation porte projet, zone et budget** — les deux axes sont indépendants | ✅ Livré |
| 4 | **Tout est une ligne de compte** — `create_manual_transaction`, espèces | ✅ Livré |
| 5 | **Recettes et mouvements internes** — `inflow_nature`, contreparties | ✅ Livré |
| 6 | **Le relevé confirme les récurrences** — `match_recurrences` | ✅ Livré |
| 7 | **Continuité des relevés et provenance** — solde d'ouverture requis, badges | ✅ Livré |
| 8 | **Retrouver le solde d'ouverture** — `anchoring.py`, attestation re-vérifiée | ✅ Livré |

Détail d'implémentation par lot : `docs/MODULES/banking.md`.

## Le catalogue est complet

**14 détecteurs**, couvrant les 17 lignes du catalogue (certaines lignes partagent un
détecteur). Quatre n'admettent **aucun** arbitrage, et c'est structurant :

| Clé | Pourquoi aucun motif ne tient |
|---|---|
| `account_without_window` | Prérequis : sans fenêtre de conformité, aucun contrôle ne porte sur le compte. |
| `account_cash_negative` | Physiquement impossible : un retrait n'a pas été déclaré. |
| `recurring_double_confirmed` | Compter une facture deux fois n'est jamais acceptable. |
| `account_anchor_stale` | L'arithmétique contredit un solde que l'utilisateur a lui-même relevé : il manque un relevé, ou la lecture était fausse. |

Les dix autres sont arbitrables — et chaque arbitrage **périme** si ce qu'il couvrait
change.

## La recette qui prouve la garantie

Sur le vrai relevé Crédit Agricole (116 lignes) :

1. Onglet Contrôle → **un seul écart actionnable en tête** : le compte sans solde
   d'ouverture. Les dépendants affichent « non évaluable », pas « conforme ».
2. Renseigner le solde d'ouverture → l'écart disparaît **et** les dépendants
   s'évaluent (~100 lignes non ventilées, chaîne non vérifiable — l'export CA n'a
   pas de colonne solde). Ce solde passé étant précisément ce que le CA n'exporte
   pas, il se **retrouve** depuis le solde du jour (lot 8) plutôt que se deviner.
3. Aucune dépense antérieure au solde d'ouverture n'est signalée.
4. Ranger 20 lignes en actions groupées, arbitrer les frais bancaires avec motif.
5. Révoquer un arbitrage → l'écart resurgit à l'identique.
6. Arbitrer une ligne partiellement ventilée puis changer son split → l'écart
   revient en **arbitrage périmé**.
7. Traiter le reste jusqu'à **zéro écart ouvert**, avec
   `ouverts + arbitrés = détectés`.
