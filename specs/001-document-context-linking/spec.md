# Feature Specification: Traiter un document entrant et le relier au bon contexte

**Feature Branch**: `001-document-context-linking`  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: User description: "Traiter un document entrant et le relier au bon contexte"

## Clarifications

### Session 2026-03-09

- Q: Comment calculer l'état produit `sans contexte` dans la V1 ? → A: Un document reste `sans contexte` tant qu'il n'a aucune activité liée, même s'il possède déjà un lien zone ou projet.
- Q: Quel contrat minimal d'ajout doit être exigé dans la V1 ? → A: Le flux d'ajout exige un fichier, préremplit un nom modifiable et laisse le type facultatif.
- Q: Quel mode de sélection d'activité doit être proposé pour le rattachement V1 ? → A: Le rattachement propose une liste d'activités récentes complétée par une recherche simple par libellé.
- Q: Comment gérer un rattachement document-activité déjà existant ? → A: Le système refuse les doublons exacts document-activité et conserve un seul lien par couple document-activité.
- Q: Où renvoyer l'utilisateur juste après l'ajout d'un document ? → A: Après ajout, l'utilisateur est redirigé directement vers le détail du document créé.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ajouter et repérer un document à traiter (Priority: P1)

En tant que membre du foyer, je veux ajouter simplement un document puis le retrouver parmi les documents à traiter afin qu'il entre dans le système même s'il n'a pas encore de contexte métier.

**Why this priority**: Sans entrée fiable du document et sans visibilité sur les éléments sans contexte, le parcours n'existe pas et aucune qualification n'est possible.

**Independent Test**: Peut être testé indépendamment en ajoutant un document avec des informations minimales puis en vérifiant qu'il apparaît immédiatement dans la liste avec un état compréhensible de document à traiter.

**Acceptance Scenarios**:

1. **Given** un membre du foyer sur la surface documents, **When** il ajoute un document avec un fichier, un nom prérempli modifiable et sans obligation de type, **Then** le document est enregistré sans exiger de rattachement immédiat et l'utilisateur est redirigé vers son détail.
2. **Given** un document nouvellement ajouté sans lien métier, **When** le détail du document s'ouvre après création, **Then** l'utilisateur voit immédiatement qu'il est sans contexte et quelles actions de qualification sont possibles.
3. **Given** plusieurs documents dont certains sont déjà qualifiés, **When** l'utilisateur revient ensuite à la liste des documents, **Then** le document créé apparaît dans les documents récents et est identifiable comme sans contexte.
4. **Given** plusieurs documents dont certains sont déjà qualifiés, **When** l'utilisateur active le filtre des documents à traiter, **Then** seuls les documents sans activité liée sont mis en avant, même s'ils possèdent déjà un contexte secondaire visible.

---

### User Story 2 - Comprendre l'état d'un document (Priority: P2)

En tant qu'utilisateur, je veux ouvrir un document dans une page dédiée pour comprendre rapidement ce qu'il représente déjà, ce qui lui manque et quelles actions sont possibles.

**Why this priority**: Une liste seule ne suffit pas pour décider du bon rattachement. La compréhension du document est la base du traitement manuel et du futur accompagnement assisté.

**Independent Test**: Peut être testé indépendamment en ouvrant un document depuis la liste et en vérifiant que ses informations principales, son état de contexte et ses actions disponibles sont lisibles sans navigation supplémentaire.

**Acceptance Scenarios**:

1. **Given** un document existant dans la liste, **When** l'utilisateur l'ouvre, **Then** il accède à une page dédiée affichant l'identité du document, ses notes, son contenu textuel disponible et son état de rattachement actuel.
2. **Given** un document sans lien métier, **When** sa page est affichée, **Then** l'interface indique clairement qu'il est encore sans contexte et propose des actions pour le qualifier.
3. **Given** un document déjà relié à une ou plusieurs activités, **When** sa page est affichée, **Then** les activités liées sont visibles de manière compréhensible dans un bloc de contexte actuel.

---

### User Story 3 - Relier un document à une activité existante (Priority: P3)

En tant qu'utilisateur, je veux rattacher un document à une activité déjà présente afin d'éviter les doublons et de retrouver la pièce depuis l'historique du foyer.

**Why this priority**: C'est l'action de qualification la plus directe et la plus structurante pour transformer un document isolé en élément utile.

**Independent Test**: Peut être testé indépendamment en partant d'un document sans contexte, en choisissant une activité existante, puis en vérifiant que le lien devient visible immédiatement depuis le détail du document.

**Acceptance Scenarios**:

1. **Given** un document sans contexte et au moins une activité existante, **When** l'utilisateur choisit de le relier à une activité depuis une liste d'activités récentes ou via une recherche simple par libellé, **Then** le lien est créé et confirmé visuellement.
2. **Given** un document déjà relié à une activité, **When** l'utilisateur le relie à une autre activité autorisée, **Then** le document peut afficher plusieurs activités liées sans masquer les liens existants.
3. **Given** un document déjà relié à l'activité sélectionnée, **When** l'utilisateur tente de créer à nouveau ce même rattachement, **Then** aucun doublon exact n'est créé et l'état du document reste inchangé.
4. **Given** un rattachement réussi, **When** l'utilisateur revient au détail du document, **Then** son nouveau contexte est visible immédiatement.

---

### User Story 4 - Créer une activité depuis un document (Priority: P4)

En tant qu'utilisateur, je veux créer une nouvelle activité à partir d'un document afin de transformer immédiatement une pièce utile en élément exploitable sans ressaisie inutile.

**Why this priority**: Ce scénario complète le parcours lorsque le bon sujet n'existe pas encore. Il est moins prioritaire que le rattachement direct car il dépend d'un flux métier plus long.

**Independent Test**: Peut être testé indépendamment en ouvrant un document sans contexte, en déclenchant la création d'activité, puis en vérifiant que l'activité créée reste reliée au document et que le retour vers le document est clair.

**Acceptance Scenarios**:

1. **Given** un document sans activité correspondante, **When** l'utilisateur choisit de créer une activité depuis ce document, **Then** le flux de création réutilise les informations utiles déjà connues pour limiter la ressaisie.
2. **Given** une activité créée depuis un document, **When** la création est terminée, **Then** le document est relié à cette nouvelle activité et l'utilisateur peut revenir à son détail avec un feedback clair.

### Edge Cases

- Que se passe-t-il si l'utilisateur ajoute un document en conservant seulement le nom prérempli sans renseigner de type ? Le document doit quand même pouvoir entrer dans le système avec un état sans contexte.
- Que se passe-t-il si un document n'a aucun contenu textuel exploitable ou si son contenu est incomplet ? Le document doit rester compréhensible grâce à son identité, ses notes et son état de rattachement.
- Que se passe-t-il si un utilisateur tente de relier un document à une activité qui n'est pas accessible dans son foyer ? Le rattachement doit être refusé sans créer de lien partiel.
- Que se passe-t-il si le document est déjà relié au contexte sélectionné ? Le système doit refuser le doublon exact document-activité, conserver un seul lien pour ce couple et garder un état cohérent.
- Que se passe-t-il si un document possède déjà d'autres contextes connus en lecture ? La page doit les afficher sans détourner l'action principale de qualification par activité, et le document reste à traiter tant qu'aucune activité n'est liée.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST permettre à un membre du foyer d'ajouter un document depuis la surface documents avec un fichier obligatoire, un nom prérempli modifiable et un type facultatif.
- **FR-002**: Le système MUST autoriser l'enregistrement d'un document sans contexte métier immédiat.
- **FR-003**: Le système MUST rediriger l'utilisateur vers le détail du document immédiatement après sa création réussie.
- **FR-021**: Le système MUST rendre le document nouvellement ajouté visible dans la liste active lorsque l'utilisateur revient à la liste après la création.
- **FR-004**: Le système MUST distinguer clairement les documents sans activité liée des documents déjà qualifiés par activité afin d'orienter le traitement.
- **FR-005**: Les utilisateurs MUST pouvoir ouvrir chaque document depuis la liste dans une vue de détail dédiée.
- **FR-006**: La vue de détail MUST afficher au minimum l'identité du document, ses informations descriptives utiles, son contenu textuel disponible et son état de contexte actuel.
- **FR-007**: Le système MUST afficher explicitement lorsqu'un document est sans contexte d'activité, même si d'autres liens secondaires existent déjà.
- **FR-008**: Le système MUST permettre de relier un document à zéro, une ou plusieurs activités existantes selon les droits de l'utilisateur.
- **FR-009**: Le système MUST traiter le lien document-activité comme le contrat produit de référence pour ce parcours, indépendamment d'éventuels héritages de compatibilité internes.
- **FR-010**: Le système MUST confirmer visuellement tout rattachement réussi depuis le détail document.
- **FR-019**: Le système MUST proposer, pour le rattachement V1, une sélection d'activité combinant une liste d'activités récentes et une recherche simple par libellé, sans exiger de recherche multi-critères avancée.
- **FR-020**: Le système MUST refuser la création de doublons exacts pour un même couple document-activité et préserver un seul rattachement actif par couple.
- **FR-011**: Le système MUST permettre de démarrer la création d'une nouvelle activité à partir d'un document et de conserver le document comme pièce reliée à l'issue du flux.
- **FR-012**: Le système MUST réduire la ressaisie lors de la création d'une activité depuis un document en réutilisant les informations déjà connues du document lorsque cela est pertinent.
- **FR-013**: Le système MUST offrir une continuité de navigation permettant de revenir de manière claire au détail document après un rattachement ou une création.
- **FR-014**: La fonctionnalité MUST définir la frontière de responsabilité entre le contenu disponible dès l'ouverture de la page et les interactions complémentaires déclenchées par l'utilisateur.
- **FR-015**: La fonctionnalité MUST définir le contrat de données initial pour la liste documents et le détail document afin d'éviter un premier affichage vide ou ambigu.
- **FR-016**: Le système MUST afficher les autres contextes déjà connus d'un document lorsqu'ils sont disponibles en lecture, sans les rendre bloquants pour la V1.
- **FR-018**: Pour la V1, le calcul produit de l'état `sans contexte` et du filtre associé MUST reposer sur l'absence de lien d'activité, et non sur la seule absence de tout autre type de rattachement.
- **FR-017**: Le système MUST rester compatible, dans la V1, avec l'ajout manuel simple et ne pas empêcher l'intégration future d'autres canaux d'entrée.

### Non-Functional Requirements

- **NFR-001**: La fonctionnalité MUST isoler les nouveaux écrans de création et de détail du parcours documents afin de limiter à 15 % maximum la régression du bundle de l'entrée liste existante en V1.

### Key Entities *(include if feature involves data)*

- **Document entrant**: Pièce source ajoutée au système, avec une identité lisible, des informations descriptives, un éventuel contenu textuel extrait et un état de qualification.
- **Contexte d'activité**: Activité métier du foyer à laquelle un document peut être relié pour devenir retrouvable et exploitable dans l'historique.
- **Rattachement document-activité**: Relation métier qui permet de relier un document à une ou plusieurs activités et d'exprimer l'état de contexte du document.
- **État de qualification du document**: Vue synthétique indiquant si le document est sans contexte, déjà relié à des activités, ou enrichi par d'autres contextes visibles.

### Assumptions & Dependencies

- La cible principale est un membre authentifié d'un foyer ayant accès aux documents et aux activités de ce foyer.
- Le parcours V1 priorise la qualification par activité ; les autres contextes restent secondaires et principalement visibles en lecture.
- Un document peut donc apparaître comme `sans contexte` dans le parcours V1 même s'il possède déjà un lien zone ou projet, tant qu'aucune activité ne lui est liée.
- La surface de rattachement V1 privilégie une sélection rapide : activités récentes d'abord, puis recherche simple par libellé si nécessaire.
- Après un ajout réussi, la continuité primaire du parcours passe par l'ouverture immédiate du détail document plutôt que par un retour direct à la liste.
- Le retour utilisateur minimal attendu après une action de rattachement ou de création est un retour clair vers le détail document.
- Le document source reste la référence principale, même si son contenu textuel est absent, partiel ou imparfait.
- Le parcours doit rester cohérent avec une future assistance à la qualification, sans automatiser la décision finale de rattachement.
- Le contrat minimal d'ajout V1 privilégie la vitesse d'entrée : fichier requis, nom modifiable, type non bloquant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90 % des utilisateurs cibles peuvent ajouter un document avec un fichier obligatoire, un nom prérempli modifiable et un type facultatif, puis le retrouver dans la liste en moins de 2 minutes lors d'un test de parcours guidé.
- **SC-006**: 90 % des utilisateurs cibles accèdent au détail du document créé en moins de 5 secondes après un ajout réussi, sans étape de navigation supplémentaire.
- **SC-002**: 95 % des documents sans contexte sont identifiables en moins de 10 secondes depuis la liste documents, avec ou sans filtre dédié.
- **SC-003**: 90 % des utilisateurs testeurs peuvent déterminer l'état actuel d'un document depuis sa page de détail en moins de 30 secondes.
- **SC-004**: 85 % des rattachements à une activité existante sont réalisés sans erreur ni retour arrière inutile lors d'un test de parcours manuel.
- **SC-005**: Après création d'une activité depuis un document, 100 % des cas réussis affichent le nouveau lien au retour sur le détail document.
