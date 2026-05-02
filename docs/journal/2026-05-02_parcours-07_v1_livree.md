# 2026-05-02 — Parcours 07 V1 livrée

## Contexte

Implémentation complète de la V1 du parcours 07 — agent conversationnel sur la mémoire du foyer.

Les six premiers parcours ont construit la mémoire du foyer (interactions, documents, projets, zones, équipements, alertes). Le parcours 07 ouvre une seconde lecture de cette mémoire : un agent qui répond à la place de l'utilisateur, avec citations vérifiables.

Vertical slice livré entre 2026-04-23 et 2026-05-02 sous forme de 5 lots techniques (0a, 0b, 1, 2, 3) + un bonus OCR multi-page (#107).

## Ce qui a été livré

### Lot 0a — Pipeline OCR à l'upload (#88)

- support HEIC/HEIF (validation magic bytes, conversion JPEG côté serveur)
- resize automatique au-delà de 2000 px, q85
- `extract_text(document)` : Vision Haiku pour images, `pypdf` pour PDFs texte, `""` sur erreur (l'upload ne casse jamais)
- skip OCR sur `type='photo'` (la photo grid est dédiée aux souvenirs visuels)
- `metadata['ocr_extracted_at']` + `metadata['ocr_method']` (`vision_haiku` | `pypdf` | `skipped`)
- section pliable du texte extrait dans `DocumentDetailPage.tsx` + i18n 4 locales

### Lot 0b — Backfill OCR (#89)

- management command `python manage.py extract_documents_text` avec `--household`, `--force`, `--type`, `--limit`, `--dry-run`
- progress counter + résumé total / skipped / extracted / failed + coût Vision estimé
- bouton "Re-extraire le texte" sur la fiche document → `POST /api/documents/{id}/reprocess_ocr/`

### Bonus — OCR multi-page sur PDFs scannés (#107 / PR #111)

- détection des PDFs où `pypdf` rend du vide (PDFs scannés en images)
- fallback Vision Haiku par page, concaténation, `metadata['ocr_method']='vision_pages'`
- marqueur OCR sur la card document quand le texte est issu de Vision

### Lot 1 — Retrieval full-text naïf (#100 / PR #112)

- nouvelle app `apps/agent/`
- `SearchableSpec` registry : chaque app déclare ses entités dans son `apps.py.ready()`
- `apps/agent/retrieval.py` : `SearchVector` à la volée par modèle, `config='simple_unaccent'`, `SearchHeadline` Postgres pour les snippets
- 10 entités V1 indexées : Document, Interaction, Equipment, Task, Project, Zone, StockItem, InsuranceContract, Contact, Structure
- `Household.preferred_language` ajouté (placeholder pour stemming par foyer, à activer dans #113)
- scope household systématique enforced côté retrieval

### Lot 2 — Service agent + LLM + citations (#101 / PR #114)

- `LLMClient` Protocol + `AnthropicClient` concret + factory `get_llm_client()` keyed sur `LLM_PROVIDER`
- `apps/agent/prompts.py` : prompt système qui contraint le format `<cite id="entity_type:id"/>` et l'aveu d'ignorance
- `apps/agent/service.ask(question, household)` orchestre retrieval → prompt → LLM → parsing
- citations honnêtes : `_resolve_citations()` intersecte les marqueurs regex avec les hits du retrieval — un marqueur inventé est ignoré
- IDK shortcuts : question vide / retrieval vide / `ANTHROPIC_API_KEY` absente → pas d'appel LLM, message canned + `metadata.reason='no_household_match'`
- endpoint `POST /api/agent/ask/` (`504` timeout, `503` LLM error, `400` no household)
- skeleton `apps/ai_usage/` créé en avance sur le lot 6 : modèle `AIUsageLog`, `log_ai_usage()` fail-soft, admin read-only
- chaque appel LLM agent logue une ligne (`feature='agent_ask'`)

### Lot 3 — Surface UI chat (#102 / PR #115)

- page React `/app/agent/` accessible depuis la sidebar (icône `Sparkles`)
- mention de confidentialité au premier usage : modale Radix non-dismissible, persistance localStorage `agent.privacyAccepted.v1`, input bloqué tant qu'elle n'est pas acceptée
- input multi-ligne : `Enter` envoie, `Shift+Enter` saute une ligne
- bulles question/réponse, loader animé, hint d'accueil
- composant `AgentCitation` : chip cliquable avec icône Lucide adaptée par `entity_type` (10 types mappés)
- composant `ChatBubble` : marqueurs `<cite id="…"/>` rendus inline en chips numérotés + panneau "Sources" en bas de bulle
- i18n complet en/fr/de/es (namespace `agent`)
- 5 tests E2E Playwright (mock backend) : golden path + privacy notice + IDK + URL de citation par type d'entité

## Décisions produit prises

- **page dédiée** `/app/agent/` plutôt que widget global pour V1 — à réévaluer après usage si l'agent devient un point d'entrée fréquent
- **pas de mémoire conversationnelle** en V1 (lot 4 basculé V2) — décision motivée par l'incertitude sur le besoin réel et le coût d'implémentation (modèles, scope, rétention, streaming)
- **pas de redaction PII** en V1 (faible priorité solo user) — à arbitrer si on ouvre à d'autres utilisateurs
- **`AIUsageLog`** stocke les métadonnées (feature, provider, model, durée, tokens, success), **pas le contenu** des prompts ou réponses — décision tranchée pour limiter la surface confidentialité
- **Claude Haiku 4.5** pour l'agent (même API key qu'OCR) — Sonnet réservé aux cas où Haiku échoue manifestement, non observé en V1

## Décisions techniques prises

- abstraction `LLMClient` Protocol dès le lot 2 — permet un futur `OllamaClient` (modèle local) sans réécrire la couche métier
- citations parsées via regex côté service, intersectées avec les hits du retrieval — invariant : l'agent ne peut pas citer ce qu'on ne lui a pas montré
- `apps/ai_usage/` créée en avance sur le lot 6 (skeleton uniquement) pour que le service agent puisse logger ses appels — le lot 6 ajoutera les agrégations et l'UI par-dessus
- registry pattern pour le retrieval : ajouter une 11ᵉ entité = 5 lignes dans son `apps.py`, zéro touche à `apps/agent/`
- `config='simple_unaccent'` (pas de stemming) en V1 — multi-tenant safe, activable par foyer plus tard via `Household.preferred_language` (#113)

## Validation manuelle en prod

Validé sur le foyer "Les Petits Bonheur" (`ff28b251-…`, 188 docs) via `service.ask()` en Django shell :

| Question | Hits | Citations | Tokens (in/out) | Latence |
|---|---|---|---|---|
| "vmc" | 12 | 5 (documents + project) | 1149 / 252 | 3054 ms |
| "crédit immobilier" | 12 | 3 (documents) | 594 / 167 | 2217 ms |
| "assurance habitation" | 12 | 7 (document + interaction + insurance_contract) | 1420 / 372 | 3430 ms |
| "superman batman" | 0 | — (IDK shortcut, pas d'appel LLM) | — | — |

Test HTTP via nginx → web container : 200 OK, contrat JSON respecté. `AIUsageLog` : 4 lignes loguées, toutes `success=True`, `feature='agent_ask'`.

## Définition de done — V1 validée

1. ✅ tout document uploadé a son `ocr_text` peuplé automatiquement (#88)
2. ✅ les documents existants ont été re-extraits via la management command (#89)
3. ✅ le retrieval full-text retourne des hits scopés household (#100)
4. ✅ le service agent répond avec ≥1 citation vérifiable (#101)
5. ✅ la surface UI permet de poser une question et de naviguer vers une citation (#102)
6. ✅ les tests Python (62) et E2E Playwright (5 agent + 70 préexistants) sont à jour
7. ✅ la mention de confidentialité est visible avant le premier usage

## Reste ouvert (non bloquant)

- **#109** — observabilité IA : agrégations + page admin `/app/admin/ai-usage/`. Backend skeleton livré dans le lot 2, KPIs et UI restent à faire. À livrer quand le besoin de métriques d'usage se fait sentir.
- **#113** — activer `Household.preferred_language` pour stemming par foyer. À déclencher quand on observe des matches ratés "facture" ↔ "factures" à l'usage.

## Suite recommandée

1. **recette manuelle** : utiliser l'agent au quotidien pendant 1-2 semaines, ouvrir des issues ciblées sur ce qui craque concrètement (questions ratées, format de citation, latence)
2. lot 6 (#109) en parallèle si on veut quantifier la qualité d'usage
3. lot 4 (mémoire multi-tour) à arbitrer après quelques semaines d'usage one-shot

## Références

- [docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md)
- [docs/parcours/PARCOURS_07_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_07_BACKLOG_TECHNIQUE.md)
- [docs/fiches/RAG.md](/Users/benjaminvandamme/Developer/house/docs/fiches/RAG.md)
- PRs : #111 (#107), #112 (#100), #114 (#101), #115 (#102)
