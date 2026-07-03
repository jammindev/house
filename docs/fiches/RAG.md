# RAG — Retrieval-Augmented Generation dans house

> Concept fondateur du **parcours 07** (agent conversationnel). Cette fiche explique le RAG, la version "naïve" qu'on implémente en V1, et comment on l'a câblé dans `house`.

## 1. Le problème

Tu veux poser des questions en langage naturel sur la mémoire de ton foyer :

- *"Combien j'ai payé d'électricité en mars 2026 ?"*
- *"Quand est-ce que j'ai changé les filtres VMC pour la dernière fois ?"*
- *"Quel est le modèle de ma chaudière ?"*

Un LLM seul (Claude, GPT…) ne sait **rien** de tes données. Il a été entraîné sur Internet, pas sur tes factures Engie. Trois options pour lui apprendre tes données :

1. **Fine-tuning** : ré-entraîner le modèle sur ton corpus. Cher, fige le modèle, devient obsolète à chaque nouvelle facture.
2. **Tout coller dans le prompt** : envoyer toute ta base à chaque question. Marche jusqu'à quelques milliers de docs. Au-delà, coût et latence explosent, et les LLM se perdent dans 200k tokens.
3. **RAG** : à chaque question, **chercher** les passages pertinents dans tes données, **injecter** uniquement ces passages dans le prompt. Le LLM répond avec un contexte sur mesure.

C'est cette troisième option, le RAG, qu'on implémente. C'est le pattern dominant en 2026 pour faire parler un LLM de tes données.

## 2. Le concept en deux phrases

> Le RAG, c'est *récupérer les bons passages* (retrieval) puis *demander au LLM de répondre en s'appuyant dessus* (generation). On augmente la connaissance du modèle au moment de la question, pas au moment de l'entraînement.

## 3. Les 5 étapes d'un RAG

```
[Tes données]               [Question utilisateur]
     │                              │
     ▼                              ▼
[1. Indexation]            [2. Retrieval]
   tsvector                   SearchVector(query)
     │                              │
     └──────────────┬───────────────┘
                    ▼
            [3. Augmentation]
        prompt = système + hits + question
                    ▼
            [4. Generation]
              Claude Haiku
                    ▼
            [5. Citation]
       réponse + références cliquables
```

| # | Étape | Rôle | Dans `house` |
|---|---|---|---|
| 1 | **Indexation** | Préparer les données à être cherchées (OCR sur images/PDF, normalisation) | OCR au upload (lot 0a #88) + backfill (lot 0b #89) |
| 2 | **Retrieval** | Récupérer les passages pertinents pour une question donnée | `apps/agent/retrieval.py` (lot 1 #100) |
| 3 | **Augmentation** | Construire un prompt qui contient la question + les hits du retrieval | `apps/agent/prompts.py` (lot 2 #101) |
| 4 | **Generation** | Appeler le LLM, parser la réponse | `apps/agent/client.py` + `service.py` (lot 2 #101) |
| 5 | **Citation** | Tracer la réponse à ses sources, exposer les liens | API + `<AgentCitation>` UI (lots 2 et 3) |

## 4. Comment on l'a appliqué dans `house`

> **Évolution 2026-07 (lot 7, function calling)** — Le RAG « pipeline figé »
> décrit ci-dessous (retrieval systématique **avant** l'appel LLM) a été
> transformé en **boucle tool-use** : le retrieval est devenu un *tool*
> (`search_household`) que le modèle appelle **quand il en a besoin**. Les 5
> étapes ci-dessous restent exactes, mais elles s'exécutent désormais **dans le
> corps du tool** au lieu d'être câblées avant chaque réponse. Conséquence : le
> modèle répond directement au dialogue (« bonjour ») et à la culture générale
> sans recherche, et n'appelle le retrieval que pour un fait du foyer. Un 2ᵉ tool
> `get_entity(entity_type, id)` lit le **contenu complet** d'une entité (ex : tout
> l'OCR d'une facture) quand le snippet tronqué de la recherche ne suffit pas. Un
> 3ᵉ tool `get_related(entity_type, id)` charge **tout ce qui est lié** à une
> entité (les documents, dépenses, tâches et zones d'un projet), chacun renvoyé
> comme un Hit citable — pour le scénario « montre-moi tout sur ce projet ». Les
> relations sont déclarées par chaque app via le champ optionnel
> `SearchableSpec.related` (même esprit registry, aucun hardcode dans l'agent).
> Détails : [PARCOURS_07_LOT7_FUNCTION_CALLING.md](../parcours/PARCOURS_07_LOT7_FUNCTION_CALLING.md).

### 4.1 Indexation (étape 1) — OCR avant tout

Avant de pouvoir chercher dans une facture papier, il faut en extraire le texte. C'est ce qu'on a fait en lots 0a et 0b :

- **Lot 0a (#88)** : à l'upload d'un document (image / PDF / HEIC), pipeline qui :
  1. valide / convertit (HEIC → JPEG)
  2. resize si > 2000px (économise des tokens Vision)
  3. extrait le texte : Claude Haiku Vision pour images, `pypdf` pour PDFs texte
  4. stocke dans `Document.ocr_text`
- **Lot 0b (#89)** : management command `python manage.py extract_documents_text` pour rattraper l'historique (Supabase + uploads pré-#88) + bouton "Re-extraire" sur la fiche document.

### 4.2 Retrieval (étape 2) — Postgres full-text + registry pattern

Le retrieval c'est **trouver les bons passages** parmi les milliers d'entités du foyer.

#### Le choix : full-text Postgres vs embeddings vectoriels

| | Full-text (`tsvector`) | Embeddings (`pgvector`) |
|---|---|---|
| **Comment** | Tokenise le texte, match exact/stemming | Représente le texte comme un vecteur sémantique |
| **Exemple** | "facture engie" matche "factures Engie" mais pas "bill from Engie" | "voiture" matche "automobile" car proches sémantiquement |
| **Latence** | qq ms | 50-200ms (computer l'embedding de la question) |
| **Coût** | gratuit | API embedding ($0.02/M tokens) |
| **Setup** | natif Postgres | extension `pgvector` + pipeline d'indexation continu |
| **Gain** | excellent sur petit volume avec mots-clés clairs | excellent sur grand volume + recherches vagues |

**Décision V1** : full-text. **Pourquoi** :

- volume modeste (foyer = milliers d'entités, pas millions)
- les questions du foyer ont des mots-clés clairs (Engie, chaudière, mars 2026…)
- on ne saura ce qui craque qu'à l'usage : pas la peine d'investir dans pgvector avant d'avoir touché les limites du full-text
- migration vers embeddings reste possible plus tard, sans réécrire l'API agent

#### Le pattern registry — extensible par construction

Hardcoder la liste des modèles cherchables dans `retrieval.py` = inscrire le problème dans le code. Tu veux pouvoir ajouter `apps/livestock/`, `apps/garden/`, `apps/gite/` plus tard sans toucher à l'agent.

```python
# apps/agent/searchables.py
@dataclass(frozen=True)
class SearchableSpec:
    entity_type: str                  # 'task', 'document', 'animal'…
    model: type[Model]
    search_fields: tuple[str, ...]    # ('subject', 'content')
    label_attr: str                   # ou Callable
    url_template: str                 # '/app/tasks/{id}'

REGISTRY: list[SearchableSpec] = []

def register(spec: SearchableSpec) -> None:
    REGISTRY.append(spec)
```

Chaque app contribue ses entités dans son `apps.py.ready()` :

```python
# apps/tasks/apps.py
class TasksConfig(AppConfig):
    name = 'tasks'
    def ready(self):
        from agent.searchables import register, SearchableSpec
        from .models import Task
        register(SearchableSpec(
            entity_type='task',
            model=Task,
            search_fields=('subject', 'content'),
            label_attr='subject',
            url_template='/app/tasks/{id}',
        ))
```

`retrieval.search()` itère sur `REGISTRY`, lance un `SearchVector` par modèle, merge les hits, trie par rang Postgres, retourne le top-N.

#### Entités enregistrées en V1

10 entités, qui couvrent toute la mémoire textuelle du foyer :

| App | Entité | Pourquoi indexer |
|---|---|---|
| documents | `Document` | factures, manuels, contrats, leur OCR |
| interactions | `Interaction` | journal d'événements, notes |
| equipment | `Equipment` | équipements maison, marques, notes maintenance |
| tasks | `Task` | tâches en cours / closes |
| projects | `Project` | projets foyer |
| zones | `Zone` | pièces, surfaces, notes par zone |
| stock | `StockItem` | inventaire, fournisseurs, notes |
| insurance | `InsuranceContract` | contrats, garanties, fournisseurs |
| directory | `Contact` | personnes (plombier, médecin…) |
| directory | `Structure` | entreprises, organismes |

**Pas indexé V1** : `Electricity*` (numérique majoritaire), `Photo` (pas de texte). Ajout trivial plus tard si besoin.

#### Multi-tenant ready : `config='simple_unaccent'`

Postgres `to_tsvector` prend une **config de langue** qui détermine stemming et stopwords. `'french'` sait que "manger / mangé / mangerait" partagent une racine. `'english'` fait pareil pour "eat / eating / ate".

**Choix V1** : `config='simple_unaccent'` — copie de `simple` (pas de stemming, pas de stopwords) augmentée de l'extension `unaccent` pour matcher café/cafe et Engie/ENGIE. Marche dans n'importe quelle langue sans hypothèse.

L'extension et la config TS sont créées dans `apps/agent/migrations/0001_initial.py`.

**Pourquoi pas `'french'` directement** : le projet doit rester multi-tenant ready (tu pourrais ouvrir l'app à des utilisateurs DE/EN un jour). Hardcoder `'french'` = se peindre dans un coin et nécessiter une migration future.

**Trade-off** : on perd le stemming. "facture" ne matche pas "factures" sans le stemming FR. Sur le volume V1, c'est acceptable.

**Plan futur — activer le stemming par foyer** : un champ placeholder `Household.preferred_language` est ajouté en V1 (default `'fr'`, choices `fr/en/de/es`) sans être utilisé. Le jour où le retrieval rate à cause des conjugaisons / accords, on l'active. Étapes concrètes :

1. **Créer une config TS par langue** dans une nouvelle migration agent : `french_unaccent`, `english_unaccent`, `german_unaccent`, `spanish_unaccent` (copie de la config Postgres `french`/`english`/… + mapping `unaccent`).
2. **Exposer le champ** dans `HouseholdSerializer` + un select dans la page paramètres du foyer (UI).
3. **Switcher dans `apps/agent/retrieval.py`** : remplacer la constante `_SEARCH_CONFIG` par un lookup `{'fr': 'french_unaccent', 'en': 'english_unaccent', …}.get(household.preferred_language, 'simple_unaccent')` passé à chaque `SearchVector` / `SearchQuery` / `SearchHeadline`.

Pas de migration de données nécessaire — le champ est déjà rempli par défaut.

#### Ranking : pondération de champ + normalisation par longueur

`ts_rank` brut récompense la **fréquence** d'un terme : un long document dont l'OCR répète « pompe à chaleur » 20× score ~0.98, alors qu'un projet dont le **titre est exactement la requête** score ~0.27 — et se fait éjecter du top-12. C'est le défaut classique de `ts_rank` sans réglage. Deux leviers dans `apps/agent/retrieval.py` corrigent ça :

1. **Pondération de champ (`setweight`)** — `_vector_for_fields` donne au premier `search_field` (le titre/nom, par convention toujours en tête et égal à `label_attr`) le poids **A**, aux autres champs le poids **B**. Un match dans le titre pèse plus qu'un match noyé dans un corps.
2. **Normalisation par longueur** — `SearchRank(..., normalization=Value(1))` divise le rank par `1 + log(longueur)`, ce qui pénalise les longs documents. Constante `_RANK_NORMALIZATION`.

Effet mesuré sur la donnée prod (« pompe à chaleur ») : le projet passe de la **position 20/21 → 3/21**, devant les PDF. Aucun changement d'interface — `search_multi()` renvoie toujours `list[Hit]`, seul le calcul interne du `rank` change.

### 4.3 Augmentation (étape 3) — construire le prompt

Une fois les hits récupérés, on construit un prompt :

```
[Système]
Tu es un assistant qui répond uniquement à partir des informations
fournies ci-dessous. Cite tes sources avec la balise <cite id="..."/>.
Si l'information n'est pas dans le contexte, dis "Je ne sais pas".

[Contexte]
1. [DOCUMENT id=abc-123 label="Facture Engie mars 2026"]
   ...total à payer 142,67€ TTC échéance 02/04/2026...

2. [INTERACTION id=def-456 label="Note du 14/03/2026"]
   Reçu facture Engie 142,67€...

[Question utilisateur]
Combien j'ai payé d'électricité en mars 2026 ?
```

Claude répond en s'appuyant **uniquement** sur ce contexte. C'est ce qui distingue le RAG du LLM seul : on contraint le modèle à ne pas halluciner.

### 4.4 Generation (étape 4) — Claude Haiku 4.5

Choix tranché en #88 : **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`).

**Pourquoi Haiku** : modèle "petit-rapide-pas-cher" d'Anthropic, parfait pour les cas où on injecte beaucoup de contexte et où on veut une réponse en < 3s. Sonnet est meilleur sur du raisonnement complexe mais 5× plus cher.

**Coût indicatif** : ~$0.001 par question pour ~2k tokens de contexte + 200 tokens de réponse. Tu peux poser 1000 questions pour $1.

### 4.5 Citation (étape 5) — réponse traçable

L'API agent renvoie :

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
  ]
}
```

L'UI (lot 3) affiche chaque citation comme un chip cliquable qui te ramène à l'entité d'origine. **Aucune réponse sans citation vérifiable** : c'est le filet de sécurité contre l'hallucination.

## 5. Pourquoi cette implémentation

### "Naïf-first vertical slice"

Plutôt que viser un retrieval parfait avant de toucher au LLM, on livre la chaîne complète avec chaque maillon faible, puis on renforce celui qui craque vraiment.

| Approche académique | Notre approche |
|---|---|
| Retrieval optimal (embeddings + reranking + boost récence + …) avant de toucher au LLM | Retrieval naïf, voir ce qui rate, renforcer |
| 3-4 sessions de polish sur le retrieval | 1 session, on passe au LLM |
| Découvre les vrais problèmes au moment d'intégrer | Découvre les problèmes en utilisant l'agent |

**Pourquoi ça marche pour `house`** :
- volume modeste (Claude Haiku a 200k tokens de contexte, on peut spammer)
- usage solo en V1 = on accepte des bugs et on itère
- on ne peut pas savoir ce qui rate avant d'avoir vu Claude répondre sur de vraies données

### Décisions clés

| Décision | Raison |
|---|---|
| Full-text Postgres en V1, pas embeddings | volume modeste, mots-clés clairs, gain marginal |
| `config='simple'` | multi-tenant safe, pas de hardcode `'french'` |
| Pattern registry (chaque app déclare ses entités) | ajout d'un module = 5 lignes, jamais toucher à l'agent |
| Claude Haiku 4.5 | rapide, pas cher, suffisant pour ce volume de contexte |
| Synchrone, pas de Celery | latence acceptable (2-5s), pas de complexité ops |
| Pas de mémoire conversationnelle V1 | on validera l'usage en mode question one-shot d'abord |
| Lecture seule | l'agent ne crée rien (pas de tool-calling V1) |

## 6. Ce qu'on a écarté et pourquoi

| Idée | Pourquoi écartée en V1 |
|---|---|
| **Embeddings vectoriels** (`pgvector`) | Sur < 100k entités texte modeste, gain marginal. Migration possible plus tard sans réécrire l'API. |
| **Index `tsvector` matérialisé** | Pas nécessaire à ce volume. Si latence devient un sujet → optimisation locale. |
| **Streaming de réponse** | Complexité UI + back. Bloc en V1 suffit. |
| **Tool-calling** (agent qui crée des tâches, etc.) | ~~Périmètre énorme + risque d'erreurs côté écriture. V2.~~ **Livré** : lecture au lot 7 (3 tools), écriture au lot 8 (`create_entity`, tâche). |
| **Mémoire conversationnelle multi-tour** | Lot 4 du backlog, basculé V2. Question one-shot couvre 95% des cas. |
| **Détection de langue par document** | Trop tôt. Sur ton corpus, un seul document EN/DE par-ci par-là, pas de quoi justifier le pipeline. |
| **Redaction PII avant envoi à Claude** | Faible priorité en solo user. À reconsidérer si ouverture multi-tenant. |
| **Feedback utilisateur 👍/👎** | Pas en V1. Ajouter si on voit que la qualité varie beaucoup. |
| **Widget global (raccourci `/`)** | Page dédiée d'abord, widget si l'usage le demande. |

## 7. Règle pour la suite — ⚠️ important

**Tout nouveau modèle Django à contenu textuel doit être enregistré dans `apps/agent/searchables.py`** via le registry. Sinon il sera invisible pour l'agent.

```python
# Dans apps/<nouvelle_app>/apps.py
class MyAppConfig(AppConfig):
    name = 'my_app'
    def ready(self):
        from agent.searchables import register, SearchableSpec
        from .models import MyEntity
        register(SearchableSpec(
            entity_type='my_entity',
            model=MyEntity,
            search_fields=('name', 'description', 'notes'),
            label_attr='name',
            url_template='/app/my_app/{id}',
        ))
```

**Cas limites** :
- modèle purement numérique / sans champ textuel → ne pas enregistrer, mentionner explicitement le choix dans la PR
- modèle techniques (logs, audit, M2M through) → ne pas enregistrer

Cette règle est aussi sauvée en mémoire pour l'assistant Claude Code, qui doit le proposer proactivement à chaque ajout de modèle.

## 7bis. Conversation ancrée sur une entité (contexte pré-injecté)

Le RAG « classique » ci-dessus est **pull** : le modèle décide quand appeler
`search_household` pour aller chercher les passages pertinents. Depuis 2026-07,
une conversation peut aussi être **ancrée** sur une entité précise (un projet,
une zone, un équipement…) — le contexte est alors **poussé** dès le départ.

**Idée.** Une `agent.AgentConversation` porte un couple optionnel
`(context_entity_type, context_object_id)` — le même vocabulaire d'adressage que
les tools (`entity_type:id`). Quand il est présent, à chaque `ask` :

1. `agent.context.build_entity_context()` résout l'entité, prend son contenu
   complet (comme `get_entity`) **plus** tout ce qui lui est lié via
   `spec.related` (comme `get_related`), et rend le tout en bloc citable
   (`render_context_block`) ;
2. `service.ask()` injecte ce bloc comme **premier tour** de la conversation
   (`[CONTEXT — <label>]` + accusé assistant), et **seed** ces hits dans le pool
   de citations (le modèle peut donc les citer sans les avoir cherchés) ;
3. le system prompt reçoit un addendum (`ANCHORED_ADDENDUM`) : « le contexte de
   l'élément courant est déjà fourni, réponds et cite directement sans chercher ;
   n'utilise les tools que pour des infos hors de ce contexte ».

Le contexte est ré-injecté **à chaque tour** : il reste frais si le projet évolue
(borné par les budgets `RELATED_*`).

**Générique par construction.** Aucune de ces étapes ne connaît « project » :
toute entité enregistrée dans `agent.searchables` (idéalement avec un `related`)
peut ancrer une conversation. Réutilisation ailleurs = zéro ligne dans
`apps/agent/`, juste un `<EntityAssistant entityType="…" objectId="…" />` côté UI.
Voir `docs/MODULES/agent.md` pour le mode d'emploi.

**Pull vs push, quand quoi ?**

| | Pull (`/app/agent`) | Push (onglet Assistant d'une entité) |
|---|---|---|
| Contexte | rien au départ, cherché à la demande | tout l'objet + ses liens, dès le 1er tour |
| Bon pour | questions transverses au foyer | « fais le point sur CE projet » |
| Tools | tous, décidés par le modèle | idem + contexte déjà là, cite sans chercher |

## 8. Glossaire

| Terme | Sens |
|---|---|
| **RAG** | Retrieval-Augmented Generation : pattern qui combine un moteur de recherche et un LLM |
| **Retrieval** | l'étape "chercher les bons passages" |
| **Generation** | l'étape "le LLM produit la réponse" |
| **Embedding** | représentation vectorielle d'un texte (~768 ou ~1536 floats) qui capture sa sémantique |
| **`tsvector`** | type Postgres qui pré-tokenise un texte pour la recherche full-text |
| **`SearchVector`** | wrapper Django ORM autour de `tsvector` |
| **`SearchQuery`** | wrapper Django ORM pour la requête utilisateur |
| **`SearchRank`** | score Postgres entre une `SearchQuery` et un `SearchVector` |
| **`SearchHeadline`** | extrait Postgres ~150 chars autour du match (pour le snippet) |
| **Stemming** | réduire un mot à sa racine ("mangeait" → "mang") pour matcher les variantes |
| **Stopwords** | mots ignorés à l'indexation ("le", "la", "the", "a"…) |
| **Citation** | référence cliquable vers la source d'une affirmation produite par le LLM |
| **Hallucination** | quand un LLM invente une info qui n'existe pas. Le RAG + citations contraignent le LLM à ne dire que ce qui est dans le contexte. |
| **Tool-calling** | quand un LLM peut invoquer des fonctions. Dans house : 3 tools de lecture (lot 7) + `create_entity` en écriture (lot 8). |

## 9. Pour aller plus loin

- [Postgres Text Search](https://www.postgresql.org/docs/current/textsearch.html) — la doc officielle, dense mais essentielle
- [Django `django.contrib.postgres.search`](https://docs.djangoproject.com/en/5.0/ref/contrib/postgres/search/) — API ORM
- [Anthropic — Claude API](https://docs.anthropic.com/en/api) — référence du SDK utilisé
- [Anthropic Cookbook — RAG](https://github.com/anthropics/anthropic-cookbook) — exemples de patterns RAG avec Claude
- [pgvector](https://github.com/pgvector/pgvector) — pour quand on passera aux embeddings (V2 potentielle)
- Backlog technique du parcours : [docs/parcours/PARCOURS_07_BACKLOG_TECHNIQUE.md](../../docs/parcours/PARCOURS_07_BACKLOG_TECHNIQUE.md)
- Doc produit du parcours : [docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md](../../docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md)
