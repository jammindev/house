# Feature Specification: Migration Zones 1:1 Legacy vers Django

**Feature Branch**: `001-migrate-zones-parity`  
**Created**: 2026-03-04  
**Status**: Draft  
**Input**: User description: "Migration 1:1 des pages Zones Next.js vers Django avec split React legacy conservé, adaptation de contrat de données localisée, parité en deux paliers (liste/arbre puis détail/photos)."

## Clarifications

### Session 2026-03-04

- Q: Quel comportement de suppression appliquer pour une zone parent avec enfants ? → A: Bloquer la suppression tant qu'il existe des enfants, avec message explicite.
- Q: Quelle stratégie appliquer en cas d'édition concurrente de la même zone ? → A: Rejeter une mise à jour obsolète avec erreur de conflit et demande de rechargement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gérer l'arbre des zones avec parité stricte (Priority: P1)

En tant que membre du household, je veux retrouver la page liste/arbre des zones avec le même comportement visuel et fonctionnel que la version legacy afin de continuer à créer, éditer, supprimer et organiser les zones sans changement d'usage.

**Why this priority**: C'est le flux principal de gestion des zones, utilisé quotidiennement, et la base de la migration progressive.

**Independent Test**: Peut être validé indépendamment en utilisant uniquement la page liste/arbre et en exécutant un cycle CRUD complet avec réorganisation parent/enfant.

**Acceptance Scenarios**:

1. **Given** un utilisateur avec au moins un household et des zones existantes, **When** il ouvre la page liste des zones, **Then** il voit l'arbre hydraté avec les mêmes regroupements, ordres et états visuels attendus.
2. **Given** la page liste des zones chargée, **When** l'utilisateur crée, modifie, déplace (parentage) puis supprime une zone, **Then** chaque action est reflétée immédiatement dans l'arbre sans incohérence de structure.
3. **Given** des zones avec règles de couleur héritées, **When** l'utilisateur consulte ou met à jour les zones, **Then** les couleurs affichées et héritées restent cohérentes avec le comportement legacy.
4. **Given** une zone parent avec au moins un enfant, **When** l'utilisateur tente de supprimer le parent, **Then** la suppression est refusée et un message explicite indique qu'il faut d'abord traiter les enfants.

---

### User Story 2 - Consulter et enrichir le détail d'une zone (Priority: P2)

En tant que membre du household, je veux une page détail de zone fidèle à la référence legacy pour consulter les informations de zone, les statistiques et la galerie photo, puis gérer les photos associées.

**Why this priority**: Le détail zone complète la valeur métier de la page liste et permet le suivi visuel/documentaire.

**Independent Test**: Peut être validé indépendamment via navigation directe vers une page détail zone et opérations photo sans passer par les écrans internes de migration.

**Acceptance Scenarios**:

1. **Given** une zone existante, **When** l'utilisateur ouvre la page détail de cette zone, **Then** il voit les informations principales, les statistiques attendues et la galerie photo.
2. **Given** la page détail affichée, **When** l'utilisateur attache une nouvelle photo, **Then** la photo apparaît dans la galerie de la zone concernée.
3. **Given** une zone sans photo, **When** l'utilisateur consulte la page détail, **Then** un état vide lisible est présenté sans erreur bloquante.

---

### User Story 3 - Préserver la continuité UX pendant la migration (Priority: P3)

En tant qu'équipe produit, nous voulons remplacer l'entrée simplifiée actuelle par une entrée fidèle au découpage legacy tout en conservant le pattern mini-SPA Django, afin de limiter le risque de régression et de faciliter la maintenance.

**Why this priority**: Assure une migration sûre, incrémentale et vérifiable sans refonte backend globale.

**Independent Test**: Peut être validé en comparant les interactions critiques legacy vs nouvelle implémentation (liste/arbre, détail, photos) et en vérifiant les parcours de navigation web.

**Acceptance Scenarios**:

1. **Given** la page zones migrée, **When** l'utilisateur navigue entre liste et détail, **Then** les points d'entrée, le chargement initial serveur et l'hydratation client restent stables et lisibles.
2. **Given** les tests ciblés zones exécutés, **When** les validations sont terminées, **Then** aucun écart critique de comportement UX n'est observé sur les parcours principaux.

### Edge Cases

- Ouverture de la page liste avec zéro zone existante.
- Création d'une zone avec parent invalide ou non accessible dans le household courant.
- Suppression d'une zone parent contenant des enfants: suppression refusée avec message explicite.
- Conflit de modification simultanée entre deux utilisateurs sur la même zone: mise à jour obsolète rejetée avec erreur de conflit et invitation à recharger.
- Échec de chargement ou d'attachement photo sans interrompre l'usage principal de la page détail.
- Données partielles (note, surface, couleur absentes) nécessitant une normalisation d'affichage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST livrer une expérience Zones alignée 1:1 avec la référence legacy pour les parcours liste/arbre et détail, sans dégrader les comportements utilisateurs existants.
- **FR-002**: Le système MUST conserver un découpage front de responsabilités équivalent à la référence legacy afin de limiter les écarts de signatures d'entrée/sortie entre composants et hooks.
- **FR-003**: Le système MUST accepter un état initial injecté côté serveur pour la page liste des zones et l'utiliser pour l'affichage initial avant les interactions utilisateur.
- **FR-004**: Le système MUST permettre les opérations de création, lecture, mise à jour et suppression de zone depuis l'interface liste/arbre.
- **FR-005**: Le système MUST permettre la gestion de la hiérarchie parent/enfant des zones avec mise à jour cohérente de l'arbre affiché.
- **FR-006**: Le système MUST normaliser les données de zone nécessaires à l'UI (y compris parentage, note, surface, couleur) afin de préserver les règles d'affichage legacy.
- **FR-007**: Le système MUST fournir une page détail dédiée pour une zone, accessible par URL, avec affichage des informations, statistiques et galerie photo.
- **FR-008**: Le système MUST permettre l'association de photos à une zone depuis la page détail et refléter l'état mis à jour dans la galerie.
- **FR-009**: Le système MUST maintenir le pattern mini-SPA web existant (rendu serveur léger + hydratation client) avec un fallback lisible en cas d'absence de JavaScript.
- **FR-010**: Le système MUST garantir que toutes les opérations zones sont exécutées dans le contexte household actif de l'utilisateur.
- **FR-011**: Le système MUST limiter les ajustements backend aux seuls écarts de contrat indispensables à la parité front, sans refonte large.
- **FR-012**: Le système MUST inclure une vérification de non-régression UX couvrant arbre, CRUD, parentage, couleurs, détail et photos avant clôture de la migration.
- **FR-013**: Le système MUST refuser la suppression d'une zone ayant des enfants et afficher un retour utilisateur explicite sur la raison du refus.
- **FR-014**: Le système MUST rejeter une mise à jour de zone obsolète en cas d'édition concurrente et retourner un feedback explicite demandant le rechargement avant nouvelle tentative.

### Key Entities *(include if feature involves data)*

- **Zone**: Entité spatiale gérée par un household, avec nom, parent éventuel et métadonnées d'affichage utilisées par l'UI.
- **Zone Tree Node**: Représentation hiérarchique d'une zone dans la vue arbre, incluant ses relations parent/enfant et son état visuel.
- **Zone Detail View Data**: Données nécessaires pour la page détail d'une zone (informations clés, indicateurs, éléments de galerie).
- **Zone Photo**: Média attaché à une zone, visible dans la galerie de détail.
- **Zones Page Initial Payload**: Données serveur injectées à l'ouverture de page pour garantir une hydratation initiale fidèle.

### Assumptions

- Les capacités backend zones existantes couvrent déjà les opérations principales, avec seulement des ajustements de contrat mineurs attendus.
- Le household actif est déjà résolu côté session/navigation standard de l'application.
- La référence legacy est considérée comme baseline UX prioritaire en cas d'écart d'interprétation.

### Dependencies

- Disponibilité des endpoints zones existants et de leurs actions de hiérarchie et photos.
- Disponibilité des templates web Django pour les routes liste et détail.
- Données de test représentatives pour vérifier la parité (arbre multi-niveaux, zones colorées, zones avec et sans photos).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% des scénarios d'acceptation P1 (liste/arbre + CRUD + parentage) sont validés en test fonctionnel.
- **SC-002**: 100% des scénarios d'acceptation P2 (détail + stats + galerie + ajout photo) sont validés en test fonctionnel.
- **SC-003**: Au moins 95% des interactions UI critiques identifiées dans la référence legacy sont reproduites sans écart bloquant.
- **SC-004**: 0 régression critique observée sur les parcours zones couverts par les tests ciblés exécutés avant livraison.
- **SC-005**: Les utilisateurs testeurs internes complètent un cycle complet "créer -> organiser -> consulter détail -> ajouter photo" sans assistance dans au moins 90% des tentatives.
