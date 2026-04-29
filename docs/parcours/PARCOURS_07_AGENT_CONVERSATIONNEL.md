# Parcours 07 — Poser une question en langage naturel sur son foyer

> **Draft** — ce document a été reconstitué à partir des issues #88, #89 et #51 (chat IA household). Il est à relire et corriger. Les sections marquées `À préciser` attendent une décision produit.

Ce document détaille le septième parcours métier à travailler dans House.

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

## Concept visible côté utilisateur

`À préciser` — vocabulaire et surface à valider :

- entrée : `Demander`, `Poser une question`, `Assistant` ?
- surface : page chat dédiée ? widget global ? bouton sur le dashboard ?
- format de réponse : texte libre + liens vers les entités citées
- mémoire conversationnelle : historique persisté, ou stateless par session ?

## Objectif produit

Permettre à un membre du foyer de :

1. poser une question en langage naturel sur n'importe quelle entité du foyer
2. obtenir une réponse synthétique citant les sources (interaction, document, équipement)
3. naviguer en un clic depuis une citation vers l'entité d'origine
4. comprendre les limites de la réponse quand l'agent ne sait pas

## Ce que le projet a déjà aujourd'hui

### Données sources disponibles

- `Interaction` avec types et metadata — API existante
- `Document` avec champ `ocr_text` (présent en modèle, **non peuplé** automatiquement à ce jour)
- `Equipment` avec garanties et dates de maintenance
- Endpoint placeholder `reprocess_ocr` sur `DocumentViewSet`

### Ce qui manque pour fermer le parcours

- pipeline d'extraction OCR à l'upload (issue #88)
- backfill OCR pour les documents existants (issue #89)
- recherche full-text exploitable côté backend
- couche RAG ou récupération contextuelle
- service d'appel LLM (Claude Haiku 4.5 vu dans les issues)
- surface UI chat
- mécanisme de citation et de navigation vers les entités citées

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

1. L'utilisateur ouvre la surface agent (`À préciser`).
2. Il tape une question en langage naturel.
3. L'agent affiche une réponse contenant une ou plusieurs citations.
4. Chaque citation est cliquable et navigue vers l'entité d'origine.

### Reformuler ou approfondir

1. L'utilisateur peut affiner sa question dans le même fil.
2. L'agent garde le contexte de la conversation en cours (`À préciser` : durée, persistance).

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

L'utilisateur doit savoir que le contenu de son foyer (texte d'interactions, OCR de documents) est envoyé à un modèle externe (Claude). `À préciser` : copy de mention, opt-in, redaction.

## Backlog produit recommandé pour la V1

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

#### Critères d'acceptation

`À préciser` — détails à valider, pistes :

- Postgres `SearchVector` sur `Interaction.subject + description + metadata` et `Document.ocr_text + name + notes`
- index dédié, scope household systématique
- endpoint interne ou utilitaire Python utilisé par la couche agent

### Story 2 — Service d'appel LLM

En tant que système,
je veux un service interne qui prend une question utilisateur et un contexte récupéré,
et qui appelle Claude pour produire une réponse citée.

#### Critères d'acceptation

`À préciser` — détails à valider, pistes :

- module `apps/agent/` ou utilitaire dans `apps/<existant>/`
- contrat d'entrée : question, household, historique optionnel
- contrat de sortie : réponse texte + liste de citations (id + type d'entité)
- timeout, retry, gestion d'erreur explicite
- client Anthropic mocké systématiquement en tests

### Story 3 — Surface UI chat

En tant que membre du foyer,
je veux une interface où poser mes questions,
afin d'utiliser l'agent au quotidien.

#### Critères d'acceptation

`À préciser` — détails à valider :

- surface : page dédiée `/app/agent/` ? widget ? entrée depuis le dashboard ?
- composant chat : input, historique de la session, indicateur de chargement
- rendu des citations cliquables menant aux entités d'origine
- mention de confidentialité visible
- i18n complet (en, fr, de, es)

### Story 4 — Mémoire conversationnelle (optionnel V1)

En tant que membre du foyer,
je veux retrouver mes échanges précédents avec l'agent,
afin de continuer une conversation ou retrouver une réponse passée.

#### Critères d'acceptation

`À préciser` — décision V1 vs V2 à prendre :

- conservation de l'historique : oui/non, durée
- modèle `AgentConversation` + `AgentMessage` ?
- scope household ou utilisateur ?

## Recommandation d'interface

`À préciser` — pas de wireframe figé. À discuter.

## Écrans impactés

- pas d'écran existant impacté en Story 0 (extension du flux upload existant)
- nouvelle surface chat en Story 3 (`À préciser`)
- éventuel widget global ou entrée dashboard (`À préciser`)

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

**Décidé dans #88** : Claude Haiku 4.5 Vision pour OCR (images), `pypdf` pour PDFs texte. SDK officiel `anthropic`.

`À préciser` pour la couche agent (Story 2) : Haiku ou Sonnet ? mêmes credentials ? ratio coût/qualité ?

### 2. Sync vs async

**Décidé dans #88** : sync pour V1, pas de Celery. Async hors scope tant que les volumes restent petits.

Pour la couche agent, le sync semble également acceptable en V1 vu la latence cible (quelques secondes).

### 3. Stockage des extractions

**Décidé dans #88** :

- texte extrait dans `Document.ocr_text` (champ existant)
- traçabilité dans `metadata` : `ocr_extracted_at`, `ocr_method` (`vision_haiku` | `pypdf` | `skipped`)

### 4. Stockage des conversations

`À préciser` — selon décision Story 4.

### 5. Périmètre des données envoyées au LLM

`À préciser` — politique de redaction, scope par requête, audit log des prompts.

## Définition de done du parcours 07

Le parcours peut être considéré comme livré si, pour un utilisateur réel :

1. tous ses documents (anciens et nouveaux) ont leur texte extrait et indexé
2. il peut poser une question en langage naturel depuis l'application
3. l'agent répond avec une citation vérifiable vers l'entité d'origine
4. l'agent reconnaît honnêtement quand il ne sait pas
5. la latence reste acceptable (`À préciser` : SLA ?)
6. la mention de confidentialité est claire avant la première utilisation

## Check de validation manuelle

`À préciser` — scénarios complets à valider une fois la Story 3 livrée. Pistes :

1. uploader une nouvelle facture HEIC → vérifier que `ocr_text` est peuplé
2. lancer le backfill OCR sur 5 documents existants → vérifier les textes extraits
3. poser une question simple sur un équipement → vérifier réponse + citation cliquable
4. poser une question dont la réponse n'est pas dans la base → vérifier l'aveu d'ignorance
5. vérifier le scope household (deux comptes différents posent la même question, réponses isolées)

Backlog technique associé : [PARCOURS_07_BACKLOG_TECHNIQUE.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_07_BACKLOG_TECHNIQUE.md)
