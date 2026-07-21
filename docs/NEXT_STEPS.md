# Next steps

État au 2026-05-02. Petite doc pour ne pas perdre le fil après la livraison de la V1 du parcours 07.

## Maintenant — recette manuelle (1-2 semaines)

Utiliser l'agent au quotidien sur le foyer réel ("Les Petits Bonheur", 188 docs) avant d'ouvrir des chantiers d'optimisation.

- [ ] poser des questions au quotidien dans `/app/agent/`
- [ ] noter les questions qui ratent un match évident → déclencheur de #113 (stemming par foyer)
- [ ] noter les réponses où la citation paraît bizarre → déclencheur d'un fix prompt ou retrieval
- [ ] noter les latences inacceptables → déclencheur d'un cache / reformulation prompt
- [ ] fermer #51 (issue parente du parcours 07) une fois la recette terminée

But : ouvrir des issues **ciblées** plutôt que sur-investir à l'aveugle.

## Court terme — issues ouvertes du parcours 07

| Issue | Sujet | Quand | Effort |
|---|---|---|---|
| #109 | Lot 6 — observabilité IA (KPIs + page admin) | Quand le besoin de métriques se fait sentir | ~2 jours |
| #113 | Stemming par foyer (`Household.preferred_language`) | Si l'usage révèle des matches ratés "facture"↔"factures" | ~1 jour |

Lot 6 (#109) : le backend skeleton est déjà livré (modèle `AIUsageLog` + helper + admin). Reste : agrégations, API, UI page admin `/app/admin/ai-usage/`, refacto OCR pour passer par `LLMClient.vision_extract()`.

## Court terme — autres chantiers déjà cadrés

| Issue | Sujet | Pourquoi |
|---|---|---|
| #69 | Page 404 + Error Boundary global | Polish UI avant ouverture multi-user |
| #65 | Page Assurances — frontend manquant | Trou produit visible |
| #67 | Champ montant structuré pour les dépenses | Débloque le scénario B du parcours 07 ("combien j'ai dépensé en plomberie") |
| #75 | Récurrence des tâches | Demande utilisateur récurrente |

## Moyen terme — prochain parcours métier

**Parcours 06 — Alertes et rappels proactifs** est le seul parcours métier V1 pas encore démarré.

- doc produit : [`docs/parcours/PARCOURS_06_ALERTES_ET_RAPPELS_PROACTIFS.md`](./parcours/PARCOURS_06_ALERTES_ET_RAPPELS_PROACTIFS.md)
- backlog : [`docs/parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md`](./parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md)
- issue parente liée : #40 (assignation de tâche + notifications, V2 du parcours 06)

À démarrer après la recette du parcours 07 si on veut élargir plutôt qu'approfondir.

## Moyen terme — parcours 09 : piloter la maison connectée

Cadré le 2026-07-03. Base domotique générique multi-constructeurs (capabilities normalisées + couche adapter), premier provider Shelly Cloud, intégration agent (lecture d'état via RAG + tool `control_device`). Preuve V1 : piloter le Shelly 2PM réel (volet roulant).

- doc produit : [`docs/parcours/PARCOURS_09_PILOTER_LA_MAISON_CONNECTEE.md`](./parcours/PARCOURS_09_PILOTER_LA_MAISON_CONNECTEE.md)
- backlog : [`docs/parcours/PARCOURS_09_BACKLOG_TECHNIQUE.md`](./parcours/PARCOURS_09_BACKLOG_TECHNIQUE.md)
- issues : #183 (socle), #185 (provider Shelly), #186 (services + API), #187 (frontend), #188 (agent), #189 (V2 différée : mesures, cron, webhooks, chiffrement)

## Moyen terme — parcours 10 : analyser la consommation électrique

Cadré le 2026-07-04. Onglet Consommation du module Électricité : modèle pivot générique multi-pays (`ConsumptionRecord` en Wh sur intervalle explicite), relevés d'index manuels matérialisés en estimations quotidiennes, imports idempotents via registry d'adaptateurs (`enedis_csv` + `generic_csv` à mapping libre), agrégation serveur heure/jour/mois/année, chart Recharts (première lib de graphiques du projet), agent (somme kWh via `list_entities`, relevé dicté avec undo). Preuve V1 : la courbe de charge Enedis réelle importée donne les mêmes totaux que l'espace client.

- doc produit : [`docs/parcours/PARCOURS_10_ANALYSER_LA_CONSOMMATION_ELECTRIQUE.md`](./parcours/PARCOURS_10_ANALYSER_LA_CONSOMMATION_ELECTRIQUE.md)
- backlog : [`docs/parcours/PARCOURS_10_BACKLOG_TECHNIQUE.md`](./parcours/PARCOURS_10_BACKLOG_TECHNIQUE.md)
- issues : #198 (socle backend), #199 (importers), #200 (frontend), #201 (agent), #202 (V2 différée : coût €, comparaisons, sync auto, autres fluides)

## Moyen terme — parcours 11 : tracker des valeurs dans le temps

Cadré le 2026-07-04. Séries de valeurs numériques datées (compteurs, niveaux, heures, budgets, poids) ancrées sur l'existant : FK projet (onglet du détail projet) + liaison générique vers toute entité du foyer (via le registry `agent.searchables`). Saisie rapide depuis la carte, sparkline SVG maison, valeurs citables par l'agent via `entries_summary` (même pont RAG que le parcours 09) et relevé dicté via `create_entity` avec undo. Preuve V1 : le relevé mensuel du compteur d'eau en moins de dix secondes.

- doc produit : [`docs/parcours/PARCOURS_11_TRACKER_DES_VALEURS.md`](./parcours/PARCOURS_11_TRACKER_DES_VALEURS.md)
- backlog : [`docs/parcours/PARCOURS_11_BACKLOG_TECHNIQUE.md`](./parcours/PARCOURS_11_BACKLOG_TECHNIQUE.md)
- issues : #192 (socle), #193 (services + API), #194 (frontend), #195 (embed projet), #196 (agent), #197 (V2 différée : graphes riches, agrégats, rappels, panneaux entités)

## Moyen terme — extensions IA des parcours 01 et 02

S'appuient sur la couche IA déjà posée (`LLMClient`, `AIUsageLog`, citations). À arbitrer après quelques semaines d'usage de l'agent V1.

| Issue | Sujet |
|---|---|
| #50 | Capture d'interaction depuis WhatsApp / email / IA (parcours 01 IA) |
| — | Compréhension assistée de documents à l'upload (parcours 02 IA, suggestion de qualification) |

Décisions transverses tranchées dans [`docs/parcours/PARCOURS_IA_TRANSVERSE.md`](./parcours/PARCOURS_IA_TRANSVERSE.md). Restent à arbitrer : contrat de proposition (schéma JSON unique vs par entité), stockage des suggestions, stratégie zone manquante, résolution utilisateur+household pour canaux externes.

## Moyen terme — ouverture multi-user

Tant qu'on est en solo user, le bar de qualité reste indulgent. Avant d'ouvrir l'app à d'autres utilisateurs :

| Issue | Sujet |
|---|---|
| #58 | Audit global du code et préparation du MVP pour ouverture aux utilisateurs |
| #59 | Page d'inscription (signup) — frontend manquant |
| #64 | Vérifier et activer l'envoi d'email pour les invitations foyer |
| #48 | Audit log pour les actions sensibles |
| #49 | 2FA / TOTP |
| #52 | Compte démo en lecture seule |
| #39 | Séparer Documents et Photos (modèles distincts) |

## Moyen terme — parcours 21 : recherche sémantique hybride (embeddings)

Cadré le 2026-07-21. **Chantier technique transverse** (pas de surface UI nouvelle) : ajouter une jambe sémantique (embeddings `pgvector`) **à côté** du full-text actuel, fusionnée par Reciprocal Rank Fusion — l'agent retrouve par le sens quand le vocabulaire de la question diverge des documents (« le chauffage » → facture « pompe à chaleur »). Abstraction `EmbeddingClient` (miroir de `LLMClient`) ; fournisseur prod tranché : **API Voyage AI** (`voyage-3`, multilingue) — le VPS 4 Go ne peut pas héberger un modèle local sans risquer l'OOM, l'API = 0 Go RAM + coût négligeable ; Ollama local (`bge-m3`) reste la cible RAM ≥ 8 Go, activable en un flag. Table d'index `EmbeddingChunk` + chunking, backfill par management command, flag de rollback, qualité validée par éval `recall@k`/`MRR`. `retrieval.search()` garde sa signature → tout `apps/agent/` est transparent au changement. Prend le relais de l'ancienne idée « embeddings si le full-text plafonne » : le plafond a été touché à l'usage.

- doc produit : [`docs/parcours/PARCOURS_21_RECHERCHE_SEMANTIQUE_HYBRIDE.md`](./parcours/PARCOURS_21_RECHERCHE_SEMANTIQUE_HYBRIDE.md)
- fiche concept (le cours) : [`docs/fiches/EMBEDDINGS.md`](./fiches/EMBEDDINGS.md)
- backlog : [`docs/parcours/PARCOURS_21_BACKLOG_TECHNIQUE.md`](./parcours/PARCOURS_21_BACKLOG_TECHNIQUE.md)
- issues : #327 (lot 0 socle), #328 (lot 1 EmbeddingChunk), #329 (lot 2 backfill), #330 (lot 3 retrieval hybride RRF), #331 (lot 4 éval + observabilité), #332 (lot 5 idées V2)

## Idées long terme

- Lot 4 du parcours 07 — mémoire conversationnelle multi-tour (basculée V2). À arbitrer si l'usage one-shot devient frustrant.
- Streaming de réponse dans le chat agent (UX, pas critique tant que latence reste à 2-4s).
- `OllamaClient` pour faire tourner l'agent en local (l'abstraction `LLMClient` est déjà prête).
- **Chiffrement des documents** (milestone GitHub [#8](https://github.com/jammindev/house/milestone/8)) — protéger le contenu des documents/photos, aujourd'hui stockés en clair (`MEDIA_ROOT` sur le VPS, `ocr_text` en clair en DB). Deux phases :
  - **Phase 1 — chiffrement au repos** (le serveur garde la clé) : protège contre un vol de disque / backup qui fuite, **sans casser** OCR / full-text / RAG. Meilleur rapport bénéfice/coût, à faire en premier.
  - **Phase 2 — coffre E2EE sélectif** (le client garde la clé) : s'appuie sur `documents.is_private`, l'user marque un doc comme « coffre » → chiffré côté client, **exclu** de l'OCR / full-text / RAG (trade-off assumé et affiché).
  - Hors scope : E2EE total du corpus (casserait le RAG serveur-side).

## Comment garder cette doc à jour

À relire à chaque fin de gros chantier (livraison d'un parcours, ouverture multi-user, pivot produit). Les issues GitHub restent la source de vérité du backlog ; ce document hiérarchise et donne le narratif.
