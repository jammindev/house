# Parcours métier prioritaires

Ce document propose un premier cadrage produit pour développer House de façon utile après la migration vers la base Django + React actuelle.

Suivi vivant : l'état actuel des parcours et les dernières sessions sont tenus dans [docs/JOURNAL_PRODUIT.md](/Users/benjaminvandamme/Developer/house/docs/JOURNAL_PRODUIT.md).

L'idée directrice est simple :

- on ne pilote pas le produit page par page
- on pilote par parcours métier de bout en bout
- on vise un rythme de 1 parcours principal par semaine

## Comment prioriser

Un parcours est prioritaire s'il coche au moins deux de ces critères :

- usage fréquent au quotidien
- forte valeur de mémoire ou de coordination pour le foyer
- effet structurant sur plusieurs modules du produit
- complexité raisonnable pour livrer un premier flux complet

## Les 5 premiers parcours recommandés

## 1. Capturer un événement du foyer et le retrouver facilement

Document détaillé : `docs/PARCOURS_01_CAPTURER_ET_RETROUVER_UN_EVENEMENT.md`

Statut actuel : **socle V1 livré**

### Pourquoi en premier

Le modèle `interaction` est le coeur du produit. Si ce flux est excellent, le reste du produit devient plus cohérent. S'il est faible, toutes les autres pages deviennent des silos.

### Déclencheur utilisateur

"Il vient de se passer quelque chose dans la maison et je veux le consigner tout de suite."

### Résultat attendu

L'utilisateur peut créer une interaction en moins d'une minute, lui donner un type clair, la rattacher à un contexte minimal, puis la retrouver sans effort.

La capture rapide peut démarrer depuis le dashboard, mais la vue de référence du parcours reste la page interactions/historique.

Le point d'entrée recommandé est un CTA unique d'ajout, suivi d'un sélecteur de type, puis d'un formulaire adapté.

### Stories initiales

- Créer une interaction simple depuis l'écran principal.
- Choisir un type utile dès la création : note, todo, dépense, maintenance.
- Ajouter un minimum de contexte : date, titre, description, zone éventuelle.
- Retrouver rapidement l'interaction dans la liste.
- Filtrer la liste par type, date ou contexte.

### Définition de done

- création rapide sans friction
- liste lisible et exploitable
- filtres de base utilisables
- aucun trou de navigation entre création et consultation

## 2. Traiter un document entrant et le relier au bon contexte

### Pourquoi en deuxième

Les documents ont une forte valeur pratique, mais ils deviennent vraiment utiles seulement s'ils sont reliés à une interaction, un contact, une structure, un projet ou une zone.

### Déclencheur utilisateur

"J'ai une facture, un devis, un contrat ou une photo de document et je veux qu'il serve à quelque chose."

### Résultat attendu

L'utilisateur peut ajouter un document, comprendre ce qu'il représente, puis le rattacher au bon contexte métier sans ressaisie inutile.

### Stories initiales

- Voir la liste des documents avec un statut et des métadonnées minimales.
- Ouvrir un document et comprendre son contexte actuel.
- Lier un document à une interaction existante ou en créer une depuis le document.
- Associer un contact, une structure ou un projet si nécessaire.
- Revenir ensuite au document ou à l'interaction sans perdre le fil.

### Définition de done

- un document n'est plus un fichier isolé
- le lien document <-> interaction est simple à créer
- la navigation entre les entités liées est claire

## 3. Transformer un besoin en action suivie

### Pourquoi en troisième

Un produit de mémoire maison n'est pas seulement un journal. Il doit aussi aider à agir. Le flux tâches/actions donne une utilité quotidienne immédiate.

### Déclencheur utilisateur

"Je dois faire quelque chose, ou faire faire quelque chose, et je veux pouvoir le suivre."

### Résultat attendu

Une action peut être créée, contextualisée, suivie puis clôturée avec un historique exploitable.

### Stories initiales

- Créer une tâche depuis une interaction ou directement depuis la page tâches.
- Lier la tâche à un document, un contact, une structure, une zone ou un projet.
- Voir les tâches ouvertes, en retard et terminées.
- Marquer une tâche comme faite sans perdre son contexte historique.
- Retrouver depuis la tâche l'événement ou le document qui l'a déclenchée.

### Définition de done

- une tâche peut naître d'un besoin réel
- son contexte reste visible
- la clôture laisse une trace compréhensible

## 4. Suivre un projet de travaux ou de maintenance de bout en bout

### Pourquoi en quatrième

Le module projets devient utile quand il agrège des événements, documents, acteurs et actions. C'est un bon parcours de consolidation multi-entités.

### Déclencheur utilisateur

"Je veux avancer sur un chantier ou un sujet de fond sans perdre les infos dispersées."

### Résultat attendu

Un projet permet de centraliser les interactions, documents, contacts et tâches liés à un même objectif.

### Stories initiales

- Créer un projet avec un intitulé et un statut clairs.
- Voir sa synthèse : dernières interactions, documents liés, tâches ouvertes.
- Ajouter rapidement une interaction ou un document depuis le contexte projet.
- Lier les bons contacts ou prestataires.
- Garder une vue d'avancement suffisamment simple pour décider de la suite.

### Définition de done

- un projet devient un vrai point de coordination
- les informations utiles sont visibles sans fouille
- l'utilisateur sait quoi faire ensuite

## 5. Naviguer par zone ou équipement pour comprendre l'existant et agir

### Pourquoi en cinquième

La maison est un espace physique. La valeur du produit monte fortement si l'on peut partir d'une pièce, d'une zone ou d'un équipement pour retrouver l'historique et déclencher une action.

### Déclencheur utilisateur

"Je suis devant un espace ou un équipement et je veux savoir ce qu'il s'y est passé ou quoi faire."

### Résultat attendu

Depuis une zone ou un équipement, l'utilisateur peut voir l'historique utile, les documents associés et les prochaines actions pertinentes.

### Stories initiales

- Parcourir l'arborescence des zones sans confusion.
- Ouvrir une zone et voir les interactions, documents et équipements liés.
- Ouvrir un équipement et voir son historique de maintenance ou d'usage.
- Créer une interaction ou une tâche depuis ce contexte.
- Garder des liens cohérents entre zone, équipement et projet éventuel.

### Définition de done

- la navigation spatiale aide réellement à retrouver l'information
- l'utilisateur peut agir depuis le contexte consulté
- les liens entre espace, équipement et historique sont lisibles

## Ce que je ne mettrais pas dans les 5 premiers

- flux avancés d'email entrant tant que le parcours document + interaction n'est pas solide
- raffinements IA tant que les parcours métier de base ne sont pas propres
- pages secondaires isolées sans impact sur un parcours complet

## Ordre de livraison recommandé

### Semaine 1

Parcours 1 : capturer et retrouver une interaction

### Semaine 2

Parcours 2 : traiter un document et le relier au bon contexte

### Semaine 3

Parcours 3 : transformer un besoin en action suivie

### Semaine 4

Parcours 4 : suivre un projet de bout en bout

### Semaine 5

Parcours 5 : naviguer par zone ou équipement pour comprendre et agir

## Template de travail pour une semaine

Pour chaque parcours hebdomadaire, remplir cette fiche avant de coder.

### 1. Problème utilisateur

Quel besoin concret veut-on résoudre cette semaine ?

### 2. Parcours cible

Décrire en 5 à 8 étapes le chemin complet utilisateur.

### 3. Stories de la semaine

Limiter à 3 à 7 stories maximum.

### 4. Critères d'acceptation

Chaque story doit avoir des critères observables et testables.

### 5. Écrans impactés

Lister seulement les pages touchées par ce parcours.

### 6. Risques métier ou UX

Identifier les zones de friction, trous de navigation ou ambiguïtés de vocabulaire.

### 7. Définition de done

Le parcours doit être faisable de bout en bout, même de manière simple.

## Règle de pilotage

Si une page n'améliore aucun parcours prioritaire, elle ne doit pas passer devant une amélioration de flux déjà engagé.