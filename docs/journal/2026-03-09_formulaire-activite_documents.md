# 2026-03-09 — Formulaire activité et documents

## Contexte

Extension du formulaire de création d'activité pour mieux relier les parcours 01 et 02 sans ouvrir de nouveau chantier backend.

Objectif de la session : permettre de lier des documents depuis le formulaire activité lui-même, au lieu d'obliger l'utilisateur à passer uniquement par la page documents.

## Ce qui a été ajouté

- sélection de documents existants directement depuis le formulaire activité
- recherche locale simple dans les documents disponibles
- priorisation des documents sans activité dans la liste de suggestions
- filtre simple par type de document
- ajout d'un document simple inline depuis le formulaire activité, puis rattachement immédiat à l'activité créée

## Décisions de périmètre

- pas de refactor backend : réutilisation de `document_ids` et du contrat API existant
- pas de recherche serveur dédiée pour cette version
- pas de création inline avancée au-delà d'un upload simple
- les documents restent un enrichissement optionnel du formulaire, pas un champ obligatoire

## Effet produit

Le formulaire activité devient un point d'entrée plus réaliste pour les cas où l'utilisateur pense d'abord à l'événement.

Exemples :

- créer une dépense et y rattacher immédiatement une facture
- créer une maintenance et y joindre un manuel ou un devis
- créer une note ou une inspection et téléverser sur le moment le document associé

## Impact sur les parcours

- parcours 01 : le formulaire de création gagne un enrichissement documentaire utile sans perdre sa rapidité
- parcours 02 : le lien document <-> activité devient symétrique et moins dépendant d'un seul point d'entrée

## Références

- [docs/JOURNAL_PRODUIT.md](/Users/benjaminvandamme/Developer/house/docs/JOURNAL_PRODUIT.md)
- [docs/PARCOURS_01_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_01_BACKLOG_TECHNIQUE.md)
- [docs/PARCOURS_02_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_02_BACKLOG_TECHNIQUE.md)