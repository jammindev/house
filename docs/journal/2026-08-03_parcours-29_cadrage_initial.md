# 2026-08-03 — Parcours 29 cadrage initial

## Contexte

Session de cadrage du vingt-neuvième chantier : **l'album du foyer** — faire des
photos le point d'entrée de House.

Déclencheur immédiat : la livraison le matin même du téléversement multiple
(#524 / PR #525), qui a fait apparaître la friction suivante dès la première
utilisation réelle. Dit par l'utilisateur :

> « Les photos techniques sont mélangées avec les photos souvenirs, les photos
> observation. »

Le but explicite de la session : **produire uniquement de la documentation, des
specs et les issues GitHub** — aucun code.

## Ce que le cadrage a trouvé

Quatre manques, vérifiés dans le code pendant la séance, qui expliquent l'ordre
des lots :

1. `DocumentViewSet` n'a **aucune pagination**, et il n'y a pas de `PAGE_SIZE`
   global : la galerie charge la totalité du foyer dans une réponse. Déjà signalé
   dans `docs/MODULES/documents.md`, jamais traité.
2. La taille d'un fichier vit dans `metadata` — donc inagrégeable sans cast JSON,
   exactement la dette résorbée côté argent avec `amount` / `kind` / `supplier`.
3. **Aucune infrastructure de tâches de fond** : ni Celery, ni django-q, ni Redis.
   La pile a en revanche déjà deux conteneurs `scheduler` — le projet sait faire
   tourner un processus de fond, pas un broker.
4. `Household` porte **déjà** `latitude` / `longitude`, posées pour la météo : le
   géofence de la synchro iPhone a son ancre sans rien ajouter.

## L'arbitrage central

Deux ambitions étaient sur la table.

- **Le classeur du foyer** — technique + observation + un album curaté ; les
  souvenirs restent dans la pellicule. Volume faible, quota bon marché,
  et une catégorie que personne ne sert. **Recommandé par l'assistant.**
- **L'album complet** — House remplace la pellicule comme point d'entrée photo.
  **Retenu par l'utilisateur.**

L'argument opposé à l'album complet était sa collision avec la deuxième demande
de la même session (un quota de stockage par foyer) : les souvenirs sont la
catégorie la plus lourde en octets et la moins spécifique à House, donc celle qui
décide du coût par foyer. L'arbitrage a été maintenu ; il est écrit tel quel dans
la doc produit, avec ses trois coûts nommés, parce que la suite du backlog n'a de
sens qu'à cette lumière.

Conséquence directe : le stockage objet cesse d'être une option lointaine et
entre dans le chantier (lot 3), avant le gros volume — migrer après coûte
beaucoup plus cher.

## Le concept retenu

Une photo porte trois axes (zone = *où*, entité = *sur quoi*, phase = *quand dans
le chantier*). Il en manquait un : **l'intention** — `technical`, `observation`,
`memory`, et le vide.

Le point structurant : **le vide n'est pas « souvenir »**. Vide signifie que
personne n'a trié, c'est un écart, et il alimente une file « À trier ». C'est la
transposition littérale de `inflow_nature == ""` n'est pas `"other"`, et du
principe du parcours 26 (« toute entité est soit résolue, soit flaggée avec un
motif »).

Décision qui en découle et qui a été discutée : **aucun backfill**. Marquer
`technical` toute photo déjà liée à un projet serait écrire une devinette en base,
où elle deviendrait indistinguable d'un choix — ce que `banking.rules` interdit.
Tout l'existant part dans « À trier », et c'est le tri **par grappe de session**
qui rend la contrepartie tenable.

## Contrainte conservée

House est auto-hébergeable depuis le parcours 28, en trois conteneurs. Le stockage
objet et le traitement asynchrone sont donc des **capacités déclarées et
optionnelles**, sur le modèle de `PROTECTED_MEDIA_ACCEL` — jamais des prérequis.
C'est la contrainte qui a écarté Celery + Redis.

## Livrables

- Doc produit : [`PARCOURS_29_ALBUM_DU_FOYER.md`](../parcours/PARCOURS_29_ALBUM_DU_FOYER.md)
- Fiche concept : [`PIPELINE_MEDIA.md`](../fiches/PIPELINE_MEDIA.md)
- Backlog : [`PARCOURS_29_BACKLOG_TECHNIQUE.md`](../parcours/PARCOURS_29_BACKLOG_TECHNIQUE.md)
- Issues : parente #526, lots #527 → #533, annexe V2 #534

## Ce qui reste à arbitrer

**Ce chantier ne dit pas ce qu'il advient du parcours 28.** Les lots 0 et 4 de
celui-ci corrigent des écarts *ouverts aujourd'hui* (runner exposé, absence de
licence sur un dépôt public) et restent hors séquence. La priorité relative entre
le reste du parcours 28 et le parcours 29 n'a pas été tranchée pendant cette
séance.
