# 2026-07-21 — Parcours 21 cadrage initial

## Contexte

Session de cadrage du vingt-et-unième chantier de House — et le premier qui soit
purement **technique transverse** plutôt qu'un usage métier : faire évoluer le
retrieval de l'agent (parcours 07) d'un moteur **100 % full-text** (`tsvector`)
vers une **recherche sémantique hybride** (full-text + embeddings vectoriels
`pgvector`, fusionnés par Reciprocal Rank Fusion).

Déclencheur : à l'usage, le RAG rate les questions dont le vocabulaire diverge des
documents (« le chauffage » ne trouve pas la facture « pompe à chaleur »). C'est
la limite structurelle du lexical, annoncée dès la V1 du parcours 07 (RAG.md §6 :
« embeddings écartés en V1, migration possible plus tard sans réécrire l'API »).
Ce chantier est ce « plus tard ».

Le but explicite de cette session : **produire uniquement de la documentation, des
specs et les issues GitHub** — pas de code.

## Ce qui a été confirmé (décisions)

- **hybride, pas remplacement** : on ajoute une jambe sémantique **à côté** du
  full-text. Le full-text reste imbattable sur les identifiants exacts (marques,
  montants, n° série) que le vectoriel gère mal — le jeter serait une régression ;
- **fusion par RRF** (Reciprocal Rank Fusion) : on fusionne par **rang**, pas par
  scores bruts (`ts_rank` et distance cosinus ne sont pas comparables). Sans
  calibrage, robuste, standard 2026 ;
- **pgvector** dans la base Postgres existante, **pas** de base vectorielle dédiée
  (volume foyer modeste, une seule base à opérer) ;
- **abstraction `EmbeddingClient`** (Protocol + factory sur `EMBEDDING_PROVIDER`),
  **miroir exact de `LLMClient`** : Anthropic ne fournit pas d'embeddings, le
  fournisseur devient un choix de settings. **Fournisseur tranché en séance : API
  Voyage AI** (`voyage-3`, multilingue, 1024 dims). Motif : le VPS de prod (OVH
  VPS-1, **4 Go RAM**, déjà 5 conteneurs Docker — Postgres, gunicorn, scheduler,
  nginx, Traefik) **ne peut pas héberger un modèle local** (`bge-m3` ≈ 2–2,5 Go
  chargé) sans risquer l'OOM killer sur l'app elle-même. Voyage = 0 Go RAM sur le
  VPS, coût négligeable au volume foyer, partenaire recommandé par Anthropic (même
  frontière de confiance que l'OCR, déjà chez Claude). **Ollama local (`bge-m3`)
  reste la cible** dès que la machine passe à ≥ 8 Go — `EMBEDDING_PROVIDER=ollama`,
  un container `ollama` ajouté au compose, zéro refactor du retrieval (rôle de
  l'abstraction). Décision initiale « Ollama » de la session révisée après examen
  du VPS réel ;
- **table `EmbeddingChunk` dédiée** (FK polymorphe, pattern `Interaction.source`)
  + **chunking** fenêtre fixe + overlap : le registry `agent.searchables` reste la
  **source de vérité unique** de ce qui est indexé ;
- **pas d'index HNSW en V1** (scan exact instantané au volume foyer) ;
- **backfill manuel** par management command (`backfill_embeddings`, `--dry-run`,
  `--force`, coût estimé) — miroir de `extract_documents_text` ;
- **interface `Hit` et signature `search()` inchangées** → tout `apps/agent/`
  (tools, service, conversation ancrée, digest, Telegram) est transparent au
  changement ;
- **flag de rollback** `AGENT_HYBRID_RETRIEVAL_ENABLED` (off au démarrage) →
  full-text seul strictement identique en cas de souci prod.

## État du runtime confirmé pendant la session

- retrieval actuel entièrement lexical : `apps/agent/retrieval.py`
  (`SearchVector`/`SearchRank`, config `simple_unaccent` créée dans
  `apps/agent/migrations/0001_initial.py` via `UnaccentExtension`) — le setup
  pgvector se calquera dessus (`VectorExtension`) ;
- registry `SearchableSpec` (`apps/agent/searchables.py`) : ~10+ entités
  enregistrées, chacune via `apps.py::ready()` — c'est le point d'ancrage de
  l'indexation vectorielle, aucun modèle ne le double ;
- helper `retrieval._full_content(obj, fields)` concatène déjà les champs
  searchables → réutilisable tel quel comme entrée du chunking ;
- pansement existant `query_expansion.py` (LLM réécrit la question en mots-clés
  avant retrieval) : conservé, il aide aussi la jambe full-text, il devient moins
  critique côté sémantique ;
- observabilité `AIUsageLog` (`apps/ai_usage/`) déjà en place et provider-neutre →
  accueille la feature `embed` sans changement de schéma ;
- abstraction `LLMClient` (`apps/agent/llm.py`) : modèle direct à copier pour
  `EmbeddingClient` (Protocol + factory + logging + clients concrets) ;
- `anthropic==0.43.0` + `httpx` déjà présents ; à ajouter : `pgvector` (binding
  Django/psycopg) + `voyageai` (SDK Voyage) ;
- aucune dépendance vectorielle ni base tierce dans le projet aujourd'hui ;
- **déploiement** : Docker Compose (`docker-compose.prod.yml`), runner self-hosted
  sur le VPS OVH VPS-1 (Debian 13, 4 Go RAM, 2 vCores) ; services `db`
  (postgres:16), `web` (gunicorn), `scheduler`, `nginx`, derrière Traefik. Le choix
  Voyage n'ajoute **aucun** conteneur ; la cible Ollama en ajouterait un (§6.3 de
  la fiche EMBEDDINGS).

## Documents produits ou mis à jour

- [docs/fiches/EMBEDDINGS.md](../fiches/EMBEDDINGS.md) — **la fiche cours** :
  embeddings, similarité cosinus, k-NN, hybride, RRF, pgvector, chunking,
  comparatif des 3 fournisseurs, décisions et écartés
- [docs/fiches/RAG.md](../fiches/RAG.md) — cross-refs ajoutées (§ choix full-text
  vs embeddings, § écartés, § pour aller plus loin)
- [docs/fiches/README.md](../fiches/README.md) — entrée d'index EMBEDDINGS.md
- [docs/parcours/PARCOURS_21_RECHERCHE_SEMANTIQUE_HYBRIDE.md](../parcours/PARCOURS_21_RECHERCHE_SEMANTIQUE_HYBRIDE.md)
  — doc produit / vision
- [docs/parcours/PARCOURS_21_BACKLOG_TECHNIQUE.md](../parcours/PARCOURS_21_BACKLOG_TECHNIQUE.md)
  — backlog technique (lots 0 → 5)
- [docs/MODULES/agent.md](../MODULES/agent.md) — note prospective « retrieval
  hybride à venir »
- [docs/NEXT_STEPS.md](../NEXT_STEPS.md) — entrée chantier parcours 21
- issues GitHub : #327 (lot 0 socle), #328 (lot 1 EmbeddingChunk), #329 (lot 2
  backfill), #330 (lot 3 retrieval hybride RRF), #331 (lot 4 éval + observabilité),
  #332 (lot 5 idées V2) — labels `enhancement` + `app:agent` (`idea` pour le lot 5)

## Recommandation pour la suite

Implémenter dans l'ordre des lots, une feature branch par lot :

1. **lot 0** (socle pgvector + `EmbeddingClient`) — fondations, rien de visible ;
2. **lot 1** (modèle `EmbeddingChunk` + chunking + write-time) ;
3. **lot 2** (backfill) — indexer le corpus réel du foyer « Les Petits Bonheur » ;
4. **lot 3** (retrieval hybride RRF + flag) — **le gain utilisateur**, livré flag
   off, activé après éval ;
5. **lot 4** (éval + observabilité) — mesurer, puis **trancher le fournisseur** et
   la valeur par défaut du flag.

Le fournisseur prod est tranché (Voyage `voyage-3`) ; le lot 4 valide la qualité
et décide l'activation du mode hybride par défaut sur `recall@k` / `MRR` mesurés,
pas au feeling — et sert de garde-fou pour une bascule local (`bge-m3`) future.

## Points de vigilance conservés

- ne jamais casser le contrat `Hit` ni la signature de `search()` (transparence
  d'`apps/agent/`) ;
- mock systématique de `EmbeddingClient` en CI (zéro appel réseau IA — invariant) ;
- idempotence de l'indexation (`content_hash` + `model`) sinon ré-embed à chaque
  save ;
- le registry `searchables` reste la source de vérité de ce qui est indexé ;
- changement de modèle = ré-embed complet (`--force`) ; stocker `model` par chunk ;
- flag off = comportement legacy strictement identique (test de non-régression) ;
- scope household systématique sur la recherche vectorielle.
