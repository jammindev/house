# Couche IA — note transverse

Ce document est le chapeau commun aux notes de compatibilité IA déjà rédigées par parcours.

Il factorise les principes, le vocabulaire et les décisions à trancher avant d'attaquer une vraie implémentation. Il ne remplace pas les notes par parcours, il les unifie.

Voir aussi :

- [PARCOURS_07_AGENT_CONVERSATIONNEL.md](/Users/benjaminvandamme/Developer/house/docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md) — premier porteur d'implémentation IA (agent en lecture seule + extensions futures pour capture conversationnelle et compréhension de documents)

## Objet

Les deux notes IA actuelles sont parallèles : elles vérifient parcours par parcours que le socle reste compatible avec une future couche IA. Elles convergent sur les mêmes principes mais n'ont jamais été factorisées.

Ce document a trois rôles :

1. exposer une vision unifiée de la couche IA produit
2. figer le vocabulaire commun (provenance, confiance, modes de validation)
3. lister explicitement les décisions transverses à trancher avant implémentation

Tout ce qui est ici l'emporte sur les notes par parcours en cas de divergence.

## Promesse produit unifiée

> Un membre du foyer doit pouvoir capturer, recevoir ou qualifier un élément avec le moins d'effort possible, quel que soit le canal d'entrée, sans perdre la traçabilité de la pièce source ni le contrôle final.

Cette promesse couvre les deux parcours IA :

- parcours 01 : capter un événement à partir d'un message libre, d'un formulaire, ou d'un canal externe
- parcours 02 : comprendre un document entrant et le relier au bon contexte métier

Dans les deux cas, le formulaire web reste un client crédible parmi d'autres canaux d'entrée.

## Principe cible

La couche IA ne remplace jamais le contrat métier.

Elle :

1. reçoit une entrée brute : message libre, document, OCR, email, etc.
2. produit une **proposition structurée** alignée sur les contrats métier existants
3. appelle la même couche de création ou de mise à jour que la saisie manuelle
4. conserve la provenance, le texte brut et le niveau de confiance

Conséquence : aucun chemin parallèle. Une `Interaction` créée par IA passe par le même serializer qu'une `Interaction` créée par formulaire. Un rattachement de document suggéré par IA utilise le même contrat `InteractionDocument` que le rattachement manuel.

## Modèle d'architecture

```
canaux d'entrée                  noyau métier
───────────────                  ──────────────
formulaire web        ─┐
chat IA               ─┤
WhatsApp              ─┤   ┌──> Interaction
email entrant         ─┼───┤
upload document       ─┤   └──> Document + InteractionDocument
OCR pipeline          ─┘
```

Règles structurantes :

- les canaux n'écrivent pas directement en base, ils passent par le service métier
- la couche IA est un **producteur de propositions**, pas un canal d'entrée à part entière
- une proposition IA peut elle-même être issue de n'importe quel canal (WhatsApp + IA, email + IA, upload + OCR + IA)

## Contrat de provenance unifié

Toute proposition IA doit conserver dans `metadata` un sous-objet stable. Ce sous-objet est la fusion factorisée des deux notes existantes.

```jsonc
{
  "ai": {
    "source": "whatsapp" | "email" | "upload" | "photo" | "manual" | "chat",
    "source_message_id": "string?",      // si canal externe identifiable
    "raw_text": "string?",               // texte brut d'origine
    "ocr_engine": "string?",             // si extraction OCR
    "parsed_by": "string",               // identifiant du modèle/version
    "confidence": 0.0,                   // 0.0 à 1.0
    "review_state": "auto" | "needs_review" | "draft" | "rejected",
    "suggestions": {                     // optionnel, parcours 02 surtout
      "type": "string?",
      "links": [],
      "summary": "string?"
    }
  }
}
```

Règles :

- ce sous-objet est **optionnel** pour les créations manuelles, **obligatoire** pour les créations IA
- les champs spécifiques à un parcours vivent sous `ai.suggestions` pour ne pas polluer la racine
- la pièce source (texte, fichier) reste accessible — la proposition IA ne la remplace pas

## Niveaux de confiance et modes de validation

Trois modes uniques, valables pour les deux parcours :

| Confiance | Mode | Comportement |
|-----------|------|--------------|
| Haute | `auto` | création directe, suggestion mise en avant ou pré-remplissage confirmé d'un clic |
| Moyenne | `needs_review` | proposition explicite à valider avant de devenir vérité métier |
| Faible | `draft` | brouillon ou simple aide de lecture, aucun rattachement automatique |

Les seuils précis (par exemple 0.8 / 0.5) ne sont pas figés ici. Ils seront calibrés par parcours dans le design doc d'implémentation.

## Mode `needs_review`

Le besoin d'un état intermédiaire est commun aux deux parcours. Il doit être pensé comme un mécanisme transverse, pas dupliqué entité par entité.

Pistes à instruire dans le design doc d'implémentation :

- ajouter un champ `review_state` partagé sur les entités susceptibles d'être créées par IA (`Interaction`, `Document`, peut-être `InteractionDocument`)
- ou conserver l'état uniquement dans `metadata.ai.review_state` tant qu'aucune requête transversale ne le justifie
- exposer dans l'UI un emplacement clair pour les éléments en attente de revue (file d'attente dédiée ou filtre liste)

Décision : ne pas trancher ici, mais ne pas exclure ce mode par le design actuel.

## Règles à préserver dès maintenant

Pour rester compatible avec une future implémentation IA, les décisions suivantes doivent rester vraies :

1. les règles métier importantes vivent côté backend, pas côté React
2. le payload des entités créables par IA reste simple, stable, et exprimable hors UI
3. `metadata` absorbe les besoins spécifiques tant qu'ils ne justifient pas un vrai champ
4. la provenance d'une création doit pouvoir être conservée sans changer le modèle
5. la pièce source (texte brut, fichier, OCR) reste accessible
6. un futur mode `draft` / `needs_review` ne doit pas être exclu par le design actuel
7. aucun couplage ne lie un parcours à un canal unique

## Ce qu'il ne faut pas faire

- mettre une règle métier seulement dans React
- coupler la création d'`Interaction` au seul formulaire web
- masquer la pièce source d'un document derrière un résumé IA
- stocker des interprétations IA sans trace de provenance ni confiance
- transformer trop tôt une suggestion en vérité métier définitive
- introduire des validations UI impossibles à reproduire côté API

## Hors scope V1

Sont **explicitement hors scope** d'une première itération IA :

- ingestion email entrante comme surface runtime active
- intégration WhatsApp ou autre canal externe en lecture
- compréhension automatique sans confirmation pour les cas à faible confiance
- pipeline OCR avancé (au-delà de ce qui existe déjà)
- décisions IA opaques sans pièce source consultable

Ces sujets restent compatibles avec l'architecture mais ne sont pas livrables tant que le socle IA transverse n'est pas posé.

## Décisions transverses

Certaines décisions sont déjà tranchées via le parcours 07 (issue #88), d'autres restent ouvertes.

### Décisions déjà tranchées

#### Provider et modèle

**Claude Haiku 4.5** + SDK officiel `anthropic`. Vision pour images, `pypdf` pour PDFs texte. Tranché dans #88.

À reconfirmer pour la couche agent (Story 2 du parcours 07) : Haiku ou Sonnet selon ratio coût/qualité.

#### Sync vs async

**Sync** pour V1, pas de Celery. Tranché dans #88. Async réservé aux pièces volumineuses si la sync devient bloquante.

#### Stockage de l'extraction OCR

- texte extrait dans `Document.ocr_text` (champ existant)
- traçabilité dans `metadata` : `ocr_extracted_at`, `ocr_method` (`vision_haiku` | `pypdf` | `skipped`)

Tranché dans #88 et #89.

### Décisions encore ouvertes

#### Où vit le service IA

- Lot 0 du parcours 07 : extension de `apps/documents/` (`extraction.py`, `image_processing.py`).
- Lot 2+ : nouvelle app `apps/agent/` ou utilitaire partagé. À trancher avant le lot 2.

#### Contrat de proposition (parcours 01 et 02)

- Schéma JSON unique pour toutes les propositions IA, ou schéma par type d'entité ?
- Validation côté backend systématique avant de matérialiser une proposition ?
- Comment gérer une proposition partielle (champs manquants ou incertains) ?

#### Stockage des suggestions (parcours 02)

- Recalculées à la demande ou persistées ?
- Si persistées : nouvelle table `AISuggestion` polymorphe, ou champs `metadata.ai.*` sur l'entité cible ?
- Durée de rétention des suggestions rejetées ?

#### Stratégie sur les zones manquantes (parcours 01)

- Zone par défaut implicite type `À classer` ?
- Brouillon obligatoire tant qu'aucune zone n'est résolue ?
- Inférence avec seuil de confiance dédié ?

#### Résolution utilisateur et household (parcours 01)

- Comment un canal externe (chat IA, email, WhatsApp) résout-il l'utilisateur et le household ?
- Création faite au nom de l'utilisateur ou via un compte système assistant ?
- Audit trail correspondant ?

#### Sécurité et confidentialité

- Politique de redaction (PII) avant envoi au modèle ?
- Audit log des prompts et réponses ?
- Mention utilisateur explicite avant premier usage ?
- Quelles données sortent du périmètre du foyer ?

## Étape suivante

Le **parcours 07** (agent conversationnel) est le premier porteur d'implémentation IA. Son lot 0 (issues #88 et #89) est déjà cadré et débloque la suite : tant que `Document.ocr_text` n'est pas peuplé, aucune fonctionnalité IA ne peut s'appuyer sur le contenu des documents.

Séquence recommandée :

1. **Parcours 07 — lot 0a** : pipeline OCR à l'upload (#88) — débloque tout le reste
2. **Parcours 07 — lot 0b** : backfill OCR sur les documents existants (#89)
3. **Parcours 07 — lots 1+** : retrieval, service agent, surface UI chat
4. **Extensions IA des parcours 01 et 02** (documentées dans la section "Évolutions ultérieures" de la doc parcours 07) : compréhension assistée de documents puis capture conversationnelle

Le seul invariant : avant d'attaquer une extension IA après la V1 du parcours 07, vérifier que les décisions encore ouvertes ci-dessus ont été tranchées dans la doc du parcours 07, pour ne pas dupliquer la couche IA.
