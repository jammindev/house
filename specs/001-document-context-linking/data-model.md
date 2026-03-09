# Data Model — Traiter un document entrant et le relier au bon contexte

## 1) Document
- **Purpose**: Représente une pièce source réellement stockée dans le runtime actif et visible depuis le parcours documents.
- **Core fields**:
  - `id`
  - `household_id`
  - `file_path` (chemin relatif dans le stockage media)
  - `name`
  - `mime_type`
  - `type` (`document`, `invoice`, `manual`, `warranty`, `receipt`, `plan`, `certificate`, `other`, avec `photo` exclu du parcours documents)
  - `notes`
  - `ocr_text`
  - `metadata` (taille, état de traitement, provenance éventuelle)
  - `created_at`, `created_by`
  - `interaction` (champ legacy de compatibilité, non vérité produit)
- **Relationships**:
  - N—1 vers `Household`
  - 1—N vers `InteractionDocument`
  - 1—N vers `ZoneDocument`
  - 1—N vers `ProjectDocument`
- **Validation rules**:
  - le document doit appartenir à un household accessible par l’utilisateur
  - l’upload initial requiert un fichier binaire
  - le `name` est prérempli à partir du fichier mais reste modifiable
  - le `type` est facultatif à l’entrée et doit tomber sur une valeur supportée si renseigné
  - `file_path` doit rester un chemin relatif sûr, sans chemin absolu ni traversal
- **State transitions**:
  - `Uploaded / sans contexte`
  - `Uploaded / avec contextes secondaires`
  - `Linked to activity` (au moins un `InteractionDocument`)
  - `Linked to multiple activities`
  - `Deleted`

## 2) InteractionDocument
- **Purpose**: Représente le rattachement canonique d’un document à une activité du foyer.
- **Core fields**:
  - `interaction_id`
  - `document_id`
  - `role`
  - `note`
  - `created_at`
- **Relationships**:
  - N—1 vers `Interaction`
  - N—1 vers `Document`
- **Validation rules**:
  - l’interaction et le document doivent appartenir au même household
  - l’utilisateur doit avoir accès aux deux objets
  - le couple `(interaction_id, document_id)` est unique
  - une tentative de recréation du même couple doit produire un refus métier explicite
- **State transitions**:
  - `Absent`
  - `Created`
  - `Rejected as duplicate`
  - `Deleted` (hors scope MVP mais structurellement possible)

## 3) DocumentQualificationState
- **Purpose**: Projection métier dérivée utilisée par la liste et le détail pour exprimer l’état du document.
- **Derived fields**:
  - `has_activity_context` (bool)
  - `linked_interactions_count`
  - `has_secondary_context` (bool)
  - `qualification_state` (`without_activity`, `activity_linked`)
- **Derivation rules**:
  - `without_activity` si aucun `InteractionDocument` n’existe pour le document
  - un document peut rester `without_activity` même s’il possède déjà un lien zone ou projet
  - les champs legacy `interaction` / `interaction_subject` peuvent être exposés à titre transitoire mais ne pilotent plus ce calcul produit

## 4) DocumentDetailProjection
- **Purpose**: Agrégat de lecture injecté dans le détail document et réutilisable côté API.
- **Core fields**:
  - `document` (snapshot du document)
  - `qualification` (`DocumentQualificationState`)
  - `linked_interactions[]` avec résumé (`id`, `subject`, `type`, `occurred_at`)
  - `zone_links[]` avec résumé (`zone_id`, `zone_name`)
  - `project_links[]` avec résumé (`project_id`, `project_name`)
  - `recent_interaction_candidates[]` pour amorcer le rattachement
  - `action_urls` (`back_url`, `attach_url`, `create_activity_url`, `file_url`)
- **Validation rules**:
  - tous les éléments agrégés doivent appartenir au household actif
  - les contextes secondaires restent en lecture seule dans la V1

## 5) DocumentUploadCommand
- **Purpose**: Contrat d’écriture pour l’entrée minimale d’un document avec binaire réel.
- **Input fields**:
  - `file` (required)
  - `name` (optional, prérempli côté UI)
  - `type` (optional)
  - `notes` (optional)
  - household via header `X-Household-Id`
- **Output fields**:
  - `document_id`
  - `detail_url`
  - `file_url`
  - état de qualification initial
- **Validation rules**:
  - un household explicite est requis si aucun autre contexte ne permet de l’inférer
  - le fichier doit être stockable dans le runtime media actif
  - la réponse doit permettre la redirection immédiate vers le détail document

## 6) InteractionCreateFromDocumentCommand
- **Purpose**: Contrat d’écriture pour réutiliser le flux d’activité existant tout en reliant automatiquement un document.
- **Input fields**:
  - champs standards de création d’activité (`subject`, `content`, `type`, `status`, `occurred_at`, `zone_ids`, `metadata`, `tags_input`)
  - `document_ids[]` (optionnel mais utilisé par ce parcours)
- **Relationships**:
  - crée une `Interaction`
  - crée un ou plusieurs `InteractionDocument`
- **Validation rules**:
  - les zones restent obligatoires selon la règle actuelle du runtime
  - tous les documents fournis doivent être accessibles et du même household que les zones/l’activité
  - la création de l’activité et des liens doit être atomique

## 7) InteractionSelectionCandidate
- **Purpose**: Projection légère utilisée dans l’UI “Relier à une activité existante”.
- **Core fields**:
  - `id`
  - `subject`
  - `type`
  - `occurred_at`
  - `zone_names[]`
  - `document_count`
- **Usage rules**:
  - la page détail affiche d’abord des activités récentes hydratées côté serveur
  - une recherche simple par libellé complète cette liste au runtime
  - aucune recherche multi-critères avancée n’est requise dans la V1
