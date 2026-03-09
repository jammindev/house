# Documents Web Contract — Feature 001

## Overview

Cette feature ajoute trois surfaces web Django-routées pour le parcours documents:

1. liste `/app/documents/`
2. création `/app/documents/new/`
3. détail `/app/documents/<id>/`

Le flux de création d’activité depuis un document réutilise `/app/interactions/new/` avec des props supplémentaires dérivées d’un `source_document_id` accessible.

## Screen 1 — Documents list

**Route**: `/app/documents/`

**Django view**
- `AppDocumentsView(ReactPageView)`
- Vite asset: `src/pages/documents/list.tsx`

**SSR props**
- `title`
- `createUrl`
- `initialDocuments[]`
- `initialLoaded`
- `initialCounts.total`
- `initialCounts.withoutActivity`
- `filterDefaults.withoutActivityOnly` (V1 peut rester `false` et local à la page)

**First-render responsibilities**
- afficher immédiatement les documents récents
- afficher le volume de documents à traiter
- exposer l’entrée “Ajouter un document”

**Runtime API interactions**
- `GET /api/documents/documents/` pour refresh liste
- aucune mutation inline critique requise pour la V1, hors édition légère/suppression existantes

**Navigation**
- clic sur CTA principal → `/app/documents/new/`
- clic sur item → `/app/documents/<id>/`

## Screen 2 — Document create

**Route**: `/app/documents/new/`

**Django view**
- `AppDocumentCreateView(ReactPageView)`
- Vite asset: `src/pages/documents/new.tsx`

**SSR props**
- `title`
- `cancelUrl`
- `allowedTypes[]`
- `defaultType` (nullable)
- `uploadApiUrl`
- `successRedirectMode` = `document-detail`

**First-render responsibilities**
- afficher un formulaire d’upload minimal
- préremplir le nom à partir du fichier sélectionné côté client
- ne pas exiger de type

**Runtime API interactions**
- `POST /api/documents/documents/upload/` en multipart

**Navigation**
- succès → redirection immédiate vers `/app/documents/<id>/`
- annulation → retour `/app/documents/`

## Screen 3 — Document detail

**Route**: `/app/documents/<id>/`

**Django view**
- `AppDocumentDetailView(ReactPageView)`
- Vite asset: `src/pages/documents/detail.tsx`

**SSR props**
- `documentId`
- `listUrl`
- `fileUrl`
- `attachInteractionApiUrl`
- `createInteractionUrl`
- `initialDocument` (payload enrichi)
- `initialRecentInteractionCandidates[]`
- `initialLoaded`

**First-render responsibilities**
- afficher l’identité du document
- afficher l’état `sans contexte` ou les activités liées
- afficher les contextes zone/projet disponibles en lecture
- rendre visibles les actions principales

**Runtime API interactions**
- `GET /api/documents/documents/{id}/` pour refresh après mutation
- `POST /api/interactions/interaction-documents/` pour rattachement à une activité existante
- `GET /api/interactions/interactions/` pour recherche simple d’activité par libellé si les récentes ne suffisent pas

**Navigation**
- retour liste → `/app/documents/`
- créer activité → `/app/interactions/new/?source_document_id=<id>`

## Reused screen — Interaction create from document

**Route**: `/app/interactions/new/?source_document_id=<id>`

**Django view change**
- `AppInteractionNewView` résout `source_document_id` si présent et accessible
- construit un redirect de succès vers le détail document au lieu du retour liste standard

**Additional SSR props**
- `sourceDocument` (`id`, `name`, `type`)
- `linkedDocumentIds[]`
- `redirectAfterSuccessUrl`

**Runtime API interaction**
- `POST /api/interactions/interactions/` avec `document_ids`

**Success flow**
- création activité + lien(s) document atomiques
- redirection vers `/app/documents/<id>/?created_interaction=<uuid>`

## Boundary rules

### Server-rendered / SSR-owned
- routes, permissions, household resolution
- shell HTML
- props JSON initiaux pour les trois écrans
- URLs de navigation cross-page sûres

### React-owned
- gestion des états d’interface
- sélection fichier + préremplissage du nom
- filtrage local V1 de la liste si conservé local
- recherche simple d’activité
- feedback utilisateur après mutation

### Runtime API-owned
- upload réel du binaire
- calcul canonique du statut `sans contexte`
- validation household et refus des doublons document-activité
- création atomique activité + lien document

## i18n impact

Nouvelles chaînes à couvrir dans les 4 fichiers JSON React:
- `documents.title`
- `documents.subtitle`
- `documents.add`
- `documents.new.*`
- `documents.detail.*`
- `documents.qualification.*`
- `documents.attach.*`
- `documents.createActivity.*`

Nouvelles chaînes Django potentielles:
- titres SSR de page création/détail
- labels de navigation shell si rendus côté template
