# Parcours 09 — Piloter la maison connectée

Ce document détaille le neuvième parcours métier à travailler dans House.

Il s'appuie sur l'état actuel du projet Django + React, sur le socle posé par les parcours 01 à 08, et en particulier sur l'agent conversationnel du parcours 07.

## Résumé

Le neuvième usage fondamental du produit est le suivant :

"Je veux voir l'état de mes équipements connectés et les piloter depuis House, sans ouvrir une app constructeur par marque."

Ce parcours fait entrer le temps réel physique dans la mémoire du foyer.

- Le foyer accumule des devices connectés (volets, prises, relais, capteurs) répartis sur plusieurs écosystèmes constructeurs.
- Chaque écosystème impose son app, son compte, son vocabulaire — l'information d'état est dispersée.
- House connaît déjà les pièces (zones) et les objets (équipements) : il est le lieu naturel pour unifier la vue et le pilotage.

Le premier device réel est un **Shelly 2PM Gen2 en mode volet roulant** : pouvoir l'ouvrir, le fermer, le stopper et connaître sa position depuis House est la preuve que la base est réussie.

## Positionnement produit

Les parcours 01 à 05 ont construit la mémoire du foyer (événements, documents, tâches, projets, navigation spatiale). Le parcours 07 a rendu cette mémoire interrogeable en langage naturel. Le parcours 09 ajoute une dimension nouvelle : l'état **présent** et **actionnable** de la maison. L'agent ne répond plus seulement "quand a-t-on changé la chaudière" mais aussi "le volet du séjour est-il ouvert ?" — et peut le fermer sur demande.

Exigence structurante : la base doit être **générique multi-constructeurs**. Shelly est le premier fournisseur implémenté, pas une hypothèse de conception. Ajouter Home Assistant, Tuya ou un pont MQTT plus tard ne doit demander qu'un adaptateur, aucun changement de modèle ni d'interface.

## Concept interne

Trois concepts nouveaux, portés par une nouvelle app `apps/domotics/` :

### Intégration (`DomoticsIntegration`)

La connexion du foyer à un compte fournisseur : un type de provider (`shelly_cloud` en V1), des credentials saisis par l'utilisateur, un état de dernière synchronisation. Une intégration appartient au foyer (`HouseholdScopedModel`) et ses credentials ne redescendent jamais vers le client.

### Appareil (`Device`)

Un device physique découvert via une intégration. Il porte :

- son identité fournisseur (`external_id`, modèle, génération)
- son ancrage House : une zone (FK `zones.Zone`) et optionnellement une fiche équipement (FK `equipment.Equipment`) pour relier patrimoine et pilotage
- ses **capabilities** : liste normalisée de ce que le device sait faire (`cover`, `switch`, `power_meter`, `temperature`), indépendante du constructeur — c'est le cœur de la généricité, inspiré du modèle entités de Home Assistant
- un **cache d'état** normalisé (`state` JSON + `state_updated_at`) et un **résumé texte de l'état** (`state_summary`) régénéré à chaque rafraîchissement — ce résumé est ce que l'agent lit

### Commande (`DeviceCommand`)

Le journal d'audit immuable des actions : qui (utilisateur), quoi (capability, action, paramètres), par quel canal (app ou agent), avec quel résultat réel (succès/échec + réponse du fournisseur). Une action physique n'a pas d'undo : la traçabilité remplace la réversibilité.

### Couche providers

Un contrat d'adaptateur (`BaseProvider` : tester la connexion, lister les devices, lire les états, exécuter une commande) et un registry, sur le même modèle que `agent.searchables`. `shelly_cloud` est le premier adaptateur : il parle à l'API Shelly Cloud (la prod tourne sur un VPS, pas sur le réseau local du foyer — le cloud constructeur est le chemin qui marche partout).

## Concept visible côté utilisateur

Dans l'interface, le vocabulaire à utiliser est :

- vue principale : `Domotique`
- les objets : `Appareils connectés`
- la connexion à un compte constructeur : `Connecter un compte` (puis `Synchroniser les appareils`)
- les actions volet : `Ouvrir`, `Stop`, `Fermer`
- les actions relais : `Allumer`, `Éteindre`
- l'état : `En ligne` / `Hors ligne`, position en %, puissance en W

Le mot "intégration" reste interne ; l'utilisateur "connecte un compte Shelly".

## Objectif produit

Permettre à un membre du foyer de :

1. connecter son compte constructeur (Shelly Cloud en V1) en saisissant ses identifiants d'API, et importer automatiquement ses devices
2. voir tous ses appareils connectés groupés par pièce, avec leur état courant (ouvert/fermé, position, puissance, température, en ligne/hors ligne)
3. piloter un appareil : ouvrir/fermer/stopper un volet, allumer/éteindre un relais — avec un retour fidèle du résultat réel
4. rattacher un appareil à une zone et à une fiche équipement pour l'inscrire dans la mémoire du foyer
5. demander à l'agent l'état d'un appareil ("le volet du séjour est-il ouvert ?") et lui demander une action explicite ("ferme le volet du séjour")

## Ce que le projet a déjà aujourd'hui

- **Zones hiérarchiques** ([apps/zones/models.py](../../apps/zones/models.py)) — l'ancrage spatial des devices existe déjà
- **Équipements** ([apps/equipment/models.py](../../apps/equipment/models.py)) — la fiche patrimoniale (garantie, achat, entretien) à laquelle un device peut se rattacher
- **Agent conversationnel** ([apps/agent/](../../apps/agent/)) — registry `searchables` extensible depuis n'importe quelle app, registry de tools LLM acceptant l'enregistrement croisé (`apps/agent/tools.py`), conversations ancrées sur entité
- **Pattern multi-tenant** — `HouseholdScopedModel`, permission `IsHouseholdMember`/`IsHouseholdOwner`, scoping par header
- **Pattern feature frontend** — hooks + query keys, Card/Dialog, i18n 4 langues (documenté dans CLAUDE.md)

Ce qui n'existe pas encore : aucune notion de device connecté, aucun client HTTP sortant vers un service tiers constructeur, aucun scheduler de tâches de fond.

## Problème utilisateur précis

Quand l'utilisateur pense "je veux fermer le volet" ou "est-ce que la prise du garage est allumée", il doit aujourd'hui :

- retrouver l'app du constructeur concerné sur son téléphone
- se rappeler quel device vit dans quel écosystème
- faire l'aller-retour mental entre l'objet physique ("le volet du séjour") et son nom technique dans l'app constructeur

House connaît déjà le séjour, la fiche du volet, son historique d'entretien. Le pilotage doit vivre au même endroit que la mémoire.

## Utilisateur cible

Un membre du foyer qui veut consulter ou agir sur l'état physique de la maison, depuis l'app ou en langage naturel.

Exemples :

- "Le volet du séjour est-il bien fermé ?"
- "Ferme le volet, le soleil tape."
- "Combien consomme la prise de l'aquarium en ce moment ?"
- "Quels appareils sont hors ligne ?"

## Scénarios prioritaires

### Scénario A — Connecter son compte Shelly

"Je vais dans Domotique, je connecte mon compte Shelly avec ma clé d'autorisation cloud, je synchronise, mes devices apparaissent."

### Scénario B — Piloter le volet roulant

"Sur la carte du volet du séjour, je clique Fermer. Le bouton indique l'action en cours, puis la position se met à jour. Si le cloud Shelly renvoie une erreur, je la vois."

### Scénario C — Consulter l'état d'un coup d'œil

"J'ouvre Domotique : je vois par pièce mes appareils, lesquels sont en ligne, la position des volets, la puissance instantanée."

### Scénario D — Ancrer un device dans le foyer

"Je renomme 'shellyswitch25-B48A0A' en 'Volet séjour', je l'affecte à la zone Séjour et je le lie à la fiche équipement du volet (garantie, facture)."

### Scénario E — Piloter via l'agent

"Je demande à l'agent : 'le volet du séjour est-il ouvert ?' — il répond avec l'état et son horodatage. Je dis 'ferme-le' — il exécute et me rapporte le résultat réel."

## Parcours cible

### Connecter et importer

1. L'utilisateur ouvre `Domotique` (état vide → CTA `Connecter un compte`).
2. Il choisit le fournisseur (Shelly Cloud), saisit serveur + clé d'autorisation.
3. Il teste la connexion, puis synchronise.
4. Ses devices apparaissent avec leurs capabilities détectées automatiquement.

### Consulter et piloter

1. L'utilisateur ouvre `Domotique` : appareils groupés par pièce, états à jour.
2. Il agit sur un appareil (Ouvrir / Stop / Fermer, ou toggle).
3. Le résultat réel s'affiche (nouvel état, ou message d'échec).

### Interroger et commander via l'agent

1. L'utilisateur pose une question d'état — l'agent répond en citant le device, avec l'horodatage de l'état.
2. Il demande une action explicite — l'agent exécute via le tool dédié et rapporte le résultat réel.

## Règles produit

### Règle 1 — La base est générique, Shelly n'est qu'un adaptateur

Aucun concept Shelly ne fuit dans le modèle, l'API interne, l'UI ou l'agent. Tout passe par les capabilities normalisées. Ajouter un constructeur = un adaptateur + une entrée de registry.

### Règle 2 — Une action physique n'a pas d'undo

Contrairement aux créations de l'agent (toast Annuler), une commande domotique est irréversible par nature. La sécurité vient de : exécution uniquement sur demande explicite, retour fidèle du résultat réel, et journal d'audit complet (`DeviceCommand`).

### Règle 3 — Pas d'état optimiste

L'UI n'affiche jamais un état supposé. Un bouton d'action reste en attente jusqu'à la réponse, et l'état affiché est toujours celui rapporté par le fournisseur, horodaté.

### Règle 4 — L'état est une donnée de la mémoire du foyer

L'état courant (résumé texte horodaté) est indexé comme le reste de la mémoire : l'agent y accède par la recherche standard, sans mécanique dédiée.

### Règle 5 — Les credentials ne redescendent jamais

Les identifiants d'API sont write-only : saisis, stockés, jamais re-sérialisés vers le client. Seul le propriétaire du foyer gère les intégrations.

### Règle 6 — Le device s'inscrit dans l'existant, il ne le duplique pas

Un device pointe vers une zone et optionnellement une fiche équipement. On ne recrée ni pièce ni patrimoine dans le module domotique.

## Backlog produit recommandé pour la V1

### Story 0 — Connecter un compte fournisseur

En tant que propriétaire du foyer,
je veux connecter mon compte Shelly Cloud et importer mes appareils,
afin de retrouver ma maison connectée dans House.

#### Critères d'acceptation

- je peux créer une intégration Shelly Cloud (serveur + clé d'autorisation)
- je peux tester la connexion avant d'enregistrer
- la synchronisation importe mes devices avec nom, modèle et capabilities détectées
- mes identifiants ne réapparaissent jamais dans l'interface ni dans les réponses API
- seul le propriétaire du foyer peut créer/modifier/supprimer une intégration

### Story 1 — Voir l'état de la maison

En tant que membre du foyer,
je veux voir mes appareils connectés groupés par pièce avec leur état courant,
afin de comprendre l'état physique de la maison d'un coup d'œil.

#### Critères d'acceptation

- la page Domotique liste les appareils groupés par zone (les sans-zone dans un groupe dédié)
- chaque carte affiche : nom, en ligne/hors ligne, et l'état par capability (position de volet, on/off, puissance W, température °C)
- l'état se rafraîchit automatiquement tant que la page est ouverte
- l'horodatage du dernier état connu est visible

### Story 2 — Piloter un appareil

En tant que membre du foyer,
je veux ouvrir/fermer/stopper mon volet (et allumer/éteindre un relais) depuis House,
afin de ne plus dépendre de l'app constructeur.

#### Critères d'acceptation

- la carte d'un appareil `cover` propose Ouvrir / Stop / Fermer et affiche la position
- la carte d'un appareil `switch` propose un interrupteur
- pendant l'exécution, le contrôle est désactivé avec indicateur d'attente ; aucun état optimiste
- en cas d'échec fournisseur, le message d'erreur est affiché
- chaque commande est journalisée (qui, quoi, quand, résultat)

### Story 3 — Ancrer un appareil dans le foyer

En tant que membre du foyer,
je veux renommer un appareil, l'affecter à une pièce et le lier à une fiche équipement,
afin qu'il s'inscrive dans la mémoire du foyer.

#### Critères d'acceptation

- nom, zone et équipement lié sont éditables depuis la carte
- une resynchronisation n'écrase jamais le nom ni la zone édités
- la fiche équipement liée est accessible en un clic

### Story 4 — Interroger et commander via l'agent

En tant que membre du foyer,
je veux demander à l'agent l'état d'un appareil et lui demander une action,
afin de piloter la maison en langage naturel.

#### Critères d'acceptation

- "le volet du séjour est-il ouvert ?" → réponse citée avec l'état et son horodatage
- "ferme le volet du séjour" → exécution + compte-rendu du résultat réel (jamais de succès annoncé sans confirmation du fournisseur)
- l'agent n'exécute jamais une commande sans demande explicite et immédiate de l'utilisateur
- les commandes de l'agent apparaissent dans le journal d'audit avec la source `agent`

## Recommandation d'interface

### Structure cible de la page Domotique

```
┌──────────────────────────────────────────┐
│  Domotique                    [Comptes]  │
├──────────────────────────────────────────┤
│  Séjour                                  │
│  ┌────────────────────────────────────┐  │
│  │ 🪟 Volet séjour        ● En ligne  │  │
│  │ Fermé · position 0%                │  │
│  │ [▲ Ouvrir] [■ Stop] [▼ Fermer]     │  │
│  │ 0 W · état de 14:12          [⋯]   │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  Garage                                  │
│  ┌────────────────────────────────────┐  │
│  │ 🔌 Prise congélateur   ● En ligne  │  │
│  │ Allumée          [ ⏻ interrupteur ]│  │
│  │ 86 W · 34,2 °C               [⋯]   │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  Sans pièce                              │
│  │ shellyplus1-a8032ab...  ○ Hors ligne│ │
└──────────────────────────────────────────┘
```

### Dialog de connexion d'un compte

```
┌──────────────────────────────────────┐
│  Connecter un compte                 │
│  Fournisseur : [Shelly Cloud ▾]      │
│  Nom : [Shelly            ]          │
│  Serveur : [https://shelly-73-eu...] │
│  Clé d'autorisation : [•••••••••]    │
│  [Tester la connexion]               │
│            [Annuler] [Enregistrer]   │
└──────────────────────────────────────┘
```

## Écrans impactés

- nouvelle feature `ui/src/features/domotics/` — page, cartes appareil, widgets par capability, dialogs
- `ui/src/components/Sidebar.tsx` — entrée `Domotique` dans le groupe Home
- `ui/src/router.tsx` — route `/app/domotics`
- détail équipement (plus tard, V2) — état du device lié visible sur la fiche

## Hors scope pour la V1

- historique des mesures et graphes de consommation (nécessite un scheduler — voir backlog technique)
- scheduler/cron de rafraîchissement en tâche de fond (le rafraîchissement V1 est à la demande)
- webhooks entrants depuis les devices (temps réel poussé)
- scènes, automatisations, programmation horaire ("fermer tous les volets à 22h")
- autres providers que Shelly Cloud (Home Assistant, Tuya, MQTT) — l'architecture les prévoit, la V1 n'en livre qu'un
- pilotage local (LAN) — la prod est sur VPS, le chemin V1 est le cloud constructeur
- chiffrement applicatif des credentials (write-only V1 ; upgrade path documenté)
- notifications sur changement d'état ou device hors ligne (rejoindra le parcours 06)

## Décisions produit recommandées

### 1. Le modèle est par capabilities, pas par type de device

Un Shelly 2PM peut être volet ou double relais selon sa configuration. C'est l'état rapporté par le fournisseur qui détermine les capabilities, pas le modèle commercial. L'UI et l'agent raisonnent uniquement en capabilities.

### 2. Le pilotage agent est un tool dédié, pas une écriture générique

`create_entity` crée des objets House réversibles (undo). Commander un device est un effet physique irréversible : tool distinct (`control_device`), garde-fous propres (demande explicite, compte-rendu fidèle), pas de toast Annuler.

### 3. Le rafraîchissement V1 est à la demande, protégé par un TTL serveur

Pas de scheduler dans le projet. La page interroge le fournisseur à l'affichage et à intervalle régulier tant qu'elle est ouverte ; le serveur limite la fréquence réelle des appels sortants (TTL) pour respecter les limites de l'API constructeur. Un rafraîchissement en tâche de fond (cron) viendra quand l'historique de mesures le justifiera.

### 4. Une intégration par fournisseur et par foyer en V1

Cas multi-comptes du même fournisseur : différé jusqu'à un besoin réel.

## Définition de done du parcours 09

Le parcours peut être considéré comme livré si, pour un utilisateur réel :

1. il connecte son compte Shelly Cloud et voit ses devices importés avec les bonnes capabilities
2. il ouvre, stoppe et ferme son volet roulant réel depuis House, position à l'appui
3. un échec du cloud constructeur s'affiche honnêtement (pas de faux succès)
4. il affecte le device à une pièce et le retrouve groupé sous cette pièce
5. l'agent répond correctement à "le volet est-il ouvert ?" et exécute "ferme le volet" sur demande explicite
6. chaque commande (app ou agent) est visible dans le journal d'audit
7. la page est utilisable sur mobile

## Check de validation manuelle

Avant de considérer la V1 terminée, vérifier ce scénario complet avec le Shelly 2PM réel :

1. connecter le compte Shelly Cloud (serveur + clé) — tester la connexion
2. synchroniser — vérifier que le 2PM apparaît avec la capability volet (+ puissance, température)
3. renommer en "Volet séjour", affecter à la zone Séjour
4. fermer le volet depuis la carte — vérifier le mouvement physique et la position affichée
5. ouvrir puis stopper à mi-course — vérifier la position intermédiaire
6. couper le WiFi du device — vérifier l'affichage Hors ligne et l'échec propre d'une commande
7. demander à l'agent "le volet du séjour est-il ouvert ?" — vérifier la réponse citée et l'horodatage
8. demander "ferme le volet du séjour" — vérifier l'exécution et le compte-rendu
9. vérifier le journal des commandes (sources `app` et `agent`)

Backlog technique associé : `docs/parcours/PARCOURS_09_BACKLOG_TECHNIQUE.md`
