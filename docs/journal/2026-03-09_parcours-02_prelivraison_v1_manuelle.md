# 2026-03-09 — Parcours 02 pré-livraison V1 manuelle

## Contexte

Relecture croisée de la documentation produit et du runtime actif pour le parcours 02.

Objectif de la session : figer le périmètre de livraison réaliste, vérifier le raccord document -> activité, et réaligner la documentation sur l'état réel du code.

## Décision de périmètre

La livraison visée est une V1 manuelle du parcours document -> activité.

Inclu dans cette livraison :

- ajout manuel ou upload simple d'un document
- liste documents avec repérage des documents sans activité
- détail document avec contexte actuel
- rattachement à une activité existante
- création d'une activité depuis un document avec préremplissage minimal
- retour au détail document après création ou rattachement

Hors périmètre de cette livraison :

- ingestion email entrante comme surface runtime active
- compréhension assistée par IA
- orchestration complète des autres contextes métier depuis le détail document

## Ce qui a été confirmé dans le runtime

- la liste documents existe et expose déjà les documents sans activité
- l'upload simple existe côté web et API
- la page détail document existe et expose les activités, zones et projets liés
- le rattachement à une activité existante fonctionne depuis le détail document
- la création d'activité depuis un document est raccordée au retour sur le détail document
- le formulaire activité reçoit maintenant un préremplissage minimal à partir du document source
- le formulaire activité permet aussi de sélectionner d'autres documents existants et d'ajouter un document simple inline avant création

## Effet produit

Le raccord entre les parcours 01 et 02 est plus symétrique.

- on peut partir d'un document vers une activité
- on peut aussi partir d'une activité et y rattacher immédiatement un ou plusieurs documents
- le formulaire activité peut servir de point d'entrée pragmatique quand l'utilisateur pense d'abord à l'événement plutôt qu'au document

Cette capacité reste un enrichissement transverse et ne change pas le périmètre formel de la V1 manuelle du parcours 02.

## Reste avant livraison

- exécuter et relire la recette bout en bout ciblée
- faire un dernier passage de polish UX léger si la recette révèle une friction
- garder la doc transverse alignée avec le périmètre réellement livré

## Références

- [docs/PARCOURS_02_TRAITER_UN_DOCUMENT_ENTRANT_ET_LE_RELIER_AU_BON_CONTEXTE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_02_TRAITER_UN_DOCUMENT_ENTRANT_ET_LE_RELIER_AU_BON_CONTEXTE.md)
- [docs/PARCOURS_02_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_02_BACKLOG_TECHNIQUE.md)
- [docs/PARCOURS_02_COMPREHENSION_ASSISTEE_PAR_IA.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_02_COMPREHENSION_ASSISTEE_PAR_IA.md)