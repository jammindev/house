# Parcours 02 — Traiter un document entrant et le relier au bon contexte

Ce document détaille le deuxième parcours métier prioritaire à travailler dans House.

Il s'appuie sur l'état actuel du projet Django + React hybride, et non sur les archives `legacy/`.

Note complémentaire : la projection future d'une compréhension ou d'un rattachement assistés par IA est consolidée dans la section "Évolutions ultérieures" de [docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md](../../docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md).

## Résumé

Le deuxième usage fondamental du produit est le suivant :

"J'ai un document utile pour la maison et je veux qu'il serve vraiment, pas qu'il reste isolé dans une liste."

Ce parcours est prioritaire car les documents ont une forte valeur pratique mais restent peu exploitables tant qu'ils ne sont pas reliés à un événement, une zone, un projet ou un acteur.

- Une facture devient utile quand elle est reliée à une dépense, une intervention ou un projet.
- Un devis devient utile quand il est relié à une décision ou à une action à suivre.
- Un manuel devient utile quand il est retrouvé depuis l'équipement ou l'intervention concernée.
- Une photo de document devient utile quand elle est replacée dans un contexte métier compréhensible.

Autrement dit, ce parcours ne doit pas être pensé comme une simple bibliothèque de fichiers. Il doit être pensé comme un flux de qualification et de rattachement d'une pièce utile à la mémoire du foyer.

## Positionnement produit

## Concept interne

Le modèle technique central de ce parcours reste `Document`.

Ce nom est bon pour :

- le backend Django
- l'API DRF
- les serializers et vues
- les composants React métier
- la cohérence de la donnée

## Concept visible côté utilisateur

Dans l'interface, le vocabulaire recommandé pour ce parcours est :

- vue globale : `Documents`
- état à traiter : `À relier`, `Sans contexte`, `Non rattaché`
- action principale : `Ouvrir`, `Relier`, `Créer une activité depuis ce document`
- formulation secondaire : `document`, `pièce`, `justificatif`, `manuel`, `facture`, `devis`

Le mot `document` peut rester central dans l'UI, à condition qu'il soit toujours accompagné d'un contexte d'usage clair.

## Objectif produit

Permettre à un membre du foyer de :

1. ajouter simplement un document quand il entre dans le système
2. retrouver rapidement un document entrant ou récent
3. comprendre ce qu'il représente avec juste assez d'informations
4. le rattacher au bon contexte métier sans ressaisie inutile
5. naviguer facilement entre le document et les entités liées

## Périmètre de livraison V1 retenu

La livraison visée à court terme pour le parcours 02 est une V1 manuelle recentrée sur le lien document <-> activité.

Elle couvre explicitement :

- l'ajout manuel ou l'upload simple d'un document
- la liste documents avec mise en avant des documents sans activité
- le détail document avec état de rattachement actuel
- le rattachement à une activité existante
- la création d'une activité depuis un document avec préremplissage minimal et retour au détail document

Elle n'inclut pas dans cette livraison :

- l'ingestion email entrante comme flux runtime principal
- une couche de compréhension assistée par IA
- une orchestration complète des rattachements contact, structure, projet ou zone depuis le détail document

## Décisions de cadrage MVP réaliste

Pour rendre le parcours 02 effectivement réalisable dans le code actif, la V1 doit assumer explicitement les décisions suivantes :

- le rattachement document -> activité est géré côté métier par `InteractionDocument`
- un document peut donc être relié à zéro, une ou plusieurs activités
- `Document.interaction` doit être traité comme un héritage technique du runtime, pas comme la vérité produit de la V1
- la page document devient la surface canonique de lecture et d'action
- le parcours 02 V1 ne dépend pas de l'existence d'une page web de détail activité
- la continuité de navigation minimale est : liste documents -> détail document -> création ou rattachement -> retour au détail document
- les liens projet et zone restent visibles en lecture si on peut les résoudre simplement, mais leur création complète n'entre pas dans le coeur de la V1

## Répartition des rôles entre page documents et pages métier liées

Le parcours s'appuie sur deux surfaces complémentaires.

## Page documents

La page documents doit devenir la surface d'entrée et de tri de ce parcours.

Elle doit servir à :

- ajouter un document avec un minimum de friction
- lister les documents récents ou non reliés
- signaler les documents qui restent isolés
- ouvrir un détail clair du document
- déclencher rapidement le rattachement à une activité ou à un autre contexte

Elle ne doit pas devenir une simple table technique de métadonnées.

## Pages de contexte liées

Les autres pages du produit doivent rester les surfaces métiers de consultation approfondie.

Elles doivent servir à :

- afficher les documents déjà liés à une interaction, une zone ou un projet
- permettre un retour naturel depuis un document vers le contexte concerné
- consolider plusieurs documents autour d'un même sujet

## Principe produit retenu

Le document peut entrer dans le système comme un élément encore ambigu.

Le flux de référence doit ensuite le conduire vers un contexte exploitable.

En pratique, cela veut dire :

- `documents = point d'entrée, qualification et rattachement`
- `interaction / zone / projet = contexte métier de référence`

Le pattern retenu pour la V1 du parcours est :

1. ajouter un document ou ouvrir un document déjà présent
2. voir son état de rattachement actuel
3. choisir de le relier à une activité existante ou d'en créer une depuis ce document
4. conserver la possibilité d'enrichir le reste du contexte ensuite

## Promesse UX de ce parcours

Si l'utilisateur reçoit ou retrouve un document utile, il doit pouvoir comprendre en quelques secondes s'il est déjà relié au bon sujet.

Si le document n'est pas encore relié, il doit pouvoir le rattacher sans avoir à naviguer dans plusieurs modules ni à ressaisir inutilement les mêmes informations.

## Ce que le projet a déjà aujourd'hui

Le repo contient désormais l'essentiel du flux manuel V1, avec encore un travail de pré-livraison sur la recette, le polish et la documentation.

## Pages web existantes

- `/app/documents/` via [apps/documents/views_web.py](../../apps/documents/views_web.py)
- `/app/documents/new/` via [apps/documents/views_web.py](../../apps/documents/views_web.py)
- `/app/documents/<id>/` via [apps/documents/views_web.py](../../apps/documents/views_web.py)

## Composants React existants

- liste : [apps/documents/react/DocumentsPage.tsx](../../apps/documents/react/DocumentsPage.tsx)
- item de liste : [apps/documents/react/DocumentListItem.tsx](../../apps/documents/react/DocumentListItem.tsx)
- création : [apps/documents/react/DocumentCreatePage.tsx](../../apps/documents/react/DocumentCreatePage.tsx)
- détail : [apps/documents/react/DocumentDetailPage.tsx](../../apps/documents/react/DocumentDetailPage.tsx)
- modal d'édition légère : [apps/documents/react/EditDocumentModal.tsx](../../apps/documents/react/EditDocumentModal.tsx)
- point de montage : [ui/src/pages/documents/list.tsx](../../ui/src/pages/documents/list.tsx)
- points de montage complémentaires : [ui/src/pages/documents/new.tsx](../../ui/src/pages/documents/new.tsx), [ui/src/pages/documents/detail.tsx](../../ui/src/pages/documents/detail.tsx)

## API existante

- CRUD principal : `/api/documents/documents/`
- upload simple : `/api/documents/documents/upload/`
- regroupement par type : `/api/documents/documents/by_type/`
- relance OCR placeholder : `/api/documents/documents/{id}/reprocess_ocr/`

Implémentation principale : [apps/documents/views.py](../../apps/documents/views.py)

## Capacité métier déjà présente

- création, upload et édition d'un document avec type, notes, OCR, métadonnées et household scoping
- présence de deux mécanismes de lien activité : `Document.interaction` et `InteractionDocument`
- filtre simple côté UI pour isoler les documents non reliés
- liens déjà existants au niveau du modèle vers certaines entités métier
- cohérence household déjà en place côté API
- détail document avec activités liées, zones, projets et candidats récents
- rattachement à une activité existante depuis le détail document
- création d'activité depuis le document avec rattachement automatique et retour au détail document

## Point important de scope actuel

L'upload ou l'ajout manuel de document est maintenant disponible dans le runtime actif.

Cela implique que le parcours 02 doit désormais couvrir explicitement deux promesses :

- faire entrer un document dans le système avec un flux minimal crédible
- rendre ce document utile ensuite par qualification et rattachement

## Liens métier déjà présents dans le code actif

Le code actif contient déjà plusieurs formes de rattachement de documents :

- interaction <-> document via `InteractionDocument`
- document -> interaction via `Document.interaction` (héritage runtime, non retenu comme contrat produit V1)
- zone <-> document via `ZoneDocument`
- projet <-> document via `ProjectDocument`

Cela veut dire qu'on n'est pas face à un vide technique, mais à un flux produit encore incomplet et hétérogène.

Pour une V1 réaliste avec plusieurs activités possibles par document, le contrat produit doit se recentrer sur `InteractionDocument`.

## Limites actuelles du runtime

Aujourd'hui, on a surtout :

- une liste de documents
- un filtre `non reliés`
- un ajout manuel ou upload simple
- une édition légère du nom, du type et des notes
- une suppression
- un détail document avec lecture du contexte actuel
- un rattachement à une activité existante
- une création d'activité depuis le document avec préremplissage minimal

Ce qui manque pour rendre le parcours vraiment fort :

- une recette bout en bout explicite de pré-livraison
- un dernier passage de polish UX et de wording produit
- une clarification du statut de livraison dans la documentation transversale
- une stratégie plus complète sur les autres contextes métier au-delà de l'interaction

## Problème utilisateur précis

Quand un document entre dans le système, l'utilisateur ne doit pas se demander :

- est-ce juste un fichier stocké ou quelque chose d'utile ?
- où vais-je le retrouver plus tard ?
- dois-je l'attacher à une activité, une zone, un projet ?
- faut-il créer quelque chose d'abord pour qu'il serve ?

Le système doit répondre à cette hésitation par un flux simple :

- j'ouvre le document
- je comprends son état actuel
- je le relie au bon sujet
- je peux revenir ensuite vers le document sans perdre le fil, même si le détail activité n'est pas encore une page dédiée du runtime

## Utilisateur cible

Pour ce deuxième parcours, la cible principale est un membre de household qui reçoit, retrouve ou classe une pièce utile pour la maison.

Exemples :

- une facture d'intervention
- un devis à comparer
- un manuel d'équipement
- une photo d'attestation, de référence ou de garantie
- un document administratif à garder sous la main

## Scénarios prioritaires

## Scénario A — Facture à relier à une dépense

"Je viens d'ajouter une facture, je veux qu'elle soit reliée à la bonne activité pour la retrouver plus tard."

## Scénario B — Devis à transformer en sujet suivi

"J'ai un devis, je veux garder sa trace et pouvoir ensuite le rattacher à un projet ou à une décision."

## Scénario C — Manuel à relier à un contexte utile

"Je garde le manuel d'un équipement, mais je veux le retrouver depuis le bon endroit le jour où j'en ai besoin."

## Scénario D — Document isolé à qualifier

"J'ai un document dans la bibliothèque, mais je ne sais plus à quoi il correspond ; je veux le comprendre et le relier proprement."

## Parcours cible

Le parcours de référence pour la V1 est le suivant.

1. L'utilisateur ajoute un document depuis la page documents.
2. Le document entre dans le système avec des métadonnées minimales et un état `sans contexte` si aucun lien n'existe encore.
3. L'utilisateur repère ensuite ce document récent ou non relié dans la liste.
4. Il ouvre une vue de détail claire du document.
5. Le système lui montre les métadonnées utiles, le type, les notes et l'état de rattachement actuel.
6. Il choisit soit de relier le document à une ou plusieurs activités existantes, soit de créer une activité à partir du document.
7. Le système préremplit au maximum les informations disponibles sans imposer de ressaisie inutile.
8. Le document est ensuite visible comme rattaché à un contexte métier exploitable.
9. L'utilisateur revient au détail document avec un feedback clair sur le rattachement créé ou ajouté.

## Règles produit

## Règle 0 — L'entrée du document dans le système doit exister en V1

Le parcours 02 ne peut pas reposer uniquement sur l'hypothèse qu'un document existe déjà.

Il faut au minimum un flux d'ajout crédible permettant :

- de choisir un fichier
- de lui donner un nom ou de réutiliser un nom par défaut
- de définir un type minimal si nécessaire
- de l'enregistrer même sans contexte métier immédiat

Le but n'est pas de construire une GED complète dès cette étape.

Le but est de garantir une entrée simple et exploitable dans le système.

## Règle 1 — Un document ne doit pas rester une simple pièce isolée

Le produit doit encourager la qualification et le rattachement, pas seulement le stockage.

Cela ne veut pas dire qu'un document doit être obligatoirement relié dès la création.

Cela veut dire qu'un document non relié doit être identifiable et traitable rapidement.

## Règle 2 — La page de détail document doit devenir la surface canonique du parcours

La liste seule ne suffit pas.

Le bon modèle produit pour la V1 est :

- liste pour repérer
- détail pour comprendre et agir

## Règle 3 — Le premier contexte à prioriser est l'activité

Le rattachement le plus structurant pour la V1 est le lien `document <-> activité`.

Pourquoi :

- il est déjà cohérent avec le coeur interaction-first du produit
- il transforme immédiatement le document en élément retrouvé dans l'historique
- il crée un pont naturel vers les autres parcours

Pour cette V1, il faut assumer qu'un document peut être relié à plusieurs activités.

Le bon support métier de ce besoin est `InteractionDocument`, pas `Document.interaction`.

Les liens zone et projet existent déjà dans le code ou le modèle, mais n'ont pas besoin d'être tous exposés dès la première itération du parcours 02.

## Règle 4 — Le document doit rester lisible même quand l'OCR est imparfait

Le texte OCR, s'il existe, est utile.

Mais la compréhension produit ne doit pas dépendre entièrement d'une extraction parfaite.

Il faut garder une hiérarchie simple :

- identité du document
- type
- notes
- rattachements actuels
- contenu OCR en aide secondaire

## Règle 5 — Le retour entre document et contexte doit être fluide

Après un rattachement ou une création d'activité, l'utilisateur doit pouvoir :

- revenir au document
- comprendre visuellement que le lien a bien été créé

Dans le runtime actuel, cette règle ne doit pas être interprétée comme une obligation de livrer immédiatement une page web de détail activité.

Pour la MVP, la continuité minimale suffisante est :

- retour au détail document après action
- affichage immédiat des activités liées
- possibilité ultérieure d'ajouter un vrai détail activité sans remettre en cause le parcours document

## Règle 6 — Le flux doit rester compatible avec une future ingestion email ou IA

Le parcours 02 ne doit pas supposer que tous les documents viennent d'un upload manuel propre.

Il doit rester compatible avec des documents arrivant plus tard par :

- email entrant
- import automatisé
- pipeline OCR
- compréhension assistée par IA

## Backlog produit recommandé pour la première itération

Le but n'est pas de finir une GED complète. Le but est de rendre un document utile dans un flux concret.

## Story 0 — Ajouter un document simplement

En tant que membre du foyer,
je veux pouvoir ajouter un document sans passer par un flux technique ou incomplet,
afin qu'il entre dans le système avant d'être qualifié.

### Critères d'acceptation

- un point d'entrée clair d'ajout existe depuis la page documents
- un fichier peut être enregistré avec des métadonnées minimales
- le document peut exister sans contexte immédiat
- le document ajouté devient visible dans la liste juste après création

## Story 1 — Voir les documents à traiter

En tant que membre du foyer,
je veux repérer rapidement les documents sans contexte,
afin de savoir lesquels nécessitent une action.

### Critères d'acceptation

- la liste documents permet d'identifier les documents non reliés
- le volume de documents à traiter est visible
- l'état vide est compréhensible

## Story 2 — Ouvrir un document et comprendre son état

En tant qu'utilisateur,
je veux ouvrir un document et voir ce qu'il représente déjà,
afin de décider quoi en faire.

### Critères d'acceptation

- une vue de détail document existe
- les métadonnées principales sont visibles
- les rattachements actuels sont visibles
- l'OCR éventuel reste consultable sans prendre tout l'écran

## Story 3 — Relier un document à une activité existante

En tant qu'utilisateur,
je veux rattacher un document à une activité existante,
afin d'éviter les doublons et de retrouver le document depuis l'historique.

### Critères d'acceptation

- le choix d'une activité existante est simple
- le rattachement est confirmé visuellement
- le ou les liens deviennent visibles depuis le document

## Story 4 — Créer une activité depuis un document

En tant qu'utilisateur,
je veux créer une activité à partir d'un document,
afin de transformer immédiatement un justificatif ou une pièce en élément exploitable.

### Critères d'acceptation

- le document peut servir de point de départ à la création
- certaines données sont préremplies ou reportées quand c'est utile
- le document reste relié à l'activité créée

Pour rester réaliste avec le runtime actuel, la création d'activité peut conserver l'étape de choix de zone si le formulaire existant l'exige encore.

## Story 5 — Garder une navigation continue

En tant qu'utilisateur,
je veux naviguer entre le document et son contexte lié,
afin de ne pas perdre le fil après rattachement.

### Critères d'acceptation

- le détail document affiche clairement les activités liées après action
- le feedback de création ou de rattachement permet de revenir au document si besoin
- le produit donne une impression de continuité plutôt que de modules séparés

## Recommandation d'interface pour la V1

Je recommande pour cette itération :

- une entrée d'ajout document simple et explicite
- une liste documents qui reste légère
- une vraie page de détail document
- dans cette page, un bloc `Contexte actuel`
- puis deux actions principales : `Relier à une activité` et `Créer une activité depuis ce document`

Cette direction est plus saine qu'une multiplication de petites actions inline directement dans la liste.

L'ajout initial peut rester minimal tant que l'étape suivante de qualification est claire.

## Structure recommandée de la page détail document

### Bloc 1 — Identité du document

- nom
- type
- date de création
- taille ou mime type si utile

### Bloc 2 — Compréhension rapide

- notes utilisateur
- extrait OCR si disponible
- indice de provenance ou de catégorie plus tard si nécessaire

### Bloc 3 — Contexte actuel

- activités liées si elles existent
- autres rattachements visibles plus tard si disponibles
- état `sans contexte` sinon

### Bloc 4 — Actions

- modifier les métadonnées simples
- relier à une activité existante
- créer une activité depuis le document
- ouvrir le fichier original

## Architecture de rattachement recommandée pour la V1

Le bon compromis actuel est :

- ne pas faire de refactor large du domaine document
- utiliser `InteractionDocument` comme vérité produit pour document <-> activité
- considérer `Document.interaction` comme un héritage de compatibilité éventuelle, pas comme la source principale de la V1
- garder les autres liens existants comme extensions naturelles du parcours

Autrement dit, la première promesse à tenir est :

`un document n'est plus isolé parce qu'il peut être relié à une activité utile`

et non :

`un document peut tout relier partout dès la première itération`

## Proposition UI V1 exacte

Cette section décrit le flow V1 recommandé, adapté au projet tel qu'il existe aujourd'hui.

## 1. Liste documents

La page documents expose :

- une action `Ajouter un document`
- les documents récents
- le compteur global
- le compteur de documents non reliés
- un filtre simple `Afficher seulement les documents sans contexte`

Dans la V1 réalisable, la notion `sans contexte` doit être calculée à partir des liens activités effectivement exposés au produit, et non seulement à partir du champ hérité `Document.interaction`.

## 1 bis. Ajout minimal du document

Le flux d'ajout V1 doit permettre :

- de sélectionner un fichier
- de proposer un nom par défaut modifiable
- de choisir un type simple si utile
- d'enregistrer le document sans exiger de rattachement immédiat

Une fois créé, le document doit revenir naturellement dans la liste puis pouvoir être ouvert dans son détail.

## 2. Ouverture du détail document

Au clic sur un document, l'utilisateur arrive sur une page de détail dédiée.

Pourquoi ce choix :

- meilleure lisibilité qu'une modal si le document doit afficher métadonnées, OCR et rattachements
- meilleure extensibilité pour la suite
- meilleure continuité de navigation

## 3. Bloc de contexte dans le détail

La page montre clairement :

- si le document est déjà relié à une ou plusieurs activités
- sinon qu'il est encore `sans contexte`
- quelles actions sont possibles ensuite

## 4. Action `Relier à une activité existante`

Cette action ouvre un sélecteur ou une surface simple de recherche d'activité.

L'objectif V1 n'est pas de construire un moteur avancé, mais de proposer une sélection lisible et rapide.

Cette action ajoute un lien `InteractionDocument`.

Elle ne doit pas être pensée comme le remplacement d'une activité unique déjà stockée sur le document.

## 5. Action `Créer une activité depuis ce document`

Cette action renvoie vers la création d'activité avec le document déjà passé dans le flux.

Pourquoi cette option est bonne pour la V1 :

- elle réutilise le parcours 01 déjà présent
- elle évite de reconstruire un gros formulaire dans la page documents
- elle renforce la cohérence du produit autour de l'historique

Dans la V1 réalisable, la fin du flux doit prioritairement ramener l'utilisateur vers le détail document avec le nouveau lien visible.

## Risques à éviter

- transformer la page documents en écran de stockage passif
- imposer trop tôt tous les types de rattachement dans la même UI
- dépendre entièrement de l'OCR pour rendre un document compréhensible
- créer une couche de workflow email alors que le parcours document de base n'est pas encore solide

## Définition de done produit

La V1 du parcours 02 peut être considérée comme crédible si :

1. l'utilisateur peut ajouter un document simplement
2. l'utilisateur repère facilement les documents non reliés
3. il peut ouvrir un document et comprendre son état actuel
4. il peut relier un document à une ou plusieurs activités existantes
5. il peut créer une activité à partir d'un document
6. le retour au document après action est clair et fiable
