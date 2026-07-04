# 2026-07-04 — Parcours 10 cadrage initial

## Contexte

Session de cadrage du dixième parcours métier : analyser la consommation électrique du foyer par heure, jour, mois et année.

Déclencheur : l'utilisateur (client Enedis avec Linky) veut analyser sa consommation depuis House. Exigence posée dès le départ : pouvoir importer directement ses données tout en restant **générique pour les autres pays** — Enedis ne doit être qu'un format d'entrée parmi d'autres.

## Ce qui a été confirmé

- le module électricité actuel ne contient **aucune donnée de mesure** (architecture du tableau uniquement) — la consommation est une brique nouvelle, mais elle vit dans `apps/electricity/` (pas de nouvelle app), en 5e onglet du module
- le cœur générique est un **modèle pivot** `ConsumptionRecord` (énergie Wh entière, sur un intervalle explicite en minutes, par compteur et cadran) — aucun concept Enedis, aucun pas de temps supposé ; tout pays s'y réduit
- l'import passe par un **registry d'adaptateurs** (même philosophie que `agent.searchables` et les providers domotics du parcours 09) : `enedis_csv` (détection auto du format courbe de charge) + `generic_csv` (mapping utilisateur colonnes/unité/pas = filet de sécurité international) ; idempotence par clé naturelle `(meter, register, ts_start)`
- la **sync automatique Enedis est écartée en V1** : l'API Data Connect est réservée aux tiers enregistrés, les proxys tiers ajoutent de la complexité pour des données J+1 de toute façon — le CSV d'abord, un futur adaptateur `fetch()` produira les mêmes points normalisés (non-cassant, cf. #202)
- les relevés manuels d'index restent la **source universelle** (le parcours marche sans Enedis) : delta entre deux relevés matérialisé en estimations quotidiennes au prorata des secondes, régénérées à chaque modification
- règle d'honnêteté des granularités : la vue heure n'affiche jamais une estimation quotidienne ; chaque seau expose `estimated_wh`
- l'agrégation est 100 % serveur (`Trunc` + `Sum` Postgres, frontières en fuseau local) — le front ne calcule rien
- **Recharts entre au projet** (première lib de graphiques, resservira au parcours 08)
- intégration agent sans modifier `apps/agent/` : `SearchableSpec('meter')`, `ListableSpec('consumption')` avec `amount_of` en kWh (le rendu `sum_amount` du tool est sans devise — vérifié dans `apps/agent/tools.py`), `WritableSpec('meter_reading')` create-only avec undo standard

## État du runtime confirmé pendant la session

- aucun modèle de mesure, aucun endpoint d'agrégation, aucun upload de fichier de données, aucune lib de charts dans package.json
- permissions du module électricité : owner écrit, membres lisent (`IsElectricityOwnerWriteMemberRead`) — conservées pour compteurs/relevés/imports
- le registry `agent.listables` supporte `amount_of` (somme sur l'ensemble filtré, rendu neutre sans devise) — c'est ce qui répond à « combien a-t-on consommé en juin ? »
- `apps/electricity/apps.py` n'a pas encore de `ready()` — à créer au lot 4
- session menée en parallèle du cadrage du parcours 11 (tracker de valeurs) : la numérotation a été coordonnée (10 = consommation, 11 = trackers)

## Documents produits ou mis à jour

- [docs/parcours/PARCOURS_10_ANALYSER_LA_CONSOMMATION_ELECTRIQUE.md](../parcours/PARCOURS_10_ANALYSER_LA_CONSOMMATION_ELECTRIQUE.md) — doc produit
- [docs/parcours/PARCOURS_10_BACKLOG_TECHNIQUE.md](../parcours/PARCOURS_10_BACKLOG_TECHNIQUE.md) — backlog technique
- [docs/parcours/PARCOURS_METIER_PRIORITAIRES.md](../parcours/PARCOURS_METIER_PRIORITAIRES.md) — section 10 ajoutée
- [docs/NEXT_STEPS.md](../NEXT_STEPS.md) — entrée moyen terme parcours 10
- issues GitHub : #198 (socle backend), #199 (importers), #200 (frontend), #201 (agent), #202 (idea V2)

## Recommandation pour la suite

Implémenter dans l'ordre des lots : socle (#198) → importers (#199) → frontend (#200, preuve V1 avec la courbe de charge réelle) → agent (#201). Une feature branch par lot, PR vers `main`, merge dans l'ordre.

## Points de vigilance conservés

- caler le parser Enedis sur le **fichier réel du foyer** (la doc du format ne fait pas foi), archiver un extrait anonymisé en fixture
- prorata des **secondes** pour les estimations (les journées de 23 h/25 h au changement d'heure doivent tomber juste)
- parse intégral avant écriture — jamais d'import partiel silencieux
- ne jamais laisser un concept Enedis fuiter hors de `importers/enedis_csv.py`
- recouper les totaux importés avec l'espace client Enedis avant de considérer la V1 livrée
- **chevauchement produit à surveiller avec le parcours 11 (trackers)** : un tracker peut aussi porter un relevé de compteur ; le parcours 10 garde l'analyse énergétique spécialisée (imports, cadrans, granularités), le 11 la saisie générique — réévaluer si l'usage crée de la confusion
