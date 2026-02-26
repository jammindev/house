# Feature Specification: Module Électricité Maison

**Feature Branch**: `001-electricity-circuit-module`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Je veux créer une app django electricity qui sera le module electricité de ma maison. Je veux pouvoir gérer l'électricité c'est à dire pour commencer le plan des différents circuits electrique avec quel disjoncteur va avec quelle prise ou lumière et vis versa, le circuit en lui meme les inter diff si c'est triphasé ect. Je veux que tu l'intègre à mon projet."

## Clarifications

### Session 2026-02-26

- Q: Quel rôle peut créer/modifier/supprimer le plan électrique ? → A: Seul owner peut créer/modifier/supprimer; tous les autres rôles sont en lecture seule.
- Q: Quelle cardinalité entre circuit et disjoncteur ? → A: Un circuit est relié à un seul disjoncteur, et un disjoncteur peut couvrir plusieurs circuits.
- Q: Quel mode de suppression pour les associations ? → A: Désactivation des associations avec historique conservé (soft delete).
- Q: Quelle règle d’unicité pour les repères visibles ? → A: Unicité du repère sur l’ensemble du plan du foyer (tous types confondus).
- Q: Comment gérer le triphasé au MVP ? → A: Stocker le type d’alimentation et la phase (L1/L2/L3) pour chaque circuit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cartographier le tableau électrique (Priority: P1)

En tant que propriétaire du foyer, je peux créer le plan des circuits électriques de la maison pour savoir précisément quels éléments sont protégés par chaque disjoncteur.

**Why this priority**: C’est la base du module; sans cartographie du tableau, le reste (recherche, contrôle, maintenance) perd sa valeur.

**Independent Test**: Cette story est testable seule en créant un tableau avec circuits, disjoncteurs et différentiels, puis en vérifiant les associations enregistrées.

**Acceptance Scenarios**:

1. **Given** un foyer sélectionné, **When** le propriétaire crée un circuit et l’associe à un disjoncteur, **Then** l’association est enregistrée et visible dans le plan électrique.
2. **Given** un circuit existant, **When** le propriétaire associe des points d’usage (prises et lumières) à ce circuit, **Then** chaque point d’usage affiche son circuit de rattachement.
3. **Given** une installation triphasée, **When** le propriétaire renseigne la nature de l’alimentation, la phase de chaque circuit et les protections associées, **Then** ces informations sont visibles dans le plan du foyer.

---

### User Story 2 - Naviguer dans les correspondances (Priority: P2)

En tant que membre du foyer, je peux retrouver rapidement la correspondance dans les deux sens (disjoncteur vers prises/lumières et prise/lumière vers disjoncteur) pour agir vite en cas de besoin.

**Why this priority**: La consultation rapide est le principal bénéfice opérationnel au quotidien et en situation de dépannage.

**Independent Test**: Cette story est testable seule en effectuant des recherches dans les deux sens et en validant les résultats affichés.

**Acceptance Scenarios**:

1. **Given** un plan électrique déjà renseigné, **When** un membre sélectionne un disjoncteur, **Then** la liste des circuits et des points d’usage associés est affichée.
2. **Given** un plan électrique déjà renseigné, **When** un membre sélectionne une prise ou une lumière, **Then** le circuit et le disjoncteur de protection sont affichés.

---

### User Story 3 - Maintenir le plan à jour (Priority: P3)

En tant que propriétaire du foyer, je peux modifier ou retirer des associations lorsque l’installation évolue afin de conserver un plan fiable dans le temps.

**Why this priority**: Un plan non maintenu devient rapidement inexact; la mise à jour continue garantit la confiance dans les données.

**Independent Test**: Cette story est testable seule en modifiant une association existante puis en vérifiant la prise en compte immédiate du changement.

**Acceptance Scenarios**:

1. **Given** une association existante entre circuit et point d’usage, **When** le propriétaire change le rattachement, **Then** l’ancienne association est remplacée et la nouvelle est visible immédiatement.
2. **Given** un disjoncteur sans éléments rattachés, **When** le propriétaire le supprime, **Then** il est retiré du plan sans affecter les autres circuits.

### Edge Cases

- Un même point d’usage est lié à deux circuits actifs; le système refuse la sauvegarde et indique le conflit.
- Un membre tente de supprimer un disjoncteur encore utilisé par un circuit; le système bloque la suppression tant qu’une relation active existe.
- Le foyer n’a pas encore renseigné de tableau électrique; le système affiche un état vide guidant la création initiale.
- Un utilisateur hors foyer tente d’accéder au plan électrique; l’accès est refusé.
- Le type d’alimentation n’est pas renseigné; le système applique une valeur par défaut et permet de la corriger.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT permettre au propriétaire du foyer de créer, consulter, modifier et supprimer des circuits électriques.
- **FR-002**: Le système DOIT permettre au propriétaire du foyer de créer, consulter, modifier et supprimer des disjoncteurs de protection.
- **FR-003**: Le système DOIT permettre au propriétaire du foyer de créer, consulter, modifier et supprimer des interrupteurs différentiels.
- **FR-004**: Le système DOIT permettre d’associer chaque circuit à un seul disjoncteur et, le cas échéant, à un interrupteur différentiel.
- **FR-005**: Le système DOIT permettre de rattacher des points d’usage (prises, points lumineux) à un circuit.
- **FR-006**: Le système DOIT fournir une consultation bidirectionnelle entre protections, circuits et points d’usage.
- **FR-007**: Le système DOIT garantir qu’un point d’usage n’a qu’un seul circuit actif à la fois.
- **FR-008**: Le système DOIT gérer le type d’alimentation du foyer (monophasé ou triphasé), le rendre visible dans le plan et permettre d’indiquer la phase (L1/L2/L3) pour chaque circuit en triphasé.
- **FR-009**: Le système DOIT empêcher la suppression d’un élément encore lié à des associations actives, sauf si les dépendances sont traitées via désactivation des liens.
- **FR-010**: Le système DOIT limiter l’accès en lecture au module électricité aux membres du foyer concerné, et réserver les actions de création/modification/suppression au propriétaire du foyer.
- **FR-011**: Le système DOIT conserver un historique minimal des changements (création, modification, suppression) avec auteur et date.
- **FR-012**: Le système DOIT permettre la recherche d’un élément par son identifiant visible (nom, repère, étiquette) dans le plan électrique.
- **FR-013**: Le système DOIT autoriser un disjoncteur à couvrir plusieurs circuits dans un même foyer.
- **FR-014**: Le système DOIT désactiver les associations (soft delete) au lieu de les supprimer physiquement, et permettre d’indiquer leur statut actif/inactif.
- **FR-015**: Le système DOIT garantir l’unicité des repères visibles au sein d’un foyer sur l’ensemble des types d’éléments du plan électrique.

### Key Entities *(include if feature involves data)*

- **Tableau Électrique**: Représentation de l’installation d’un foyer, incluant son type d’alimentation.
- **Circuit Électrique**: Ligne logique de distribution regroupant des points d’usage et reliée à une protection, avec repère visible unique dans le foyer et phase associée en triphasé (L1/L2/L3).
- **Disjoncteur**: Élément de protection pouvant couvrir plusieurs circuits, tandis qu’un circuit n’est rattaché qu’à un seul disjoncteur, avec repère visible unique dans le foyer.
- **Interrupteur Différentiel**: Élément de protection amont pouvant couvrir plusieurs disjoncteurs/circuits, avec repère visible unique dans le foyer.
- **Point d’Usage**: Équipement terminal (prise, lumière) rattaché à un seul circuit actif, avec repère visible unique dans le foyer.
- **Association de Plan**: Lien explicite entre protections, circuits et points d’usage, avec statut actif/inactif et date de désactivation éventuelle.

## Assumptions

- Le module est d’abord orienté cartographie et consultation, sans calcul électrique avancé.
- Les membres autorisés du foyer partagent une vue commune du plan électrique.
- Un foyer possède un plan électrique principal; les extensions futures (annexes, sous-tableaux) restent hors périmètre initial.
- Le triphasé est traité comme une caractéristique de l’installation et des circuits (affectation L1/L2/L3), sans simulation de charge.

## Dependencies

- Le module dépend de l’existence d’un foyer actif et du modèle de permissions multi-tenant du projet.
- Le module dépend d’une sélection de foyer cohérente avant toute action de lecture/écriture.
- Les fonctionnalités de contacts, documents ou maintenance peuvent être reliées plus tard mais ne sont pas requises pour ce premier périmètre.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% des membres testeurs peuvent créer un plan initial (au moins 3 circuits et leurs protections) en moins de 15 minutes.
- **SC-002**: 95% des recherches bidirectionnelles (protection vers point d’usage, et inversement) aboutissent au bon résultat en moins de 10 secondes.
- **SC-003**: 100% des tentatives d’accès hors foyer au module électricité sont bloquées.
- **SC-004**: 90% des modifications du plan (ajout, déplacement, suppression d’association) sont validées sans erreur de cohérence lors des tests fonctionnels.
