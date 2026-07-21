# Parcours 21 — Recherche sémantique hybride (embeddings)

Ce document détaille le vingt-et-unième chantier de House. Contrairement aux
parcours 01 à 20 qui ajoutent des **usages métier**, celui-ci est un **chantier
technique transverse** : il renforce le cœur de retrieval qui alimente déjà tout
l'agent conversationnel (parcours 07) et ses dérivés (digest, Telegram,
conversation ancrée).

Il s'appuie sur le socle du parcours 07 (RAG full-text) et prolonge sa décision
fondatrice — « full-text en V1, embeddings possibles plus tard sans réécrire
l'API » — qui est enfin exercée ici.

Fiche concept (le cours) : [docs/fiches/EMBEDDINGS.md](../fiches/EMBEDDINGS.md).
Backlog technique : [PARCOURS_21_BACKLOG_TECHNIQUE.md](./PARCOURS_21_BACKLOG_TECHNIQUE.md).

## Résumé

Le problème que ce chantier résout :

> « Je pose une question à l'agent avec **mes** mots, mais mes documents utilisent
> **d'autres** mots — alors l'agent ne trouve rien. »

Le retrieval actuel est **100 % lexical** : il matche des mots, pas du sens. Il
est excellent quand l'utilisateur emploie le vocabulaire exact de ses documents
(« Engie », « Daikin », un numéro de facture), et **muet** dès qu'il paraphrase
(« le chauffage » pour une facture qui dit « pompe à chaleur »).

Ce chantier ajoute une **deuxième jambe sémantique** — la recherche par
embeddings vectoriels — **à côté** de la recherche full-text, les deux fusionnées
en un seul classement. L'agent retrouve désormais par le **sens** autant que par
les **mots**.

Le concept central est la **recherche hybride** : full-text (`tsvector`) +
vectoriel (`pgvector`), fusionnés par **Reciprocal Rank Fusion**.

## Positionnement produit

Le parcours 07 a rendu la mémoire du foyer interrogeable en langage naturel. À
l'usage, sa limite est apparue exactement là où la fiche RAG l'avait prédite : le
full-text rate les questions dont le vocabulaire diverge des documents. On avait
posé un premier pansement (`query_expansion` — un LLM réécrit la question en
mots-clés avant le retrieval), utile mais insuffisant : il coûte un appel LLM par
question, dépend de la culture générale du modèle, et ignore les synonymes
**propres au foyer** (« la chambre du haut », « le local technique »).

Ce chantier attaque la cause plutôt que le symptôme. Il ne crée **aucune surface
utilisateur nouvelle** : l'agent, sa page, ses conversations ancrées, le digest,
le canal Telegram — tout reste identique. Ce qui change est **invisible et
partout** : les réponses deviennent meilleures parce que le retrieval trouve ce
qu'il ratait.

C'est un **investissement de plateforme**, comparable à l'observabilité IA
(parcours 07 lot 6) : il ne se voit pas dans l'UI mais il élève la qualité de
tout ce qui s'appuie dessus.

## Ce que l'utilisateur gagne (exemples concrets)

| Question | Aujourd'hui (full-text) | Après (hybride) |
|---|---|---|
| « combien m'a coûté le chauffage cet hiver ? » | ❌ rien (docs disent « PAC », « Daikin ») | ✅ retrouve la facture pompe à chaleur |
| « qui est venu réparer la chaudière ? » | ❌ rien (note dit « intervention ballon ECS ») | ✅ retrouve la note d'intervention |
| « qu'est-ce que j'ai à faire au jardin ? » | 🟡 dépend des mots exacts | ✅ tâches/notes sémantiquement liées au jardin |
| « facture Engie mars 2026 » | ✅ match franc | ✅ **toujours** franc (full-text préservé) |
| « équipement n° série 4F8A-22K » | ✅ match exact | ✅ **toujours** exact (full-text préservé) |

La dernière ligne est le point clé : **on ne perd rien**. Le mode hybride
préserve intégralement les forces du full-text tout en ajoutant celles du
sémantique.

## Concept interne (survol — détail dans le backlog)

Rien de tout cela ne touche `apps/agent/` sur le fond : la fusion se fait
**dans** `retrieval.search()`, dont la signature et le type de retour (`list[Hit]`)
ne changent pas. L'agent ne sait pas que le vectoriel existe.

- **`EmbeddingClient`** — abstraction du fournisseur d'embeddings, miroir exact de
  `LLMClient`. Anthropic ne fournit pas d'embeddings : le fournisseur est un choix
  de settings (`EMBEDDING_PROVIDER`). **Choix tranché : API Voyage AI (`voyage-3`)
  en prod** — le VPS actuel (4 Go, déjà 5 conteneurs) ne peut pas héberger un
  modèle local sans risquer l'OOM sur l'app. Voyage = 0 Go RAM sur le VPS, coût
  négligeable au volume foyer, multilingue, partenaire recommandé par Anthropic.
  **Ollama local (`bge-m3`) reste la cible** dès que la machine passe à ≥ 8 Go,
  activable en un flag sans refactor.
- **`EmbeddingChunk`** — table d'index dédiée. Les textes longs (OCR de factures)
  sont découpés en morceaux (chunks) et embeddés chunk par chunk. La table pointe
  vers l'entité source par FK polymorphe (même pattern que `Interaction.source`),
  ce qui garde le registry `agent.searchables` comme **source de vérité unique**
  de ce qui est indexé.
- **Indexation** — write-time (à l'écriture de l'entité source) + **backfill** par
  management command (`backfill_embeddings`), miroir de `extract_documents_text`.
- **Retrieval hybride** — `retrieval.search()` lance les deux recherches
  (full-text + k-NN pgvector) et les fusionne par **RRF**. Un flag permet un
  rollback instantané vers le full-text seul.
- **Observabilité & éval** — chaque embedding logue dans `AIUsageLog` (feature
  `embed`) ; un petit harnais d'évaluation (jeu de questions/réponses attendues)
  mesure objectivement le gain hybride vs full-text avant de trancher le
  fournisseur.

## Décisions structurantes (prises au cadrage)

1. **Hybride, pas remplacement.** Le full-text reste. On ajoute une jambe, on
   n'en coupe pas une. (cf. EMBEDDINGS.md §3.4, §4.3)
2. **Fusion par RRF** (rang, pas score bruts). Sans calibrage, robuste, standard.
3. **pgvector**, pas de base vectorielle dédiée. Une seule base à opérer.
4. **`EmbeddingClient` Protocol** — fournisseur tranché : **API Voyage AI**
   (`voyage-3`) en prod, contrainte par le VPS 4 Go. Ollama local (`bge-m3`) = cible
   RAM ≥ 8 Go, activable en un flag.
5. **Table `EmbeddingChunk` dédiée** + chunking. Le registry `searchables` reste
   la source de vérité de ce qui est indexé.
6. **Pas d'index HNSW en V1** (scan exact instantané au volume foyer).
7. **Backfill manuel** par management command, avec `--dry-run` et coût estimé.
8. **Interface `Hit` inchangée** → transparence totale pour l'agent.

## Ce qui reste hors chantier (idées V2)

- **Reranking cross-encoder** sur le top-k (gain de précision, coût/latence) — à
  ouvrir seulement après avoir mesuré que RRF plafonne.
- **Chunking sémantique** (découpe aux frontières de sens plutôt qu'à fenêtre
  fixe).
- **Index HNSW** — à ajouter si le volume fait sentir la latence du scan exact.
- **Stemming par foyer** (`Household.preferred_language`, issue #113) — orthogonal
  et toujours ouvert ; le sémantique en réduit l'urgence mais ne le remplace pas.

## Critères de succès du chantier

- une batterie de questions « paraphrasées » qui rendaient `[]` en full-text
  renvoie désormais les bons hits (mesuré par l'éval du dernier lot) ;
- **aucune régression** sur les questions à mots-clés exacts (identifiants,
  marques, montants) — vérifié par l'éval ;
- la latence de `search()` reste sous le seuil acceptable (~quelques centaines de
  ms max au volume foyer) ;
- ajouter un nouveau module reste « ~5 lignes dans son `apps.py` » (le registry
  ne régresse pas) ;
- un flag permet le rollback instantané full-text-only en cas de souci prod.
