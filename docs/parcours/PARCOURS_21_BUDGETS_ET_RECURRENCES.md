# Parcours 21 — Je pilote mon budget et j'anticipe mes dépenses

> Cadrage : 2026-07-16. Prolonge le parcours 08 (suivre les dépenses).
> Le socle dépenses existe déjà — `Interaction` type `expense`, agrégations,
> `Project.actual_cost`. Ce parcours ajoute la **projection** : des budgets
> mensuels pour se fixer un cap, des récurrences pour anticiper la trésorerie,
> et un bilan mensuel rédigé par l'IA pour comprendre où est parti l'argent.
> Gros ROI perçu pour peu de schéma nouveau.
>
> Issues : #312 (Lot 1), #313 (Lot 2), #314 (Lot 3).

## Décisions produit (actées)

1. **Les budgets multiples nommés SONT la dimension de regroupement.** Pas de
   taxonomie de catégories séparée : l'utilisateur crée des enveloppes (« Courses »,
   « Loisirs », « Travaux »…) qui jouent le rôle de catégorie. Un concept au lieu
   de deux. Décision prise après avoir écarté les zones (« pas d'intérêt ») et les
   catégories libres (fragmentation, alerte non fiable).
2. **Rattachement d'une dépense à un budget = optionnel.** Un sélecteur à la
   saisie, jamais obligatoire, pas de reclassement forcé de l'existant. Ce qui
   n'est pas rattaché tombe dans **« hors budget »** — une ligne toujours visible
   dans la vue d'ensemble (miroir, sans plafond ni alerte), jamais un trou.
3. **Un budget global mensuel optionnel comme filet.** Il plafonne **tout**
   (budgeté + hors budget) et répond à la seule question « est-ce que je dérape
   globalement ? ». Les budgets nommés deviennent des sous-enveloppes ; la vue
   d'ensemble signale si leur somme dépasse le global.
4. **Récurrences en prévision + confirmation 1-clic, jamais de génération auto.**
   Une facture varie, une date glisse : l'auto-création crée des dépenses fausses
   en silence. La récurrence projette la trésorerie ; à l'échéance un rappel
   propose « confirmer » (montant éditable) → crée la vraie `Interaction` via
   `create_manual_expense_interaction` et avance l'échéance.
5. **Le bilan mensuel EST un ping** (`ping_type` mensuel), calqué sur le digest
   quotidien du parcours 19 : on hérite de l'opt-in, du fuseau, de la langue, du
   fallback gabarit et de la livraison Telegram. Repolissage IA optionnel et hors
   chemin critique.
6. **Tout membre gère budgets et récurrences.** Cohérent avec la saisie de
   dépenses, déjà ouverte à tous les membres. Données scopées foyer. Pas de
   réserve owner en V1 (durcissable plus tard si besoin).

## Vue d'ensemble cible (illustration)

```
Budget global : 1 850 / 2 000 €   92 %
  ├─ Courses      420 / 400 €   ⚠ dépassé
  ├─ Loisirs      130 / 200 €
  ├─ Travaux      600 / 800 €
  └─ Hors budget  700 €          (pas de plafond)
```

## Backlog

### Lot 1 — Budgets mensuels (enveloppes) + alerte de dépassement · Must · #312

| # | Story | État |
|---|---|---|
| 1.1 | Créer / éditer / supprimer (undo) plusieurs budgets nommés à montant mensuel | ✅ V1 |
| 1.2 | Rattacher une dépense à un budget (sélecteur optionnel à la saisie) | ✅ V1 |
| 1.3 | Compteur par budget « dépensé / budgété » + états attention (80 %) / dépassement | ✅ V1 |
| 1.4 | Vue d'ensemble : tous les budgets + ligne « hors budget » + budget global optionnel | ✅ V1 |

> Lot 1 livré côté implémentation (module `budget` + FK `Interaction.budget` +
> câblage agent + UI). Voir [docs/MODULES/budget.md](../MODULES/budget.md).

### Lot 2 — Dépenses récurrentes + prévision de trésorerie · Must · #313

| # | Story | État |
|---|---|---|
| 2.1 | Déclarer une récurrence (libellé, montant, cadence, échéance, fournisseur, budget) | ⏳ à faire |
| 2.2 | Prévision de trésorerie à 30 / 90 jours + « engagé à venir » sur le compteur mensuel | ⏳ à faire |
| 2.3 | Rappel d'échéance + confirmation 1-clic (montant éditable) → crée l'`Interaction`, undo | ⏳ à faire |

### Lot 3 — Bilan mensuel rédigé par l'IA · Should · #314

| # | Story | État |
|---|---|---|
| 3.1 | Bilan mensuel généré en début de mois (total vs budgets, top dépenses, récurrences, tendance) | ⏳ à faire |
| 3.2 | Consulter le bilan dans l'app (dernier + historique) ; push Telegram optionnel | ⏳ à faire |

## Limites V1 assumées

- **Pas de catégories dédiées** : les budgets nommés en tiennent lieu. Une dépense
  appartient à au plus un budget. Le Lot « catégories prédéfinies » a été fusionné
  ici et ne sera ré-ouvert que si le besoin réel se confirme à l'usage.
- **Pas de génération automatique de dépenses** depuis les récurrences : toujours
  une confirmation explicite (décision 4).
- **Un seul canal sortant** pour le bilan : Telegram (comme le digest).
- **Budget mensuel reconduit tel quel** chaque mois (pas d'override par mois en V1).

## Prérequis transverses (rappels maison)

- Scoping foyer sur tous les modèles ; permissions member/owner (ici : tout membre).
- Undo sur toute suppression (budget, récurrence, confirmation d'échéance).
- i18n 4 langues : namespaces `budget.*`, `recurring.*`, `budget.report.*`.
- Tutoriels (`/tutorials`) mis à jour dans la même PR que chaque lot livrant de l'UI.
