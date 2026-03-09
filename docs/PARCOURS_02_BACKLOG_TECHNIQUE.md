# Parcours 02 — Backlog technique V1

Ce document traduit la décision produit du parcours 02 en backlog technique concret pour le repo actuel.

Flow cible :

1. ajout minimal du document
2. liste documents
3. repérage des documents sans contexte
4. ouverture d'un détail document
5. visualisation du contexte actuel
6. rattachement à une activité existante ou création d'une activité depuis le document
7. retour fluide entre document et activité

## Objectif d'implémentation

Livrer une première version utilisable sans refactor large, en réutilisant au maximum l'architecture déjà en place :

- page documents React déjà montée côté Django
- API documents déjà disponible dans le repo
- parcours 01 déjà en place pour la création et la consultation des activités
- modèles de lien déjà présents pour plusieurs contextes métier

## Principe d'exécution

Le backlog est organisé en lots techniques verticaux.

Chaque lot doit produire un incrément testable.

## Lot 0 — Entrée minimale du document dans le système

### But

Spécifier puis migrer un flux d'ajout ou d'upload simple permettant de faire exister un document dans le runtime actif.

### Fichiers principaux

- [apps/documents/views.py](/Users/benjaminvandamme/Dev/house/apps/documents/views.py)
- [apps/documents/views_web.py](/Users/benjaminvandamme/Dev/house/apps/documents/views_web.py)
- [apps/documents/react/DocumentsPage.tsx](/Users/benjaminvandamme/Dev/house/apps/documents/react/DocumentsPage.tsx)
- [ui/src/lib/api/documents.ts](/Users/benjaminvandamme/Dev/house/ui/src/lib/api/documents.ts)
- [apps/documents/tests/test_api_documents.py](/Users/benjaminvandamme/Dev/house/apps/documents/tests/test_api_documents.py)

### Tâches

1. Définir le point d'entrée UI `Ajouter un document`.
2. Définir le contrat minimal d'ajout : fichier, nom, type, household.
3. Décider si la V1 passe par un vrai upload fichier ou par un flux de création minimale compatible avec le stockage actuel.
4. Garantir qu'un document peut être créé sans contexte métier immédiat.
5. Faire réapparaître le document ajouté dans la liste active.

### Notes techniques

- L'API CRUD `documents` existe déjà mais le flux web d'ajout n'est pas encore migré comme expérience produit.
- Il faut privilégier un incrément minimal crédible, pas une refonte complète du stockage.
- Le document ajouté doit pouvoir rester `sans contexte` avant qualification.

### Critères de validation

- un utilisateur peut ajouter un document depuis la page documents
- le document existe ensuite dans la liste
- aucun rattachement n'est requis au moment de l'ajout

## Lot 1 — Reframing produit de la page documents

### But

Faire évoluer la page documents pour qu'elle serve de point d'entrée de traitement, et pas seulement de bibliothèque de fichiers.

### Fichiers principaux

- [apps/documents/views_web.py](/Users/benjaminvandamme/Dev/house/apps/documents/views_web.py)
- [apps/documents/react/DocumentsPage.tsx](/Users/benjaminvandamme/Dev/house/apps/documents/react/DocumentsPage.tsx)
- [apps/documents/react/DocumentsFilters.tsx](/Users/benjaminvandamme/Dev/house/apps/documents/react/DocumentsFilters.tsx)
- [ui/src/locales/en/translation.json](/Users/benjaminvandamme/Dev/house/ui/src/locales/en/translation.json)
- [ui/src/locales/fr/translation.json](/Users/benjaminvandamme/Dev/house/ui/src/locales/fr/translation.json)

### Tâches

1. Clarifier le vocabulaire visible de la page documents.
2. Mettre en avant la notion de documents sans contexte ou à relier.
3. Vérifier que le filtre actuel `non reliés` s'inscrit bien dans le parcours produit.
4. Préparer les CTA qui mèneront au détail document.

### Notes techniques

- La page documents existe déjà mais ses props sont quasi inexistantes.
- Le filtre `unlinkedOnly` est aujourd'hui calculé côté React sur la liste chargée.
- Le cadrage V1 peut rester simple avant d'introduire des filtres API plus riches.

### Critères de validation

- la page documents expose clairement le sous-ensemble des documents à traiter
- la liste est lisible avec ou sans filtre
- l'entrée vers le détail document est évidente

## Lot 2 — Vue détail document

### But

Ajouter une page dédiée de détail document pour comprendre l'élément et agir dessus.

### Fichiers principaux

- [apps/documents/views_web.py](/Users/benjaminvandamme/Dev/house/apps/documents/views_web.py)
- [apps/documents/web_urls.py](/Users/benjaminvandamme/Dev/house/apps/documents/web_urls.py)
- [apps/documents/react/](/Users/benjaminvandamme/Dev/house/apps/documents/react)
- [ui/src/pages/documents/](/Users/benjaminvandamme/Dev/house/ui/src/pages/documents)
- [ui/vite.config.ts](/Users/benjaminvandamme/Dev/house/ui/vite.config.ts)

### Tâches

1. Créer une vue Django de détail qui hérite de `ReactPageView`.
2. Ajouter une route web du type `/app/documents/<id>/`.
3. Créer un composant React métier de détail document.
4. Ajouter un point d'entrée Vite pour cette page.
5. Rendre la navigation liste -> détail simple et stable.

### Notes techniques

- Le pattern existe déjà dans les apps `projects`, `equipment`, `zones` et `directory`.
- Il faut rester cohérent avec l'architecture mini-SPA ciblée par page.
- La vue détail doit recevoir des props initiales minimales pour éviter un premier rendu vide.

### Critères de validation

- un document peut être ouvert dans une page dédiée
- la page affiche un socle compréhensible sans dépendre d'interactions multiples
- la navigation retour vers la liste est claire

## Lot 3 — Payload détail document côté API

### But

Exposer un payload de détail plus utile pour afficher l'état réel du document et ses contextes liés.

### Fichiers principaux

- [apps/documents/serializers.py](/Users/benjaminvandamme/Dev/house/apps/documents/serializers.py)
- [apps/documents/views.py](/Users/benjaminvandamme/Dev/house/apps/documents/views.py)
- [ui/src/lib/api/documents.ts](/Users/benjaminvandamme/Dev/house/ui/src/lib/api/documents.ts)
- [apps/documents/tests/test_api_documents.py](/Users/benjaminvandamme/Dev/house/apps/documents/tests/test_api_documents.py)

### Tâches

1. Étendre le serializer de détail du document.
2. Exposer l'activité liée de façon claire si elle existe déjà.
3. Prévoir des champs de résumé pour les autres rattachements disponibles ou futurs.
4. Ajouter une fonction frontend de récupération du détail document.

### Recommandation V1

Afficher au minimum :

- identité du document
- notes
- OCR ou extrait OCR
- activité liée actuelle
- indicateurs simples sur les autres liens éventuels si disponibles

### Critères de validation

- le détail document ne nécessite pas de reconstituer les relations côté client à partir de plusieurs appels ambigus
- le payload est suffisant pour afficher un bloc `Contexte actuel`
- les tests d'API couvrent le nouveau contrat de détail

## Lot 4 — Rattachement à une activité existante

### But

Permettre depuis le document de le relier simplement à une activité déjà présente dans l'historique.

### Fichiers principaux

- [apps/documents/react/](/Users/benjaminvandamme/Dev/house/apps/documents/react)
- [ui/src/lib/api/documents.ts](/Users/benjaminvandamme/Dev/house/ui/src/lib/api/documents.ts)
- [apps/documents/views.py](/Users/benjaminvandamme/Dev/house/apps/documents/views.py)
- [apps/interactions/views.py](/Users/benjaminvandamme/Dev/house/apps/interactions/views.py)

### Tâches

1. Définir l'action UI `Relier à une activité existante`.
2. Prévoir une sélection simple d'activité existante.
3. Mettre à jour le document avec l'activité choisie.
4. Rafraîchir le détail document après rattachement.

### Recommandation V1

- ne pas construire tout de suite un moteur avancé de recherche multi-critères
- privilégier un sélecteur simple, lisible, éventuellement limité aux activités récentes ou filtrées
- s'appuyer d'abord sur le lien `Document.interaction` déjà actif dans le runtime

### Point de vigilance

Une table `InteractionDocument` existe déjà. Pour la V1, il vaut mieux éviter un refactor large de la stratégie de lien tant que le flux produit cible n'est pas validé.

### Critères de validation

- le rattachement à une activité existante fonctionne depuis le document
- le document reflète immédiatement son nouveau contexte
- l'utilisateur peut ouvrir l'activité liée ensuite

## Lot 5 — Création d'activité depuis un document

### But

Réutiliser le parcours 01 pour transformer un document en activité exploitable.

### Fichiers principaux

- [apps/documents/react/](/Users/benjaminvandamme/Dev/house/apps/documents/react)
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Dev/house/apps/interactions/views_web.py)
- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Dev/house/apps/interactions/react/InteractionCreateForm.tsx)
- [ui/src/lib/api/interactions.ts](/Users/benjaminvandamme/Dev/house/ui/src/lib/api/interactions.ts)

### Tâches

1. Définir l'action `Créer une activité depuis ce document` dans le détail document.
2. Passer les informations utiles au flux de création d'activité.
3. Prévoir un préremplissage minimal cohérent.
4. Assurer le rattachement du document à l'activité créée.

### Recommandation V1

Le plus simple est de :

- rediriger vers la page de création d'activité existante
- transmettre l'identifiant du document et éventuellement quelques valeurs de contexte
- traiter le rattachement final côté backend ou dans le flux de confirmation

### Critères de validation

- le document peut servir de point d'entrée au parcours activité
- la ressaisie manuelle est réduite
- le document est bien relié à l'activité créée à la fin du flux

## Lot 6 — Affichage du contexte élargi

### But

Préparer l'ouverture vers les autres contextes métier sans alourdir la première itération.

### Fichiers principaux

- [apps/documents/serializers.py](/Users/benjaminvandamme/Dev/house/apps/documents/serializers.py)
- [apps/zones/models.py](/Users/benjaminvandamme/Dev/house/apps/zones/models.py)
- [apps/projects/models.py](/Users/benjaminvandamme/Dev/house/apps/projects/models.py)
- [apps/documents/react/](/Users/benjaminvandamme/Dev/house/apps/documents/react)

### Tâches

1. Décider ce qui doit être visible dès la V1 sur les liens zone/projet.
2. Afficher au moins les contextes déjà connus si le document est déjà relié ailleurs.
3. Reporter la création complète de tous les types de liens si cela surcharge la V1.

### Recommandation V1

- afficher les liens existants si on sait les résoudre simplement
- garder l'action active principale sur l'activité
- traiter projet et zone comme enrichissements utiles mais non bloquants

### Critères de validation

- le document n'est plus vu seulement sous l'angle activité si d'autres rattachements existent
- la page reste lisible et non surchargée

## Lot 7 — Ajustement de la liste et de la retrouvabilité

### But

Faire de la liste documents un bon point de tri et de suivi des éléments à qualifier.

### Fichiers principaux

- [apps/documents/react/DocumentsPage.tsx](/Users/benjaminvandamme/Dev/house/apps/documents/react/DocumentsPage.tsx)
- [apps/documents/react/DocumentListItem.tsx](/Users/benjaminvandamme/Dev/house/apps/documents/react/DocumentListItem.tsx)
- [ui/src/lib/api/documents.ts](/Users/benjaminvandamme/Dev/house/ui/src/lib/api/documents.ts)
- [ui/src/locales/en/translation.json](/Users/benjaminvandamme/Dev/house/ui/src/locales/en/translation.json)
- [ui/src/locales/fr/translation.json](/Users/benjaminvandamme/Dev/house/ui/src/locales/fr/translation.json)

### Tâches

1. Vérifier la lisibilité des badges ou indicateurs de rattachement.
2. Clarifier les labels pour les documents sans contexte.
3. Étudier si une recherche visible doit entrer dans la V1.
4. Vérifier si le filtre `non reliés` doit être synchronisé dans l'URL ou rester local dans un premier temps.

### Recommandation

Pour cette V1, un filtre principal sur les documents non reliés suffit probablement. Une recherche ou un tri plus riche peut rester dans le backlog suivant si le timing est serré.

### Critères de validation

- l'utilisateur retrouve rapidement les documents à traiter
- la liste reste simple et orientée action

## Lot 8 — Tests et validation manuelle

### But

Sécuriser le flux sans multiplier les tests inutiles.

### Fichiers principaux

- [apps/documents/tests/test_api_documents.py](/Users/benjaminvandamme/Dev/house/apps/documents/tests/test_api_documents.py)
- tests web à créer si le payload Django change significativement

### Tâches

1. Ajouter des tests API pour le détail enrichi du document.
2. Ajouter des tests API pour le rattachement à une activité existante.
3. Ajouter des tests pour la création d'activité depuis un document si le contrat backend évolue.
4. Vérifier les labels visibles si des assertions de contenu sont ajoutées.

### Validation manuelle minimale

1. ouvrir la page documents
2. filtrer les documents sans contexte
3. ouvrir un document
4. lire son état actuel
5. le relier à une activité existante
6. revenir au document
7. créer une activité depuis un autre document
8. vérifier le retour fluide entre document et activité

## Ordre recommandé d'implémentation

1. Lot 0 — Entrée minimale du document
2. Lot 1 — Reframing page documents
3. Lot 2 — Vue détail document
4. Lot 3 — Payload détail API
5. Lot 4 — Rattachement à une activité existante
6. Lot 5 — Création d'activité depuis un document
7. Lot 6 — Contexte élargi visible
8. Lot 7 — Ajustement de liste
9. Lot 8 — Tests et validation

## Découpage en sessions de travail

Si tu veux garder de petites itérations propres, je découperais en 3 sessions :

### Session 1

- Lot 0
- Lot 1
- Lot 2
- début Lot 3

### Session 2

- fin Lot 3
- Lot 4
- Lot 5

### Session 3

- Lot 6
- Lot 7
- Lot 8

## Points de vigilance

- ne pas lancer une GED complète trop tôt
- ne pas ouvrir tous les types de liens au même niveau dès la première itération
- ne pas refactorer massivement la stratégie de lien document avant validation du flux produit
- ne pas dépendre d'un pipeline email entrant qui n'est pas encore une surface active du runtime
- garder un vocabulaire produit cohérent entre liste, détail et rattachement

## Définition de done technique

La V1 peut être considérée terminée si :

1. un document peut être ajouté simplement dans le runtime actif
2. la page documents sert réellement à identifier les documents à traiter
3. un document peut être ouvert dans une page de détail utile
4. l'état actuel du document est lisible
5. le document peut être relié à une activité existante
6. une activité peut être créée depuis le document
7. la navigation document <-> activité est claire
8. les tests essentiels sont à jour
