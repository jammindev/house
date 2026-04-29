# 2026-03-08 — Parcours 01 V1 et projection IA

## Contexte

Session de consolidation du premier parcours métier : capturer un événement du foyer et le retrouver facilement.

Objectif réel de la session : transformer le parcours 01 en socle produit crédible, puis cadrer la compatibilité avec une future couche de capture assistée par IA.

## Ce qui a été confirmé

- le produit doit être piloté par parcours métier, pas page par page
- le dashboard sert de point d'entrée rapide
- la page interactions reste la source de vérité du parcours
- le vocabulaire visible doit éviter d'exposer trop frontalement le mot `interaction`

## Ce qui a été livré sur le parcours 01

- CTA unique `Ajouter` sur le dashboard
- sélecteur de type avant création
- formulaire unique avec variantes selon le type
- stockage minimal des données spécifiques via `metadata`
- retour vers l'historique avec mise en évidence de l'élément créé
- recherche visible dans la liste
- extraction du sélecteur de zones dans un composant partagé
- création d'un sélecteur de tags partagé
- harmonisation des traductions frontend EN/FR/DE/ES
- ajout des traductions serveur manquantes FR/DE/ES
- simplification visuelle finale du formulaire
- champ date par défaut sans heure, avec ajout de l'heure à la demande

## Décisions importantes prises pendant la session

- le formulaire n'est pas la finalité du parcours, seulement le premier canal de capture
- la promesse long terme n'est pas "remplir un formulaire vite" mais "capturer un événement avec le moins d'effort possible"
- une future couche IA devra appeler le même noyau métier de création d'interaction
- il faut préserver la possibilité d'un futur mode `draft`, `needs_review` ou équivalent

## Points d'attention remontés pour plus tard

- la zone obligatoire est un bon garde-fou pour la saisie manuelle, mais peut bloquer une saisie conversationnelle
- une interaction créée par IA devra conserver sa provenance
- la confiance de l'IA devra probablement piloter trois modes : création directe, confirmation, brouillon

## Documents produits ou mis à jour

- [docs/PARCOURS_METIER_PRIORITAIRES.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_METIER_PRIORITAIRES.md)
- [docs/PARCOURS_01_CAPTURER_ET_RETROUVER_UN_EVENEMENT.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_01_CAPTURER_ET_RETROUVER_UN_EVENEMENT.md)
- [docs/PARCOURS_01_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_01_BACKLOG_TECHNIQUE.md)
- note de projection IA pour le parcours 01 (depuis consolidée dans [docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md), section "Évolutions ultérieures")

## Recommandation pour la suite

Le prochain sujet à attaquer devrait être le parcours 02.

Avant de coder, repartir de :

1. l'état courant du produit dans [docs/JOURNAL_PRODUIT.md](/Users/benjaminvandamme/Developer/house/docs/JOURNAL_PRODUIT.md)
2. les idées non traitées sur GitHub (label `idea`)
3. les décisions déjà figées dans les docs du parcours 01