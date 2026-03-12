# Parcours 01 — Capturer un événement du foyer et le retrouver facilement

Ce document détaille le premier parcours métier à travailler dans House.

Il s'appuie sur l'état actuel du projet Django + React hybride, et non sur les archives `legacy/`.

Note complémentaire : la projection future d'une capture conversationnelle ou assistée par IA est cadrée dans [docs/PARCOURS_01_CAPTURE_ASSISTEE_PAR_IA.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_01_CAPTURE_ASSISTEE_PAR_IA.md).

## Résumé

Le premier usage fondamental du produit est le suivant :

"Il vient de se passer quelque chose dans la maison, je veux l'enregistrer immédiatement, puis le retrouver sans effort quand j'en ai besoin."

Ce parcours est prioritaire car il structure le reste du produit.

- Les documents deviennent utiles quand ils sont liés à un événement.
- Les tâches deviennent utiles quand elles naissent d'un événement réel.
- Les projets deviennent utiles quand ils agrègent des événements.
- Les zones, équipements, contacts et structures deviennent utiles quand ils donnent du contexte aux événements.

Autrement dit, ce parcours ne doit pas être pensé comme une simple page "interactions". Il doit être pensé comme le flux de capture et de restitution du journal vivant du foyer.

Dans ce flux, le dashboard peut et doit jouer un rôle important pour la capture rapide. En revanche, la page interactions reste la vue de référence pour consulter, filtrer et retrouver les événements.

## Positionnement produit

## Concept interne

Le modèle technique central reste `Interaction`.

Ce nom est bon pour :

- le backend Django
- l'API DRF
- les composants React métier
- la cohérence de la donnée

## Concept visible côté utilisateur

Dans l'interface, il vaut mieux éviter d'exposer trop frontalement le mot `interaction`.

Le vocabulaire recommandé pour ce parcours est :

- vue globale : `Historique` ou `Activité`
- action principale : `Ajouter un événement`
- types visibles : `Note`, `Tâche`, `Dépense`, `Maintenance`
- formulation secondaire : `événement`, `activité`, `entrée d'historique`

Le mot `interaction` peut rester présent dans certains endroits techniques ou temporaires, mais il ne doit pas devenir le vocabulaire principal du produit.

## Objectif produit

Permettre à un membre du foyer de :

1. capturer rapidement un événement significatif
2. le qualifier avec juste assez de contexte
3. le retrouver ensuite par liste, filtre ou contexte
4. s'en servir comme point d'entrée pour les autres parcours

## Répartition des rôles entre dashboard et page interactions

Le parcours s'appuie sur deux surfaces complémentaires.

## Dashboard

Le dashboard est la meilleure entrée pour la capture rapide.

Il doit servir à :

- déclencher rapidement l'ajout d'un événement
- ouvrir un sélecteur de type léger avant la création
- montrer un aperçu des événements récents
- réduire la friction quand l'utilisateur veut juste consigner quelque chose tout de suite

Il ne doit pas devenir l'écran complet de gestion de l'historique.

## Page interactions

La page interactions reste la surface canonique du parcours.

Elle doit servir à :

- porter le formulaire de création complet mais léger
- afficher la liste de référence
- permettre les filtres de base
- assurer la retrouvabilité
- servir de base pour les futurs raffinements de recherche et de navigation

## Principe produit retenu

La capture peut partir du dashboard.

Le flux de référence, lui, reste adossé à la page interactions.

En pratique, cela veut dire :

- `dashboard = point d'entrée rapide`
- `interactions = source de vérité du parcours`

Le pattern retenu pour la création rapide est :

1. un bouton d'ajout unique sur le dashboard
2. un clic qui ouvre un sélecteur de type
3. une fois le type choisi, affichage du formulaire adapté

## Promesse UX de ce parcours

Si l'utilisateur a une information en tête, il doit pouvoir l'enregistrer en moins d'une minute.

Si l'utilisateur cherche une information déjà enregistrée, il doit pouvoir la retrouver sans se demander dans quel sous-module elle est cachée.

## Ce que le projet a déjà aujourd'hui

Le repo contient déjà une première implémentation exploitable du parcours.

## Pages web existantes

- `/app/interactions/` via [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)
- `/app/interactions/new/` via [apps/interactions/web_urls.py](/Users/benjaminvandamme/Developer/house/apps/interactions/web_urls.py)

Le dashboard actuel est aussi concerné fonctionnellement comme point d'entrée rapide, même si la logique centrale du parcours reste sur le module interactions.

## Composants React existants

- liste : [apps/interactions/react/InteractionList.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionList.tsx)
- création : [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx)
- points de montage : [ui/src/pages/interactions/list.tsx](/Users/benjaminvandamme/Developer/house/ui/src/pages/interactions/list.tsx) et [ui/src/pages/interactions/new.tsx](/Users/benjaminvandamme/Developer/house/ui/src/pages/interactions/new.tsx)

## API existante

- CRUD principal : `/api/interactions/interactions/`
- regroupement par type : `/api/interactions/interactions/by_type/`
- vue tâches : `/api/interactions/interactions/tasks/`
- changement rapide de statut : `/api/interactions/interactions/{id}/update_status/`

Implémentation principale : [apps/interactions/views.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views.py)

## Capacité métier déjà présente

- création d'une interaction avec type, statut, date, contenu, tags et zones
- obligation d'avoir au moins une zone
- filtrage API par type, statut, zone, contact, structure, date, tags
- recherche API sur `subject`, `content`, `enriched_text` et noms de tags
- préhydratation initiale de la liste côté Django
- household scoping cohérent avec le reste du produit

## Modèle métier déjà présent

Le modèle [apps/interactions/models.py](/Users/benjaminvandamme/Developer/house/apps/interactions/models.py) couvre déjà une base large.

### Types actuellement disponibles

- `note`
- `todo`
- `expense`
- `maintenance`
- `repair`
- `installation`
- `inspection`
- `warranty`
- `issue`
- `upgrade`
- `replacement`
- `disposal`

### Relations déjà utiles

- zones
- projet
- documents via table de lien
- contacts via table de lien
- structures via table de lien
- tags

## Diagnostic actuel

Le socle existe, mais le parcours n'est pas encore pleinement "produit".

Aujourd'hui, on a surtout :

- une page de création
- une page de liste
- des filtres principaux
- une structure de données robuste

Ce qui manque pour rendre le parcours vraiment fort :

- un vocabulaire UI plus naturel
- un flux de capture encore plus guidé
- une stratégie claire entre types simples et types avancés
- une meilleure continuité entre création, confirmation et consultation
- des critères de qualité explicites pour la recherche et la retrouvabilité

## Problème utilisateur précis

Quand un événement se produit dans le foyer, l'utilisateur ne doit pas hésiter entre plusieurs modules.

Il ne doit pas se demander :

- est-ce que je crée une note, une tâche, une dépense, autre chose ?
- est-ce que je dois d'abord aller dans la bonne page ?
- où vais-je retrouver cette information plus tard ?

Le système doit répondre à cette hésitation par un flux simple :

- j'ajoute un événement
- je choisis son type concret
- je renseigne le minimum utile
- je le retrouve ensuite dans un historique fiable

## Utilisateur cible

Pour ce premier parcours, la cible principale est un membre de household qui veut journaliser un fait réel du quotidien.

Exemples :

- une dépense a été faite
- un problème a été constaté
- une maintenance a été réalisée
- une chose à faire a été identifiée
- une note libre doit être gardée

## Scénarios prioritaires

## Scénario A — Note simple

"Je veux noter quelque chose à propos de la cuisine avant de l'oublier."

## Scénario B — Dépense rapide

"J'ai acheté une pièce ou payé une petite prestation, je veux la garder en mémoire."

## Scénario C — Maintenance réalisée

"J'ai effectué une intervention et je veux garder une trace datée."

## Scénario D — Tâche identifiée

"Je repère quelque chose à faire plus tard et je veux que cela reste visible."

## Parcours cible

Le parcours de référence pour la semaine 1 est le suivant.

1. L'utilisateur est sur le dashboard et veut noter rapidement quelque chose.
2. Il clique sur une action claire du type `Ajouter` ou `Ajouter un événement`.
3. Le système ouvre un sélecteur de type dans un overlay léger.
4. L'utilisateur choisit un type compréhensible immédiatement.
5. Le système affiche le formulaire adapté à ce type.
6. L'utilisateur renseigne un titre, une date et un contexte minimal.
7. Il associe au moins une zone.
8. Il valide sans friction.
9. Le système confirme la création et le ramène vers une vue utile de l'historique.
10. L'utilisateur retrouve ensuite l'événement via la liste et les filtres de base.

## Règles produit

## Règle 1 — Une capture doit être possible avec peu de champs

La création doit rester courte.

Champs minimums recommandés pour le MVP de ce parcours :

- type
- titre
- date/heure
- zone
- description facultative

## Règle 2 — Le type doit guider le sens

Le système de types existe déjà côté données, mais l'UI ne doit pas noyer l'utilisateur avec trop de granularité trop tôt.

Pour ce parcours 1, je recommande de prioriser dans le sélecteur de type :

- `Note`
- `Tâche`
- `Dépense`
- `Maintenance`

Les types plus spécialisés peuvent exister en second niveau, dans une section `Autres types`, ou plus tard.

L'objectif n'est pas d'afficher 10 types et plus directement sur le dashboard.

## Règle 2 bis — Le dashboard ne doit pas exposer un bouton par type

Avec un nombre de types déjà élevé et appelé à augmenter, multiplier les CTA de création sur le dashboard n'est pas une bonne stratégie.

Le dashboard doit porter :

- un seul bouton d'ajout
- une ouverture de sélecteur de type
- éventuellement une hiérarchisation entre types principaux et types secondaires

Pas une grille de 10 à 15 boutons concurrents.

## Règle 2 ter — Le choix de type est une étape dédiée du parcours

Le bon modèle de flux est :

- choix du type d'abord
- formulaire ensuite

Cela permet :

- de garder le dashboard propre
- de garder un formulaire cohérent
- d'adapter les champs au type sans multiplier les pages trop tôt

## Règle 3 — La zone est un ancrage métier fort

Le choix de rendre la zone obligatoire est bon dans le contexte du produit.

Cela permet :

- de relier l'événement à l'espace physique réel
- d'améliorer la retrouvabilité plus tard
- de préparer les futurs parcours zone/équipement

En revanche, l'UX de sélection de zone doit être très propre. Une obligation métier mal servie par l'UI devient une friction inutile.

## Règle 4 — Après création, on revient vers une vue utile

La redirection actuelle vers la liste après création va dans le bon sens.

Il faut cependant garantir que l'utilisateur puisse :

- comprendre que l'événement a bien été créé
- le repérer dans la liste retournée
- éventuellement garder les filtres cohérents

## Règle 5 — Retrouver est aussi important que créer

Un événement mal retrouvable vaut presque autant qu'un événement non créé.

Le parcours 1 doit donc traiter ensemble :

- la capture
- la liste
- les filtres de base
- la lisibilité des cartes/lignes

## Backlog produit recommandé pour la semaine 1

Le but n'est pas de "finir la page interactions". Le but est de rendre le parcours complet crédible et fluide.

## Story 1 — Entrée claire vers le parcours

En tant que membre du foyer,
je veux une entrée claire pour ajouter un événement,
afin de ne pas hésiter sur où commencer.

### Critères d'acceptation

- l'accès à la création est visible depuis le dashboard
- l'accès à la création reste disponible depuis la vue liste
- le libellé de l'action est compréhensible sans jargon technique
- l'utilisateur comprend qu'il est en train d'ajouter un élément à l'historique du foyer
- le dashboard ne présente pas une multiplication de CTA par type

## Story 2 — Choix de type simple et scalable

En tant que membre du foyer,
je veux choisir le type de ce que j'ajoute après avoir cliqué sur un seul bouton,
afin d'éviter une interface surchargée et de démarrer vite.

### Critères d'acceptation

- le dashboard expose un seul CTA principal d'ajout
- le clic ouvre un sélecteur de type dans un overlay léger
- les types principaux sont immédiatement visibles
- les types secondaires sont accessibles sans surcharger le premier niveau

## Story 3 — Création rapide avec champs minimums

En tant que membre du foyer,
je veux créer un événement en moins d'une minute,
afin de capturer l'information avant de l'oublier.

### Critères d'acceptation

- le formulaire n'exige que les champs strictement utiles
- les valeurs par défaut sont cohérentes
- les erreurs sont compréhensibles
- l'envoi fonctionne avec household et zones valides

## Story 4 — Formulaire adapté au type

En tant que membre du foyer,
je veux voir un formulaire adapté au type sélectionné,
afin de renseigner les bonnes informations sans complexité inutile.

### Critères d'acceptation

- un tronc commun reste identique quel que soit le type
- des champs spécifiques apparaissent selon le type choisi
- le statut n'encombre pas l'expérience quand il n'est pas pertinent
- le parcours ne duplique pas inutilement des formulaires entièrement séparés

## Story 5 — Liste lisible après création

En tant que membre du foyer,
je veux retrouver facilement l'événement que je viens de créer,
afin d'avoir confiance dans le système.

### Critères d'acceptation

- après création, la liste se recharge correctement
- le retour depuis une entrée dashboard reste cohérent
- l'élément nouvellement créé est visible sans ambiguïté
- les informations affichées suffisent à le reconnaître rapidement

## Story 6 — Filtres de base utiles

En tant que membre du foyer,
je veux filtrer l'historique par critères simples,
afin de retrouver rapidement le bon événement.

### Critères d'acceptation

- filtre par type utilisable
- filtre par statut utilisable pour les tâches
- état vide compréhensible
- URL synchronisée avec les filtres principaux

## Story 7 — Vocabulaire produit cohérent

En tant qu'utilisateur,
je veux une interface qui parle le langage de l'usage,
afin de ne pas subir le vocabulaire interne du modèle.

### Critères d'acceptation

- le mot `interaction` n'est pas le terme dominant des CTA principaux
- les pages utilisent des labels plus naturels pour l'utilisateur
- la cohérence de vocabulaire est la même entre liste, formulaire et feedback

## Recommandation d'interface pour le sélecteur de type

Je déconseille le dropdown classique si la liste de types continue de grandir.

Les deux options raisonnables sont :

- `dialog` si tu veux une étape de choix claire, compacte et focalisée
- `sheet` si tu veux un flux plus mobile-first et plus extensible

Pour ce projet, la `sheet` est probablement la meilleure option si tu veux faire évoluer la création rapide sans alourdir le dashboard.

Le repo a déjà les primitives nécessaires pour cela via le design system :

- [ui/src/design-system/dialog.tsx](/Users/benjaminvandamme/Developer/house/ui/src/design-system/dialog.tsx)
- [ui/src/design-system/sheet-dialog.tsx](/Users/benjaminvandamme/Developer/house/ui/src/design-system/sheet-dialog.tsx)

## Structure recommandée des types dans le sélecteur

### Types principaux

- Note
- Tâche
- Dépense
- Maintenance

### Types secondaires

- Réparation
- Installation
- Inspection
- Garantie
- Problème
- Amélioration
- Remplacement
- Mise au rebut

Cette hiérarchie est produitement plus saine que d'exposer tous les types au même niveau.

## Architecture de formulaire recommandée

Le bon compromis actuel est :

- un formulaire unique
- un tronc commun stable
- des sections conditionnelles selon le type

Tronc commun recommandé :

- titre
- date/heure
- zone
- description

Champs spécifiques ensuite selon le type.

Il ne faut pas partir tout de suite sur une page complètement différente par type tant que les workflows ne sont pas réellement divergents.

## Proposition UI V1 exacte

Cette section décrit le flow V1 recommandé, adapté au projet tel qu'il existe aujourd'hui.

## 1. CTA dashboard

Le dashboard expose déjà une zone de `quickActions` dans [apps/accounts/views/template_views.py](/Users/benjaminvandamme/Developer/house/apps/accounts/views/template_views.py) et [apps/accounts/react/DashboardPage.tsx](/Users/benjaminvandamme/Developer/house/apps/accounts/react/DashboardPage.tsx).

Pour le parcours 1, la recommandation V1 est :

- conserver un seul CTA principal dans cette zone
- libellé recommandé : `Ajouter` ou `Ajouter un événement`
- variante visuelle principale dans les quick actions
- ne pas mettre un bouton distinct pour chaque type

Ce CTA ne doit plus rediriger directement vers un formulaire vide. Il doit d'abord ouvrir le sélecteur de type.

## 2. Ouverture d'une sheet de sélection

Au clic sur le CTA principal, ouvrir une `SheetDialog`.

### Pourquoi ce choix

- meilleure lisibilité qu'un dropdown si la liste de types grandit
- meilleure compatibilité mobile
- permet d'ajouter description, regroupement et hiérarchie de types
- extensible sans refaire le dashboard

### Contenu recommandé de la sheet

Titre : `Que voulez-vous ajouter ?`

Description courte :

`Choisissez le type d'événement à consigner dans l'historique du foyer.`

## 3. Structure des options dans la sheet

Les types ne doivent pas tous apparaître au même niveau.

### Bloc principal — types fréquents

- Note
- Tâche
- Dépense
- Maintenance

Chaque option doit afficher :

- un label
- une phrase d'aide courte
- éventuellement une icône

Exemples de microcopy :

- `Note` : consigner une information libre
- `Tâche` : suivre quelque chose à faire
- `Dépense` : garder la trace d'un achat ou d'un coût
- `Maintenance` : enregistrer une intervention ou un entretien

### Bloc secondaire — autres types

Regrouper dans une section `Autres types` ou `Plus d'options` :

- Réparation
- Installation
- Inspection
- Garantie
- Problème
- Amélioration
- Remplacement
- Mise au rebut

Cette section peut être affichée :

- directement sous les types principaux
- ou derrière un bouton `Voir plus de types`

## 4. Après sélection du type

Une fois le type choisi, deux options sont raisonnables.

### Option recommandée V1

La sheet ferme et redirige vers la page de création dédiée avec type prérempli.

Exemple de logique :

- clic sur `Dépense`
- navigation vers `/app/interactions/new/?type=expense`

Pourquoi cette option est la meilleure pour la V1 :

- elle réutilise le parcours déjà présent dans [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)
- elle évite d'embarquer toute la complexité du formulaire dans le dashboard
- elle réduit le coût d'implémentation
- elle reste compatible avec une évolution future vers une quick capture plus inline

### Option plus ambitieuse mais non nécessaire en V1

Garder la sheet ouverte et y rendre le formulaire directement.

Cette option est intéressante plus tard, mais elle alourdit la première implémentation.

## 5. Structure exacte du formulaire V1

Le formulaire de création doit rester unique, avec un tronc commun stable.

La base existe déjà dans [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx).

### Champs communs à tous les types

- type affiché en tête du formulaire
- titre
- date et heure
- zone
- description

### Champs spécifiques conditionnels

#### Note

- aucun champ supplémentaire en V1

#### Tâche

- statut visible
- statut par défaut : `pending` ou `backlog` selon ta préférence produit

#### Dépense

- montant
- éventuellement devise si tu veux la poser dès maintenant

#### Maintenance

- aucun champ lourd supplémentaire en V1
- possibilité future : équipement concerné ou nature d'intervention

## 6. Ordre visuel recommandé dans le formulaire

1. bandeau ou header rappelant le type choisi
2. titre
3. date/heure
4. zone
5. description
6. champs spécifiques éventuels
7. action de validation

Le type doit rester modifiable si l'utilisateur s'est trompé, mais ce changement ne doit pas casser la fluidité.

## 7. Comportement après validation

Le comportement post-submit doit être cohérent et rassurant.

Flow recommandé V1 :

1. succès visible
2. redirection vers la vue historique
3. liste rechargée
4. idéalement filtre ou état permettant de repérer facilement l'élément créé

La redirection actuelle vers la liste dans [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py) va déjà dans le bon sens.

## 8. Ce qu'il faut afficher sur le dashboard en V1

Le dashboard ne doit pas devenir un mini module de création complet.

Il doit simplement afficher :

- le CTA principal `Ajouter`
- les quick actions secondaires déjà utiles pour le produit
- un aperçu de l'activité récente

Le dashboard reste un hub. La création complète reste portée par la page dédiée.

## 9. Implémentation V1 recommandée

Ordre de mise en oeuvre concret :

1. remplacer l'action `New interaction` du dashboard par un CTA unique ouvrant une `SheetDialog`
2. implémenter le sélecteur de type avec 4 types principaux et un bloc secondaire
3. rediriger vers `/app/interactions/new/?type=...`
4. adapter le formulaire pour afficher clairement le type sélectionné
5. ajouter les variations conditionnelles minimales par type
6. conserver le retour vers l'historique après création

## 10. Résumé de la décision V1

Le flow retenu est :

1. dashboard
2. CTA unique `Ajouter`
3. `SheetDialog` de choix du type
4. redirection vers formulaire dédié prérempli
5. formulaire unique avec sections conditionnelles
6. retour vers historique

Ce flow est propre, scalable, compatible mobile, et suffisamment léger pour une première livraison utile.

## Écrans impactés

- dashboard
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)
- [apps/interactions/react/InteractionList.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionList.tsx)
- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx)
- la navigation et les CTA menant vers la création

## Hors scope pour cette semaine

Pour garder une vraie livraison verticale, je sortirais explicitement du périmètre :

- liaison détaillée aux documents
- création depuis email entrant
- automatisations IA
- workflows complexes contacts/structures
- vue détaillée complète d'un événement si elle n'est pas encore nécessaire au parcours
- raffinement avancé des types spécialisés

## Décisions produit recommandées

## 1. Conserver `Interaction` comme modèle unique

Ne pas éclater ce parcours en plusieurs modèles séparés à ce stade.

Pourquoi :

- le timeline reste unifié
- la recherche reste cohérente
- les futurs liens documents/projets/zones restent simples
- les types `note`, `todo`, `expense`, `maintenance` suffisent à créer des vues spécialisées plus tard

## 2. Masquer partiellement le terme `interaction`

Recommandation UI :

- page liste : `Historique` ou `Activité`
- page création : `Ajouter un événement`
- éléments de formulaire : `Type`, `Titre`, `Date`, `Description`, `Pièces/Zones concernées`

## 3. Réduire la complexité visible au premier contact

Même si le backend supporte de nombreux types, le premier niveau d'interface ne devrait pas tous les exposer avec le même poids.

## 4. Traiter la recherche comme un besoin de base

L'API supporte déjà `search`, mais la liste React actuelle met surtout l'accent sur type et statut.

Produitement, il faut considérer que la recherche textuelle fait partie du parcours de retrouvabilité, même si elle n'est pas encore livrée cette semaine.

## Écarts actuels entre socle technique et parcours cible

## Ce qui est déjà bon

- validation household cohérente
- zone obligatoire bien défendue côté API
- filtres de base présents
- préchargement initial côté page web
- architecture mini-SPA compatible avec une itération rapide

## Ce qui semble encore faible

- aucun détail de navigation dans la liste au-delà de la lecture rapide
- pas de recherche textuelle visible dans le composant liste actuel
- type et statut affichés tels quels, sans forte couche de vocabulaire produit
- aucun pattern documenté de sélecteur de type entre le dashboard et le formulaire
- trop de types potentiellement visibles si on les expose tous au même niveau
- continuité UX post-création encore basique

## Métriques produit à suivre

Même sans instrumentation lourde, tu peux suivre quelques signaux simples :

- temps estimé de création d'un événement simple
- nombre moyen de champs réellement remplis
- proportion d'événements avec zone correctement renseignée
- facilité à retrouver un élément créé dans les 24 dernières heures
- usage réel des filtres type/statut

## Définition de done du parcours 1

Le parcours peut être considéré comme livré si, pour un utilisateur réel :

1. il sait où cliquer pour ajouter un événement
2. il comprend immédiatement les types principaux proposés
3. il peut créer un événement simple avec peu de friction
4. il revient sur une liste lisible après création
5. il retrouve l'événement grâce aux filtres de base
6. il perçoit ce flux comme l'entrée naturelle du journal du foyer

## Check de validation manuelle

Avant de considérer la semaine terminée, vérifier ce scénario complet :

1. ouvrir `/app/interactions/`
2. lancer la création
3. créer une note liée à une zone
4. revenir sur la liste
5. retrouver l'élément créé
6. filtrer par type
7. confirmer que l'expérience est claire sans explication technique

## Proposition de séquence d'implémentation

Si tu travailles vraiment une semaine sur ce parcours, je te conseille cet ordre :

### Étape 1

Poser une entrée de capture rapide cohérente depuis le dashboard.

### Étape 2

Créer le sélecteur de type dans un dialog ou une sheet.

### Étape 3

Aligner le vocabulaire produit sur dashboard + liste + création.

### Étape 4

Structurer le formulaire autour d'un tronc commun et de variantes par type.

### Étape 5

Renforcer la continuité après création vers la liste.

### Étape 6

Améliorer la lisibilité de la liste et des filtres existants.

### Étape 7

Décider si la recherche textuelle entre dans la semaine 1 ou devient le premier incrément de la semaine suivante.

## Risques à éviter

- transformer la page en formulaire trop riche
- exposer trop de types dès le départ
- laisser le vocabulaire technique prendre le dessus
- traiter la capture sans traiter la retrouvabilité
- faire une refonte UI large sans renforcer le flux réel

## Conclusion

Ce premier parcours ne doit pas être jugé comme une simple fonctionnalité CRUD. C'est la colonne vertébrale du produit.

Si ce flux devient naturel, rapide et fiable, House gagne immédiatement en utilité quotidienne et crée une base saine pour documents, tâches, projets et navigation contextuelle.

Backlog technique associé : `docs/PARCOURS_01_BACKLOG_TECHNIQUE.md`