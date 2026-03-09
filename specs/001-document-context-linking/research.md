# Phase 0 Research — Traiter un document entrant et le relier au bon contexte

## Decision 1: Ajouter un endpoint multipart dédié pour l’upload initial du document
- **Decision**: Introduire un endpoint dédié `POST /api/documents/documents/upload/` en multipart pour l’entrée minimale du document, au lieu de surcharger le `create` JSON existant.
- **Rationale**: Le runtime actif ne gère aujourd’hui l’upload binaire que via des actions DRF dédiées avec `MultiPartParser` et `FormParser`. Un endpoint dédié garde la compatibilité avec le `POST /api/documents/documents/` actuel, déjà utilisé en JSON par les tests et les clients existants.
- **Alternatives considered**:
  - Étendre `POST /api/documents/documents/` pour accepter JSON et multipart: rejeté, car cela mélange deux contrats et complique les validations.
  - Refactorer `Document.file_path` en `FileField`: rejeté pour la V1, car cela toucherait trop de consommateurs existants.

## Decision 2: Conserver `Document.file_path` comme contrat de stockage V1
- **Decision**: Garder `Document.file_path` comme représentation persistée du fichier et écrire le binaire dans `MEDIA_ROOT` avec génération/sanitisation manuelle du chemin.
- **Rationale**: Le code actif, l’admin, les serializers, certaines vues de détail et les scripts d’import utilisent déjà `file_path` comme source de vérité. Une V1 crédible peut s’appuyer sur ce contrat sans refactor transverse.
- **Alternatives considered**:
  - Migrer vers un stockage abstrait complet dès maintenant: rejeté, hors scope MVP.
  - Continuer avec des documents purement metadata sans binaire réel: rejeté, car la spec exige un vrai upload exploitable.

## Decision 3: Faire de `InteractionDocument` la vérité produit pour le contexte activité
- **Decision**: Calculer l’état produit `sans contexte` à partir de l’absence de liens `InteractionDocument`, tout en gardant `Document.interaction` comme champ de compatibilité transitoire.
- **Rationale**: La spec V1 et le backlog produit imposent plusieurs activités par document. Le modèle `InteractionDocument` existe déjà, a une contrainte d’unicité et correspond au contrat métier attendu.
- **Alternatives considered**:
  - Continuer à structurer le produit autour de `Document.interaction`: rejeté, car cela limite le document à une seule activité et maintient l’ambiguïté actuelle.
  - Masquer totalement `Document.interaction` dès la première livraison: rejeté, car une compatibilité transitoire simplifie la migration du runtime actif.

## Decision 4: Créer trois surfaces web Django-routées pour ce parcours
- **Decision**: Structurer la feature autour de trois pages hybrides dédiées: liste `/app/documents/`, création `/app/documents/new/` et détail `/app/documents/<id>/`, chacune portée par `ReactPageView` et un entrypoint Vite distinct.
- **Rationale**: C’est le pattern déjà utilisé avec succès dans `projects`, `zones` et `directory`. Cela évite une mini-navigation client trop lourde et donne des URLs stables pour l’upload, la qualification et le retour post-action.
- **Alternatives considered**:
  - Conserver uniquement une liste avec modales: rejeté, car cela ne couvre pas correctement le parcours de qualification.
  - Construire un mini-routeur React côté documents: rejeté, car contraire au pattern Django-routed du repo.

## Decision 5: Donner des props SSR utiles à la liste, à la création et au détail
- **Decision**: Hydrater les pages avec des props Django minimales mais utiles: liste initiale + compteurs sur la page liste, contrat d’upload sur la page création, et document enrichi + URLs d’action sur la page détail.
- **Rationale**: `ReactPageView` pose explicitement la règle “pas de premier rendu vide”. Le module documents actuel ne respecte pas encore cette règle; la V1 doit corriger cela.
- **Alternatives considered**:
  - Tout charger au runtime depuis React: rejeté, car cela dégrade le premier rendu et contredit la constitution.
  - Tout rendre en SSR sans appels runtime complémentaires: rejeté, car la recherche d’activité et les mutations restent mieux adaptées à l’API DRF.

## Decision 6: Réutiliser la création d’activité existante avec un contrat `document_ids`
- **Decision**: Étendre `POST /api/interactions/interactions/` avec un champ optionnel `document_ids` pour créer l’activité et les liens `InteractionDocument` de façon atomique. La page `/app/interactions/new/` recevra un `source_document_id` et un redirect de succès construit côté serveur vers le détail document.
- **Rationale**: Le flux de création d’activité existe déjà, avec ses validations de zones et de household. L’étendre évite un enchaînement client non atomique `create interaction` puis `create link`.
- **Alternatives considered**:
  - Faire deux appels client successifs: rejeté, car plus fragile et moins sûr sur les doublons/erreurs intermédiaires.
  - Créer un endpoint dédié `create-interaction-from-document`: rejeté en V1, car cela dupliquerait trop de logique du flux existant.

## Decision 7: Utiliser une sélection d’activité “récentes + recherche simple”
- **Decision**: Sur le détail document, proposer une liste d’activités récentes hydratée côté serveur, complétée par une recherche simple côté runtime via l’endpoint interactions existant.
- **Rationale**: Cette approche couvre le besoin fonctionnel sans lancer un moteur de recherche avancé. Elle reste cohérente avec la clarification validée dans la spec.
- **Alternatives considered**:
  - Activités récentes uniquement: rejeté, car trop limité si l’activité cible n’est pas récente.
  - Recherche multi-critères avancée: rejeté, car trop coûteux pour la V1.

## Decision 8: Refuser explicitement les doublons exacts document-activité
- **Decision**: Le rattachement via `InteractionDocument` doit échouer proprement si le couple `(document, interaction)` existe déjà, avec une réponse métier explicite plutôt qu’une simple erreur technique de base de données.
- **Rationale**: La contrainte d’unicité existe déjà au niveau modèle, mais le produit V1 a besoin d’un comportement lisible et testable.
- **Alternatives considered**:
  - S’appuyer uniquement sur l’IntegrityError de la base: rejeté, car mauvaise UX et faible lisibilité de contrat.
  - Rendre l’opération silencieusement idempotente: rejeté, car la clarification spec demande un refus explicite du doublon.

## Decision 9: Exposer les contextes zone/projet en lecture seule dans le détail
- **Decision**: Le payload de détail document doit inclure des résumés de liens zone/projet lorsqu’ils sont déjà résolubles, sans ouvrir de création de ces liens dans la V1.
- **Rationale**: Cela répond au besoin de “contexte actuel” sans élargir le scope au-delà du rattachement activité.
- **Alternatives considered**:
  - Ignorer complètement les contextes secondaires: rejeté, car le document perdrait une partie utile de son contexte réel.
  - Ouvrir l’édition complète de tous les liens dès la V1: rejeté, car trop large.

## Decision 10: Prévoir l’impact i18n dès la conception
- **Decision**: Toute nouvelle chaîne visible doit être ajoutée dans les 4 fichiers React `ui/src/locales/{en,fr,de,es}/translation.json`, et les nouveaux libellés SSR Django doivent être ajoutés dans les catalogues `.po` correspondants.
- **Rationale**: La constitution rend cette synchronisation obligatoire. Le namespace `documents` React est encore quasi vide aujourd’hui.
- **Alternatives considered**:
  - S’appuyer temporairement sur `defaultValue`: rejeté, acceptable en code existant mais non suffisant comme cible de design.

## Resolved Technical Context

- **Language/Version**: Python 3.x avec Django 5.2.11; TypeScript 5.9.x avec React 19.
- **Primary Dependencies**: Django, DRF, django-filter, drf-spectacular, django-vite, React, i18next, Tailwind, Lucide.
- **Storage strategy**: PostgreSQL au runtime; SQLite in-memory pour les tests; fichiers documents stockés localement sous `MEDIA_ROOT` via `file_path` en V1.
- **Testing strategy**: pytest + DRF APIClient pour API/contracts; validation manuelle ciblée pour les pages hybrides.
- **Performance target**: éviter le premier rendu vide sur liste/détail/création; redirection post-upload vers le détail en moins de 5 secondes en environnement nominal; recherche/rattachement limités à des jeux de données household de taille modérée.
- **Scale assumption**: parcours limité à quelques pages et endpoints dans un repo Django/React existant; datasets orientés foyer (documents récents, activités récentes) plutôt que GED volumineuse.

Tous les points nécessaires au passage en design sont résolus pour cette feature V1.
