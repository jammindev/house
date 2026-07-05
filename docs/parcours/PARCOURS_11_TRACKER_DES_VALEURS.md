# Parcours 11 — Tracker des valeurs dans le temps

Ce document détaille le onzième parcours métier à travailler dans House.

Il s'appuie sur l'état actuel du projet Django + React, sur le socle posé par les parcours 01 à 08, et en particulier sur l'agent conversationnel du parcours 07.

## Résumé

Le onzième usage fondamental du produit est le suivant :

"Je veux suivre l'évolution d'une valeur dans le temps — un compteur, un niveau, un poids, des heures de fonctionnement — sans tableur ni app dédiée."

Ce parcours fait entrer les **séries de mesures** dans la mémoire du foyer.

- Le foyer accumule des valeurs qui n'ont de sens que dans la durée : relevé du compteur d'eau, niveau de la cuve de fioul, heures de fonctionnement de la VMC, budget consommé d'un chantier, poids personnel.
- Aujourd'hui ces valeurs vivent dans des tableurs, des notes éparses ou nulle part — la tendance est invisible, la valeur précédente introuvable.
- House connaît déjà les objets concernés (équipements, zones, stock, projets) : il est le lieu naturel pour accrocher ces séries à leur contexte.

Le concept central est le **Tracker** : une série de valeurs numériques datées (valeur + unité + date + note), qui peut être **générale**, **insérée dans un projet**, ou **liée à n'importe quelle entité** du foyer.

## Positionnement produit

Les parcours 01 à 05 ont construit la mémoire du foyer (événements, documents, tâches, projets, navigation spatiale). Le parcours 07 a rendu cette mémoire interrogeable en langage naturel, le parcours 08 a ouvert la lecture transversale des dépenses. Le parcours 11 ajoute une dimension nouvelle : la **mesure dans la durée**. L'agent ne répond plus seulement "quand a-t-on changé la chaudière" mais aussi "où en est le compteur d'eau ?" ou "combien a-t-on consommé depuis le mois dernier ?" — et peut enregistrer un relevé dicté en langage naturel.

Exigence structurante : un tracker doit pouvoir **s'ancrer sur l'existant** sans dupliquer de concept. Il pointe vers un projet (comme une tâche) ou vers n'importe quelle entité déjà connue de House (équipement, zone, item de stock…) via une liaison générique — le même pattern polymorphe que `Interaction.source`. On ne recrée ni patrimoine ni contexte dans le module trackers.

## Concept interne

Deux concepts nouveaux, portés par une nouvelle app `apps/trackers/` :

### Tracker (`Tracker`)

La série elle-même : un nom ("Compteur d'eau"), une unité libre (`m³`, `kg`, `h`, `%`, `€`…), un emoji optionnel pour la reconnaissance visuelle, une description. Un tracker appartient au foyer (`HouseholdScopedModel`) et porte ses ancrages :

- un **projet** optionnel (FK `projects.Project`, comme `Task.project`) — le tracker apparaît alors dans un onglet du détail projet
- une **cible** optionnelle (liaison polymorphe générique, pattern `Interaction.source`) — n'importe quelle entité du foyer : équipement, zone, item de stock…
- ni l'un ni l'autre → **tracker général** (poids, relevé personnel)

Il porte aussi un cache dénormalisé (`last_value`, `last_entry_at`) pour l'affichage en liste, et un **résumé texte des dernières entrées** (`entries_summary`) régénéré à chaque écriture — ce résumé est ce que l'agent lit (même mécanisme que le `state_summary` du parcours 09).

### Entrée (`TrackerEntry`)

Une mesure datée : valeur numérique (Decimal), date/heure d'observation, note optionnelle. Les entrées sont éditables et supprimables (une saisie erronée doit pouvoir disparaître). L'antidatage est supporté : on peut saisir un relevé oublié de la semaine dernière, la série reste ordonnée par date d'observation.

## Concept visible côté utilisateur

Dans l'interface, le vocabulaire à utiliser est :

- vue principale : `Trackers`
- l'objet : `Tracker`
- une mesure : `Entrée` (le geste : `Ajouter une valeur`)
- les ancrages : `Projet`, `Lié à` (équipement, pièce, stock…)
- la tendance : la sparkline sur la carte + le **delta** entre deux entrées consécutives

Le mot "série temporelle" reste interne ; l'utilisateur "suit une valeur".

## Objectif produit

Permettre à un membre du foyer de :

1. créer un tracker (nom, unité, emoji), général ou rattaché à un projet ou à une entité du foyer
2. saisir une valeur en quelques secondes depuis la carte du tracker (saisie rapide inline), avec date et note optionnelles
3. voir la tendance d'un coup d'œil : dernière valeur, sparkline, delta entre entrées
4. consulter l'historique complet sur la page détail, corriger ou supprimer une entrée
5. retrouver les trackers d'un projet dans un onglet dédié du détail projet
6. dicter un relevé à l'agent ("note 148.2 sur le compteur d'eau") et interroger les valeurs ("où en est le compteur d'eau ?")

## Ce que le projet a déjà aujourd'hui

- **FK polymorphe générique** ([apps/interactions/models.py](../../apps/interactions/models.py)) — le pattern `source_content_type` / `source_object_id` / `GenericForeignKey` à décliner en `target_*` pour la cible d'un tracker
- **Ancrage projet** ([apps/tasks/models.py](../../apps/tasks/models.py)) — `Task.project` + l'onglet `tasks` de `ProjectDetailPage` avec le panel embarquable (`TasksPanel`), le contrat à répliquer pour l'onglet trackers
- **Agent conversationnel** ([apps/agent/](../../apps/agent/)) — registries `searchables` / `listables` / `writables` extensibles depuis n'importe quelle app, conversations ancrées sur entité (`EntityAssistant`), tool générique `create_entity` avec undo côté front
- **Pont RAG par champ texte dénormalisé** — le `Device.state_summary` du parcours 09 a validé le mécanisme : un champ texte régénéré à chaque écriture, inclus dans les `search_fields`, rend l'état citable sans toucher `apps/agent/`
- **Pattern multi-tenant** — `HouseholdScopedModel`, permission `IsHouseholdMember`, scoping par header
- **Pattern feature frontend** — hooks + query keys, Card/Dialog, i18n 4 langues (documenté dans CLAUDE.md)

Ce qui n'existe pas encore : aucun modèle de série de valeurs datées, aucun composant de visualisation de tendance (pas de lib de chart dans le projet).

## Problème utilisateur précis

Quand l'utilisateur pense "je relève le compteur" ou "où en était la cuve le mois dernier", il doit aujourd'hui :

- retrouver le bon tableur ou la bonne note sur son téléphone
- se rappeler la dernière valeur pour calculer la consommation de tête
- perdre le lien entre la mesure et son objet (quel compteur ? quelle chaudière ? quel chantier ?)

House connaît déjà l'équipement, la pièce, le projet. La mesure doit vivre au même endroit que la mémoire, et la tendance doit se lire sans calcul mental.

## Utilisateur cible

Un membre du foyer qui veut consigner une valeur récurrente ou consulter son évolution, depuis l'app ou en langage naturel.

Exemples :

- "Où en est le compteur d'eau ?"
- "Note 148.2 sur le compteur d'eau."
- "Combien d'heures a tourné la VMC depuis l'installation ?"
- "On a consommé combien de fioul cet hiver ?"

## Scénarios prioritaires

### Scénario A — Créer un tracker général

"Je crée un tracker 'Poids' en kg, sans le lier à rien. Il apparaît dans ma page Trackers, je saisis ma première valeur."

### Scénario B — Le relevé mensuel en dix secondes

"J'ouvre Trackers, je clique le `+` sur la carte 'Compteur d'eau', je tape 148.2, Entrée. La carte affiche la nouvelle valeur, la sparkline bouge, je vois le delta depuis le mois dernier."

### Scénario C — Un tracker dans un projet

"Dans mon projet 'Rénovation salle de bain', j'ouvre l'onglet Trackers et je crée 'Budget peinture' en €. Il est automatiquement rattaché au projet et n'apparaît que là."

### Scénario D — Un tracker lié à un équipement

"Je crée 'Heures VMC' lié à la fiche équipement de la VMC. Depuis le tracker, je rejoins la fiche en un clic ; l'agent sait que ces heures parlent de cet équipement."

### Scénario E — Dicter un relevé à l'agent

"Je dis à l'agent : 'note 148.2 sur le compteur d'eau' — il crée l'entrée et me le confirme, avec un bouton Annuler. Je demande 'combien depuis le dernier relevé ?' — il répond avec le delta, en citant le tracker."

## Parcours cible

### Créer et saisir

1. L'utilisateur ouvre `Trackers` (état vide → CTA `Nouveau tracker`).
2. Il nomme le tracker, choisit une unité, un emoji, et optionnellement un projet ou une entité cible.
3. Il saisit sa première valeur depuis la carte (saisie rapide) ou la page détail.
4. La carte affiche dernière valeur, date relative et sparkline.

### Consulter et corriger

1. L'utilisateur ouvre la page détail : sparkline large, liste chronologique des entrées avec deltas.
2. Il édite ou supprime une entrée erronée ; le cache et la sparkline se recalculent.
3. Il rejoint le projet ou l'entité liée en un clic.

### Saisir et interroger via l'agent

1. L'utilisateur dicte un relevé — l'agent crée l'entrée (toast Annuler, comme toute création d'agent).
2. Il pose une question de valeur — l'agent répond en citant le tracker, deltas à l'appui (via `entries_summary`).

## Règles produit

### Règle 1 — Une entrée se saisit en moins de dix secondes

Le geste quotidien est la saisie, pas la création de tracker. La carte offre une saisie rapide inline (un input, Entrée pour valider, date = maintenant). Le dialog complet (date passée, note) reste disponible mais n'est jamais obligatoire.

### Règle 2 — Le tracker s'ancre sur l'existant, il ne le duplique pas

Un tracker pointe vers un projet ou vers une entité existante (équipement, zone, stock…). On ne recrée ni fiche ni contexte dans le module trackers. La cible est navigable en un clic dans les deux sens de lecture (V1 : tracker → entité ; entité → trackers différé).

### Règle 3 — Les valeurs sont une donnée de la mémoire du foyer

Les dernières entrées (avec deltas) sont rendues en texte et indexées comme le reste de la mémoire : l'agent y accède par la recherche standard, sans mécanique dédiée.

### Règle 4 — Une écriture d'agent est réversible

Créer un tracker ou une entrée depuis le chat suit le contrat `create_entity` : création immédiate + toast Annuler. Pas de brouillon à valider.

### Règle 5 — L'antidatage est un cas normal

Un relevé oublié se saisit après coup avec sa vraie date. La série, la dernière valeur affichée et les deltas se calculent toujours par date d'observation, jamais par ordre de saisie.

### Règle 6 — La tendance se lit sans configuration

Pas d'axes, pas de périodes, pas de réglages en V1 : une sparkline honnête (x proportionnel au temps) et des deltas entre entrées consécutives suffisent à lire la tendance. Les graphes riches viendront quand l'usage réel les réclamera.

## Backlog produit recommandé pour la V1

### Story 1 — Créer un tracker

En tant que membre du foyer,
je veux créer un tracker avec un nom, une unité et un ancrage optionnel,
afin de commencer à suivre une valeur qui compte pour moi.

#### Critères d'acceptation

- je peux créer un tracker général, rattaché à un projet, ou lié à une entité (équipement, pièce, stock…)
- l'unité est libre (m³, kg, h, %, €…), l'emoji optionnel
- le tracker apparaît dans la page Trackers avec un état vide clair
- je peux l'archiver (il disparaît des listes sans perdre son historique)

### Story 2 — Saisir des valeurs

En tant que membre du foyer,
je veux ajouter une valeur datée en quelques secondes,
afin que la saisie récurrente ne soit jamais une corvée.

#### Critères d'acceptation

- saisie rapide depuis la carte : un input numérique, Entrée = enregistré à maintenant
- saisie complète en dialog : valeur, date/heure (antidatage possible), note
- la carte reflète immédiatement la nouvelle dernière valeur et la sparkline
- je peux éditer ou supprimer une entrée depuis la page détail

### Story 3 — Lire la tendance

En tant que membre du foyer,
je veux voir l'évolution d'un coup d'œil,
afin de comprendre la tendance sans calcul mental.

#### Critères d'acceptation

- chaque carte affiche : emoji + nom, dernière valeur + unité, date relative, sparkline
- la page détail affiche la liste chronologique avec le delta entre entrées consécutives
- la sparkline espace les points proportionnellement au temps (relevés irréguliers honnêtes)
- l'ancrage (projet ou entité liée) est visible et cliquable

### Story 4 — Trackers d'un projet

En tant que membre du foyer,
je veux retrouver les trackers d'un projet dans son détail,
afin de suivre les valeurs du chantier là où je le pilote.

#### Critères d'acceptation

- le détail projet a un onglet `Trackers` listant uniquement les trackers du projet
- créer un tracker depuis cet onglet le rattache automatiquement au projet
- la saisie rapide fonctionne depuis l'onglet

### Story 5 — Saisir et interroger via l'agent

En tant que membre du foyer,
je veux dicter un relevé à l'agent et l'interroger sur les valeurs,
afin de tracker en langage naturel.

#### Critères d'acceptation

- "note 148.2 sur le compteur d'eau" → entrée créée + toast Annuler
- "ajoute 82.4" dans une conversation ancrée sur un tracker → entrée créée sur ce tracker
- "où en est le compteur d'eau ?" → réponse citée avec la dernière valeur et sa date
- créer un tracker depuis une conversation ancrée sur un équipement le lie à cet équipement

## Recommandation d'interface

### Structure cible de la page Trackers

```
┌──────────────────────────────────────────┐
│  Trackers               [Nouveau tracker]│
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ 💧 Compteur d'eau            [⋯]   │  │
│  │ 148.2 m³ · il y a 3 j    ▁▂▃▅▆▇    │  │
│  │ [+]                                │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 🌀 Heures VMC                [⋯]   │  │
│  │ 1 240 h · hier           ▁▃▄▅▆█    │  │
│  │ 🔗 VMC double flux (équipement)    │  │
│  │ [+] [ 1245__ ] ↵                   │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 🎨 Budget peinture           [⋯]   │  │
│  │ 340 € · il y a 12 j      ▁▁▂▄▄▅    │  │
│  │ 📁 Rénovation salle de bain        │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Page détail d'un tracker

```
┌──────────────────────────────────────────┐
│  ← Trackers                              │
│  💧 Compteur d'eau (m³)   [Ajouter] [⋯]  │
│  🔗 Compteur général (équipement)        │
├──────────────────────────────────────────┤
│        ╭──●  148.2                       │
│   ╭────╯                                 │
│  ─╯          (sparkline large)           │
├──────────────────────────────────────────┤
│  1 juil. 2026   148.2   (+3.1)   [⋯]     │
│                 "relevé mensuel"         │
│  1 juin 2026    145.1   (+2.8)   [⋯]     │
│  1 mai 2026     142.3            [⋯]     │
├──────────────────────────────────────────┤
│  [Assistant]                             │
└──────────────────────────────────────────┘
```

## Écrans impactés

- nouvelle feature `ui/src/features/trackers/` — page, cartes avec saisie rapide, page détail, dialogs
- nouveau composant partagé `ui/src/components/Sparkline.tsx` (SVG maison, réutilisable)
- `ui/src/components/Sidebar.tsx` — entrée `Trackers` dans le groupe Suivi
- `ui/src/router.tsx` — routes `/app/trackers`, `/app/trackers/:id`
- `ui/src/features/projects/ProjectDetailPage.tsx` — onglet `Trackers`
- détail équipement / zone / stock (plus tard, V2) — panneau des trackers liés

## Hors scope pour la V1

- graphes riches (axes, tooltips, zoom, sélection de période) — la sparkline + les deltas couvrent la lecture de tendance V1
- agrégats par période ("consommation m³/mois", moyennes glissantes)
- rappels de relevé ("tu n'as pas relevé le compteur depuis 35 jours") — rejoindra le parcours 06 (alertes)
- panneaux "trackers liés" sur les pages détail équipement / zone / stock (l'API le permet déjà, travail UI pur)
- seuils et objectifs avec alerte (poids cible, budget max)
- import CSV d'un historique existant
- distinction compteur cumulatif vs mesure instantanée (typage des deltas)

## Décisions produit recommandées

### 1. Un modèle unique valeur numérique, pas de types de tracker

Pas de champ `kind` ni de familles de trackers en V1 : `nom + unité + emoji` couvrent tous les cas identifiés (compteur, niveau, durée, budget, poids). Un typage (cumulatif vs instantané) viendra seulement si les agrégats V2 l'exigent.

### 2. La cible générique s'appuie sur le registry de l'agent

Le registry `agent.searchables` sait déjà résoudre `entity_type → modèle`, produire un label et une URL pour toute entité du foyer. La cible d'un tracker réutilise ce registre : tout ce qui est cherchable par l'agent est liable à un tracker, sans table de correspondance dédiée.

### 3. L'ajout d'entrée par l'agent est une création réversible standard

Contrairement au pilotage domotique (parcours 09, tool dédié sans undo), ajouter une entrée est une écriture réversible : elle passe par le tool générique `create_entity` avec toast Annuler, comme les tâches et les notes.

### 4. Sparkline maison, pas de lib de chart

Aucune dépendance ajoutée : un composant SVG (~40 lignes) suffit pour la V1 et reste réutilisable (dépenses, électricité). Une lib de graphes n'entrera dans le projet que portée par un besoin V2 réel.

## Définition de done du parcours 11

Le parcours peut être considéré comme livré si, pour un utilisateur réel :

1. il crée un tracker général, un tracker de projet et un tracker lié à un équipement
2. il saisit une valeur en moins de dix secondes depuis la carte, sparkline et delta à l'appui
3. il corrige une entrée erronée et antidatage un relevé oublié — la série reste juste
4. l'onglet Trackers du projet ne montre que les trackers du projet
5. l'agent enregistre "note 148.2 sur le compteur d'eau" (avec Annuler) et répond à "où en est le compteur d'eau ?" en citant le tracker
6. la page est utilisable sur mobile

## Check de validation manuelle

Avant de considérer la V1 terminée, vérifier ce scénario complet :

1. créer "Compteur d'eau" (m³, 💧) — général ; "Budget peinture" (€) — dans un projet ; "Heures VMC" (h) — lié à l'équipement VMC
2. saisir 3 valeurs sur le compteur via la saisie rapide de la carte — vérifier sparkline et deltas
3. antidater une entrée du mois précédent — vérifier que la dernière valeur affichée reste la plus récente par date d'observation
4. éditer puis supprimer une entrée — vérifier le recalcul du cache et de la sparkline
5. ouvrir l'onglet Trackers du projet — seul "Budget peinture" apparaît ; y saisir une valeur
6. depuis la page du tracker VMC, cliquer le lien vers la fiche équipement
7. demander à l'agent "note 148.2 sur le compteur d'eau" — vérifier création + Annuler (et que l'annulation supprime bien l'entrée)
8. demander "où en est le compteur d'eau ?" — vérifier la réponse citée avec valeur et date
9. dans l'assistant ancré du tracker, dire "ajoute 82.4" — l'entrée se crée sans nommer le tracker
10. archiver un tracker — il disparaît de la liste, son historique reste en base

Backlog technique associé : `docs/parcours/PARCOURS_11_BACKLOG_TECHNIQUE.md`
