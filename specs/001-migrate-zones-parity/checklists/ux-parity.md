# UX Parity Checklist: Migration Zones 1:1 Legacy vers Django

**Purpose**: Valider la qualité des exigences de parité UX (liste/arbre + détail/photo) avant implémentation  
**Created**: 2026-03-04  
**Feature**: [spec.md](../spec.md)

**Note**: Cette checklist évalue la qualité de rédaction des exigences (complétude, clarté, cohérence, mesurabilité), pas le comportement du code en exécution.

## Requirement Completeness

- [ ] CHK001 Les exigences définissent-elles explicitement ce que couvre la parité 1:1 et ce qui est hors périmètre ? [Completeness, Spec §FR-001, §FR-011]
- [ ] CHK002 Les exigences couvrent-elles séparément les deux paliers annoncés (liste/arbre puis détail/photo) ? [Completeness, Spec §Input, §User Story 1, §User Story 2]
- [ ] CHK003 Les exigences précisent-elles toutes les opérations attendues sur la page liste/arbre (création, édition, suppression, parentage) ? [Completeness, Spec §FR-004, §FR-005]
- [ ] CHK004 Les exigences décrivent-elles complètement les besoins de la page détail (informations, stats, galerie, ajout photo) ? [Completeness, Spec §FR-007, §FR-008]
- [ ] CHK005 Les exigences décrivent-elles explicitement le contrat de données initiales SSR pour la liste et le détail ? [Completeness, Spec §FR-003, §FR-009, §Gap]
- [ ] CHK006 Les exigences définissent-elles le comportement attendu en absence de JavaScript (fallback lisible) ? [Completeness, Spec §FR-009]

## Requirement Clarity

- [ ] CHK007 Le terme « parité 1:1 » est-il traduit en critères observables et non interprétables ? [Clarity, Spec §FR-001, §SC-003]
- [ ] CHK008 Le terme « découpage front équivalent » est-il suffisamment précis pour éviter plusieurs interprétations de structure ? [Clarity, Spec §FR-002]
- [ ] CHK009 La notion de « normalisation des données » précise-t-elle quels champs sont obligatoires, optionnels et leur valeur de repli ? [Clarity, Spec §FR-006]
- [ ] CHK010 Le message explicite de refus de suppression parent avec enfants est-il défini avec intention métier claire (pas seulement mentionné) ? [Clarity, Spec §FR-013]
- [ ] CHK011 Le feedback de conflit d’édition obsolète précise-t-il l’action utilisateur attendue après l’erreur ? [Clarity, Spec §FR-014]
- [ ] CHK012 Les exigences distinguent-elles clairement « parité visuelle » et « parité comportementale » pour éviter des arbitrages implicites ? [Ambiguity, Spec §User Story 1, §User Story 3]

## Requirement Consistency

- [ ] CHK013 Les user stories, exigences fonctionnelles et critères de succès expriment-ils une même priorité (liste/arbre avant détail/photo) sans contradiction ? [Consistency, Spec §User Story 1-3, §FR-001, §SC-001, §SC-002]
- [ ] CHK014 Les exigences de suppression parent/enfants sont-elles cohérentes entre clarifications, edge cases et FR ? [Consistency, Spec §Clarifications, §Edge Cases, §FR-013]
- [ ] CHK015 Les exigences de gestion de conflit concurrent sont-elles alignées entre clarifications, edge cases et FR ? [Consistency, Spec §Clarifications, §Edge Cases, §FR-014]
- [ ] CHK016 Les exigences de household actif sont-elles cohérentes avec toutes les opérations (liste, détail, photos, mutations) ? [Consistency, Spec §FR-010]
- [ ] CHK017 Les hypothèses et dépendances ne contredisent-elles pas les exigences de non-refonte backend large ? [Consistency, Spec §Assumptions, §Dependencies, §FR-011]
- [ ] CHK018 Les exigences de mini-SPA hybride sont-elles cohérentes avec l’objectif de parité stricte legacy ? [Consistency, Spec §FR-002, §FR-009, §User Story 3]

## Acceptance Criteria Quality

- [ ] CHK019 Chaque scénario d’acceptation décrit-il un résultat vérifiable sans recourir à des notions subjectives ? [Acceptance Criteria, Spec §User Story 1-3]
- [ ] CHK020 Les critères de succès SC-001 et SC-002 définissent-ils des conditions mesurables et un périmètre d’évaluation non ambigu ? [Measurability, Spec §SC-001, §SC-002]
- [ ] CHK021 Le seuil SC-003 (« 95% interactions critiques ») référence-t-il une liste d’interactions explicitement identifiée ? [Measurability, Spec §SC-003, §Gap]
- [ ] CHK022 Le critère SC-004 (« 0 régression critique ») définit-il ce qui qualifie « critique » ? [Clarity, Spec §SC-004, §Ambiguity]
- [ ] CHK023 Le critère SC-005 précise-t-il protocole, taille d’échantillon et conditions de mesure des testeurs internes ? [Measurability, Spec §SC-005, §Gap]

## Scenario Coverage

- [ ] CHK024 Les exigences couvrent-elles explicitement le scénario primaire de gestion arbre complet de bout en bout ? [Coverage, Spec §User Story 1, §FR-004, §FR-005]
- [ ] CHK025 Les exigences couvrent-elles le scénario primaire de détail + galerie + ajout photo sans dépendance implicite à la liste ? [Coverage, Spec §User Story 2, §FR-007, §FR-008]
- [ ] CHK026 Les exigences couvrent-elles un scénario alternatif « household non résolu ou multiple memberships » avec comportement attendu clair ? [Coverage, Spec §FR-010, §Assumption, §Gap]
- [ ] CHK027 Les exigences couvrent-elles les flows d’exception API (erreurs de chargement, permission, conflit) pour chaque écran ? [Coverage, Spec §Edge Cases, §FR-010, §FR-014]
- [ ] CHK028 Les exigences couvrent-elles les flows de récupération utilisateur après erreur (rechargement, action corrective, état UI) ? [Coverage, Recovery Flow, Spec §FR-013, §FR-014, §Gap]

## Edge Case Coverage

- [ ] CHK029 Les exigences définissent-elles le comportement exact de l’état vide liste (zéro zone) avec attentes d’UX minimales ? [Edge Case, Spec §Edge Cases]
- [ ] CHK030 Les exigences définissent-elles le comportement exact de l’état vide galerie (zéro photo) sans ambiguïté d’affordance ? [Edge Case, Spec §User Story 2, §Edge Cases]
- [ ] CHK031 Les exigences traitent-elles la donnée partielle (note/surface/couleur) avec règles de priorité et de fallback explicites ? [Edge Case, Spec §FR-006, §Edge Cases]
- [ ] CHK032 Les exigences précisent-elles les contraintes de profondeur d’arbre, de cycles et de volume pour éviter les zones grises fonctionnelles ? [Edge Case, Spec §FR-005, §Gap]

## Non-Functional Requirements

- [ ] CHK033 Les exigences de performance perçue pour pages liste et détail sont-elles quantifiées (seuils ou budgets) et non seulement qualitatives ? [NFR, Spec §SC-004, §Gap]
- [ ] CHK034 Les exigences d’accessibilité (navigation clavier, focus, messages d’erreur) sont-elles spécifiées pour les interactions clés ? [NFR, Accessibility, §Gap]
- [ ] CHK035 Les exigences i18n/l10n des nouveaux textes UX (erreurs suppression/conflit) sont-elles explicitement décrites ? [NFR, i18n, §Gap]
- [ ] CHK036 Les exigences d’observabilité produit (journalisation des erreurs de conflit/suppression refusée) sont-elles définies pour la non-régression ? [NFR, §Gap]

## Dependencies & Assumptions

- [ ] CHK037 Les dépendances API custom (tree, children, photos, attach_photo) indiquent-elles clairement les préconditions de disponibilité et de forme de réponse ? [Dependency, Spec §Dependencies, §FR-007, §FR-008]
- [ ] CHK038 L’hypothèse « backend quasi prêt » est-elle accompagnée de critères objectifs de validité/invalidité ? [Assumption, Spec §Assumptions, §FR-011]
- [ ] CHK039 Les exigences documentent-elles explicitement la source d’autorité en cas d’écart entre legacy et runtime Django ? [Dependency, Spec §Assumptions, §FR-001]

## Ambiguities & Conflicts

- [ ] CHK040 Une règle d’arbitrage est-elle définie si une exigence de parité legacy entre en conflit avec une contrainte technique ou sécurité Django ? [Conflict, Spec §FR-001, §FR-011, §Gap]
- [ ] CHK041 Les termes subjectifs (« lisible », « stable », « fidèle », « critique ») sont-ils tous remplacés ou accompagnés de définitions mesurables ? [Ambiguity, Spec §User Story 3, §FR-009, §SC-004]
- [ ] CHK042 Un schéma d’identifiants de traçabilité (exigence ↔ scénario ↔ contrat ↔ critère succès) est-il défini pour la revue PR ? [Traceability, §Gap]

## Notes

- Profondeur: **Strict release gate**
- Audience: **Reviewer PR**
- Focus: **Parité UX liste/arbre + détail/photo**
- Cette exécution crée un nouveau fichier de checklist et ne remplace pas `requirements.md`.
