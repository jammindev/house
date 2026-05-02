# Parcours 07 — Poser une question en langage naturel sur son foyer

> **V1 livrée le 2026-05-02** — agent conversationnel utilisable sur `/app/agent/`, citations cliquables vers les entités du foyer. Détails de livraison en bas du document. Le backlog technique vit dans [PARCOURS_07_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_07_BACKLOG_TECHNIQUE.md).

Ce document détaille le septième parcours métier de House.

Il s'appuie sur le socle posé par les parcours 01 à 06 et s'inscrit dans la couche IA décrite par [PARCOURS_IA_TRANSVERSE.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_IA_TRANSVERSE.md).

## Résumé

Le septième usage fondamental du produit est le suivant :

"Je veux poser une question en langage naturel sur ma maison et obtenir une réponse fiable, sans avoir à fouiller chaque section."

Les six premiers parcours ont construit la mémoire du foyer : interactions, documents, projets, zones, équipements, alertes. Le produit sait beaucoup. Mais cette mémoire reste **passive et silotée** — pour répondre à une question simple, l'utilisateur doit naviguer, filtrer, croiser.

Ce parcours ouvre une seconde lecture de la mémoire du foyer : un agent conversationnel qui interroge cette mémoire et répond à la place de l'utilisateur, avec citations vérifiables.

## Positionnement produit

- Parcours 01–05 : capturer et organiser
- Parcours 06 : signaler ce qui mérite attention
- Parcours 07 : **interroger** la mémoire en langage naturel

L'agent ne remplace pas la navigation, il l'augmente. Pour une question floue ou transversale, demander vaut mieux que chercher.

## Concept interne

L'agent ne dispose d'aucune nouvelle source de vérité. Il s'appuie sur les données déjà en base :

- `Interaction` (notes, todos, dépenses, maintenances)
- `Document` + `Document.ocr_text` (texte extrait des factures, manuels, garanties)
- `Equipment` (garanties, dates de service)
- `Project`, `Zone`, `Contact`, `Structure`

Le verrou principal est que beaucoup de la valeur métier vit dans des documents non textuels (factures scannées, photos de manuels). Sans extraction OCR, ces documents sont aveugles à l'agent.

D'où la **Story 0 du parcours 07 : pipeline d'extraction OCR à l'upload** (issues #88 et #89).

## Concept visible côté utilisateur (V1 figée)

- **entrée** : libellé `Agent` dans la sidebar, icône `Sparkles`
- **surface** : page chat dédiée `/app/agent/` (pas de widget global en V1, à réévaluer après usage)
- **format de réponse** : texte libre avec marqueurs `<cite id="…"/>` rendus inline en chips numérotés cliquables, plus un panneau "Sources" en bas de bulle qui reprend la liste numérotée
- **mémoire conversationnelle** : aucune en V1 — chaque ouverture de page = session blanche. Décision : valider l'usage one-shot avant d'investir dans la persistance multi-tour (cf. lot 4 → V2)

## Objectif produit

Permettre à un membre du foyer de :

1. poser une question en langage naturel sur n'importe quelle entité du foyer
2. obtenir une réponse synthétique citant les sources (interaction, document, équipement)
3. naviguer en un clic depuis une citation vers l'entité d'origine
4. comprendre les limites de la réponse quand l'agent ne sait pas

## Ce que le projet a aujourd'hui (V1 livrée)

- ✅ pipeline d'extraction OCR à l'upload (#88) — Vision Haiku pour images, `pypdf` pour PDFs texte
- ✅ backfill OCR via management command (#89), bouton "Re-extraire" sur la fiche document
- ✅ OCR Vision multi-page sur PDFs scannés (#107) — `ocr_method='vision_pages'` quand `pypdf` rend du vide
- ✅ recherche full-text Postgres scopée household (#100) — registry par app, ajouter une entité = 5 lignes dans son `apps.py`
- ✅ service agent (`apps.agent.service.ask`) avec `LLMClient` Protocol, prompt qui contraint citation + ignorance, citations honnêtes (intersection avec le retrieval)
- ✅ endpoint `POST /api/agent/ask/` exploitable depuis la CLI ou l'UI
- ✅ surface React `/app/agent/` avec mention de confidentialité one-shot, bulles, citations cliquables
- ✅ table `AIUsageLog` qui logue chaque appel LLM agent (skeleton lot 6)

### Reste à finir hors V1 utilisateur

- `apps/ai_usage/` — agrégations + page admin (#109)
- intégration de l'OCR upload/backfill dans `LLMClient.vision_extract()` pour qu'il logue aussi (#109)
- stemming par foyer si l'usage le justifie (#113)

## Diagnostic actuel

Le produit a la mémoire mais pas la voix. Les six premiers parcours ont rendu cette mémoire structurée et navigable. Ce parcours la rend **interrogeable**.

L'effort est asymétrique :

- Story 0 (OCR) : prérequis technique, pas une fonctionnalité utilisateur visible
- Story 1+ : la vraie valeur produit, mais inutile sans Story 0

## Problème utilisateur précis

Quand l'utilisateur se demande "quand est-ce qu'on a changé la chaudière ?", il doit aujourd'hui :

1. ouvrir la fiche équipement chaudière
2. parcourir les interactions liées
3. ouvrir éventuellement les documents rattachés
4. lire la facture pour confirmer la date

Avec l'agent, il pose la question et obtient une réponse citée en une étape.

## Utilisateur cible

Tout membre du foyer, mais surtout celui qui n'a pas saisi la donnée lui-même et qui ne sait pas où chercher.

Exemples (issus de #51) :

- "Quand a-t-on changé la chaudière ?"
- "Quels équipements sont sous garantie ?"
- "Combien a coûté l'intervention du plombier le mois dernier ?"
- "Est-ce qu'on a un contrat d'entretien pour la VMC ?"
- "Qui est le contact du SAV de la machine à laver ?"

## Scénarios prioritaires

### Scénario A — Question factuelle simple

"Je demande 'quand expire la garantie du lave-vaisselle ?'. L'agent répond avec la date, et un lien vers la fiche équipement."

### Scénario B — Question agrégée

"Je demande 'combien on a dépensé en plomberie cette année ?'. L'agent additionne les interactions de type dépense liées au domaine plomberie et cite les sources."

### Scénario C — Question documentaire

"Je demande 'le manuel de la chaudière dit quoi sur la pression ?'. L'agent retrouve le document, cite le passage pertinent, donne un lien vers le PDF."

### Scénario D — Réponse incertaine

"Je demande quelque chose qui n'est pas dans la base. L'agent répond honnêtement qu'il ne sait pas, sans inventer."

## Parcours cible

### Poser une question

1. L'utilisateur ouvre la page agent depuis la sidebar (`/app/agent/`).
2. Il tape une question en langage naturel.
3. L'agent affiche une réponse contenant une ou plusieurs citations.
4. Chaque citation est cliquable et navigue vers l'entité d'origine.

### Reformuler ou approfondir (V2)

En V1, chaque question est traitée indépendamment — pas de mémoire conversationnelle multi-tour. L'utilisateur peut bien sûr enchaîner les questions dans la session courante (les bulles précédentes restent visibles à l'écran), mais l'agent ne re-lit pas les tours précédents pour répondre. Cette extension est documentée comme lot 4 → V2 dans le backlog technique, à arbitrer après quelques semaines d'usage one-shot.

## Règles produit

### Règle 1 — Le foyer est la seule frontière de connaissance

L'agent ne sait que ce qui est dans le household de l'utilisateur connecté. Pas de fuite entre households. Pas de connaissance externe au foyer (sauf langage et raisonnement génériques du modèle).

### Règle 2 — Toute réponse doit pouvoir être tracée

Une réponse sans citation possible est suspecte. L'agent doit indiquer ses sources ou reconnaître qu'il ne sait pas.

### Règle 3 — La pièce source reste la vérité

Si l'agent cite un document, l'utilisateur peut toujours ouvrir le document original pour vérifier. L'agent ne remplace jamais la pièce source.

### Règle 4 — L'agent ne crée pas, il répond

En V1, l'agent est en lecture seule. Pas d'action de création (interaction, tâche) déclenchée par l'agent. Cette extension est un sujet ultérieur (lien possible avec parcours 01 IA).

### Règle 5 — La latence doit rester acceptable

L'utilisateur attend une réponse en quelques secondes, pas plusieurs minutes. Le mode sync prévu en V1 fixe cette contrainte.

### Règle 6 — La confidentialité est explicite

L'utilisateur doit savoir que le contenu de son foyer (texte d'interactions, OCR de documents) est envoyé à un modèle externe (Claude). En V1 : mention de confidentialité au premier usage (modale Radix non-dismissible jusqu'à acceptation, persistance localStorage `agent.privacyAccepted.v1`). Trois points couverts : provider externe, scope household uniquement, pas de stockage du contenu des conversations. La redaction PII reste hors scope V1 (faible priorité en mode solo user, à arbitrer si on ouvre à d'autres utilisateurs).

## Backlog produit V1 — état de livraison

| Story | But | Statut | Issues / PRs |
|---|---|---|---|
| 0a | Pipeline OCR à l'upload | ✅ Livrée | #88 |
| 0b | Backfill OCR + bouton "Re-extraire" | ✅ Livrée | #89 |
| 0c | OCR Vision multi-page sur PDFs scannés | ✅ Livrée (bonus) | #107 → PR #111 |
| 1 | Recherche full-text scopée household | ✅ Livrée | #100 → PR #112 |
| 2 | Service d'appel LLM + citations honnêtes | ✅ Livrée | #101 → PR #114 |
| 3 | Surface UI chat `/app/agent/` | ✅ Livrée | #102 → PR #115 |
| 4 | Mémoire conversationnelle multi-tour | 🚫 Basculée V2 | — |
| 6 | Observabilité IA (KPIs + page admin) | 🟡 Skeleton livré (lot 2), agrégations + UI à faire | #109 |

Détails par story ci-dessous (référence pour les évolutions futures).

### Story 0 — Pipeline OCR à l'upload (prérequis)

En tant que membre du foyer,
je veux que le texte de mes documents soit extrait automatiquement à l'upload,
afin que l'agent puisse ensuite répondre à mes questions sur leur contenu.

#### Critères d'acceptation

- depuis iPhone, uploader une photo HEIC d'une facture papier → stockée en JPEG, `ocr_text` peuplé
- la page détail document affiche le texte extrait dans une section dédiée
- un upload réussit même si l'extraction échoue (`ocr_text=""`, pas d'erreur utilisateur)
- les uploads JPEG/PNG/PDF existants ne régressent pas
- les documents existants peuvent être re-extraits via management command et bouton UI

Issues : **#88** (lot 0a) + **#89** (lot 0b).

### Story 1 — Recherche full-text sur la mémoire du foyer

En tant que système,
je veux pouvoir rechercher dans le texte des interactions et des documents OCRés,
afin que l'agent dispose d'un mécanisme de récupération avant d'appeler le LLM.

#### Critères d'acceptation (livrés en #100 / PR #112)

- Postgres `SearchVector` (`config='simple_unaccent'`) à la volée par modèle, pas de matérialisation
- registry par app : chaque module déclare ses entités dans son `apps.py.ready()` via `agent.searchables.register()`
- 10 entités V1 indexées : Document, Interaction, Equipment, Task, Project, Zone, StockItem, InsuranceContract, Contact, Structure
- scope household systématique (pas d'opt-out)
- exposé en interne par `agent.retrieval.search(household_id, query, limit)` — pas d'endpoint UI dédié

### Story 2 — Service d'appel LLM

En tant que système,
je veux un service interne qui prend une question utilisateur et un contexte récupéré,
et qui appelle Claude pour produire une réponse citée.

#### Critères d'acceptation (livrés en #101 / PR #114)

- `apps/agent/service.ask(question, household)` orchestre retrieval → prompt → LLM → parsing citations
- abstraction `LLMClient` Protocol + `AnthropicClient` concret (factory `get_llm_client()` keyed sur `LLM_PROVIDER`)
- contrat de sortie : `{answer, citations[{entity_type, id, label, snippet, url_path}], metadata{duration_ms, tokens_in, tokens_out, model}}`
- prompt système qui contraint les citations au format `<cite id="entity_type:id"/>` et l'aveu d'ignorance
- citations honnêtes : intersection regex des marqueurs avec les hits du retrieval — un marqueur inventé est ignoré
- shortcuts IDK (zéro retrieval, API key absente, question vide) → pas d'appel LLM
- timeout 30s, mapping `LLMTimeoutError → 504`, `LLMError → 503`
- tests : zéro appel réseau Anthropic en CI, fakes via Protocol

### Story 3 — Surface UI chat

En tant que membre du foyer,
je veux une interface où poser mes questions,
afin d'utiliser l'agent au quotidien.

#### Critères d'acceptation (livrés en #102 / PR #115)

- page dédiée `/app/agent/` accessible depuis la sidebar (icône `Sparkles`, libellé `Agent`)
- input multi-ligne (`Enter` envoie, `Shift+Enter` saute une ligne), bulles question/réponse, loader animé
- citations rendues inline en chips numérotés cliquables qui naviguent vers `url_path`, plus un panneau "Sources" en bas de bulle
- chip différencié par `entity_type` (icône Lucide adaptée pour les 10 types) et title=snippet au survol
- mention de confidentialité au premier usage (modale Radix non-dismissible, persistance localStorage `agent.privacyAccepted.v1`)
- i18n complet en/fr/de/es (namespace `agent`)
- 5 tests E2E Playwright (mock backend) : golden path + privacy notice + IDK + URL de citation par type d'entité

### Story 4 — Mémoire conversationnelle (basculée V2)

En tant que membre du foyer,
je veux retrouver mes échanges précédents avec l'agent,
afin de continuer une conversation ou retrouver une réponse passée.

#### Décision (2026-04-29) : 🚫 hors V1

Pas livrée en V1. La V1 fonctionne en mode questions one-shot (chaque ouverture de page = session blanche). Décision motivée par : (1) pas certain que l'usage le demande, (2) coût d'implémentation non négligeable (modèles, scope, rétention, streaming), (3) on saura mieux quoi en faire après quelques semaines d'usage.

#### Pistes pour V2 (à arbitrer après recette manuelle)

- modèles `AgentConversation(household, créé par, titre auto, last_message_at)` + `AgentMessage(conversation, role, content, citations, metadata)`
- scope : conversation appartient à un user dans un household (privée), ou partagée au foyer ?
- liste des conversations dans la sidebar de la page agent
- nettoyage automatique au-delà d'une rétention donnée
- streaming de réponse (en parallèle ou indépendant)

## Interface livrée

- nouvelle surface chat plein écran sur `/app/agent/`, accessible depuis la sidebar
- pas de widget global ni d'entrée dashboard en V1 (à réévaluer après usage : si l'agent devient un point d'entrée fréquent, un raccourci global `/` ou un widget dashboard pourra être ajouté)

## Écrans impactés

- aucun écran existant n'a été modifié pour Story 0 (extension transparente du flux upload)
- nouvelle page `/app/agent/` (Story 3)
- nouvelle entrée sidebar dans le groupe d'accueil (entre `Dashboard` et `Alertes`)

## Hors scope pour la V1

- agent qui crée ou modifie des entités (lecture seule en V1)
- ingestion email entrante
- intégration WhatsApp ou autre canal externe
- vocaux ou reconnaissance d'images en entrée
- réponses temps réel via streaming (sync simple suffit en V1)
- recherche multi-household pour les utilisateurs ayant plusieurs foyers
- fine-tuning ou modèle local

## Évolutions ultérieures de la couche IA

Le parcours 07 est le premier porteur d'implémentation IA. Une fois la V1 livrée, deux extensions IA sont déjà identifiées et concernent les parcours 01 et 02 (livrés sans IA aujourd'hui). Les sujets ci-dessous étaient documentés dans deux notes séparées (`PARCOURS_01_CAPTURE_ASSISTEE_PAR_IA.md` et `PARCOURS_02_COMPREHENSION_ASSISTEE_PAR_IA.md`) — désormais consolidés ici pour éviter la dispersion.

### Extension 1 — Capture conversationnelle d'événements (parcours 01 IA)

Permettre à un membre du foyer de **créer une interaction** depuis un canal externe (chat IA, WhatsApp, email entrant) sans passer par le formulaire web. L'IA produit un candidat structuré, l'utilisateur valide (lien avec issue **#50**).

#### Sujets spécifiques à anticiper

- **Zone obligatoire** : aujourd'hui, une `Interaction` exige au moins une zone. C'est un bon garde-fou pour la saisie manuelle, mais bloquant pour un message libre. Trois stratégies à arbitrer :
  1. l'IA infère la zone avec une confiance suffisante
  2. le système utilise une zone par défaut implicite type `À classer`
  3. le système crée un brouillon à confirmer (lien avec le mode `needs_review` du transverse)
- **Résolution utilisateur + household** : un canal externe doit identifier qui parle, dans quel foyer, et si la création est faite au nom de l'utilisateur ou via un compte système assistant. Le multi-tenant actuel est compatible mais le canal devra l'enforcer.
- **Provenance enrichie** : `metadata.ai.source_message_id` en plus des champs standards quand le canal expose un identifiant stable.

### Extension 2 — Compréhension assistée de documents (parcours 02 IA)

Une fois le pipeline OCR en place (lot 0 du parcours 07), l'extraire pour qu'elle ne serve pas seulement à l'agent en lecture, mais aussi à **suggérer une qualification** au moment de l'ajout d'un document : type probable (facture, devis, manuel, garantie), montants, dates, fournisseur, et candidats de rattachement (activité, projet, zone).

#### Sujets spécifiques à anticiper

- **OCR imparfait et ambiguïté documentaire** : un document peut être mal scanné ou mal cadré. Le système ne doit jamais dépendre d'une lecture parfaite pour rester utile. La pièce source doit toujours rester consultable au-delà du résumé IA.
- **Faux rattachements et hallucinations de contexte** : l'IA peut proposer un mauvais projet ou une mauvaise interprétation. Les trois modes du transverse (`auto` / `needs_review` / `draft`) s'appliquent ; un mécanisme de validation explicite reste nécessaire.
- **Documents sensibles ou bruités** : tous les documents ne doivent pas être interprétés avec la même agressivité (administratif ambigu, données personnelles sensibles, photo peu lisible, document composite). Le design doit permettre de rester utile sans interprétation forte.
- **Canal email entrant** : à terme, certains documents arriveront par email plutôt que par upload. Le runtime actuel ne le supporte pas — la couche IA documents doit rester compatible avec ce futur canal sans en dépendre.

### Position commune

Ces deux extensions partagent les principes du transverse (proposition vs vérité, niveaux de confiance, provenance, mode `needs_review`). Elles n'introduisent pas de nouveau contrat IA : elles réutilisent celui posé pour l'agent conversationnel.

## Décisions produit recommandées

### 1. Provider et modèle

**Décidé dans #88** : Claude Haiku 4.5 Vision pour OCR (images), `pypdf` pour PDFs texte (avec fallback Vision multi-page sur PDFs scannés depuis #107). SDK officiel `anthropic`.

**Décidé dans #101 / lot 2** : agent conversationnel sur Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), même API key qu'OCR. Validé en prod : 188 docs sur le foyer "Les Petits Bonheur", réponses à 2-3s, 200-1500 tokens en input typique. Sonnet réservé aux cas où Haiku échoue manifestement (pas observé en V1).

### 2. Sync vs async

**Décidé dans #88** : sync pour V1, pas de Celery. Async hors scope tant que les volumes restent petits.

Pour la couche agent, le sync semble également acceptable en V1 vu la latence cible (quelques secondes).

### 3. Stockage des extractions

**Décidé dans #88** :

- texte extrait dans `Document.ocr_text` (champ existant)
- traçabilité dans `metadata` : `ocr_extracted_at`, `ocr_method` (`vision_haiku` | `pypdf` | `skipped`)

### 4. Stockage des conversations

**Décidé** : pas de stockage en V1 (cf. Story 4). Les bulles à l'écran sont en mémoire React, perdues au reload.

### 5. Périmètre des données envoyées au LLM

**Décidé en V1** : on envoie les hits du retrieval (10 entités, ~12 hits max, snippet ~150 chars chacun), pas la base entière. Scope household enforced côté retrieval. Pas de redaction PII (faible priorité solo user, à arbitrer si on ouvre à d'autres utilisateurs).

**Audit log** : table `AIUsageLog` populated à chaque appel LLM (lot 2 livré, agrégations + page admin = lot 6 / #109). On stocke métadonnées (feature, provider, model, durée, tokens, success), **pas le contenu** des prompts ou réponses — décision tranchée pour limiter la surface confidentialité.

## Définition de done — V1 livrée le 2026-05-02

Tous les critères sont satisfaits :

1. ✅ tous les documents (anciens et nouveaux) ont leur texte extrait et indexé (#88, #89, #107)
2. ✅ on peut poser une question en langage naturel depuis l'application (`/app/agent/`)
3. ✅ l'agent répond avec au moins une citation vérifiable vers l'entité d'origine (intersection regex avec le retrieval, citations honnêtes)
4. ✅ l'agent reconnaît honnêtement quand il ne sait pas (IDK shortcuts + prompt système)
5. ✅ la latence reste acceptable — observé en prod : 2-4s pour les requêtes typiques (188 docs, ~1000 tokens input)
6. ✅ la mention de confidentialité est claire avant la première utilisation (modale Radix non-dismissible, localStorage)

## Recette manuelle (à faire à l'usage)

À pratiquer pendant 1-2 semaines sur le foyer réel pour repérer ce qui craque concrètement :

1. uploader une nouvelle facture HEIC → vérifier que `ocr_text` est peuplé
2. lancer le backfill OCR sur 5 documents existants → vérifier les textes extraits
3. poser une question simple sur un équipement → vérifier réponse + citation cliquable
4. poser une question dont la réponse n'est pas dans la base → vérifier l'aveu d'ignorance
5. vérifier le scope household (deux comptes différents posent la même question, réponses isolées)
6. **noter les questions qui ratent** — ce qui devait matcher mais qui n'a pas matché (déclencheur de #113 : stemming par foyer)

Backlog technique associé : [PARCOURS_07_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_07_BACKLOG_TECHNIQUE.md)
Fiche concept (RAG) : [docs/fiches/RAG.md](/Users/benjaminvandamme/Developer/house/docs/fiches/RAG.md)
