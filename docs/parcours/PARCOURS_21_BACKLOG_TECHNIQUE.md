# Parcours 21 — Backlog technique : recherche sémantique hybride

> **État au 2026-07-21** — Chantier **cadré, non démarré**. Doc produit et fiche
> concept écrites, issues GitHub ouvertes. Ordre d'implémentation : lot 0 → 1 → 2
> → 3 → 4, le lot 5 étant un backlog d'idées V2.

Doc produit : [PARCOURS_21_RECHERCHE_SEMANTIQUE_HYBRIDE.md](./PARCOURS_21_RECHERCHE_SEMANTIQUE_HYBRIDE.md)
Fiche concept (le cours) : [docs/fiches/EMBEDDINGS.md](../fiches/EMBEDDINGS.md)
Socle dont on hérite : [PARCOURS_07_BACKLOG_TECHNIQUE.md](./PARCOURS_07_BACKLOG_TECHNIQUE.md)

## Tableau de bord

| Lot | Sujet | Statut | Issue |
|---|---|---|---|
| 0 | Socle pgvector + abstraction `EmbeddingClient` (Voyage `voyage-3`) | ✅ Livré (PR #333) | #327 |
| 1 | Modèle `EmbeddingChunk` + chunking + indexation write-time | ✅ Livré (PR #334) | #328 |
| 2 | Backfill par management command (`backfill_embeddings`) | ✅ Livré (PR #335) | #329 |
| 3 | Retrieval hybride (full-text + vecteur, fusion RRF) + flag | ✅ Livré (PR #336) | #330 |
| 4 | Observabilité (`AIUsageLog` feature `embed`) + harnais d'évaluation | 🚧 En PR | #331 |
| 5 | Idées V2 (reranking, index HNSW, chunking sémantique) | 💡 Idée | #332 |

## Philosophie d'implémentation

Même approche « vertical slice » qu'au parcours 07 : livrer la chaîne complète
avec chaque maillon dans sa version la plus simple qui marche, puis renforcer
celui qui craque **une fois mesuré**.

- **Hybride, pas remplacement** : on ajoute une jambe sémantique **à côté** du
  full-text, jamais à la place (cf. EMBEDDINGS.md §3.4 et §4.3).
- **Interface stable** : `retrieval.search()` garde sa signature et son type de
  retour (`list[Hit]`). Tout `apps/agent/` est transparent au changement.
- **Fournisseur ouvert** : `EmbeddingClient` abstrait Ollama/Voyage/OpenAI ; on
  tranche par l'éval (lot 4), pas à l'aveugle.
- **Réversible** : un flag `AGENT_HYBRID_RETRIEVAL_ENABLED` permet le rollback
  instantané vers le full-text seul en prod.
- **Pas d'appel réseau IA en CI** : mock systématique de `EmbeddingClient`
  (invariant hérité du parcours 07).

## Décisions de cadrage (toutes tranchées)

- **hybride** full-text + vecteur, **fusion RRF** (rang, pas scores bruts) ;
- **pgvector** dans la base existante, **pas** de base vectorielle dédiée ;
- **`EmbeddingClient` Protocol** + factory `get_embedding_client()` sur
  `EMBEDDING_PROVIDER` (miroir de `LLMClient`) ; **fournisseur tranché : API Voyage
  AI**, modèle **`voyage-3`** (multilingue, 1024 dims) — le VPS 4 Go ne peut pas
  héberger un modèle local sans risquer l'OOM sur l'app. `OllamaEmbeddingClient`
  reste implémenté et branchable (cible RAM ≥ 8 Go, `EMBEDDING_PROVIDER=ollama`) ;
- **table `EmbeddingChunk` dédiée** (FK polymorphe) + **chunking** fenêtre fixe +
  overlap ; le registry `agent.searchables` reste la source de vérité ;
- **pas d'index HNSW en V1** (scan exact suffisant au volume foyer) ;
- **backfill manuel** par management command (`--dry-run`, `--force`, coût
  estimé) — pas de re-embed automatique ;
- **observabilité** : chaque embedding logue dans `AIUsageLog` (feature `embed`) ;
- **scope household systématique** sur toute recherche vectorielle (invariant).

---

## Lot 0 — Socle pgvector + abstraction `EmbeddingClient`

**Statut** : ⬜ À faire.

### But

Poser les fondations sans encore rien indexer ni chercher : l'extension pgvector,
l'abstraction fournisseur d'embeddings, les settings, le logging `AIUsageLog`.
À la fin du lot, on sait produire un vecteur pour un texte et le logger — rien de
plus.

### Décisions tranchées

- extension pgvector activée par **migration** (`VectorExtension`), calquée sur
  `UnaccentExtension` d'`apps/agent/migrations/0001_initial.py` ;
- `EmbeddingClient` **Protocol** dans `apps/agent/embeddings.py` (miroir de
  `apps/agent/llm.py`) ; méthode `embed(texts: list[str]) -> list[list[float]]`
  (batch : embedder N chunks en un appel) + `embed_query(text) -> list[float]` ;
- factory `get_embedding_client(provider=None)` keyed sur `EMBEDDING_PROVIDER` ;
- clients concrets : `VoyageEmbeddingClient` (**celui qu'on utilise**, API Voyage
  `voyage-3`, clé `VOYAGE_API_KEY`) ; `OllamaEmbeddingClient` **implémenté aussi**
  (API `/api/embeddings` en `httpx`) pour la bascule local future ;
  `OpenAIEmbeddingClient` en stub branchable optionnel ;
- chaque appel logue dans `AIUsageLog` via `log_ai_usage(feature='embed', …)`
  (dimensions, nb de chunks, tokens si le provider les renvoie) ;
- settings : `EMBEDDING_PROVIDER` (défaut **`voyage`**), `EMBEDDING_MODEL` (défaut
  **`voyage-3`**), `EMBEDDING_DIMENSIONS` (défaut **1024**), `VOYAGE_API_KEY` ;
  `EMBEDDING_BASE_URL` (Ollama, défaut `http://localhost:11434`) pour la cible local.

### Fichiers principaux

- `apps/agent/embeddings.py` (nouveau) — Protocol + clients + factory
- `apps/agent/migrations/XXXX_pgvector_extension.py` (nouveau)
- `config/settings/base.py`, `local.py`, `production.py` — settings `EMBEDDING_*`
- `requirements/base.txt` — `pgvector` (binding Django/psycopg) + `voyageai` (SDK
  Voyage). Ollama reste appelé en HTTP via `httpx` (déjà présent), pas de SDK
- **prérequis ops (prod)** : `VOYAGE_API_KEY` dans le `.env` de prod,
  `EMBEDDING_PROVIDER=voyage`. **Aucun conteneur ajouté** au
  `docker-compose.prod.yml`. (Cible local future : ajouter un service `ollama` +
  `ollama pull bge-m3` quand la RAM ≥ 8 Go — voir fiche EMBEDDINGS §6.3.)
- `apps/agent/tests/test_embeddings.py` (nouveau) — client mocké, factory,
  logging

### Tâches

1. ajouter `pgvector` (+ éventuel SDK provider) à `requirements/base.txt`
2. migration `VectorExtension()` (create extension `vector`)
3. `embeddings.py` : `EmbeddingClient` Protocol, `EmbeddingResponse` dataclass,
   `OllamaEmbeddingClient` concret, stubs `Voyage`/`OpenAI`, `get_embedding_client()`
4. wire `log_ai_usage(feature='embed', provider, model, …)` dans chaque `embed*`
5. settings `EMBEDDING_*` (base + local + production) avec `env(...)`
6. tests : factory renvoie le bon client selon settings, `embed` batch mocké,
   `AIUsageLog` créé, erreur provider → `EmbeddingError` (pas de crash appelant)

### Critères de validation

- `get_embedding_client().embed(["pompe à chaleur"])` renvoie un vecteur de la
  dimension attendue (`EMBEDDING_DIMENSIONS`)
- une ligne `AIUsageLog(feature='embed')` est créée par appel
- changer `EMBEDDING_PROVIDER` change le client sans toucher les appelants
- zéro appel réseau en CI (client mocké)

### Hors scope

- toute indexation (lot 1) ; tout retrieval (lot 3)

---

## Lot 1 — Modèle `EmbeddingChunk` + chunking + indexation write-time

**Statut** : ⬜ À faire.

### But

Découper le texte des entités searchables en chunks, les embedder, et les stocker
dans une table d'index. Maintenir cet index **à l'écriture** de l'entité source.

### Décisions tranchées

- **modèle `EmbeddingChunk`** (`HouseholdScopedModel`) :
  - FK polymorphe `(source_content_type, source_object_id)` + `GenericForeignKey`
    (même pattern que `Interaction.source`) → n'importe quelle entité source,
    zéro migration par type ;
  - `entity_type` (str, dénormalisé depuis le spec — pour filtrer/citer sans join) ;
  - `chunk_index` (int, position dans la source) ;
  - `content` (text du chunk) ;
  - `embedding` (`VectorField(dimensions=…)`) ;
  - `model` (str — quel modèle a produit ce vecteur, pour détecter l'obsolescence) ;
  - `content_hash` (str — hash du texte source, pour l'idempotence : on ne
    ré-embedde que si le contenu a changé) ;
  - `unique_together = (source_content_type, source_object_id, chunk_index)`.
- **chunking** : fenêtre fixe (~300 tokens) + overlap (~50 tokens), sur le
  `_full_content` déjà concaténé par `retrieval._full_content` (réutilisé, pas
  réinventé). Fonction pure `chunk_text(text) -> list[str]` testable seule.
- **quoi indexer** = le registry `agent.searchables` (source de vérité). On
  n'ajoute **pas** de champ obligatoire au spec : par défaut on embedde les mêmes
  `search_fields` que le full-text. Champ optionnel `SearchableSpec.embed = True`
  (défaut `True`) pour exclure explicitement une entité du vectoriel si un jour
  utile (ex. purement numérique).
- **indexation write-time** : service `apps/agent/indexing.py::reindex_instance(
  instance)` appelé depuis un `post_save` signal (ou depuis les services métier,
  à trancher — signal privilégié pour ne rien oublier). Idempotent via
  `content_hash` : pas de ré-embed si le texte n'a pas bougé. `post_delete` →
  supprime les chunks.
- **gating modules** : un chunk d'une entité de module désactivé n'est pas
  cherché (filtré au retrieval, lot 3) — pas besoin de le supprimer.

### Fichiers principaux

- `apps/agent/models.py` — modèle `EmbeddingChunk`
- `apps/agent/migrations/XXXX_embedding_chunk.py` (nouveau)
- `apps/agent/indexing.py` (nouveau) — `chunk_text`, `reindex_instance`,
  `remove_instance`, `content_hash`
- `apps/agent/signals.py` (nouveau) ou wiring dans `apps.py::ready()` — connexion
  `post_save`/`post_delete` pour chaque modèle du registry
- `apps/agent/searchables.py` — champ optionnel `embed: bool = True`
- `apps/agent/tests/test_indexing.py` (nouveau)

### Tâches

1. modèle `EmbeddingChunk` + migration (avec `VectorField`)
2. `chunk_text()` — fenêtre + overlap, fonction pure
3. `content_hash()` — hash stable du texte source concaténé
4. `reindex_instance()` — chunk → embed (batch, via `EmbeddingClient`) → upsert,
   idempotent sur `content_hash`, supprime les chunks orphelins (source
   raccourcie)
5. `remove_instance()` — purge les chunks d'une source supprimée
6. wiring signals `post_save`/`post_delete` sur les modèles du registry
   (paresseux : le registry est peuplé à `ready()`)
7. tests : chunking (texte court = 1 chunk, long = N, overlap correct), idempotence
   (2 reindex sans changement = 0 nouvel embed), scope household, delete purge

### Notes d'implémentation (livré)

- **Adressage `(entity_type, object_id)` en CharField**, pas de `ContentType` +
  `GenericForeignKey` comme prévu au cadrage : le registry `searchables` résout
  déjà `entity_type → model` (adressage identique à celui des tools /
  `AgentConversation`), et un FK typé ne peut pas couvrir les **pk mixtes** du
  registry (`Document` = pk entier, le reste UUID). `object_id = str(pk)`.
- **Write-time gaté par `EMBEDDING_INDEXING_ENABLED`** (défaut off) : le signal
  `post_save`/`post_delete` (récepteur global, filtré par le registry) ne fait
  rien tant que le flag n'est pas activé → aucune régression ni appel réseau dans
  la suite de tests. `reindex_instance` (backfill lot 2) reste actif indépendamment.
- **Tests + `--nomigrations`** : la migration 0008 (extension) étant sautée par
  pytest, le type `vector` est garanti via un `conftest.py` racine qui crée
  l'extension dans `template1` (hook `django_db_modify_db_settings`, avant le sync
  du schéma). Prérequis dev local : Postgres avec pgvector installé.

### Critères de validation

- créer une entité searchable → ses chunks apparaissent dans `EmbeddingChunk`
- éditer son texte → chunks régénérés ; ré-éditer à l'identique → **aucun** appel
  d'embedding (idempotence `content_hash`)
- supprimer l'entité → chunks purgés
- un document OCR long produit plusieurs chunks ordonnés
- ajouter une 11ᵉ entité searchable = elle est indexée sans toucher `indexing.py`

### Hors scope

- backfill de l'existant (lot 2) — ici seul le write-time est câblé
- retrieval / fusion (lot 3)
- index HNSW (V2)

---

## Lot 2 — Backfill par management command

**Statut** : ⬜ À faire.

### But

Indexer tout le corpus **existant** (entités créées avant le write-time du lot 1),
et ré-indexer après un changement de modèle/fournisseur. Miroir direct de
`extract_documents_text` (parcours 07 lot 0b).

### Décisions tranchées

- management command `python manage.py backfill_embeddings` avec args :
  `--household`, `--entity-type`, `--force` (ré-embed même si `content_hash`
  inchangé — utile après changement de modèle), `--limit`, `--dry-run` ;
- **coût & temps estimés** en sortie (nb de chunks × prix/token du provider ;
  gratuit affiché « 0 $ (local) »), + compteur de progression `[N/total]` ;
- **idempotent par défaut** (skip si `content_hash` + `model` inchangés) — comme
  l'OCR backfill ne re-traite pas sans `--force` ;
- une erreur sur une entité **n'arrête pas** le batch (log + continue).

### Fichiers principaux

- `apps/agent/management/commands/backfill_embeddings.py` (nouveau)
- `apps/agent/tests/test_backfill_embeddings.py` (nouveau)

### Tâches

1. command qui itère le registry `searchables` (× household), pour chaque
   instance appelle `reindex_instance` (réutilise le lot 1, aucune logique dupliquée)
2. `--dry-run` : compte et estime, n'écrit rien, n'appelle pas l'embedding
3. estimation coût/temps + progression
4. `--force` ré-embedde tout (changement de modèle) ; sinon skip idempotent
5. tests : `--dry-run` n'écrit rien, `--limit`, `--household`, `--force`
   ré-embedde, entité en erreur n'arrête pas le batch, `--entity-type` filtre

### Critères de validation

- `backfill_embeddings --dry-run` liste le volume + coût estimé sans rien écrire
- `backfill_embeddings --limit 20` indexe 20 entités avec résumé final
- relancer sans `--force` → tout skippé (idempotent)
- `backfill_embeddings --force` après un changement de `EMBEDDING_MODEL` → tout
  ré-embeddé avec le nouveau `model` stocké

### Hors scope

- planification cron / re-embed automatique (le batch reste manuel)
- migration de données entre dimensions (documenté, mais `--force` suffit)

---

## Lot 3 — Retrieval hybride (fusion RRF) + flag

**Statut** : ⬜ À faire.

### But

Faire cohabiter full-text et vectoriel dans `retrieval.search()` via une fusion
RRF, **sans changer la signature** ni le type de retour. C'est le lot qui apporte
le gain utilisateur.

### Décisions tranchées

- **recherche vectorielle** : `_vector_search(household_id, query, limit)` —
  `EmbeddingClient.embed_query(query)` puis k-NN pgvector
  (`ORDER BY embedding <=> query_vec LIMIT k`), scopé household, gating modules
  identique au full-text. Renvoie des chunks → dédupliqués par entité source
  (meilleur chunk par entité) → `Hit` via le spec (réutilise `hit_from_instance`
  / `_full_content`) ;
- **fusion RRF** : `_fuse_rrf(fulltext_hits, vector_hits, k=60)` — fusionne par
  rang, dédup par `(entity_type, id)`, renvoie `list[Hit]` triée. Constante
  `RRF_K = 60`. Pas de pondération en V1 (ajoutable si l'éval le justifie) ;
- **flag** `AGENT_HYBRID_RETRIEVAL_ENABLED` (défaut selon éval ; **off** au
  démarrage pour un rollout progressif). Off → `search()` = comportement full-text
  actuel, à l'octet près ;
- **le `snippet`** vient toujours du full-text quand dispo (headline surligné) ;
  pour un hit purement vectoriel, snippet = tête du meilleur chunk ;
- `search_multi` (query expansion) : la fusion se fait par requête, l'union
  ensuite — l'ordre expansion → fusion est documenté et testé.

### Fichiers principaux

- `apps/agent/retrieval.py` — `_vector_search`, `_fuse_rrf`, branchement dans
  `search()` derrière le flag ; `search_multi` inchangé sur le contrat
- `config/settings/base.py` — `AGENT_HYBRID_RETRIEVAL_ENABLED`, `RRF_K`
- `apps/agent/tests/test_retrieval_hybrid.py` (nouveau)

### Tâches

1. `_vector_search()` — embed query + k-NN pgvector + dédup chunk→entité + `Hit`
2. `_fuse_rrf()` — fusion par rang, dédup, tri
3. brancher dans `search()` derrière `AGENT_HYBRID_RETRIEVAL_ENABLED` ;
   off = chemin full-text inchangé
4. snippet : full-text si présent, sinon tête du meilleur chunk
5. tests : question paraphrasée (0 hit full-text) → hits via vecteur ; question à
   mot-clé exact → full-text toujours en tête ; RRF donne un doc présent dans les
   2 listes devant un doc présent dans une seule ; scope household ; flag off =
   comportement legacy identique ; `Hit` a la même forme

### Critères de validation

- « le chauffage » retrouve la facture « pompe à chaleur » (impossible avant)
- « Engie » / un n° de série restent en tête (pas de régression)
- flag off → sortie **identique** au full-text actuel (test de non-régression)
- latence `search()` sous le seuil au volume foyer réel
- `search_household` (le tool) et le reste d'`apps/agent/` **inchangés**

### Hors scope

- reranking (V2) ; pondération des jambes (ajoutable si éval le montre) ;
  index HNSW (V2)

---

## Lot 4 — Observabilité & harnais d'évaluation

**Statut** : ⬜ À faire.

### But

Pouvoir **mesurer** que l'hybride améliore le retrieval sans rien régresser — et
trancher le fournisseur d'embeddings sur des chiffres, pas au feeling.

### Décisions tranchées

- **observabilité** : chaque embedding (indexation + query) logue déjà dans
  `AIUsageLog` (feature `embed`, posé au lot 0) ; on ajoute une **vue de la
  couverture d'index** (combien d'entités searchables ont des chunks, combien
  sont obsolètes vs `EMBEDDING_MODEL` courant) — command `embeddings_status` ou
  intégration à la page `/app/admin/ai-usage/` (à trancher, léger) ;
- **harnais d'éval** : un jeu de questions figé (`fixtures/eval_queries.json` :
  `{question, expected_entity_ids}`) + une command `eval_retrieval` qui calcule
  **recall@k** et **MRR** pour 3 modes (full-text seul / vecteur seul / hybride)
  sur un foyer donné. Sortie tableau comparatif. Pas de réseau IA en CI (l'éval
  se lance à la main sur données réelles) ;
- le fournisseur prod est tranché (Voyage `voyage-3`) ; l'éval **valide la qualité
  de retrieval** sur le corpus réel et arbitre la valeur par défaut du flag
  `AGENT_HYBRID_RETRIEVAL_ENABLED`. Elle sert aussi de **garde-fou pour la bascule
  local future** : rejouer les mêmes questions sous `ollama`/`bge-m3` doit donner un
  recall équivalent avant de migrer (les vecteurs n'étant pas comparables → ré-embed).

### Fichiers principaux

- `apps/agent/management/commands/eval_retrieval.py` (nouveau)
- `apps/agent/management/commands/embeddings_status.py` (nouveau)
- `apps/agent/eval/` (nouveau) — `metrics.py` (recall@k, MRR), jeu de questions
- `apps/agent/tests/test_eval_metrics.py` (nouveau — les métriques, pas le réseau)

### Tâches

1. `metrics.py` — `recall_at_k`, `mrr`, fonctions pures testées
2. jeu de questions golden (questions paraphrasées **et** à mots-clés exacts, pour
   attraper les régressions)
3. command `eval_retrieval --household --mode {fulltext,vector,hybrid,all}` →
   tableau recall@k + MRR par mode
4. command `embeddings_status` — couverture d'index + chunks obsolètes
5. tests : métriques sur données synthétiques (pas d'appel réseau)

### Critères de validation

- `eval_retrieval --mode all` montre hybride ≥ full-text sur le recall des
  questions paraphrasées, **sans** perte sur les questions à mots-clés exacts
- l'éval valide `voyage-3` en prod ; si un jour on migre en local, elle vérifie
  que `bge-m3` tient le même recall avant de basculer
- `embeddings_status` indique la couverture (ex. « 188/190 entités indexées, 0
  obsolète »)
- les métriques sont testées sans réseau

### Hors scope

- dashboard graphique dédié embeddings (l'éval en CLI suffit pour trancher)
- A/B en prod automatisé

---

## Lot 5 — Idées V2 (backlog)

**Statut** : 💡 Idées, non planifiées. À ouvrir seulement quand mesuré nécessaire.

- **Reranking cross-encoder** : 2ᵉ passe (LLM ou modèle dédié) qui réordonne le
  top-k fusionné. Gain de précision réel, mais latence + coût. À ouvrir **après**
  avoir constaté par l'éval que RRF plafonne.
- **Index HNSW pgvector** : quand le scan exact commence à se sentir (volume). Un
  seul `CREATE INDEX ... USING hnsw`, paramètres `m`/`ef_construction` à régler.
- **Chunking sémantique** : découper aux frontières de sens (titres, paragraphes)
  plutôt qu'à fenêtre fixe. Meilleurs chunks, plus de complexité.
- **Pondération des jambes RRF** : si l'éval montre qu'une jambe est
  systématiquement meilleure sur une classe de requêtes.
- **Ré-embed incrémental planifié** : si un jour on veut rattraper l'obsolescence
  sans lancer le backfill à la main.

## Ordre recommandé d'implémentation

Une feature branch par lot, PR vers `main`, dans l'ordre :

**lot 0** (socle pgvector + `EmbeddingClient` — fondations, rien de visible) →
**lot 1** (modèle `EmbeddingChunk` + chunking + write-time) →
**lot 2** (backfill — indexer le corpus réel du foyer) →
**lot 3** (retrieval hybride RRF + flag — **le gain utilisateur**, livré flag off) →
**lot 4** (éval + observabilité — mesurer, puis **trancher le fournisseur** et
activer le flag par défaut).

Le lot 4 est l'arbitre : le choix Ollama/Voyage/OpenAI et l'activation du mode
hybride par défaut se décident sur `recall@k` / `MRR` mesurés, pas au feeling.
Le lot 5 n'est ouvert que si l'éval montre que RRF plafonne.

## Définition de done technique (par lot puis chantier)

Chaque lot n'est « done » que si :

1. `pytest` vert (nouveaux tests du lot + non-régression de la suite agent) ;
2. `ruff`/lint propre ;
3. **zéro appel réseau IA en CI** — `EmbeddingClient` mocké systématiquement ;
4. la doc du lot (backlog + module `agent.md`) reflète l'état livré.

**i18n 4 langues** : *non applicable* à ce chantier — aucune surface UI nouvelle
(le gain est invisible, côté retrieval). Seule exception éventuelle : si le lot 4
expose un statut d'index dans `/app/admin/ai-usage/`, ses libellés passent par les
4 locales comme le reste de l'admin.

Le **chantier** est done quand : l'éval (lot 4) montre un gain de recall sur les
questions paraphrasées **sans régression** sur les mots-clés exacts, le flag
hybride est activé par défaut, le corpus du foyer réel est intégralement indexé,
et le fournisseur d'embeddings est tranché.

## Points de vigilance (à conserver pendant tout le chantier)

- **ne jamais casser le contrat `Hit`** ni la signature de `search()` — c'est ce
  qui garde `apps/agent/` transparent au changement ;
- **mock systématique de `EmbeddingClient` en CI** — zéro appel réseau IA
  (invariant hérité du parcours 07) ;
- **idempotence de l'indexation** (`content_hash` + `model`) — sinon le write-time
  ré-embedde à chaque save et la facture/latence explose ;
- **le registry `searchables` reste la source de vérité** — indexer ≠ lister une
  2ᵉ fois les entités ailleurs ;
- **changement de modèle = ré-embed complet** (`--force`) — les vecteurs ne sont
  pas comparables entre modèles ; stocker `model` sur chaque chunk pour détecter
  l'obsolescence ;
- **flag de rollback** (`AGENT_HYBRID_RETRIEVAL_ENABLED`) testé off = comportement
  legacy strictement identique ;
- **scope household systématique** sur la recherche vectorielle, comme le full-text.
