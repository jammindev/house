# Parcours 07 — Backlog technique V1

> **Draft** — ce document a été reconstitué à partir des issues #88 et #89. Les lots 0a et 0b sont précis (issues détaillées) ; les lots suivants sont encore à cadrer.

Ce document traduit la décision produit du parcours 07 en backlog technique concret.

Doc produit associée : [PARCOURS_07_AGENT_CONVERSATIONNEL.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md)
Note transverse couche IA : [PARCOURS_IA_TRANSVERSE.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_IA_TRANSVERSE.md)

## Objectif d'implémentation

Livrer un agent conversationnel sur la mémoire du foyer en s'appuyant sur Claude Haiku 4.5 (provider tranché dans #88), de manière incrémentale :

- d'abord le prérequis OCR pour rendre les documents lisibles à l'agent
- puis la recherche full-text sur les entités du foyer
- puis le service LLM
- puis la surface UI chat

## Principe d'exécution

Le backlog est organisé en lots techniques verticaux. Chaque lot doit produire un incrément testable.

## Décisions de cadrage MVP

- provider : **Claude Haiku 4.5** + SDK `anthropic` (tranché dans #88)
- service : extension de `apps/documents/` pour le lot 0, possiblement nouvelle app `apps/agent/` à partir du lot 2 (`À préciser`)
- exécution : **synchrone** pour V1, pas de Celery (tranché dans #88)
- agent en lecture seule en V1 (pas d'action de création)
- scope household systématique sur toute requête de l'agent

## Lot 0a — Pipeline upload : HEIC + resize + OCR

**Référence** : issue **#88** (état OPEN au 2026-04-29).

### But

Peupler automatiquement `Document.ocr_text` à l'upload, avec un pipeline qui supporte les formats iPhone (HEIC) et limite les images trop grosses.

### Fichiers principaux

- [apps/core/file_validation.py](/Users/benjaminvandamme/Developer/house/apps/core/file_validation.py)
- [apps/documents/views.py](/Users/benjaminvandamme/Developer/house/apps/documents/views.py)
- `apps/documents/image_processing.py` (nouveau)
- `apps/documents/extraction.py` (nouveau)
- [apps/documents/tests/test_api_documents.py](/Users/benjaminvandamme/Developer/house/apps/documents/tests/test_api_documents.py)
- [config/settings/base.py](/Users/benjaminvandamme/Developer/house/config/settings/base.py)
- [requirements/base.txt](/Users/benjaminvandamme/Developer/house/requirements/base.txt)
- [ui/src/features/documents/DocumentUploadDialog.tsx](/Users/benjaminvandamme/Developer/house/ui/src/features/documents/DocumentUploadDialog.tsx)
- [ui/src/features/documents/DocumentDetailPage.tsx](/Users/benjaminvandamme/Developer/house/ui/src/features/documents/DocumentDetailPage.tsx)
- `ui/src/locales/{en,fr,de,es}/translation.json`

### Tâches

Voir l'issue #88 pour le détail. Synthèse :

1. ajouter `pillow-heif`, `pypdf`, `anthropic` à `requirements/base.txt`
2. valider HEIC/HEIF en magic bytes + autoriser `image/heic`, `image/heif`
3. enregistrer `pillow_heif.register_heif_opener()` au boot Django
4. exposer `ANTHROPIC_API_KEY` dans les settings
5. `normalize_image()` — HEIC → JPEG, resize si > 2000px, q85
6. `extract_text(document)` — Vision Haiku pour images, `pypdf` pour PDFs texte, `""` sur erreur
7. wire des deux dans l'action `upload` du `DocumentViewSet` — **skipper l'OCR si `type='photo'`** (la photo grid est dédiée aux souvenirs visuels, l'OCR n'apporte rien et pollue `search_fields=['ocr_text']`)
8. remplacer le placeholder `reprocess_ocr` par une vraie implémentation (l'utilisateur peut forcer l'OCR sur une photo via cette action)
9. afficher `ocr_text` dans `DocumentDetailPage.tsx` (section pliable)
10. loading state pendant l'upload + clés i18n dans les 4 locales
11. tests : upload HEIC, resize, mock anthropic, extraction qui throw, PDF texte

### Critères de validation

- upload iPhone HEIC d'une facture papier → JPEG en stockage, `ocr_text` plausible
- détail document affiche le texte extrait
- upload qui échoue à l'extraction reste réussi (`ocr_text=""`)
- aucune régression sur JPEG/PNG/PDF existants
- upload avec `type='photo'` → thumbnails générés mais `ocr_text=""` et pas de `ocr_method` dans `metadata`

### Hors scope (déjà documenté dans #88)

- backfill des documents existants → lot 0b (#89)
- OCR async → V2
- PDFs scannés → V2
- full-text search Postgres → lot 1

## Lot 0b — Backfill OCR

**Référence** : issue **#89** (OPEN, bloquée par #88).

### But

Re-traiter tous les documents existants (importés depuis Supabase ou uploadés avant le pipeline) pour qu'ils soient lisibles par l'agent.

### Fichiers principaux

- `apps/documents/management/commands/extract_documents_text.py` (nouveau)
- `apps/documents/tests/test_extract_documents_text_command.py` (nouveau)
- [ui/src/features/documents/DocumentDetailPage.tsx](/Users/benjaminvandamme/Developer/house/ui/src/features/documents/DocumentDetailPage.tsx)
- `ui/src/locales/{en,fr,de,es}/translation.json`

### Tâches

Voir l'issue #89 pour le détail. Synthèse :

1. management command `extract_documents_text` avec args `--household`, `--force`, `--type`, `--limit`, `--dry-run`
2. output : compte total / skipped / extracted / failed + coût Vision estimé
3. progress counter `[N/total]`
4. stocker `metadata['ocr_extracted_at']` + `metadata['ocr_method']`
5. bouton UI "Re-extraire le texte" sur la fiche document → appelle `POST /api/documents/{id}/reprocess_ocr/`
6. visible si `ocr_text` est vide, sinon dans menu actions
7. clés i18n dans les 4 locales
8. tests : skip par défaut, `--force`, `--household`, `--limit`, `--dry-run`, doc en erreur n'arrête pas le batch

### Critères de validation

- `python manage.py extract_documents_text --dry-run` liste sans rien écrire
- `python manage.py extract_documents_text --limit 5` traite 5 docs avec résumé + coût
- bouton UI met à jour le texte affiché
- pas de re-traitement par défaut sans `--force`

### Hors scope

- ré-OCR automatique sur tous les docs (le batch reste manuel)
- planification cron

## Lot 1 — Recherche full-text sur la mémoire du foyer

**Statut** : à cadrer. Mentionné comme suite logique dans #88 ("full-text search Postgres `SearchVector` — lot 1 du parcours 07").

### But

Permettre à l'agent de récupérer rapidement les passages pertinents dans le foyer avant l'appel LLM (étape de retrieval du RAG).

### Pistes (`À préciser`)

- index Postgres `SearchVector` sur :
  - `Interaction.subject`, `Interaction.description`, sélection de `Interaction.metadata`
  - `Document.name`, `Document.notes`, `Document.ocr_text`
  - peut-être `Equipment.name`, `Equipment.notes`
- module utilitaire `apps/agent/retrieval.py` ou dans `apps/core/`
- contrat : `search(household_id, query, limit)` → liste de hits typés (entity_type, id, snippet, rank)
- scope household systématique (pas d'opt-out)

### Décisions à prendre

- `À préciser` — un seul SearchVector multi-tables ou un par modèle ?
- `À préciser` — strategy de boost (récence, type d'entité, entité utilisateur) ?
- `À préciser` — taille du contexte renvoyé au LLM (nb de hits, longueur du snippet)
- `À préciser` — tokenizer i18n (la base est mixte FR/EN)

## Lot 2 — Service d'appel LLM (couche agent)

**Statut** : à cadrer.

### But

Module Python qui prend une question utilisateur, récupère le contexte pertinent (lot 1), appelle Claude, et renvoie une réponse + citations.

### Pistes (`À préciser`)

- nouvelle app `apps/agent/` avec :
  - `agent/client.py` — wrapper Claude (ou réutilisation de l'utilitaire posé en lot 0)
  - `agent/service.py` — orchestrateur retrieval + prompt + citation
  - `agent/serializers.py` + `agent/views.py` — endpoint API
  - `agent/models.py` — éventuel stockage de conversations (Story 4)
- contrat d'entrée : `{ question, household_id, conversation_id?, history? }`
- contrat de sortie : `{ answer: string, citations: [{ entity_type, id, label, snippet }], conversation_id }`
- prompt : système qui contraint l'agent à citer ses sources et à reconnaître l'ignorance

### Décisions à prendre

- `À préciser` — modèle (Haiku ou Sonnet)
- `À préciser` — gestion du timeout, retry, fallback
- `À préciser` — politique de logs (prompt, réponse, durée, coût)
- `À préciser` — redaction (PII) avant envoi au modèle
- `À préciser` — limite de longueur de prompt et de contexte

### Tests

- mock systématique du client Anthropic (zéro appel réseau en CI)
- couverture des cas : question simple, question avec retrieval vide, modèle qui timeout, modèle qui répond malformé

## Lot 3 — Surface UI chat

**Statut** : à cadrer.

### But

Interface où l'utilisateur tape ses questions et lit les réponses.

### Pistes (`À préciser`)

- page React dédiée `/app/agent/` ?
- ou widget global accessible partout via shortcut clavier (`/`) ?
- ou les deux ?
- composant chat : input contrôlé, historique de la session, loading
- rendu des citations cliquables (component `<AgentCitation entity_type id label />` qui résout l'URL)
- mention de confidentialité au premier usage
- i18n (en, fr, de, es)

### Décisions à prendre

- `À préciser` — page dédiée vs widget vs combinaison
- `À préciser` — comportement mobile
- `À préciser` — copy de mention de confidentialité
- `À préciser` — feedback utilisateur (pouce haut/bas) pour itérer sur la qualité

## Lot 4 — Mémoire conversationnelle (optionnel V1)

**Statut** : à arbitrer V1 vs V2.

### But

Permettre de retrouver les conversations passées et de continuer un fil.

### Pistes (`À préciser`)

- modèles `AgentConversation` (household, créé par, titre auto, last_message_at) et `AgentMessage` (conversation, role, content, citations, metadata)
- liste des conversations dans la sidebar de la page agent
- nettoyage automatique au-delà d'une rétention donnée

### Décision V1

`À préciser` — tout livrer sans persistance peut être suffisant pour valider l'usage. Si oui, ce lot bascule en V2.

## Lot 5 — Tests et validation

### But

Sécuriser la chaîne complète sans multiplier les tests fragiles à un appel LLM.

### Tâches

1. tests unitaires sur le retrieval (lot 1)
2. tests unitaires sur le service agent avec client Anthropic mocké (lot 2)
3. tests d'intégration sur l'endpoint chat (lot 2 + 3)
4. tests E2E Playwright sur la surface UI (lot 3) — au moins un golden path
5. recette manuelle bout en bout avec la liste de validation de la doc produit

## Ordre recommandé d'implémentation

1. Lot 0a — Pipeline OCR à l'upload (#88)
2. Lot 0b — Backfill OCR (#89)
3. Lot 1 — Recherche full-text
4. Lot 2 — Service agent
5. Lot 3 — Surface UI chat
6. Lot 4 — Mémoire conversationnelle (si retenue en V1)
7. Lot 5 — Tests et validation

## Découpage en sessions de travail

Suggestion :

### Session 1

- Lot 0a (#88)

### Session 2

- Lot 0b (#89)
- début Lot 1

### Session 3

- fin Lot 1
- Lot 2

### Session 4

- Lot 3
- début Lot 5

### Session 5 (si Lot 4 retenu)

- Lot 4
- fin Lot 5

## Points de vigilance

- ne jamais bloquer un upload sur un échec d'extraction (déjà inscrit dans #88)
- ne pas envoyer plus que nécessaire au modèle (coût + confidentialité)
- mock systématique du client Anthropic en tests (pas un seul appel réseau en CI)
- garder l'agent en lecture seule en V1, ne pas glisser vers la création d'entités
- éviter d'introduire Celery tant que la latence sync reste acceptable
- pas de couplage UI : la surface chat ne doit pas devenir l'unique entrée de l'agent (un endpoint API exploitable depuis la CLI peut être utile)

## Définition de done technique

La V1 du parcours 07 peut être considérée terminée si :

1. tout document uploadé a son `ocr_text` peuplé automatiquement
2. les documents existants ont été re-extraits via la management command
3. le retrieval full-text retourne des hits pertinents et scopés household
4. le service agent répond à une question avec au moins une citation vérifiable
5. la surface UI permet de poser une question et de naviguer vers une citation
6. les tests Python et E2E essentiels sont à jour
7. la mention de confidentialité est visible avant le premier usage
