# Parcours 20 — Enrichir le détail d'un projet : onglets adaptatifs + photos avant/après

> **Statut : en cours — cadré le 2026-07-16 avec l'utilisateur (session `/po`).**
> Deux besoins exprimés sur la page de détail projet :
> 1. un mécanisme **avant / après en photo** pour documenter un chantier ;
> 2. **n'afficher que les onglets utiles**, au fur et à mesure que de nouvelles
>    fonctionnalités (donc de nouveaux onglets) arrivent sur les projets.
>
> S'appuie sur les projets (parcours 04), les documents/photos et la liaison
> polymorphe `DocumentLink` (parcours 02 + refonte #295/#299), et le composant
> partagé `TabShell`.
> Issues : **#300** (20.1), **#301** (20.2), **#302** (20.3).

## Le constat

Le détail d'un projet (`ProjectDetailPage`) présente aujourd'hui **7 onglets**
en dur : `overview`, `tasks`, `trackers`, `notes`, `expenses`, `documents`,
`timeline`. Deux frictions apparaissent à l'usage :

1. **Trop d'onglets vides.** Un projet fraîchement créé, ou un petit projet, a la
   plupart de ses onglets vides. L'utilisateur clique dans des onglets qui ne
   contiennent rien. Et **chaque nouvelle feature ajoute un onglet** — la barre
   ne fait que grossir, la page devient bruyante alors que 80 % du contenu tient
   dans `overview`.

2. **Aucune mémoire visuelle du chantier.** Les photos d'un projet sont déjà
   attachables (onglet `documents`, `Document(type='photo')` lié par
   `DocumentLink`), mais **rien ne distingue une photo « avant travaux » d'une
   photo « après »**. Impossible de raconter la transformation d'une pièce d'un
   coup d'œil — pourtant c'est le premier réflexe sur une rénovation.

## L'intuition produit

Les deux besoins se répondent : **on veut ajouter du contenu à la page projet
(photos avant/après) sans l'alourdir davantage (onglets adaptatifs).** On traite
donc d'abord la lisibilité (Lot 1), puis on pose le nouveau contenu dans une page
désormais capable de se replier sur l'essentiel (Lots 2-3).

### Onglets adaptatifs — masquer ce qui est vide

Plutôt que de laisser l'utilisateur configurer manuellement quels onglets voir
(coût cognitif, un réglage de plus), **la page masque automatiquement les onglets
sans contenu**. `overview` reste toujours visible (c'est le pivot : résumé +
points d'entrée pour créer du contenu). Dès qu'un contenu apparaît (1ʳᵉ tâche,
1ʳᵉ dépense…), l'onglet correspondant se révèle tout seul au prochain
rafraîchissement du projet.

C'est le pendant, à l'échelle d'un projet, de ce que le parcours 15 a fait pour la
sidebar du foyer (`disabled_modules`) — mais **sans réglage** : la présence de
données suffit à décider. La configuration manuelle par le propriétaire reste une
option ouverte (voir « Reporté »), à ne construire que si l'automatique ne suffit
pas.

### Photos avant / après — une phase sur le lien, pas sur la photo

Une photo n'est pas « une photo d'avant » dans l'absolu : elle est l'« avant » **de
ce projet-là**. La phase est donc une propriété **du lien** entre la photo et le
projet (`DocumentLink`), pas de la photo elle-même. On ajoute un champ `phase`
(`before` / `during` / `after`, vide par défaut) sur `DocumentLink` — la même photo
peut ainsi être l'« après » d'une rénovation cuisine sans polluer un autre usage,
et on ne touche pas au modèle `Document`.

Un nouvel onglet **Photos** regroupe les photos du projet par phase (Avant /
Pendant / Après / Non classées), chaque photo pouvant être (re)taguée à tout
moment. Le **comparateur** (Lot 3) réutilise ces phases pour afficher une photo
« avant » et une photo « après » côte à côte (ou en slider tactile).

## Positionnement produit

- **Parcours 04 — Suivre un projet de bout en bout** : ce parcours enrichit sa
  page de détail (onglets + photos), sans toucher au modèle `Project`.
- **Parcours 02 — Traiter un document entrant** : les photos restent des
  `Document(type='photo')` liés par `DocumentLink`. On étend le lien, pas le
  document.
- **Parcours 15 — Adapter la navigation au foyer** : même philosophie (montrer
  ce qui sert), appliquée au niveau onglets d'un projet, mais pilotée par la
  donnée plutôt que par un réglage.

## Décisions de cadrage (confirmées avec l'utilisateur le 2026-07-16)

1. **Onglets vides masqués automatiquement**, pas de réglage manuel en V1.
   `overview` toujours visible ; un onglet réapparaît dès qu'il a du contenu.
2. **La phase avant/après vit sur `DocumentLink`** (champ `phase`), contextuelle
   au couple (photo, projet). Pas de nouveau modèle, pas de champ sur `Document`.
3. **Trois phases** : `before`, `during`, `after`. Une photo sans phase reste
   affichée dans un groupe « Non classées ».
4. **Un onglet Photos dédié**, distinct de `documents` (qui reste le fourre-tout
   fichiers). Les photos n'apparaissent donc plus mélangées aux PDF/factures.
5. **Le comparateur est purement présentation** : aucune donnée nouvelle
   au-delà de la phase (Lot 2). Il fonctionne au doigt sur mobile (slider) et à
   la souris sur desktop.
6. **L'agent reste en lecture seule sur les photos** : pas de writable pour taguer
   une phase en V1 (les documents ne sont pas agent-writable aujourd'hui). Le RAG
   voit déjà les documents liés via la centralisation `DocumentLink`.

## Découpage

| Lot | Sujet | Issue |
|---|---|---|
| 20.1 | Onglets adaptatifs — `tab_counts` backend + masquage des onglets vides côté UI | #300 |
| 20.2 | Photos avant/après — champ `phase` sur `DocumentLink`, onglet Photos, tag par photo | #301 |
| 20.3 | Comparateur avant/après — vue côte-à-côte / slider | #302 |

Détail technique : `PARCOURS_20_BACKLOG_TECHNIQUE.md`.

## Reporté / hors scope V1

- **Configuration manuelle des onglets** (le propriétaire force l'affichage d'un
  onglet vide, ou en masque un plein). S'inspirerait de
  `disabled_modules`/`pinned_modules`. À ne construire que si le masquage
  automatique ne couvre pas le besoin réel.
- **Phase avant/après sur d'autres entités** (carnet de rénovation par zone,
  parcours 13). Le champ `DocumentLink.phase` est générique et le permettra sans
  migration ; l'UI n'est câblée que pour les projets en V1.
- **Édition de la phase par l'agent** (writable). Hors scope tant que les
  documents ne sont pas agent-writable.
- **Recadrage / annotation de photos, ordre manuel dans une phase.** Les photos
  restent triées par date.
