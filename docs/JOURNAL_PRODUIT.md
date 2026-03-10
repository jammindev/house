# Journal produit

Ce document est le point d'entrée vivant pour suivre :

- l'état actuel du produit
- ce qui a été livré récemment
- les décisions prises
- les prochaines priorités
- les idées futures à ne pas perdre

Il sert de mémoire opérationnelle entre plusieurs sessions de travail.

## Comment l'utiliser

Après chaque session produit importante :

1. mettre à jour le statut ci-dessous si nécessaire
2. ajouter une entrée datée dans `docs/journal/`
3. enregistrer les idées non traitées dans `docs/IDEES_FUTURES.md`

## État actuel

Dernière mise à jour : 2026-03-10

### Parcours métier

- Parcours 01 — Capturer un événement du foyer et le retrouver facilement : **socle V1 livré**
- Parcours 02 — Traiter un document entrant et le relier au bon contexte : **V1 manuelle en pré-livraison**
- Parcours 03 — Transformer un besoin en action suivie : **V1 livrée**
- Parcours 04 — Suivre un projet de bout en bout : **V1 livrée**
- Parcours 05 — Naviguer par zone ou équipement pour comprendre et agir : **à venir**

## Ce qui est considéré comme livré sur le parcours 01

- entrée rapide depuis le dashboard via un CTA unique
- sélecteur de type avant création
- formulaire unique avec variantes utiles par type
- possibilité de lier des documents existants directement depuis le formulaire activité
- possibilité d'ajouter un document simple depuis le formulaire activité puis de le lier immédiatement
- vocabulaire produit plus naturel
- tags et zones mieux outillés
- recherche visible dans l'historique
- retour cohérent après création avec mise en évidence de l'élément créé
- traduction frontend et serveur réalignée pour les principaux libellés du parcours

Références :

- [docs/PARCOURS_01_CAPTURER_ET_RETROUVER_UN_EVENEMENT.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_01_CAPTURER_ET_RETROUVER_UN_EVENEMENT.md)
- [docs/PARCOURS_01_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_01_BACKLOG_TECHNIQUE.md)
- [docs/PARCOURS_01_CAPTURE_ASSISTEE_PAR_IA.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_01_CAPTURE_ASSISTEE_PAR_IA.md)

## Décisions produit actives

- `Interaction` reste le concept technique central
- l'interface privilégie `Activité`, `Historique` et `Ajouter un événement`
- le dashboard est le point d'entrée rapide
- la page interactions est la source de vérité du parcours
- la future couche IA devra produire une interaction candidate structurée, pas remplir un formulaire visuellement

## Ce qui est considéré comme livré sur le parcours 03

- page tâches reconstruite en liste mobile-first avec sections par statut (En retard, En cours, À faire, Backlog, Fait)
- chips de filtre rapides par statut
- carte tâche enrichie : zone, date relative, badge retard, indicateurs événement/document source
- création de tâche standalone depuis la page tâches
- création de tâche depuis un événement de l'historique avec lien stocké dans `metadata`
- création de tâche depuis un document avec lien `InteractionDocument`
- édition d'une tâche après création via dialog prérempli
- tâches en retard détectées côté frontend et signalées en tête de liste
- traductions Django et frontend réalignées (fr, en, de, es)
- 2 tests backend couvrant les nouveaux points d'entrée

Références :

- [docs/PARCOURS_03_TRANSFORMER_UN_BESOIN_EN_ACTION_SUIVIE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_03_TRANSFORMER_UN_BESOIN_EN_ACTION_SUIVIE.md)
- [docs/PARCOURS_03_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_03_BACKLOG_TECHNIQUE.md)

## Ce qui est considéré comme livré sur le parcours 04

- boutons de création rapide (tâche, note, dépense, activité) dans chaque onglet du détail projet avec contexte pré-lié
- `AppInteractionNewView` enrichi avec `project_id` : zones pré-remplies, redirection vers le projet avec `?tab=<onglet>`
- `InteractionCreateForm` : bandeau projet en mode contexte, sélecteur projet en mode général
- bloc de synthèse en tête du détail projet : tâches ouvertes, tâches en retard, budget
- `project_title` exposé dans `InteractionSerializer`
- nom du projet visible et cliquable dans `TaskCard` et `InteractionList`
- tab initial lu depuis l'URL (`?tab=`) dans `ProjectDetail`
- 5 tests backend couvrant les nouveaux flux

Références :

- [docs/PARCOURS_04_SUIVRE_UN_PROJET_DE_BOUT_EN_BOUT.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_04_SUIVRE_UN_PROJET_DE_BOUT_EN_BOUT.md)
- [docs/PARCOURS_04_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_04_BACKLOG_TECHNIQUE.md)
- [docs/journal/2026-03-10_parcours-04_v1_livree.md](/Users/benjaminvandamme/Developer/house/docs/journal/2026-03-10_parcours-04_v1_livree.md)

## Prochain focus recommandé

Implémenter le parcours 05 — Naviguer par zone ou équipement pour comprendre et agir.

Priorité : vérification des filtres API manquants, puis lot 0 — sections contextuelles dans le détail zone.

Références de cadrage :

- [docs/PARCOURS_05_NAVIGUER_PAR_ZONE_OU_EQUIPEMENT.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_05_NAVIGUER_PAR_ZONE_OU_EQUIPEMENT.md)
- [docs/PARCOURS_05_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/PARCOURS_05_BACKLOG_TECHNIQUE.md)

## Journal des sessions

- [docs/journal/2026-03-08_parcours-01_v1_et_projection_ia.md](/Users/benjaminvandamme/Developer/house/docs/journal/2026-03-08_parcours-01_v1_et_projection_ia.md)
- [docs/journal/2026-03-09_parcours-02_cadrage_initial.md](/Users/benjaminvandamme/Dev/house/docs/journal/2026-03-09_parcours-02_cadrage_initial.md)
- [docs/journal/2026-03-09_parcours-02_prelivraison_v1_manuelle.md](/Users/benjaminvandamme/Developer/house/docs/journal/2026-03-09_parcours-02_prelivraison_v1_manuelle.md)
- [docs/journal/2026-03-09_formulaire-activite_documents.md](/Users/benjaminvandamme/Developer/house/docs/journal/2026-03-09_formulaire-activite_documents.md)
- [docs/journal/2026-03-09_parcours-03_v1_livree.md](/Users/benjaminvandamme/Developer/house/docs/journal/2026-03-09_parcours-03_v1_livree.md)
- [docs/journal/2026-03-10_parcours-04_cadrage_initial.md](/Users/benjaminvandamme/Developer/house/docs/journal/2026-03-10_parcours-04_cadrage_initial.md)
- [docs/journal/2026-03-10_parcours-04_v1_livree.md](/Users/benjaminvandamme/Developer/house/docs/journal/2026-03-10_parcours-04_v1_livree.md)

## Backlog d'idées futures

- [docs/IDEES_FUTURES.md](/Users/benjaminvandamme/Developer/house/docs/IDEES_FUTURES.md)