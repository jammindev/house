# 2026-07-04 — Parcours 11 cadrage initial

## Contexte

Session de cadrage du onzième parcours métier : tracker des valeurs dans le temps (compteurs, niveaux, poids, heures de fonctionnement, budgets).

Déclencheur : l'utilisateur veut « pouvoir tracker des choses » — des trackers généraux, insérés dans des projets, ou liés à des entités du foyer. Décisions prises en début de session : entrées = valeurs numériques datées (valeur + unité + date + note), double ancrage projet + entité générique, visualisation par sparkline SVG maison, cadrage avant code.

## Ce qui a été confirmé

- le concept central est le **Tracker** (série) + **TrackerEntry** (mesure datée), nouvelle app `apps/trackers/`
- le double ancrage : FK `project` dédiée (alimente un onglet du détail projet, comme `Task.project`) + GenericFK `target_*` calquée sur `Interaction.source_*` pour lier n'importe quelle entité ; ni l'un ni l'autre = tracker général
- la cible générique s'appuie sur le registry `agent.searchables` (résolution entity_type → modèle, label et URL gratuits) : tout ce qui est cherchable par l'agent est liable à un tracker, sans table de correspondance
- le pont agent réutilise le mécanisme validé au parcours 09 : un champ texte dénormalisé `entries_summary` (10 dernières entrées avec deltas), régénéré à chaque écriture, dans les `search_fields` — les valeurs deviennent citables via le RAG standard, zéro modification de `apps/agent/`
- l'ajout d'entrée par l'agent est une écriture réversible standard : `WritableSpec('tracker_entry')` séparé via `create_entity` + toast Annuler (contrairement au `control_device` du parcours 09), avec fallback anchor pour « ajoute 82.4 » en conversation ancrée
- caches dénormalisés `last_value`/`last_entry_at` recalculés depuis la DB à chaque écriture (l'antidatage est un cas normal : max `occurred_at`, pas la dernière saisie)
- sparkline SVG maison (~40 lignes, x proportionnel au temps), servie par l'API en 1 requête (sliced Prefetch) — aucune lib de chart n'entre dans le projet en V1
- DELETE tracker = archive, DELETE entrée = hard delete ; pas de règle creator-only (un relevé est un bien commun du foyer)

## État du runtime confirmé pendant la session

- aucun modèle de série de valeurs datées dans le code (le plus proche : `PlanChangeLog`/`MaintenanceEvent` d'electricity, qui journalisent des événements, pas des mesures)
- aucune lib de chart dans `package.json` — la sparkline maison est le premier composant de visualisation
- le pattern service partagé viewset + agent est bien en place sur `apps/tasks/` (référence directe pour les lots 2 et 5)
- `ProjectDetailPage` utilise `TabShell` + panels embarquables (`TasksPanel` avec `projectId`/`stateKeyPrefix`) — le contrat à répliquer pour l'onglet Trackers
- Django 5.x → sliced `Prefetch` disponible pour la sparkline en 1 requête

## Documents produits ou mis à jour

- [docs/parcours/PARCOURS_11_TRACKER_DES_VALEURS.md](../parcours/PARCOURS_11_TRACKER_DES_VALEURS.md) — doc produit
- [docs/parcours/PARCOURS_11_BACKLOG_TECHNIQUE.md](../parcours/PARCOURS_11_BACKLOG_TECHNIQUE.md) — backlog technique
- [docs/parcours/PARCOURS_METIER_PRIORITAIRES.md](../parcours/PARCOURS_METIER_PRIORITAIRES.md) — section 10 ajoutée
- [docs/NEXT_STEPS.md](../NEXT_STEPS.md) — entrée moyen terme parcours 11
- issues GitHub : #192 (socle backend), #193 (services + API), #194 (frontend), #195 (embed projet), #196 (agent), #197 (idea V2)
- label GitHub `app:trackers` créé

## Recommandation pour la suite

Implémenter dans l'ordre des lots : socle (#192) → services + API (#193) → frontend (#194, preuve V1 : le relevé en dix secondes depuis la carte) → embed projet (#195) → agent (#196). Une feature branch par lot ou paire de lots, PR vers `main`.

## Points de vigilance conservés

- régénérer `entries_summary` et les caches sur les trois écritures d'entrée (create/update/delete), antidatage testé
- résolution `target_type` via le registry searchables toujours paresseuse (registry vide avant `ready()`)
- le handler agent passe par le service, jamais l'ORM — test « create agent = create REST » obligatoire
- l'undo d'une entrée créée par l'agent doit repasser par le service de suppression (recalcul du cache)
- sparkline de la liste en 1 requête (`assertNumQueries`)
