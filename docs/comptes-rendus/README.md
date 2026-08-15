# Comptes rendus d'implémentation

Ce dossier garde, pour un chantier livré, **ce que le code ne dit pas** : les
problèmes rencontrés en chemin, ce qui a été tranché sur le moment, et ce qui a
été laissé de côté.

## Pourquoi un troisième type de doc

Le dépôt en avait déjà deux, et aucun ne répond à cette question :

| Doc | Répond à |
|---|---|
| `docs/parcours/` | Qu'est-ce qu'on veut, et **pourquoi maintenant** |
| `docs/fiches/` | Comment marche le **concept**, et ce qu'on a écarté en théorie |
| `docs/MODULES/` | Comment marche le **code livré**, aujourd'hui |
| **`docs/comptes-rendus/`** | Ce qui s'est **passé pendant** — et ce qu'on a tranché |

La différence avec une fiche est nette : une fiche est **intemporelle** et
enseigne un concept ; un compte rendu est **daté** et raconte une exécution. Un
backlog dit ce qu'on comptait faire, un compte rendu dit ce qu'on a fait *et ce
qui a résisté*.

## Ce qu'un compte rendu doit contenir

1. **Ce qui a été livré**, lot par lot, avec ses PR.
2. **Les décisions prises en cours de route** — celles qui n'étaient pas au
   cadrage, avec ce qui les a forcées.
3. **Les problèmes rencontrés**, et comment ils ont été tranchés. C'est la
   section qui a le plus de valeur six mois plus tard : un bug qu'on a mis vingt
   minutes à comprendre se re-comprend en deux si quelqu'un l'a écrit.
4. **Ce qui a été laissé de côté**, explicitement, avec la raison.
5. **Ce que l'environnement a coûté** — un test qui ne pouvait pas tourner, une
   base de données locale cassée : ce sont des faits qui périment vite mais qui
   font perdre des heures à celui qui les redécouvre.

## Ce qu'un compte rendu ne doit pas être

- **Un journal de bord exhaustif.** Ce qui n'a pas résisté ne s'écrit pas.
- **Une doc de référence.** Si une règle doit être respectée *à l'avenir*, sa
  place est dans `CLAUDE.md` ou dans `docs/MODULES/` — pas ici, où personne
  n'ira la chercher.
- **Une justification.** Un arbitrage discutable s'écrit comme discutable.

## Index

- [CR_PARCOURS_30_VERGER.md](CR_PARCOURS_30_VERGER.md) — Module Verger : cadence
  saisonnière, FK obligatoire en `PROTECT`, et six pièges rencontrés en chemin
  (2026-08-15)
