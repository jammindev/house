# Parcours 10 — Analyser la consommation électrique

Ce document détaille le dixième parcours métier à travailler dans House.

Il s'appuie sur l'état actuel du projet Django + React, sur le module électricité existant (architecture du tableau, circuits, points d'usage) et sur l'agent conversationnel du parcours 07.

## Résumé

Le dixième usage fondamental du produit est le suivant :

"Je veux comprendre combien ma maison consomme d'électricité — par heure, par jour, par mois, par année — sans dépendre de l'app de mon fournisseur."

Ce parcours fait entrer les **données de mesure dans le temps** dans la mémoire du foyer.

- Le module électricité connaît aujourd'hui l'architecture (tableau, disjoncteurs, circuits) mais aucune donnée de consommation.
- Les données existent ailleurs : sur le compteur (index), et chez le gestionnaire de réseau (courbe de charge Enedis pour la France).
- House est le lieu naturel pour les centraliser, les agréger et les interroger — y compris en langage naturel via l'agent.

Le premier fournisseur de données réel est **Enedis (Linky)** via l'export CSV de courbe de charge du compte client, complété par la saisie manuelle de relevés d'index.

## Positionnement produit

Les parcours 01 à 05 ont construit la mémoire du foyer, le parcours 07 l'a rendue interrogeable, le parcours 08 a ouvert la lecture transversale des dépenses, le parcours 09 fait entrer l'état présent des devices. Le parcours 10 ajoute la **série temporelle** : non plus "quel est l'état maintenant" mais "comment ça évolue". C'est la première feature d'analyse de données du produit.

Exigence structurante : le cœur du modèle doit être **générique multi-pays et multi-fournisseurs**. Enedis n'est qu'un format d'entrée parmi d'autres : le modèle pivot ne connaît ni Enedis, ni la France, ni le pas de 30 minutes. Ajouter un gestionnaire de réseau belge, allemand ou un export domotique plus tard ne doit demander qu'un adaptateur d'import, aucun changement de modèle ni d'interface.

## Concept interne

Quatre concepts nouveaux, portés par l'app existante `apps/electricity/` :

### Compteur (`ElectricityMeter`)

Le point de comptage physique du foyer : un nom, un numéro de série optionnel, une zone optionnelle, un type de tarification (base ou heures pleines / heures creuses). C'est l'axe d'accrochage de toutes les données de consommation. Un foyer a typiquement un compteur, parfois plusieurs (sous-comptage, dépendance).

### Relevé d'index (`MeterReading`)

Une lecture manuelle du compteur à un instant donné : horodatage, cadran (`base`, `hp` ou `hc`), valeur d'index en kWh. Deux relevés successifs du même cadran définissent une consommation sur la période. Les relevés sont la source de données universelle — aucun pays, aucun fournisseur requis.

### Point de consommation (`ConsumptionRecord`) — le modèle pivot

Le cœur générique du parcours : *une quantité d'énergie sur un intervalle de temps, pour un compteur et un cadran*.

- `ts_start` (UTC) + `interval_minutes` — le pas est explicite car il varie selon les pays (30 min en France, 15 min en Allemagne ou Belgique, 60 min ailleurs)
- `energy_wh` en entier — pas de flottant, pas d'arrondi kWh
- `register` (`base` / `hp` / `hc`)
- `source` (`reading` = dérivé des relevés manuels, `import` = fichier importé) + lien vers l'import d'origine pour la traçabilité

Toute donnée de consommation, de n'importe quel pays, se réduit à ce pivot. L'agrégation (heure / jour / mois / année) ne consomme que lui.

Les relevés manuels sont **matérialisés** en points quotidiens estimés : le delta entre deux relevés est réparti au prorata des jours de la période. Toute création, modification ou suppression de relevé régénère les points dérivés des périodes adjacentes — l'opération est déterministe et idempotente.

### Import (`ConsumptionImport`) et registry d'adaptateurs

Un import trace un fichier chargé : fournisseur détecté, nom du fichier, compteur cible, compteurs de lignes (créées / mises à jour / ignorées), erreur éventuelle.

Le parsing passe par un **registry d'adaptateurs d'import** (même philosophie que `agent.searchables` et que les providers du parcours 09) : chaque adaptateur sait détecter son format (`detect`) et le transformer en points normalisés (`parse`). Deux adaptateurs en V1 :

- **`enedis_csv`** — l'export "courbe de charge" du compte client Enedis (pas 30 min, puissance moyenne en W convertie en énergie)
- **`generic_csv`** — le filet de sécurité international : l'utilisateur mappe lui-même colonne horodatage, colonne valeur, unité et pas de temps ; n'importe quel pays est couvert dès le jour 1

La déduplication se fait par `(compteur, cadran, ts_start)` : ré-importer le même fichier est sans effet.

## Concept visible côté utilisateur

Dans l'interface, le vocabulaire à utiliser est :

- le nouvel onglet du module Électricité : `Consommation`
- le point de comptage : `Compteur`
- la saisie manuelle : `Relevé` (avec la valeur d'index en kWh)
- le chargement de fichier : `Importer des données`
- les granularités : `Heure`, `Jour`, `Mois`, `Année`
- les cadrans : `Base`, `Heures pleines`, `Heures creuses`

Les mots "ConsumptionRecord", "pivot" ou "adaptateur" restent internes.

## Objectif produit

Permettre à un membre du foyer de :

1. déclarer son compteur (nom, tarification base ou HP/HC)
2. saisir des relevés d'index au fil de l'eau, et voir la consommation estimée qui en découle
3. importer sa courbe de charge Enedis (CSV du compte client) et obtenir la granularité horaire réelle
4. importer un CSV quelconque via le mapping générique (autre pays, autre fournisseur, export domotique)
5. visualiser sa consommation par heure, jour, mois ou année, avec navigation dans le temps
6. demander à l'agent "combien j'ai consommé en juin ?" ou lui dicter un relevé ("j'ai relevé 45230 au compteur")

## Ce que le projet a déjà aujourd'hui

- **Module électricité** ([apps/electricity/](../../apps/electricity/)) — l'app, ses permissions (owner écrit, membres lisent), son onglettage frontend ([ui/src/features/electricity/ElectricityPage.tsx](../../ui/src/features/electricity/ElectricityPage.tsx)) — le parcours 10 s'y insère, pas de nouvelle app
- **Zones** — l'ancrage spatial optionnel d'un compteur existe déjà
- **Agent conversationnel** ([apps/agent/](../../apps/agent/)) — registries `searchables` / `listables` / `writables` extensibles depuis n'importe quelle app, tool `list_entities` avec filtres et agrégats
- **Pattern multi-tenant** — `HouseholdScopedModel`, scoping par header
- **Pattern feature frontend** — hooks + query keys, Card/Dialog, i18n 4 langues (documenté dans CLAUDE.md)

Ce qui n'existe pas encore : aucune donnée de mesure temporelle, aucun endpoint d'agrégation, aucun upload de fichier de données, **aucune librairie de graphiques** (Recharts entre au projet avec ce parcours).

## Problème utilisateur précis

Quand l'utilisateur se demande "pourquoi ma facture a augmenté" ou "qu'est-ce qui consomme la nuit", il doit aujourd'hui :

- naviguer dans l'espace client Enedis ou l'app de son fournisseur, avec leurs limites (historique borné, granularités imposées, pas de recoupement avec la maison)
- tenir un tableur de relevés à la main s'il veut un historique long
- faire le lien mental entre les pics de consommation et la vie du foyer (travaux, nouvel équipement, hiver rude) — informations que House connaît déjà

## Utilisateur cible

Un membre du foyer qui veut comprendre et surveiller sa consommation, ponctuellement (vérifier une facture) ou régulièrement (chasse au gaspillage).

Exemples :

- "Combien a-t-on consommé le mois dernier, par rapport au même mois l'an dernier ?"
- "À quelle heure consomme-t-on le plus ?"
- "Quel est notre talon de consommation la nuit ?"
- "J'ai relevé le compteur : 45230."

## Scénarios prioritaires

### Scénario A — Déclarer le compteur et saisir un premier relevé

"Je vais dans Électricité → Consommation, je crée mon compteur Linky en HP/HC, je saisis mes index du jour. Au relevé suivant, la consommation de la période apparaît."

### Scénario B — Importer la courbe de charge Enedis

"Je télécharge le CSV de courbe de charge depuis mon compte Enedis, je l'importe dans House : le format est reconnu automatiquement, les points au pas 30 min sont chargés, la vue horaire devient disponible. Si je réimporte le même fichier, rien ne change."

### Scénario C — Analyser par granularité

"Je regarde ma consommation par mois sur l'année, je repère un pic en janvier, je zoome au jour puis à l'heure pour comprendre : le pic est entre 18h et 22h."

### Scénario D — Importer un format inconnu

"Mon export ne vient pas d'Enedis. Je choisis l'import générique, j'indique quelle colonne contient la date, quelle colonne contient la valeur, l'unité et le pas — les données se chargent."

### Scénario E — Interroger via l'agent

"Je demande à l'agent 'combien a-t-on consommé en juin ?' — il répond avec le total et la source. Je lui dis 'j'ai relevé 45230 au compteur' — il enregistre le relevé, avec un toast Annuler."

## Parcours cible

### Déclarer et relever

1. L'utilisateur ouvre `Électricité → Consommation` (état vide → CTA `Créer un compteur`).
2. Il crée le compteur (nom, tarification).
3. Il saisit un relevé (cadran + index) ; les relevés s'empilent, la consommation estimée se dessine.

### Importer

1. Depuis l'onglet Consommation, il clique `Importer des données`.
2. Il dépose son fichier ; le format Enedis est détecté automatiquement (sinon il bascule sur le mapping générique).
3. Le résultat de l'import s'affiche : points créés, doublons ignorés, erreurs éventuelles.

### Analyser

1. Le graphique montre la consommation sur la période courante, à la granularité choisie (Heure / Jour / Mois / Année).
2. Il navigue (période précédente / suivante), change de granularité, distingue HP/HC quand le compteur en a.

### Interroger via l'agent

1. Question d'agrégat ("combien en juin ?") — l'agent répond via le listing standard, chiffres à l'appui.
2. Dictée d'un relevé — l'agent crée le `MeterReading` (undo disponible), la consommation estimée se met à jour.

## Règles produit

### Règle 1 — Le pivot est générique, Enedis n'est qu'un adaptateur

Aucun concept Enedis ne fuit dans le modèle, l'API interne, l'UI ou l'agent. Le pas de temps est une donnée (`interval_minutes`), pas une hypothèse. Ajouter un fournisseur ou un pays = un adaptateur d'import + une entrée de registry.

### Règle 2 — On n'affiche jamais une précision qu'on n'a pas

Une vue horaire construite à partir de relevés mensuels serait un mensonge. La granularité affichée n'inclut que les points dont le pas est compatible (pas ≤ taille du seau). Les points dérivés de relevés manuels sont des **estimations quotidiennes** et sont signalés comme telles.

### Règle 3 — L'import est idempotent

Ré-importer un fichier déjà chargé (ou chevauchant) ne crée aucun doublon : la clé naturelle `(compteur, cadran, ts_start)` fait foi. L'utilisateur ne doit jamais avoir peur d'importer.

### Règle 4 — Les données de mesure suivent les permissions du module

Comme le reste du module électricité : le propriétaire du foyer écrit (compteurs, relevés, imports), tous les membres lisent et analysent.

### Règle 5 — Le relevé est la source universelle, l'import est l'enrichissement

Le parcours doit être complet sans Enedis : relevés manuels → analyse jour/mois/année. L'import ajoute la granularité fine, il n'est pas un prérequis.

## Backlog produit recommandé pour la V1

### Story 0 — Déclarer un compteur

En tant que propriétaire du foyer,
je veux déclarer mon compteur électrique (nom, tarification base ou HP/HC),
afin d'avoir un point d'accrochage pour mes données de consommation.

#### Critères d'acceptation

- je peux créer, éditer et supprimer un compteur depuis l'onglet Consommation
- la tarification (base / HP-HC) conditionne les cadrans proposés partout ensuite
- seul le propriétaire du foyer peut écrire ; les membres voient

### Story 1 — Saisir des relevés et voir la consommation estimée

En tant que propriétaire du foyer,
je veux saisir mes relevés d'index au fil de l'eau,
afin de suivre ma consommation sans dépendre d'aucun service externe.

#### Critères d'acceptation

- je saisis un relevé : date/heure, cadran, index kWh
- un index inférieur au relevé précédent du même cadran est refusé avec un message clair
- dès deux relevés, la consommation estimée apparaît dans les vues jour/mois/année
- modifier ou supprimer un relevé recalcule les estimations des périodes adjacentes
- la suppression passe par l'undo standard

### Story 2 — Importer la courbe de charge Enedis

En tant que propriétaire du foyer,
je veux importer le CSV de courbe de charge de mon compte Enedis,
afin d'obtenir ma consommation réelle au pas 30 minutes sans saisie.

#### Critères d'acceptation

- le format Enedis est détecté automatiquement à l'upload
- les points sont convertis en énergie (Wh) au pas source et rattachés au compteur choisi
- un ré-import du même fichier ne crée aucun doublon (créés = 0, ignorés = n)
- le compte-rendu d'import affiche créés / ignorés / erreurs
- un fichier illisible produit une erreur claire, pas d'import partiel silencieux

### Story 3 — Importer un CSV générique

En tant que propriétaire du foyer (dans n'importe quel pays),
je veux mapper moi-même les colonnes d'un CSV de consommation,
afin d'importer mes données même sans adaptateur dédié à mon fournisseur.

#### Critères d'acceptation

- je choisis la colonne horodatage, la colonne valeur, l'unité (Wh / kWh / W moyen) et le pas de temps
- un aperçu des premières lignes me permet de valider le mapping avant l'import
- les règles d'idempotence et de compte-rendu sont identiques à l'import Enedis

### Story 4 — Analyser par heure / jour / mois / année

En tant que membre du foyer,
je veux visualiser la consommation à la granularité de mon choix et naviguer dans le temps,
afin de comprendre quand et combien la maison consomme.

#### Critères d'acceptation

- un graphique en barres avec sélecteur Heure / Jour / Mois / Année et navigation période précédente/suivante
- la vue horaire n'affiche que les données à pas fin (import) ; les estimations de relevés n'y apparaissent pas
- les compteurs HP/HC distinguent les cadrans (empilement ou couleur)
- le total de la période affichée est visible en kWh
- l'état vide guide vers la saisie d'un relevé ou l'import

### Story 5 — Interroger et saisir via l'agent

En tant que membre du foyer,
je veux demander mes chiffres de consommation à l'agent et lui dicter un relevé,
afin d'utiliser le langage naturel pour cette donnée comme pour le reste.

#### Critères d'acceptation

- "combien a-t-on consommé en juin ?" → réponse chiffrée (kWh) via le listing standard
- "j'ai relevé 45230 au compteur" → création du relevé + toast Annuler
- l'agent retrouve le compteur par la recherche standard (searchable)

## Recommandation d'interface

### Onglet Consommation

```
┌──────────────────────────────────────────────────┐
│ Électricité                                      │
│ [Tableau] [Circuits] [Points d'usage] [Liens]    │
│ [Consommation]                                   │
├──────────────────────────────────────────────────┤
│ Compteur : [Linky maison ▾]     [+ Relevé]       │
│                                 [⭱ Importer]     │
│                                                  │
│ [Heure] [Jour] [Mois] [Année]     ◀ 2026 ▶       │
│                                                  │
│ 320 kWh sur la période                           │
│ ┌──────────────────────────────────────────┐     │
│ │ ▂ ▄ █ ▆ ▃ ▂ ▁ ▂ ▅ █ ▇ ▄   (barres)       │     │
│ │   ■ HP  ■ HC                              │    │
│ └──────────────────────────────────────────┘     │
│                                                  │
│ Relevés récents                                  │
│ 03/07 08:12 · HP 45 230 kWh · HC 31 118 kWh [⋯]  │
└──────────────────────────────────────────────────┘
```

### Dialog d'import

```
┌──────────────────────────────────────┐
│ Importer des données                 │
│ Compteur : [Linky maison ▾]          │
│ Fichier : [choisir un fichier]       │
│ Format détecté : Enedis — courbe     │
│   de charge (30 min)                 │
│   (sinon : mapping manuel des        │
│    colonnes : date / valeur /        │
│    unité / pas)                      │
│            [Annuler] [Importer]      │
└──────────────────────────────────────┘
```

## Écrans impactés

- `ui/src/features/electricity/` — nouvel onglet `Consommation` dans `ElectricityPage.tsx`, nouveaux composants (chart, dialogs compteur / relevé / import)
- aucune nouvelle entrée de Sidebar ni de route : le parcours vit dans le module Électricité existant

## Hors scope pour la V1

- **synchronisation automatique** avec l'API Enedis (Data Connect est réservé aux tiers enregistrés) ou via un proxy tiers — l'adaptateur d'import rend l'ajout ultérieur non-cassant
- **coût en euros** (prix du kWh, comparaison facture) — viendra quand les données seront là
- **comparaisons de périodes** (mois vs même mois n-1) en un seul écran
- production solaire / injection, gaz, eau — le pivot les permettrait, aucun besoin réel encore
- remontée temps réel via la domotique (parcours 09, quand l'historique de mesures y existera)
- alertes de dérive de consommation (rejoindra le parcours 06)
- sous-comptage par circuit ou par équipement

## Décisions produit recommandées

### 1. Le module reste `apps/electricity`, pas une nouvelle app

Le compteur, le tableau et les circuits appartiennent au même domaine. L'onglet Consommation rejoint les onglets existants. Si un jour l'eau ou le gaz arrivent, on généralisera à ce moment-là.

### 2. Les relevés manuels sont matérialisés en estimations quotidiennes

Répartir le delta entre deux relevés au prorata des jours donne des vues jour/mois/année cohérentes sans logique spéciale à la lecture, au prix d'une régénération à chaque modification de relevé. La vue horaire les exclut (règle 2).

### 3. Wh entiers, UTC, pas explicite

Le pivot stocke des Wh entiers (pas d'arrondi cumulatif), des horodatages UTC (les frontières de jour/mois sont calculées dans le fuseau du foyer à l'agrégation), et le pas en minutes par point (aucune hypothèse de pas uniforme).

### 4. L'agrégation est serveur, le front ne calcule rien

Un unique endpoint `summary` groupe par heure/jour/mois/année côté PostgreSQL. Le volume (≈17 500 points/an au pas 30 min) reste trivial pour Postgres — pas de table d'agrégats pré-calculés tant qu'un besoin réel ne l'exige pas.

### 5. Recharts entre au projet

Première lib de graphiques du projet, choisie pour resservir ailleurs (dépenses du parcours 08 notamment).

## Définition de done du parcours 10

Le parcours peut être considéré comme livré si, pour un utilisateur réel :

1. il crée son compteur HP/HC et saisit deux relevés → la vue mensuelle montre la consommation estimée
2. il importe son CSV Enedis réel → la vue horaire montre sa courbe de charge, HP/HC distingués
3. il réimporte le même fichier → 0 point créé, compte-rendu explicite
4. il importe un CSV non-Enedis via le mapping générique
5. il navigue heure/jour/mois/année avec des totaux justes (recoupés avec l'espace client Enedis)
6. l'agent répond à "combien a-t-on consommé en juin ?" et enregistre "j'ai relevé 45230"
7. l'onglet est utilisable sur mobile

## Check de validation manuelle

Avant de considérer la V1 terminée, vérifier ce scénario complet avec les données réelles du foyer :

1. créer le compteur Linky en HP/HC
2. saisir un relevé HP + HC daté d'aujourd'hui, puis un second daté antérieur — vérifier le refus d'index décroissant dans le bon sens
3. télécharger la courbe de charge depuis le compte Enedis et l'importer — vérifier le nombre de points et un total journalier contre l'espace client
4. réimporter le même fichier — vérifier créés = 0
5. parcourir Heure / Jour / Mois / Année, naviguer sur 2 mois — vérifier les totaux et la distinction HP/HC
6. construire un petit CSV artisanal et l'importer via le mapping générique
7. demander à l'agent "combien a-t-on consommé ce mois-ci ?" puis "j'ai relevé 45300 en HP" — vérifier la réponse chiffrée, la création du relevé et son undo
8. vérifier l'affichage mobile de l'onglet

Backlog technique associé : `docs/parcours/PARCOURS_10_BACKLOG_TECHNIQUE.md`
