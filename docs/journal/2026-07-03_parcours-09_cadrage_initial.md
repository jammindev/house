# 2026-07-03 — Parcours 09 cadrage initial

## Contexte

Session de cadrage du neuvième parcours métier : voir et piloter la maison connectée depuis House.

Déclencheur : l'utilisateur possède un Shelly 2PM Gen2 en mode volet roulant et veut le piloter depuis House. Exigence posée dès le départ : construire une base **générique multi-constructeurs** plutôt qu'un module Shelly, et l'intégrer pleinement à l'agent conversationnel.

## Ce qui a été confirmé

- le périmètre V1 inclut le pilotage (pas seulement le monitoring) : ouvrir/fermer/stopper le volet réel est la preuve que la base est réussie
- la connexion passe par Shelly Cloud API — la prod tourne sur le VPS, pas sur le réseau local du foyer ; le cloud constructeur est le seul chemin universel
- le modèle est par **capabilities** normalisées (`cover`, `switch`, `power_meter`, `temperature`), pas par type de device — aucun concept Shelly ne fuit hors de l'adaptateur
- une couche provider (contrat + registry, même philosophie que `agent.searchables`) rend l'ajout d'un constructeur = 1 fichier + 1 register
- l'intégration agent tient en deux pièces sans modifier `apps/agent/` : un champ `Device.state_summary` dans les `search_fields` du SearchableSpec (l'état devient citable via le RAG standard) + un tool dédié `control_device` avec garde-fous (action physique sans undo → demande explicite, compte-rendu fidèle, audit)
- une commande physique n'est pas une écriture réversible : pas de `WritableSpec`, pas de toast Annuler — la sécurité vient de l'audit `DeviceCommand` et du non-optimisme de l'UI

## État du runtime confirmé pendant la session

- aucune trace de domotique/IoT/MQTT dans le code ni les docs — terrain vierge
- aucun scheduler de fond (pas de Celery/Huey) → rafraîchissement V1 on-demand avec TTL serveur 15 s ; l'historique de mesures est différé avec lui
- aucun client HTTP sortant dans le projet → `requests` et `responses` entrent aux requirements
- le registry de tools de l'agent (`apps/agent/tools.py`) accepte l'enregistrement depuis le `ready()` d'une autre app — `control_device` sera le premier tool cross-app
- le RAG rend le contenu d'une entité depuis ses `search_fields` — vérifié dans `apps/agent/retrieval.py`, c'est ce qui permet le pont `state_summary` sans toucher l'agent
- endpoints Shelly Cloud vérifiés sur la doc officielle : énumération via `/device/all_status` (v1 dépréciée, seul listing existant), statut et commandes via l'API v2, rate limit 1 req/s

## Documents produits ou mis à jour

- [docs/parcours/PARCOURS_09_PILOTER_LA_MAISON_CONNECTEE.md](../parcours/PARCOURS_09_PILOTER_LA_MAISON_CONNECTEE.md) — doc produit
- [docs/parcours/PARCOURS_09_BACKLOG_TECHNIQUE.md](../parcours/PARCOURS_09_BACKLOG_TECHNIQUE.md) — backlog technique
- [docs/parcours/PARCOURS_METIER_PRIORITAIRES.md](../parcours/PARCOURS_METIER_PRIORITAIRES.md) — section 9 ajoutée
- [docs/NEXT_STEPS.md](../NEXT_STEPS.md) — entrée moyen terme parcours 09
- issues GitHub : #183 (socle backend), #185 (provider Shelly), #186 (services + API), #187 (frontend), #188 (agent), #189 (idea V2)
- label GitHub `app:domotics` créé

## Recommandation pour la suite

Implémenter dans l'ordre des lots : socle (#183) → provider (#185) → services + API (#186) → frontend (#187, preuve V1 avec le volet réel) → agent (#188). Une feature branch par lot ou paire de lots, PR vers `main`.

## Points de vigilance conservés

- ne pas laisser un concept Shelly fuiter hors de `providers/shelly_cloud.py`
- ne jamais afficher un état optimiste ni annoncer un succès non confirmé par le fournisseur
- respecter le rate limit Shelly (1 req/s) : appels groupés uniquement, TTL serveur
- `current_pos` est null tant que le volet n'est pas calibré — l'UI doit le supporter
- ne pas engager scheduler/webhooks/historique avant que l'usage réel le réclame (#189)
