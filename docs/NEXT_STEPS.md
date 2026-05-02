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

## Idées long terme

- Lot 4 du parcours 07 — mémoire conversationnelle multi-tour (basculée V2). À arbitrer si l'usage one-shot devient frustrant.
- Streaming de réponse dans le chat agent (UX, pas critique tant que latence reste à 2-4s).
- `OllamaClient` pour faire tourner l'agent en local (l'abstraction `LLMClient` est déjà prête).
- Embeddings vectoriels (`pgvector`) si le full-text plafonne — refactor incrémental, pas une refonte.

## Comment garder cette doc à jour

À relire à chaque fin de gros chantier (livraison d'un parcours, ouverture multi-user, pivot produit). Les issues GitHub restent la source de vérité du backlog ; ce document hiérarchise et donne le narratif.
