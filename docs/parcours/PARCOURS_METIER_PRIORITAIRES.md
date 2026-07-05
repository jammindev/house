# Parcours métier prioritaires

Ce document propose un premier cadrage produit pour développer House de façon utile après la migration vers la base Django + React actuelle.

Suivi vivant : l'état actuel des parcours et les dernières sessions sont tenus dans [docs/JOURNAL_PRODUIT.md](../../docs/JOURNAL_PRODUIT.md).

L'idée directrice est simple :

- on ne pilote pas le produit page par page
- on pilote par parcours métier de bout en bout
- on vise un rythme de 1 parcours principal par semaine

## Comment prioriser

Un parcours est prioritaire s'il coche au moins deux de ces critères :

- usage fréquent au quotidien
- forte valeur de mémoire ou de coordination pour le foyer
- effet structurant sur plusieurs modules du produit
- complexité raisonnable pour livrer un premier flux complet

## Les 6 premiers parcours recommandés

## 1. Capturer un événement du foyer et le retrouver facilement

Document détaillé : `docs/parcours/PARCOURS_01_CAPTURER_ET_RETROUVER_UN_EVENEMENT.md`

Statut actuel : **socle V1 livré**

### Pourquoi en premier

Le modèle `interaction` est le coeur du produit. Si ce flux est excellent, le reste du produit devient plus cohérent. S'il est faible, toutes les autres pages deviennent des silos.

### Déclencheur utilisateur

"Il vient de se passer quelque chose dans la maison et je veux le consigner tout de suite."

### Résultat attendu

L'utilisateur peut créer une interaction en moins d'une minute, lui donner un type clair, la rattacher à un contexte minimal, puis la retrouver sans effort.

La capture rapide peut démarrer depuis le dashboard, mais la vue de référence du parcours reste la page interactions/historique.

Le point d'entrée recommandé est un CTA unique d'ajout, suivi d'un sélecteur de type, puis d'un formulaire adapté.

### Stories initiales

- Créer une interaction simple depuis l'écran principal.
- Choisir un type utile dès la création : note, todo, dépense, maintenance.
- Ajouter un minimum de contexte : date, titre, description, zone éventuelle.
- Retrouver rapidement l'interaction dans la liste.
- Filtrer la liste par type, date ou contexte.

### Définition de done

- création rapide sans friction
- liste lisible et exploitable
- filtres de base utilisables
- aucun trou de navigation entre création et consultation

## 2. Traiter un document entrant et le relier au bon contexte

Document détaillé : `docs/parcours/PARCOURS_02_TRAITER_UN_DOCUMENT_ENTRANT_ET_LE_RELIER_AU_BON_CONTEXTE.md`

Note complémentaire : la couche IA pour ce parcours est consolidée dans `docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md` (section "Évolutions ultérieures").

Statut actuel : **V1 manuelle en pré-livraison**

### Pourquoi en deuxième

Les documents ont une forte valeur pratique, mais ils deviennent vraiment utiles seulement s'ils sont reliés à une interaction, un contact, une structure, un projet ou une zone.

### Déclencheur utilisateur

"J'ai une facture, un devis, un contrat ou une photo de document et je veux qu'il serve à quelque chose."

### Résultat attendu

L'utilisateur peut ajouter un document, comprendre ce qu'il représente, puis le rattacher au bon contexte métier sans ressaisie inutile.

### Périmètre de livraison V1 retenu

- ajout manuel ou upload simple d'un document
- liste documents avec repérage des documents sans activité
- détail document avec contexte actuel lisible
- rattachement à une activité existante
- création d'une activité depuis un document avec préremplissage minimal puis retour au détail document

Hors périmètre V1 :

- ingestion email entrante comme surface active de runtime
- compréhension assistée par IA
- création guidée depuis le détail document vers tous les autres contextes métier

### Stories initiales

- Voir la liste des documents avec un statut et des métadonnées minimales.
- Ouvrir un document et comprendre son contexte actuel.
- Lier un document à une interaction existante ou en créer une depuis le document.
- Associer un contact, une structure ou un projet si nécessaire.
- Revenir ensuite au document ou à l'interaction sans perdre le fil.

### Définition de done

- un document n'est plus un fichier isolé
- le lien document <-> interaction est simple à créer
- la navigation entre les entités liées est claire

## 3. Transformer un besoin en action suivie

### Pourquoi en troisième

Un produit de mémoire maison n'est pas seulement un journal. Il doit aussi aider à agir. Le flux tâches/actions donne une utilité quotidienne immédiate.

### Déclencheur utilisateur

"Je dois faire quelque chose, ou faire faire quelque chose, et je veux pouvoir le suivre."

### Résultat attendu

Une action peut être créée, contextualisée, suivie puis clôturée avec un historique exploitable.

### Stories initiales

- Créer une tâche depuis une interaction ou directement depuis la page tâches.
- Lier la tâche à un document, un contact, une structure, une zone ou un projet.
- Voir les tâches ouvertes, en retard et terminées.
- Marquer une tâche comme faite sans perdre son contexte historique.
- Retrouver depuis la tâche l'événement ou le document qui l'a déclenchée.

### Définition de done

- une tâche peut naître d'un besoin réel
- son contexte reste visible
- la clôture laisse une trace compréhensible

## 4. Suivre un projet de travaux ou de maintenance de bout en bout

### Pourquoi en quatrième

Le module projets devient utile quand il agrège des événements, documents, acteurs et actions. C'est un bon parcours de consolidation multi-entités.

### Déclencheur utilisateur

"Je veux avancer sur un chantier ou un sujet de fond sans perdre les infos dispersées."

### Résultat attendu

Un projet permet de centraliser les interactions, documents, contacts et tâches liés à un même objectif.

### Stories initiales

- Créer un projet avec un intitulé et un statut clairs.
- Voir sa synthèse : dernières interactions, documents liés, tâches ouvertes.
- Ajouter rapidement une interaction ou un document depuis le contexte projet.
- Lier les bons contacts ou prestataires.
- Garder une vue d'avancement suffisamment simple pour décider de la suite.

### Définition de done

- un projet devient un vrai point de coordination
- les informations utiles sont visibles sans fouille
- l'utilisateur sait quoi faire ensuite

## 5. Naviguer par zone ou équipement pour comprendre l'existant et agir

### Pourquoi en cinquième

La maison est un espace physique. La valeur du produit monte fortement si l'on peut partir d'une pièce, d'une zone ou d'un équipement pour retrouver l'historique et déclencher une action.

### Déclencheur utilisateur

"Je suis devant un espace ou un équipement et je veux savoir ce qu'il s'y est passé ou quoi faire."

### Résultat attendu

Depuis une zone ou un équipement, l'utilisateur peut voir l'historique utile, les documents associés et les prochaines actions pertinentes.

### Stories initiales

- Parcourir l'arborescence des zones sans confusion.
- Ouvrir une zone et voir les interactions, documents et équipements liés.
- Ouvrir un équipement et voir son historique de maintenance ou d'usage.
- Créer une interaction ou une tâche depuis ce contexte.
- Garder des liens cohérents entre zone, équipement et projet éventuel.

### Définition de done

- la navigation spatiale aide réellement à retrouver l'information
- l'utilisateur peut agir depuis le contexte consulté
- les liens entre espace, équipement et historique sont lisibles

## 6. Recevoir les bons rappels au bon moment pour ne rien rater

Document détaillé : `docs/parcours/PARCOURS_06_ALERTES_ET_RAPPELS_PROACTIFS.md`

Statut actuel : **à démarrer**

### Pourquoi en sixième

Les cinq premiers parcours ont construit la mémoire du foyer. Le produit capture, organise et relie les informations. Mais il ne signale pas. Les alertes proactives ferment la boucle : l'utilisateur sait immédiatement ce qui mérite son attention sans fouiller.

### Déclencheur utilisateur

"Je veux savoir ce qui mérite mon attention dans la maison sans avoir à tout parcourir manuellement."

### Résultat attendu

L'utilisateur arrive dans l'application et voit immédiatement ses tâches en retard, ses garanties qui expirent et ses maintenances à planifier. Il peut agir en un clic depuis cette vue.

### Périmètre de livraison V1 retenu

- section "À surveiller" sur le dashboard avec les alertes les plus urgentes
- page Alertes dédiée organisée en trois catégories : tâches en retard, garanties à surveiller, maintenances à planifier
- badge de navigation indiquant le nombre d'alertes actives
- endpoint backend `GET /api/alerts/summary/` agrégant les alertes en un seul appel

Hors périmètre V1 :

- emails ou push notifications de rappel
- configuration des fenêtres d'alerte par l'utilisateur
- alertes sur les projets sans activité récente
- snooze ou report d'une alerte

### Stories initiales

- Voir un résumé des alertes actives sur le dashboard sans fouiller.
- Accéder à la page Alertes pour voir toutes les catégories.
- Naviguer depuis une alerte vers l'entité concernée et agir.
- Voir le badge de navigation refléter le nombre d'alertes actives.

### Définition de done

- les alertes actives sont visibles sans navigation préalable
- chaque alerte mène à une action en un clic
- les alertes résolues disparaissent automatiquement

## 7. Poser une question en langage naturel sur son foyer

Document détaillé : `docs/parcours/PARCOURS_07_AGENT_CONVERSATIONNEL.md`

Note transverse : `docs/parcours/PARCOURS_IA_TRANSVERSE.md`

Statut actuel : **en cadrage, lot 0 OCR engagé** (issues #88 et #89)

### Pourquoi en septième

Les six premiers parcours ont construit une mémoire structurée du foyer. Le parcours 07 ouvre une seconde lecture de cette mémoire : l'utilisateur interroge en langage naturel et obtient une réponse citée, sans avoir à fouiller chaque section.

C'est aussi le premier porteur d'implémentation IA. Les décisions techniques (provider, sync/async, stockage OCR) sont tranchées ici avant d'irriguer les autres parcours IA (01, 02).

### Déclencheur utilisateur

"Je ne me souviens plus quand on a changé la chaudière, ou si la garantie du lave-vaisselle est encore valable, et je n'ai pas envie de fouiller."

### Résultat attendu

L'utilisateur pose une question, l'agent répond avec une citation cliquable vers l'entité d'origine.

### Périmètre de livraison V1 retenu

- pipeline OCR à l'upload des documents (issue #88)
- backfill OCR sur les documents existants (issue #89)
- recherche full-text sur la mémoire du foyer
- service d'appel Claude (Haiku 4.5) avec citations
- surface UI chat (forme à préciser)

### Hors périmètre V1

- agent qui crée ou modifie des entités (lecture seule en V1)
- ingestion email entrante ou WhatsApp
- mémoire conversationnelle persistée (à arbitrer V1 vs V2)
- streaming de réponse, vocal, fine-tuning, modèle local

### Stories initiales

- Uploader un document HEIC depuis iPhone et voir son texte extrait automatiquement.
- Re-extraire le texte des documents existants via une management command.
- Poser une question simple ("quand expire la garantie du lave-vaisselle ?") et obtenir une réponse citée.
- Cliquer sur une citation pour ouvrir l'entité d'origine.

### Définition de done

- tous les documents (anciens et nouveaux) ont leur texte extrait
- l'agent répond à une question avec une citation vérifiable
- la latence reste acceptable
- la mention de confidentialité est visible avant le premier usage

## 8. Voir et enregistrer ses dépenses depuis n'importe où dans le foyer

Document détaillé : `docs/parcours/PARCOURS_08_SUIVRE_LES_DEPENSES.md`

Statut actuel : **à démarrer** — fondation posée par la branche `feat/interaction-source-polymorphic` (PR à merger), parcours 08 ouvre la lecture transversale par-dessus.

### Pourquoi en huitième

Les dépenses existent depuis le parcours 01 sous forme d'`Interaction(type='expense')`. La branche `feat/interaction-source-polymorphic` (issue #119) a posé la fondation transverse : FK polymorphe + service helper réutilisable. Il manque encore (1) une vue agrégée qui réponde à « combien j'ai dépensé », (2) une entrée de quick-add depuis les projets, (3) la possibilité d'enregistrer une dépense « libre » (resto, cinéma, cadeau).

### Déclencheur utilisateur

"Je viens de payer une dépense, je veux pouvoir la consigner depuis n'importe où — un item de stock, un équipement, un projet, ou rien — et voir ensuite la somme du mois sans fouiller."

### Résultat attendu

Une page `/app/expenses/` qui affiche un total mensuel + breakdown, et un quick-add présent partout où une dépense peut surgir.

### Périmètre de livraison V1 retenu

- vue dépense agrégée + endpoint summary (lot 1.0)
- quick-add depuis Project (lot 1.1, parallèle à stock + equipment déjà livrés)
- dépense ad-hoc sans source — split du service en deux fonctions partageant un metadata builder (lot 1.2)

### Hors périmètre V1

- catégorisation des dépenses (`nature`, `ExpenseCategory`) — délibérément différée à 20-30 dépenses réelles, cf. #120
- module Budget complet (modèle Budget, comparaison budget vs réel, alertes seuil) — sujet d'un parcours 09 dédié
- réconciliation bancaire (import CSV, matching automatique)
- édition / suppression transverse des dépenses — couvert pour stock dans #118, à généraliser plus tard
- export CSV, multi-currency, receipt OCR

### Stories initiales

- Ouvrir `/app/expenses/` et voir le total du mois + breakdown par source-type sans fouille.
- Sur la fiche d'un projet, cliquer « + Dépense » et enregistrer un achat lié au projet (snapshot `actual_cost` mis à jour).
- Sur `/app/expenses/`, cliquer « + Dépense » pour saisir une dépense libre (`source=None`, `kind='manual'`).
- Filtrer la vue dépense par supplier ou source-type pour répondre à des questions précises (« combien j'ai payé Engie cet hiver »).

### Définition de done

- la page dépense est accessible depuis la sidebar et affiche un total cohérent
- une dépense peut être créée depuis StockItem, Equipment, Project, ou en mode ad-hoc — toutes via le même shape `metadata`
- la fondation pour un module Budget ultérieur est posée sans être pré-engagée

## 9. Voir et piloter la maison connectée depuis House

Document détaillé : `docs/parcours/PARCOURS_09_PILOTER_LA_MAISON_CONNECTEE.md`

Statut actuel : **cadré le 2026-07-03, à démarrer** — issues #183, #185 à #188 (lots 1 à 5), #189 (V2 différée).

### Pourquoi en neuvième

Les parcours 01 à 05 ont construit la mémoire du foyer, le parcours 07 l'a rendue interrogeable en langage naturel. Le parcours 09 ajoute l'état **présent et actionnable** de la maison : les devices connectés (volets, prises, relais, capteurs) rejoignent les zones et équipements que House connaît déjà. L'agent ne répond plus seulement "quand a-t-on changé la chaudière" mais aussi "le volet du séjour est-il ouvert ?" — et peut le fermer sur demande.

### Déclencheur utilisateur

"Je veux voir l'état de mes équipements connectés et les piloter depuis House, sans ouvrir une app constructeur par marque."

### Résultat attendu

Une page Domotique qui montre les appareils groupés par pièce avec leur état courant, des commandes directes (ouvrir/fermer un volet, allumer/éteindre un relais), et un agent capable de lire l'état et d'agir sur demande explicite. Preuve V1 : piloter le Shelly 2PM réel (volet roulant) de bout en bout.

### Périmètre de livraison V1 retenu

- app `apps/domotics/` : intégration provider (credentials par foyer), devices à capabilities normalisées (`cover`, `switch`, `power_meter`, `temperature`), journal d'audit des commandes
- couche adapter multi-constructeurs + premier adaptateur Shelly Cloud
- page `/app/domotics` : appareils groupés par zone, widgets par capability, connexion de compte
- intégration agent : état lisible via le RAG standard (`state_summary`) + tool `control_device` avec garde-fous

### Hors périmètre V1

- historique de mesures et graphes de consommation (nécessite un scheduler, cf. #189)
- webhooks entrants, pilotage local (LAN), autres providers que Shelly Cloud
- scènes, automatisations, programmation horaire
- notifications sur changement d'état (rejoindra le parcours 06)

### Stories initiales

- Connecter son compte Shelly Cloud et importer ses appareils automatiquement.
- Voir tous ses appareils groupés par pièce avec leur état courant.
- Ouvrir, stopper, fermer son volet roulant depuis House avec retour fidèle du résultat.
- Rattacher un appareil à une pièce et à une fiche équipement.
- Demander à l'agent l'état d'un appareil et lui demander une action explicite.

### Définition de done

- le volet roulant réel se pilote depuis House, position à l'appui
- un échec du cloud constructeur s'affiche honnêtement
- l'agent lit l'état et exécute une commande sur demande explicite, avec audit complet

## 10. Analyser la consommation électrique du foyer

Document détaillé : `docs/parcours/PARCOURS_10_ANALYSER_LA_CONSOMMATION_ELECTRIQUE.md`

Statut actuel : **cadré le 2026-07-04, à démarrer** — issues #198 à #201 (lots 1 à 4), #202 (V2 différée).

### Pourquoi en dixième

Le module électricité connaît l'architecture (tableau, circuits, points d'usage) mais aucune donnée de mesure. Le parcours 10 ajoute la **série temporelle** : combien la maison consomme, par heure, jour, mois ou année. C'est la première feature d'analyse de données du produit, et la première entrée de données externes par fichier (courbe de charge Enedis).

### Déclencheur utilisateur

"Je veux comprendre combien ma maison consomme d'électricité — par heure, par jour, par mois, par année — sans dépendre de l'app de mon fournisseur."

### Résultat attendu

Un onglet Consommation dans le module Électricité : compteur déclaré, relevés d'index saisis au fil de l'eau, import de la courbe de charge Enedis (et de tout CSV via mapping générique), graphique par granularité avec navigation dans le temps, et un agent qui répond à "combien a-t-on consommé en juin ?" et enregistre un relevé dicté.

### Périmètre de livraison V1 retenu

- modèle pivot générique multi-pays : `ConsumptionRecord` (énergie Wh sur un intervalle, cadran base/HP/HC, pas explicite) + `ElectricityMeter` + `MeterReading`
- relevés manuels matérialisés en estimations quotidiennes (prorata), régénérées à chaque modification
- registry d'adaptateurs d'import + `enedis_csv` (détection auto) + `generic_csv` (mapping colonnes/unité/pas), imports idempotents
- endpoint d'agrégation serveur heure/jour/mois/année (la vue heure exclut les estimations)
- onglet Consommation avec chart Recharts (première lib de graphiques du projet)
- intégration agent : compteur searchable, somme de kWh via `list_entities`, relevé dictable avec undo

### Hors périmètre V1

- synchronisation automatique Enedis (API réservée aux tiers enregistrés) — l'adaptateur rend l'ajout non-cassant
- coût en euros, comparaisons de périodes en un écran
- gaz, eau, production solaire ; sous-comptage par circuit
- alertes de dérive (rejoindra le parcours 06)

### Stories initiales

- Déclarer son compteur (base ou HP/HC).
- Saisir des relevés d'index et voir la consommation estimée.
- Importer la courbe de charge Enedis, idempotent au ré-import.
- Importer un CSV quelconque via mapping générique.
- Analyser par heure/jour/mois/année avec navigation dans le temps.
- Interroger l'agent sur la consommation et lui dicter un relevé.

### Définition de done

- la courbe de charge Enedis réelle importée donne les mêmes totaux que l'espace client aux 4 granularités
- un ré-import ne crée aucun doublon
- l'agent somme les kWh d'une période et enregistre un relevé dicté (réversible)

## 11. Tracker des valeurs dans le temps

Document détaillé : `docs/parcours/PARCOURS_11_TRACKER_DES_VALEURS.md`

Statut actuel : **V1 livrée le 2026-07-05** — PRs #209 (lots 1+2), #213 (lots 3+4), #212 (lot 5) ; #197 (V2 différée).

### Pourquoi en onzième

Les parcours 01 à 05 ont construit la mémoire du foyer, le parcours 07 l'a rendue interrogeable, le parcours 08 a ouvert la lecture transversale des dépenses. Le parcours 11 ajoute la **mesure dans la durée** : relevés de compteur, niveaux, heures de fonctionnement, budgets, poids — des valeurs qui vivent aujourd'hui dans des tableurs ou nulle part, alors que House connaît déjà leurs objets (équipements, zones, projets, stock).

### Déclencheur utilisateur

"Je veux suivre l'évolution d'une valeur dans le temps — un compteur, un niveau, un poids — sans tableur ni app dédiée."

### Résultat attendu

Une page Trackers où chaque série se lit d'un coup d'œil (dernière valeur, sparkline, deltas), une saisie en moins de dix secondes depuis la carte, des trackers ancrés sur l'existant (projet ou n'importe quelle entité du foyer), et un agent qui enregistre un relevé dicté et cite les valeurs.

### Périmètre de livraison V1 retenu

- app `apps/trackers/` : Tracker (nom, unité, emoji, ancrage projet ou entité générique) + TrackerEntry (valeur, date, note), caches dénormalisés, pont RAG `entries_summary`
- API DRF + services partagés viewset/agent (pattern tasks)
- page `/app/trackers` : cards avec saisie rapide inline + sparkline SVG maison, page détail avec deltas
- onglet Trackers dans le détail projet (contrat `TasksPanel`)
- intégration agent : valeurs citables via le RAG standard + création de trackers et d'entrées via `create_entity` (avec undo)

### Hors périmètre V1

- graphes riches (axes, zoom, périodes) et agrégats par période (« m³/mois ») — cf. #197
- rappels de relevé (rejoindra le parcours 06)
- panneaux « trackers liés » sur les pages équipement / zone / stock (l'API le permet déjà)
- seuils/objectifs avec alerte, import CSV

### Stories initiales

- Créer un tracker général, de projet, ou lié à une entité du foyer.
- Saisir une valeur en quelques secondes depuis la carte, antidatage possible.
- Lire la tendance : dernière valeur, sparkline, deltas entre entrées.
- Retrouver les trackers d'un projet dans son détail.
- Dicter un relevé à l'agent et l'interroger sur les valeurs.

### Définition de done

- le relevé mensuel du compteur se saisit en moins de dix secondes, tendance à l'appui
- un tracker s'ancre sur l'existant sans dupliquer de concept
- l'agent enregistre une entrée dictée (réversible) et répond en citant les valeurs

## Ce que je ne mettrais pas dans les 5 premiers

- flux avancés d'email entrant tant que le parcours document + interaction n'est pas solide
- raffinements IA tant que les parcours métier de base ne sont pas propres
- pages secondaires isolées sans impact sur un parcours complet

## Ordre de livraison recommandé

### Semaine 1

Parcours 1 : capturer et retrouver une interaction

### Semaine 2

Parcours 2 : traiter un document et le relier au bon contexte

### Semaine 3

Parcours 3 : transformer un besoin en action suivie

### Semaine 4

Parcours 4 : suivre un projet de bout en bout

### Semaine 5

Parcours 5 : naviguer par zone ou équipement pour comprendre et agir

### Semaine 6

Parcours 6 : recevoir les bons rappels au bon moment pour ne rien rater

## Template de travail pour une semaine

Pour chaque parcours hebdomadaire, remplir cette fiche avant de coder.

### 1. Problème utilisateur

Quel besoin concret veut-on résoudre cette semaine ?

### 2. Parcours cible

Décrire en 5 à 8 étapes le chemin complet utilisateur.

### 3. Stories de la semaine

Limiter à 3 à 7 stories maximum.

### 4. Critères d'acceptation

Chaque story doit avoir des critères observables et testables.

### 5. Écrans impactés

Lister seulement les pages touchées par ce parcours.

### 6. Risques métier ou UX

Identifier les zones de friction, trous de navigation ou ambiguïtés de vocabulaire.

### 7. Définition de done

Le parcours doit être faisable de bout en bout, même de manière simple.

## Règle de pilotage

Si une page n'améliore aucun parcours prioritaire, elle ne doit pas passer devant une amélioration de flux déjà engagé.