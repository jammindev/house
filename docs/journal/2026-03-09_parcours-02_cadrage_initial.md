# 2026-03-09 — Parcours 02 cadrage initial

## Contexte

Session de cadrage du deuxième parcours métier prioritaire : traiter un document entrant et le relier au bon contexte.

Objectif réel de la session : transformer la priorité produit du parcours 02 en base documentaire exploitable avant implémentation.

## Ce qui a été confirmé

- le parcours 02 doit être piloté comme un flux métier, pas comme une simple page documents
- la page documents doit devenir une surface de traitement et de rattachement, pas seulement une bibliothèque
- l'ajout ou l'upload minimal du document doit faire partie du scope car ce flux n'a pas encore été migré
- la première promesse forte du parcours 02 doit être le lien document <-> activité
- les autres contextes métier doivent rester possibles sans surcharger la V1
- l'ingestion email et l'IA doivent rester compatibles avec le socle, sans être traitées maintenant

## État du runtime confirmé pendant la session

- la page active existe à `/app/documents/`
- le runtime courant expose une liste, un filtre `non reliés`, une édition légère et une suppression
- l'entrée web d'ajout de document n'est pas encore cadrée comme flux produit migré
- il n'existe pas encore de page détail document dans le code actif
- l'API documents expose un CRUD, un regroupement par type et un endpoint placeholder de relance OCR
- plusieurs formes de liens document existent déjà côté modèles : activité, zone, projet
- le parcours produit reste incomplet malgré ce socle technique

## Documents produits ou mis à jour

- [docs/PARCOURS_02_TRAITER_UN_DOCUMENT_ENTRANT_ET_LE_RELIER_AU_BON_CONTEXTE.md](/Users/benjaminvandamme/Dev/house/docs/PARCOURS_02_TRAITER_UN_DOCUMENT_ENTRANT_ET_LE_RELIER_AU_BON_CONTEXTE.md)
- [docs/PARCOURS_02_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Dev/house/docs/PARCOURS_02_BACKLOG_TECHNIQUE.md)
- note de compréhension IA pour le parcours 02 (depuis consolidée dans [docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md), section "Évolutions ultérieures")

## Recommandation pour la suite

La prochaine étape utile est d'attaquer l'implémentation en partant de :

1. la page documents comme point d'entrée à reframer
2. une vraie page détail document
3. le rattachement à une activité existante
4. la création d'une activité depuis un document

## Points de vigilance conservés

- ne pas lancer une GED complète
- ne pas traiter l'email entrant avant d'avoir un flux document de base solide
- ne pas refactorer massivement la stratégie de lien document avant validation produit
- ne pas faire dépendre la compréhension du document d'une IA ou d'un OCR parfait
