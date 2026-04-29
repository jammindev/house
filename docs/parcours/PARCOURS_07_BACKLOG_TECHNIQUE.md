# Parcours 07 — Backlog technique V1

> **État au 2026-04-29** — lots 0a (#88) et 0b (#89) livrés. Lots 1, 2, 3 cadrés ci-dessous, issues GitHub à créer.

## Philosophie d'implémentation V1

Plutôt que viser un retrieval parfait avant de toucher au LLM, on livre un **vertical slice** : retrieval naïf → service agent → UI minimale → on utilise → on renforce le maillon qui craque vraiment. Raisons :

- volume modeste (foyer solo, milliers de docs au plus)
- Claude Haiku 4.5 a un contexte large : on peut spammer des hits sans souci
- on ne saura ce qui craque qu'en utilisant l'agent
- si plus tard le full-text plafonne, passer aux embeddings (`pgvector`) est un refactor incrémental

Cette philosophie remplace la version initiale ("chaque lot doit être complet avant le suivant").

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
- service : extension de `apps/documents/` pour le lot 0, nouvelle app `apps/agent/` à partir du lot 1
- exécution : **synchrone** pour V1, pas de Celery (tranché dans #88)
- agent en lecture seule en V1 (pas d'action de création)
- scope household systématique sur toute requête de l'agent
- **abstraction LLM dès le lot 2** : `LLMClient` Protocol + `AnthropicClient` concret, pour permettre Ollama / autre cloud plus tard sans réécrire la couche métier
- **observabilité IA centralisée** : `apps/ai_usage/` + table `AIUsageLog` qui consolide toutes les invocations IA (OCR Vision, agent, etc.)

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

## Lot 1 — Recherche full-text naïve (retrieval V1)

**Statut** : cadré, issue à créer.

### But

Permettre à l'agent de récupérer rapidement les passages pertinents dans le foyer avant l'appel LLM (étape de retrieval du RAG). **Naïf assumé** : pas de matérialisation d'index, pas de boost, pas d'embeddings.

### Décisions tranchées

- **nouvelle app `apps/agent/`** (pas dans `apps/core/`). Grandira sur lots 2, 3, 4.
- **`SearchVector` à la volée** par modèle, pas de matérialisation. Optimisation plus tard si latence devient un problème.
- **`config='simple'`** (pas de stemming, pas de stopwords). Multi-tenant safe, pas de hardcode `'french'`. Stemming activable plus tard via `Household.preferred_language`.
- **Champ placeholder `Household.preferred_language`** (`fr`/`en`/`de`/`es`, default `fr`). Pas utilisé immédiatement.
- **Pattern registry — chaque app déclare ses entités** dans son `apps.py.ready()`. Ajouter un module = ne pas toucher à l'agent.
- **Scope household systématique** (pas d'opt-out, jamais).

### Entités indexées en V1 (chaque app contribue depuis son `apps.py`)

| App | Entité | Champs cherchés | URL pattern |
|---|---|---|---|
| documents | Document | `name`, `notes`, `ocr_text` | `/app/documents/{id}` |
| interactions | Interaction | `subject`, `description`, `notes` | `/app/interactions/{id}` |
| equipment | Equipment | `name`, `brand`, `model`, `notes` | `/app/equipment/{id}` |
| tasks | Task | `subject`, `content` | `/app/tasks/{id}` |
| projects | Project | `title`, `description` | `/app/projects/{id}` |
| zones | Zone | `name`, `note` | `/app/zones/{id}` |
| stock | StockItem | `name`, `description`, `notes`, `supplier` | `/app/stock/{id}` |
| insurance | InsuranceContract | `name`, `provider`, `coverage_summary`, `notes` | `/app/insurance/{id}` |
| directory | Contact | `first_name`, `last_name`, `notes` | `/app/directory/{id}` |
| directory | Structure | `name`, `description` | `/app/directory/structures/{id}` |

**Hors scope V1 (à ajouter à l'usage si pertinent)** :
- `Electricity` (numérique majoritaire, ouverture future)
- `Photo` (pas de texte utile)
- `ElectricityBoard.main_notes` peut s'ajouter facilement si besoin

### Pattern d'extension — exemple module futur (`livestock`)

Pour ajouter un module `apps/livestock/` (petit élevage), aucune modification de l'agent :

```python
# apps/livestock/apps.py
class LivestockConfig(AppConfig):
    name = 'livestock'

    def ready(self):
        from agent.searchables import register, SearchableSpec
        from .models import Animal
        register(SearchableSpec(
            entity_type='animal',
            model=Animal,
            search_fields=('name', 'species', 'notes', 'medical_history'),
            label_attr='name',
            url_template='/app/livestock/{id}',
        ))
```

Idem pour `apps/garden/` (potager), `apps/gite/` (gîte locatif), etc.

### Contrat du module

```python
# apps/agent/searchables.py
@dataclass(frozen=True)
class SearchableSpec:
    entity_type: str
    model: type[Model]
    search_fields: tuple[str, ...]
    label_attr: str | Callable
    url_template: str

REGISTRY: list[SearchableSpec] = []
def register(spec: SearchableSpec) -> None: REGISTRY.append(spec)

# apps/agent/retrieval.py
def search(household_id: UUID, query: str, limit: int = 20) -> list[Hit]:
    """Itère sur REGISTRY, query Postgres par modèle, merge + rank."""
    ...

@dataclass
class Hit:
    entity_type: str           # libre — tout ce qui s'enregistre
    id: UUID
    label: str
    snippet: str               # ~300 chars autour du match
    rank: float
    url_path: str
```

### Fichiers principaux

- `apps/agent/__init__.py`, `apps.py`, `searchables.py`, `retrieval.py` (nouveaux)
- `apps/agent/tests/test_retrieval.py` + `test_registry.py` (nouveaux)
- `apps/households/models.py` — ajout `preferred_language`
- `apps/households/migrations/XXXX_add_preferred_language.py` (nouveau)
- `config/settings/base.py` — ajout `INSTALLED_APPS`
- 10 fichiers `apps/<app>/apps.py` modifiés pour `register()` leurs entités (documents, interactions, equipment, tasks, projects, zones, stock, insurance, directory)

### Tâches

1. créer app `apps/agent/` (skeleton + `searchables.py` avec `SearchableSpec` + `register()`)
2. ajouter `Household.preferred_language` (CharField, choices, default `'fr'`) + migration
3. implémenter `apps/agent/retrieval.py` qui itère sur `REGISTRY` et lance un `SearchVector` par modèle
4. snippet : `SearchHeadline` Postgres ~150 chars autour du match
5. enregistrer les 10 entités V1 (Document, Interaction, Equipment, Task, Project, Zone, StockItem, InsuranceContract, Contact, Structure) chacune dans le `apps.py` de son module
6. tests pytest registry : `register()` ajoute un spec, double-register lève une erreur, REGISTRY contient les 10 attendus après boot
7. tests pytest retrieval : hit pour chaque entité, scope household, query vide → `[]`, ranking décroissant, casse/accents insensibles

### Critères de validation

- `search(my_household, "engie", 10)` retourne des hits documents pertinents avec snippet
- `search(my_household, "chaudière", 10)` retourne hits multi-entités (Equipment, Task, Document, Interaction)
- `search(other_household, "engie", 10)` retourne `[]` même si l'autre foyer a des matches
- ranking : un match dans `Document.name` rank > qu'un match perdu dans `Document.ocr_text`
- ajouter une 11ᵉ entité = 5 lignes dans son `apps.py`, zéro touche à `apps/agent/`

### Hors scope

- matérialisation d'index (lot ultérieur si latence devient un sujet)
- embeddings vectoriels (V2)
- boost récence / pertinence par type
- search global UI (le retrieval n'a pas vocation à être exposé directement à l'utilisateur en V1)

## Lot 2 — Service agent (retrieval + LLM + citations)

**Statut** : cadré, issue à créer.

### But

Module Python qui prend une question utilisateur, appelle le retrieval du lot 1, construit un prompt, appelle Claude Haiku 4.5, et renvoie une réponse + citations vérifiables. **Pas d'UI à ce stade** : la chaîne est testable via API.

### Décisions tranchées

- **Modèle** : Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), tranché en #88
- **Synchrone**, timeout 30s, pas de retry automatique
- **Lecture seule** : l'agent ne crée rien (pas de tool-calling en V1)
- **Pas de mémoire conversationnelle** (lot 4 = V2)
- **Format de citation** : `{entity_type, id, label, snippet, url_path}` côté API
- **Prompt système** : oblige Claude à citer (`<cite id="..."/>` ou marqueur similaire), à dire "je ne sais pas" si rien dans le contexte
- **Abstraction LLM** : `LLMClient` Protocol + `AnthropicClient` concret. Permet un futur `OllamaClient` (modèle local) sans toucher au reste. Voir lot 6 pour l'observabilité.
- **Logs centralisés** dans `AIUsageLog` (cf lot 6) — pas de `AgentLog` dédié, le service agent contribue à la table commune
- **Zéro appel réseau en CI** : mock systématique du client

### Architecture

```
apps/agent/
├── retrieval.py        (lot 1)
├── llm.py              # LLMClient Protocol + AnthropicClient
├── service.py          # orchestrateur ask(question, household)
├── prompts.py          # système + few-shot
├── views.py            # POST /api/agent/ask/
├── serializers.py
├── urls.py
└── tests/
    ├── test_llm.py
    ├── test_service.py
    └── test_views.py

apps/ai_usage/          # lot 6 — créé en parallèle
├── models.py           # AIUsageLog (commun à toutes les features IA)
└── ...
```

### Contrat API

**Requête** : `POST /api/agent/ask/`
```json
{ "question": "Combien j'ai payé Engie en mars ?" }
```

**Réponse** :
```json
{
  "answer": "D'après ta facture Engie du 15 mars 2026, tu as payé 142,67€...",
  "citations": [
    {
      "entity_type": "document",
      "id": "abc-123",
      "label": "Facture Engie mars 2026",
      "snippet": "...total à payer 142,67€ TTC...",
      "url_path": "/app/documents/abc-123"
    }
  ],
  "metadata": {
    "duration_ms": 2340,
    "tokens_in": 1840,
    "tokens_out": 120,
    "cost_usd": 0.0021
  }
}
```

### Tâches

1. `llm.py` — `LLMClient` Protocol + `AnthropicClient` concret + `get_llm_client()` factory selon `LLM_PROVIDER` env
2. `prompts.py` — système qui contraint citation + ignorance
3. `service.py` — `ask(question, household)` orchestrateur, écrit dans `AIUsageLog` (lot 6)
4. `views.py` + `serializers.py` — endpoint DRF
5. `urls.py` — registration sous `/api/agent/`
6. settings : `LLM_PROVIDER`, `LLM_TEXT_MODEL`, `LLM_VISION_MODEL` env vars
7. tests : retrieval vide → "je ne sais pas", retrieval rempli → réponse + citations, timeout client → 503, format de citation respecté, `AIUsageLog` créé

### Critères de validation

- POST avec question simple → réponse + ≥1 citation
- POST avec question hors-domaine → "je ne sais pas", `citations: []`
- scope household respecté (impossible de citer un doc d'un autre foyer)
- ligne `AIUsageLog` créée à chaque appel (feature='agent_ask')
- changer `LLM_PROVIDER=ollama` doit fonctionner après ajout d'un `OllamaClient` (pas en V1, mais l'archi le permet sans refacto)

### Hors scope

- streaming de réponse (V2)
- tool-calling / actions de création (V2)
- mémoire conversationnelle multi-tour (lot 4 / V2)
- redaction PII (à arbitrer plus tard, faible priorité en solo user)

## Lot 3 — Surface UI chat

**Statut** : cadré, issue à créer.

### But

Interface où l'utilisateur tape ses questions et lit les réponses, avec citations cliquables vers les entités du foyer.

### Décisions tranchées

- **Page dédiée** `/app/agent/` (pas de widget global pour V1, on verra à l'usage)
- **Pas d'historique persisté** (V1 = chaque ouverture de page = session blanche)
- **Citations cliquables** : composant `<AgentCitation>` qui résout l'URL via `entity_type` + `id`
- **Mention de confidentialité** au premier usage (acceptation localStorage)
- **i18n complet** (en, fr, de, es) dès le départ
- **Pas de streaming** (réponse arrive en bloc, loader pendant l'attente)
- **Pas de feedback 👍/👎** en V1 (à voir si on en a besoin)

### Architecture frontend

```
ui/src/features/agent/
├── AgentPage.tsx          # page principale, route /app/agent/
├── ChatBubble.tsx         # bulle question ou réponse
├── AgentCitation.tsx      # chip cliquable, résout url_path
├── PrivacyNotice.tsx      # mention confidentialité au premier usage
├── hooks.ts               # useAskAgent mutation
└── api.ts                 # askAgent(question)
```

### Tâches

1. route `/app/agent/` dans le router + entrée sidebar
2. `api.ts` + `hooks.ts` — mutation `useAskAgent`
3. `AgentPage.tsx` — input + liste de bulles + loader
4. `ChatBubble.tsx` — variante user / agent
5. `AgentCitation.tsx` — badge cliquable, mapping `entity_type` → URL
6. `PrivacyNotice.tsx` — modale au premier usage, acceptation persistée localStorage
7. clés i18n dans les 4 locales (placeholder input, loader, no_results, privacy notice)
8. E2E Playwright : poser une question (mock backend), vérifier bulle + citation cliquable

### Critères de validation

- naviguer vers `/app/agent/`, voir la mention de confidentialité au premier usage
- taper une question → bulle question + loader → bulle réponse avec citations
- click sur citation → ouvre `/app/documents/...` ou `/app/equipment/...` selon `entity_type`
- en réponse "je ne sais pas" → message clair, pas de citation factice
- 4 langues OK (texte d'interface)

### Hors scope

- conversation multi-tour (lot 4)
- copier/exporter une réponse
- feedback utilisateur
- raccourci global `/`

## Lot 4 — Mémoire conversationnelle (V2 — exclu de la V1)

**Statut** : **basculé V2**. Décision : ne pas livrer en V1, valider l'usage en mode "questions one-shot" d'abord.

### But (V2)

Permettre de retrouver les conversations passées et de continuer un fil.

### Pistes pour V2

- modèles `AgentConversation` (household, créé par, titre auto, last_message_at) et `AgentMessage` (conversation, role, content, citations, metadata)
- liste des conversations dans la sidebar de la page agent
- nettoyage automatique au-delà d'une rétention donnée
- streaming de réponse

## Lot 5 — Tests et validation

### But

Sécuriser la chaîne complète sans multiplier les tests fragiles à un appel LLM.

### Tâches

1. tests unitaires sur le retrieval (lot 1)
2. tests unitaires sur le service agent avec client Anthropic mocké (lot 2)
3. tests d'intégration sur l'endpoint chat (lot 2 + 3)
4. tests E2E Playwright sur la surface UI (lot 3) — au moins un golden path
5. recette manuelle bout en bout avec la liste de validation de la doc produit

## Lot 6 — Observabilité IA (AI Usage Logging + UI)

**Statut** : cadré, issue à créer. Livrable en parallèle des lots 2/3.

### But

Donner de la visibilité sur **l'usage** des features IA (OCR Vision, agent, futurs embeddings) — pas le coût brut, mais la qualité de l'usage : combien d'appels, latence, taux d'échec, latence p95, taux de réponses "je ne sais pas".

### Décisions tranchées

- **app dédiée `apps/ai_usage/`** (pas de fragmentation entre `AgentLog` / `OCRLog` / etc.)
- **table unique `AIUsageLog`** consommée par toutes les features IA
- **logging à la source** : chaque appel `LLMClient.complete()` ou `LLMClient.vision_extract()` écrit une ligne
- **page admin dédiée** `/app/admin/ai-usage/` (visible owners only)
- **alertes "qualité usage"** affichées dans l'UI (taux de "je ne sais pas" > 30%, latence p95 > 10s)
- **pas de seuil $$** (cf décision : ne pas raisonner en coût)
- pas d'export, pas d'API publique en V1

### Modèle

```python
class AIUsageLog(models.Model):
    id = UUIDField
    household = FK(Household, related_name='ai_usage_logs')
    user = FK(User, null=True)               # qui a déclenché (null = batch/system)
    feature = CharField(max_length=64)       # 'ocr_upload', 'ocr_backfill', 'ocr_pdf_pages', 'agent_ask', ...
    provider = CharField(max_length=32)      # 'anthropic', 'ollama', ...
    model = CharField(max_length=64)         # 'claude-haiku-4-5', 'llava:7b', ...
    input_tokens = IntegerField(null=True)
    output_tokens = IntegerField(null=True)
    duration_ms = IntegerField
    success = BooleanField
    error_type = CharField(max_length=64, null=True, blank=True)
    metadata = JSONField(default=dict)       # libre, par feature : {answer_was_unknown: True, ...}
    created_at = DateTimeField(auto_now_add=True, db_index=True)
```

### Architecture

```
apps/ai_usage/
├── models.py          # AIUsageLog
├── services.py        # log_ai_usage(...) — helper appelé partout
├── aggregations.py    # KPIs (compte par jour, p95, taux d'échec)
├── views.py           # API admin /api/ai-usage/
├── serializers.py
├── urls.py
└── tests/

ui/src/features/ai-usage/
├── AIUsagePage.tsx          # /app/admin/ai-usage/
├── KpiCards.tsx
├── UsageHistogram.tsx
├── RecentCallsTable.tsx
└── hooks.ts
```

### Tâches backend

1. créer `apps/ai_usage/`, modèle `AIUsageLog`, migration
2. `services.log_ai_usage(...)` — helper utilisé par toutes les features
3. wire au `LLMClient` (lot 2) — chaque méthode écrit un log
4. wire à `extract_documents_text` et au pipeline upload OCR (refacto pour passer par `LLMClient.vision_extract()` aussi)
5. `aggregations.py` — KPIs sur 24h / 7j / 30j / all-time
6. API admin `GET /api/ai-usage/{summary,recent,histogram}/` (permission : owner)
7. tests : log créé par chaque feature, agrégations correctes, scope household respecté

### Tâches frontend

1. page React `/app/admin/ai-usage/` (route protégée owners)
2. `KpiCards` : appels 24h/7j/30j, latence p95, taux d'erreur
3. `UsageHistogram` : barres empilées par jour, par feature
4. `RecentCallsTable` : 50 derniers appels avec filtres feature/période
5. badges d'alerte qualité (UI uniquement, pas d'email V1)
6. clés i18n 4 langues
7. E2E Playwright — au moins le golden path

### Critères de validation

- chaque appel Vision (upload, backfill, agent_ask) crée une ligne `AIUsageLog`
- la page `/app/admin/ai-usage/` montre des chiffres cohérents avec le réel
- non-owners ne peuvent ni voir l'API ni la page UI
- ajouter une feature IA = 1 appel à `log_ai_usage(...)`, pas de schéma à modifier
- aucun appel réseau IA en CI

### Hors scope

- email/push si seuil franchi
- export CSV
- comparaison provider A vs B (V2 — quand on aura un `OllamaClient`)
- visualisation par utilisateur individuel

## Ordre recommandé d'implémentation

1. ✅ Lot 0a — Pipeline OCR à l'upload (#88)
2. ✅ Lot 0b — Backfill OCR (#89)
3. **Lot 1 — Recherche full-text naïve**
4. **Lot 2 — Service agent** (pose `LLMClient` + écrit dans `AIUsageLog`)
5. **Lot 6 — AI Usage Logging + UI** (en parallèle de lot 2/3, refacto OCR existant pour aussi loguer)
6. **Lot 3 — Surface UI chat**
7. **→ recette manuelle utilisateur** : tu utilises l'agent pendant 1-2 semaines, tu repères ce qui craque
8. Itérer sur le maillon faible (souvent : retrieval, prompt, ou format de citation)
9. Lot 4 (mémoire) — V2, si l'usage le demande

Lot 5 (tests) est transversal : pas un lot séquentiel, chaque PR des lots 1-3-6 livre ses tests.

## Découpage en sessions de travail

### Session 1 (faite)

- Lot 0a (#88)

### Session 2 (faite)

- Lot 0b (#89)

### Session 3 — prochaine

- Lot 1 (retrieval naïf)
- début Lot 2 (service agent + endpoint)

### Session 4

- fin Lot 2
- Lot 3 (UI chat)

### Session 5

- recette manuelle + ajustements
- premiers retours produit

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
