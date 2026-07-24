# Embeddings & recherche sémantique — le cours

> Fiche concept du **parcours 21** (recherche sémantique hybride). Elle explique
> ce qu'est un embedding, pourquoi on veut en ajouter au RAG de `house`, comment
> on marie recherche vectorielle et full-text (hybride + fusion RRF), et les
> choix qu'on tranche pour ce chantier.
>
> Prérequis : avoir lu [RAG.md](RAG.md) (le retrieval full-text actuel). Cette
> fiche est la suite directe : on part de « le full-text plafonne » pour arriver
> à « on ajoute une deuxième jambe sémantique ».

## 1. Le problème

Le retrieval de `house` est aujourd'hui **100 % lexical** (Postgres `tsvector`,
config `simple_unaccent`, cf. RAG.md §4.2). Il matche des **mots**, pas du
**sens**. Trois familles de questions le mettent en échec :

1. **Vocabulaire différent du document.**
   Question : *« combien m'a coûté le chauffage cet hiver ? »*
   Document : une facture qui dit *« pompe à chaleur »*, *« PAC »*, *« Daikin »* —
   jamais le mot « chauffage ». Le full-text ne relie pas *chauffage* → *PAC*.
   > On a déjà un pansement : `query_expansion.py` fait réécrire la question en
   > mots-clés + synonymes par un LLM **avant** le retrieval. Ça aide, mais ça
   > coûte un appel LLM par question, ça dépend de la culture générale du modèle,
   > et ça rate les synonymes propres au foyer (« la chambre du haut »).

2. **Reformulation / paraphrase.**
   *« qui est venu réparer la chaudière ? »* vs une note *« intervention Martin
   plomberie sur le ballon d'eau chaude »*. Zéro mot commun, même sens.

3. **Questions vagues, exploratoires.**
   *« qu'est-ce que j'ai à faire côté jardin ? »* — aucun mot-clé net à matcher.

Le point commun : le full-text exige un **recouvrement de tokens**. Dès que
l'utilisateur parle autrement que ses documents, il ne trouve rien. C'est la
limite structurelle annoncée dès la V1 du RAG (RAG.md §6 : « embeddings écartés
en V1, migration possible plus tard sans réécrire l'API »). **Ce parcours est ce
"plus tard".**

## 2. Le concept en deux phrases

> Un **embedding** transforme un texte en un **vecteur** de nombres (quelques
> centaines de dimensions) tel que deux textes de **sens proche** ont des
> vecteurs **géométriquement proches**. Chercher devient alors « trouver les
> vecteurs les plus proches de celui de la question » — on retrouve par le
> **sens**, plus par les mots.

## 3. Comprendre les embeddings

### 3.1 De texte à vecteur

Un modèle d'embedding est un réseau de neurones entraîné à placer les textes dans
un espace géométrique où **la proximité = la similarité de sens**.

```
"pompe à chaleur"  → [ 0.021, -0.114,  0.307, ... ]   (par ex. 768 nombres)
"PAC Daikin"       → [ 0.019, -0.108,  0.298, ... ]   ← très proche
"facture Engie"    → [-0.204,  0.077, -0.031, ... ]   ← éloigné
```

Ces vecteurs vivent dans un espace à N dimensions (768, 1024, 1536… selon le
modèle). On ne peut pas se le représenter, mais l'intuition en 2D suffit :

```
        chauffage •
                   • PAC
      pompe à chaleur •         (cluster "chaleur / chauffage")
                              
                                        • facture
                                    • Engie      (cluster "énergie / paiement")
                                        • kWh
```

Deux textes qui parlent de la même chose atterrissent dans le même coin de
l'espace, **même sans partager un seul mot**.

### 3.2 Mesurer la proximité : similarité cosinus

Pour comparer deux vecteurs, on regarde **l'angle** entre eux (pas la distance
brute — la longueur du vecteur porte peu de sens). C'est la **similarité
cosinus** :

- `1.0` = même direction (sens identique)
- `0.0` = orthogonaux (aucun rapport)
- `-1.0` = opposés

```
cos(θ) = (A · B) / (‖A‖ · ‖B‖)
```

En pratique, les modèles d'embedding produisent souvent des vecteurs **déjà
normalisés** (‖v‖ = 1), et alors la similarité cosinus se réduit au simple
produit scalaire — d'où l'opérateur `<#>` (négatif du produit scalaire) de
pgvector, le plus rapide. On y revient §5.

### 3.3 Chercher = "plus proches voisins" (k-NN)

Une recherche sémantique, c'est :

1. calculer l'embedding de la **question** (1 appel au modèle d'embedding) ;
2. trouver les **k** documents dont le vecteur est le plus proche (k-NN, *k
   nearest neighbors*) ;
3. renvoyer ces k documents.

C'est exactement le rôle du full-text (`SearchRank` → top-N), mais la métrique de
proximité change : distance vectorielle au lieu de recouvrement de tokens.

### 3.4 Le piège : les embeddings ne savent pas tout matcher

Un embedding capture le **sens général**, pas les **identifiants précis**. Il
est *mauvais* là où le full-text est excellent :

| Requête | Full-text | Embeddings |
|---|---|---|
| `Engie`, `Daikin` (marque exacte) | ✅ match franc | 🟡 dilué (« un fournisseur ») |
| `N° série 4F8A-22K` | ✅ match exact | ❌ le vecteur d'un code n'a pas de « sens » |
| `142,67 €` (montant précis) | ✅ | ❌ |
| « le truc qui chauffe l'eau » | ❌ aucun token | ✅ → ballon / chauffe-eau |
| « qui est venu réparer ? » | ❌ | ✅ → intervention plombier |

**C'est LA raison de ne pas remplacer le full-text par le vectoriel.** Les deux
sont complémentaires : l'un pour l'exactitude lexicale, l'autre pour le sens.
D'où l'architecture **hybride** (§4).

## 4. La recherche hybride (le cœur du chantier)

### 4.1 Idée

On lance **les deux** recherches en parallèle sur la même question, puis on
**fusionne** les deux classements en un seul :

```
                      question utilisateur
                     /                     \
                    ▼                       ▼
        [full-text tsvector]        [embedding question]
        top-N lexical               → k-NN pgvector
                    \                       /
                     ▼                     ▼
                    [ fusion des 2 classements ]
                                │
                                ▼
                    liste unique de Hits rankés
```

Un document qui sort **dans les deux** listes (lexical ET sémantique) est très
probablement pertinent → il remonte au sommet. Un document qui ne sort que d'un
côté reste candidat.

### 4.2 Fusionner : Reciprocal Rank Fusion (RRF)

Problème : le `rank` du full-text Postgres (`ts_rank`, ~0.05 à 1.0) et la
distance cosinus de pgvector (0 à 2) **ne sont pas comparables**. On ne peut pas
les additionner.

La solution standard 2026, simple et robuste : **RRF**. On ignore les scores
bruts et on ne garde que le **rang** (position) dans chaque liste :

```
score_RRF(doc) = Σ   1 / (k + rang_i(doc))
              (sur chaque liste i où le doc apparaît)
```

`k` est une constante d'amortissement (60 par convention). Exemple avec k=60 :

| Document | Rang full-text | Rang vecteur | Score RRF |
|---|---|---|---|
| Facture PAC | 1 | 3 | 1/61 + 1/63 = **0.0323** |
| Note intervention | — (absent) | 1 | 1/61 = **0.0164** |
| Manuel Daikin | 2 | — (absent) | 1/62 = **0.0161** |

La facture, présente dans les deux listes, gagne. C'est **exactement** la
propriété qu'on veut. RRF n'a aucun paramètre à calibrer par requête, ne dépend
pas de l'échelle des scores, et bat souvent des fusions pondérées plus
sophistiquées. On peut pondérer une jambe (`w_i / (k + rang)`) si on constate que
l'une est systématiquement meilleure — mais on commence sans poids.

### 4.3 Pourquoi hybride plutôt que « juste des embeddings »

C'est le choix tranché pour ce chantier (voir §7). En un mot : le foyer est plein
d'**identifiants exacts** (marques, montants, numéros de série, dates) que le
vectoriel gère mal (§3.4), et le full-text actuel **fonctionne déjà et est
gratuit**. Le jeter serait une régression sur toute une classe de requêtes. RRF
nous laisse ajouter la jambe sémantique **sans rien perdre**.

## 5. pgvector — le vectoriel dans Postgres

On reste sur **une seule base**. Pas de base vectorielle dédiée (Pinecone,
Weaviate, Qdrant…) : à l'échelle d'un foyer (milliers d'entités, pas millions),
[pgvector](https://github.com/pgvector/pgvector) suffit largement et évite un
service de plus à opérer. On a déjà Postgres, on a déjà l'habitude d'y créer des
extensions (cf. `unaccent` dans `apps/agent/migrations/0001_initial.py`).

### 5.1 Ce que pgvector ajoute

- un type de colonne `vector(N)` (N = dimensions du modèle) ;
- des opérateurs de distance : `<->` (L2 / euclidienne), `<#>` (produit scalaire
  négatif), `<=>` (distance cosinus) ;
- des index approximatifs **HNSW** et **IVFFlat** pour que le k-NN reste rapide
  quand le volume grandit.

### 5.2 Exact vs approximatif (HNSW)

Un k-NN **exact** compare la question à *tous* les vecteurs → lent au-delà de
quelques dizaines de milliers de lignes. Un index **HNSW** (*Hierarchical
Navigable Small World*) construit un graphe de voisinage qui trouve les voisins
« quasi les plus proches » en temps logarithmique, avec un rappel > 95 %.

À l'échelle d'un foyer, un scan exact (`ORDER BY vector <=> query LIMIT k`) est
déjà instantané. **On commence sans index HNSW** (moins de complexité, pas de
paramètres `ef_construction`/`m` à régler) et on l'ajoute quand/si le volume le
justifie — même philosophie que « pas de matérialisation du tsvector en V1 ».

### 5.3 Où stocker les vecteurs ? Le chunking

Un embedding représente bien un texte **court et cohérent**. Passer 8 pages d'OCR
de facture dans un seul vecteur dilue le sens (« moyenne » de tout le document →
ne ressemble plus à rien de précis). La pratique standard : **découper (chunk)**
les textes longs en morceaux (~200-500 tokens) et embedder chaque morceau.

Conséquence de modèle : on n'ajoute pas une colonne `vector` sur chaque modèle
métier. On crée **une table d'index dédiée** (`EmbeddingChunk`) qui pointe
(FK polymorphe, comme `Interaction.source_*`) vers l'entité source, stocke le
texte du chunk, sa position, et son vecteur. Un document = N chunks = N lignes.
La recherche renvoie des chunks → on remonte à l'entité source → on la rend
citable via le `SearchableSpec` existant (l'interface `Hit` ne change pas).

Ce découplage a un autre avantage : **le registry `searchables` reste la source
de vérité**. Ce qui est indexé pour le vectoriel = ce qui est déjà déclaré
searchable. Ajouter un module reste « ~5 lignes dans son `apps.py` », comme
aujourd'hui.

## 6. D'où viennent les vecteurs ? Le fournisseur d'embeddings

**Point crucial : Anthropic ne fournit PAS d'API d'embeddings.** Claude reste le
moteur de **génération** (les réponses), mais les **vecteurs** doivent venir
d'ailleurs. C'est une dépendance nouvelle et un vrai choix. On l'abstrait
derrière un `EmbeddingClient` (Protocol), **exactement comme `LLMClient`** l'a
fait pour la génération — le choix du fournisseur devient une décision de
settings (`EMBEDDING_PROVIDER`), pas une décision d'appelant.

> **✅ Décision (2026-07-21) : Voyage AI (API) sur le VPS actuel ; Ollama local
> comme cible future.** On voulait du local (gratuit, rien d'externalisé), mais le
> VPS de prod (OVH VPS-1, **4 Go RAM**, 2 vCores, déjà 5 conteneurs : Postgres,
> gunicorn, scheduler, nginx, Traefik) **ne peut pas héberger le modèle** sans
> risquer l'OOM sur l'app elle-même (§6.2). On fait donc tourner les embeddings
> via **l'API Voyage AI** (`voyage-3`, multilingue, partenaire recommandé par
> Anthropic, coût négligeable au volume foyer). L'abstraction `EmbeddingClient`
> garde **Ollama local (`bge-m3`) activable en un flag** dès que la machine passe à
> ≥ 8 Go — sans toucher une ligne de retrieval.

Trois options réalistes ; on retient Voyage sur cette machine, Ollama en cible :

| | **Local** (Ollama / sentence-transformers) | **Voyage AI** | **OpenAI** |
|---|---|---|---|
| Modèle type | `nomic-embed-text`, `bge-m3` | `voyage-3` | `text-embedding-3-small/large` |
| Dimensions | 768 / 1024 | 1024 | 1536 (réductible) |
| Multilingue | ✅ (bge-m3, nomic) | ✅ | ✅ |
| Coût / requête | **gratuit** (CPU/GPU local) | payant (~$0.06/M tokens) | payant (~$0.02/M tokens) |
| Données externalisées | **non** | oui (tiers) | oui (tiers) |
| Reco officielle | — | **celle d'Anthropic** | standard répandu |
| Dépendance projet | Ollama déjà anticipé (`LLMClient`) | 1 clé + SDK de plus | dépendance OpenAI (projet 100 % Anthropic) |
| Qualité (bench 2026) | très bonne | SOTA | très bonne |

**Pourquoi Voyage AI (`voyage-3`) sur cette machine :**
- **0 Go de RAM sur le VPS** — l'embedding se calcule chez le fournisseur, l'app
  garde toute sa mémoire (§6.2 explique pourquoi c'est décisif ici) ;
- **coût négligeable** au volume foyer : indexer ~190 docs (quelques milliers de
  chunks) = une fraction de centime, une fois ; les requêtes ensuite = quelques
  centimes/mois ;
- **multilingue SOTA** (fr/de/es/en) — colle à l'exigence multi-tenant du projet ;
- **partenaire recommandé par Anthropic** → cohérent avec la stack, pas de
  dépendance à un écosystème concurrent (contrairement à OpenAI).

Nuance confidentialité assumée : le texte indexé (dont l'OCR des factures) part
chez Voyage. Mais l'OCR **passe déjà par Claude/Anthropic** — Voyage est le même
partenaire, même frontière de confiance, pas un palier nouveau.

**Ollama local (`bge-m3`) reste la cible** dès que la RAM le permet (VPS ≥ 8 Go ou
machine dédiée) : gratuit, rien d'externalisé, multilingue. On y bascule avec
`EMBEDDING_PROVIDER=ollama` **sans refactorer le retrieval** — c'est tout l'intérêt
de l'abstraction. L'éval (backlog lot 4) sert alors à vérifier qu'on ne perd pas
de recall en changeant de modèle (les vecteurs n'étant pas comparables, ça impose
un ré-embed, cf. §6.1).

### 6.1 ⚠️ Changer de modèle = ré-embedding complet

La dimension du vecteur dépend du modèle (`bge-m3` = 1024, `nomic-embed-text` =
768, `text-embedding-3-small` = 1536…). Deux vecteurs produits par des modèles
différents **ne sont pas comparables** : changer de modèle ou de fournisseur
**impose de tout ré-embedder**. D'où (a) la management command de backfill avec
`--force` (backlog lot 2) et (b) le stockage du `model` sur chaque chunk pour
détecter l'obsolescence.

### 6.2 Empreinte serveur du mode local — la vraie contrainte

Un modèle d'embedding n'a **rien à voir** avec un LLM de génération côté
ressources : c'est une simple passe avant (texte → vecteur), pas de génération
autorégressive. Il tourne **sur CPU, sans GPU**.

| Modèle Ollama | Taille disque | RAM à prévoir | GPU |
|---|---|---|---|
| `nomic-embed-text` (léger) | ~275 Mo | ~1–2 Go | ❌ inutile |
| `bge-m3` (multilingue, défaut) | ~1,2 Go | ~2–3 Go | ❌ inutile |

À l'échelle d'un foyer :
- **backfill** (quelques milliers de chunks) : de l'ordre de **secondes à
  quelques minutes**, une seule fois ;
- **query-time** (embedder une question) : **~10–50 ms** sur CPU, négligeable
  devant l'appel Claude qui suit (2–4 s).

**La seule vraie question est donc : le VPS de prod a-t-il ~2–3 Go de RAM libre**
pour le process Ollama à côté de Django + Postgres ?

**Verdict sur le VPS actuel : non.** L'OVH VPS-1 (4 Go total) fait déjà tourner 5
conteneurs (Postgres, gunicorn `web`, `scheduler`, nginx, Traefik) → ~2 Go libres.
`bge-m3` chargé (~2–2,5 Go) passerait au ras et **exposerait l'app à l'OOM killer**
pendant les pics : c'est le site qui tomberait, pas juste l'indexation. Ce risque
ne vaut pas le coup pour une brique d'infra secondaire → **on fait tourner les
embeddings via l'API Voyage** (empreinte RAM nulle sur le VPS).

Bascule vers le local **sans changer le code** (rôle de l'abstraction) dès que la
RAM le permet :

1. **upgrade du VPS à ≥ 8 Go** (OVH le propose en un clic) → `EMBEDDING_PROVIDER=ollama`,
   `bge-m3`, container `ollama` ajouté au `docker-compose.prod.yml` ;
2. ou modèle plus léger `nomic-embed-text` (~1–1,5 Go) + swap si on veut rester
   local sur 4 Go en acceptant le risque — non retenu par défaut.

### 6.3 Le déploiement concret

- **Choix actuel (Voyage API)** : aucun conteneur ajouté. Une clé `VOYAGE_API_KEY`
  dans le `.env` de prod, `EMBEDDING_PROVIDER=voyage`. C'est tout.
- **Cible local (Ollama)** : un service de plus dans `docker-compose.prod.yml` —
  `ollama/ollama`, volume nommé pour le modèle pull une fois, réseau `internal`
  (jamais exposé par Traefik). `web`/`scheduler` l'appellent sur
  `http://ollama:11434` ; `EMBEDDING_BASE_URL` pointe là.

### 6.4 Choisir librement provider + modèle (tout par `.env`)

Les **trois** providers sont implémentés (REST via `httpx`, aucun SDK lourd) et
interchangeables **sans toucher au code** :

| `EMBEDDING_PROVIDER` | `EMBEDDING_MODEL` (exemples) | Clé |
|---|---|---|
| `voyage` (défaut) | `voyage-3`, `voyage-finance-2`, `voyage-law-2` | `VOYAGE_API_KEY` |
| `openai` | `text-embedding-3-small`, `text-embedding-3-large` | `OPENAI_API_KEY` |
| `ollama` | `bge-m3`, `nomic-embed-text` | — (`EMBEDDING_BASE_URL`) |

**Seule contrainte : la dimension doit valoir `EMBEDDING_DIMENSIONS` (1024)** — la
largeur de la colonne `EmbeddingChunk.embedding`. En pratique :
- `voyage-3` / `voyage-finance-2` / `voyage-law-2` / `bge-m3` sont **nativement
  1024** → aucun réglage ;
- OpenAI `text-embedding-3-*` (nativement 1536/3072) : le client envoie
  `dimensions=1024` (réduction Matryoshka) → rentre dans la colonne ;
- un modèle bloqué à une autre dimension (`voyage-3-lite`=512, `nomic-embed-text`=768)
  impose de changer `EMBEDDING_DIMENSIONS` **et** de migrer la colonne.

Un **garde-fou** (`embeddings._check_dimensions`) refuse explicitement tout vecteur
de largeur ≠ `EMBEDDING_DIMENSIONS` au lieu de laisser exploser Postgres à l'insert.

> **Changer de provider/modèle = ré-embedder** (les vecteurs ne sont pas
> comparables, §6.1) : `EMBEDDING_MODEL=…` dans le `.env` puis
> `manage.py backfill_embeddings --force`. Le lot 4 (`eval_retrieval`) permet de
> **benchmarker deux modèles** sur tes vraies questions avant de trancher.

## 7. Pourquoi cette implémentation — décisions clés

| Décision | Raison |
|---|---|
| **Hybride** (full-text **+** vecteur), pas remplacement | le foyer est plein d'identifiants exacts (marques, montants, n° série) que le vectoriel gère mal ; le full-text marche déjà et est gratuit — on ajoute une jambe, on n'en coupe pas une |
| **Fusion RRF** (rang, pas score) | scores `ts_rank` et distance cosinus non comparables ; RRF est sans calibrage, robuste, standard |
| **pgvector**, pas de base vectorielle dédiée | volume foyer modeste, une seule base à opérer, extension Postgres qu'on maîtrise déjà |
| **Table `EmbeddingChunk` dédiée** (FK polymorphe) | chunking obligatoire pour les longs OCR ; découple l'index des modèles métier ; le registry `searchables` reste la source de vérité |
| **`EmbeddingClient` Protocol** (miroir de `LLMClient`) | le fournisseur devient un choix de settings ; bascule prod ↔ local en un flag, sans refactor |
| **Voyage AI (`voyage-3`) en prod** (tranché 2026-07-21) | le VPS 4 Go ne peut pas héberger un modèle local sans risquer l'OOM sur l'app (§6.2) ; API = 0 Go RAM, coût négligeable, multilingue SOTA, partenaire Anthropic |
| **Ollama local (`bge-m3`) = cible RAM ≥ 8 Go** | gratuit, rien d'externalisé, multilingue ; activable en un flag quand la machine grandit — pas un chantier |
| **Pas d'index HNSW en V1** | scan exact instantané au volume foyer ; ajouter l'index est une optimisation locale plus tard |
| **Backfill par management command** | miroir de `extract_documents_text` : manuel, `--dry-run`, coût estimé — pas de re-embed automatique surprise |
| **Interface `Hit` inchangée** | `search_household` (le tool) et tout `apps/agent/` ne bougent pas : la fusion se fait **dans** `retrieval.search()`, l'agent ne sait pas que le vectoriel existe |

## 8. Ce qu'on écarte (et pourquoi)

| Idée | Pourquoi écartée pour ce chantier |
|---|---|
| **Remplacer le full-text** | perte du match exact sur identifiants ; on jette du code qui marche (cf. §3.4, §4.3) |
| **Base vectorielle dédiée** (Pinecone, Qdrant…) | un service de plus à opérer pour un gain nul au volume foyer |
| **Index HNSW dès le départ** | scan exact suffit ; paramètres à régler = complexité prématurée |
| **Reranking cross-encoder** (2ᵉ passe LLM sur le top-k) | vrai gain de précision, mais latence + coût ; à ouvrir **après** avoir mesuré que RRF plafonne (idée V2) |
| **Chunking sémantique** (découpe aux frontières de sens) | le chunking à fenêtre fixe + overlap suffit pour commencer ; raffiner à l'usage |
| **Embedder au niveau document entier** (pas de chunk) | dilue le sens des longs OCR ; on paie un peu de complexité de chunking pour un retrieval bien meilleur |
| **Supprimer `query_expansion`** | il aide *aussi* la jambe full-text ; on le garde, il devient moins critique côté sémantique |
| **Ré-embedding automatique en continu** | coût/surprise ; write-time + backfill manuel suffisent (lot 1 + 2) |

## 9. Comment ça s'insère dans le RAG existant

Rappel des 5 étapes du RAG (RAG.md §3). Ce chantier ne touche que **l'indexation**
(étape 1) et le **retrieval** (étape 2) :

| Étape | Avant (full-text) | Après (hybride) |
|---|---|---|
| 1. Indexation | `tsvector` à la volée par modèle | idem **+** `EmbeddingChunk` (write-time + backfill) |
| 2. Retrieval | `SearchVector` → `ts_rank` | full-text **+** k-NN pgvector → **fusion RRF** |
| 3. Augmentation | prompt + hits | **inchangé** |
| 4. Generation | Claude Haiku | **inchangé** |
| 5. Citation | `<cite id="type:id"/>` | **inchangé** |

Le contrat `search(household_id, query) -> list[Hit]` ne change pas de signature.
Tout `apps/agent/` (tools, service, conversation ancrée, écriture) est
**transparent** au changement : c'est le sens de l'abstraction posée en V1.

## 10. Glossaire

| Terme | Sens |
|---|---|
| **Embedding** | vecteur de N nombres représentant le sens d'un texte |
| **Vecteur / dimension** | liste de floats ; N (768, 1024, 1536) fixé par le modèle |
| **Similarité cosinus** | mesure d'angle entre deux vecteurs (1 = identique, 0 = sans rapport) |
| **k-NN** | *k nearest neighbors* — les k vecteurs les plus proches d'une requête |
| **Recherche sémantique** | retrouver par le sens (via embeddings) plutôt que par les mots |
| **Recherche hybride** | combiner recherche lexicale (full-text) et sémantique (vecteurs) |
| **RRF** | *Reciprocal Rank Fusion* — fusionner plusieurs classements via `1/(k+rang)` |
| **pgvector** | extension Postgres ajoutant le type `vector` et le k-NN |
| **HNSW / IVFFlat** | index approximatifs de pgvector pour un k-NN rapide à grand volume |
| **Chunk / chunking** | morceau de texte (~200-500 tokens) ; découper un long texte avant d'embedder |
| **Rappel (recall)** | proportion des bons résultats effectivement retrouvés |
| **Reranking** | 2ᵉ passe qui réordonne finement un top-k (souvent un cross-encoder) |
| **EmbeddingClient** | abstraction `house` du fournisseur d'embeddings (miroir de `LLMClient`) |

## 11. Pour aller plus loin

- [pgvector](https://github.com/pgvector/pgvector) — l'extension, sa doc, les
  opérateurs de distance et les index
- [Reciprocal Rank Fusion (papier original, Cormack 2009)](https://plg.uwaterloo.ca/~gvcormack/cormacksigir09-rrf.pdf)
- [Anthropic — Embeddings (recommandation Voyage AI)](https://docs.anthropic.com/en/docs/build-with-claude/embeddings)
- [Voyage AI — modèles d'embedding](https://docs.voyageai.com/docs/embeddings)
- [OpenAI — text-embedding-3](https://platform.openai.com/docs/guides/embeddings)
- [Ollama — embeddings (`nomic-embed-text`, `bge-m3`)](https://ollama.com/blog/embedding-models)
- [MTEB — le benchmark de référence des modèles d'embedding](https://huggingface.co/spaces/mteb/leaderboard)
- Fiche amont : [RAG.md](RAG.md) — le retrieval full-text qu'on étend ici
- Doc produit du parcours : [PARCOURS_21_RECHERCHE_SEMANTIQUE_HYBRIDE.md](../parcours/PARCOURS_21_RECHERCHE_SEMANTIQUE_HYBRIDE.md)
- Backlog technique : [PARCOURS_21_BACKLOG_TECHNIQUE.md](../parcours/PARCOURS_21_BACKLOG_TECHNIQUE.md)
