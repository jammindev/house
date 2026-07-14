# Parcours 17 — La météo entre dans la maison

> **Statut V1 (Lot 1 + 2) : en cours de livraison.**
> Décisions de cadrage figées : localisation **sur le foyer** (`Household`),
> fournisseur **Open-Meteo** (gratuit, sans clé), périmètre initial = socle
> lecture-seule (localisation + widget dashboard + page prévisions).

## Intention

Faire de la météo un **contexte transverse** de l'application, pas une simple
page isolée. La météo conditionne l'entretien de la maison (jardinage, peinture
extérieure), la protection des cultures et des animaux, et se corrèle aux
consommations (chauffage/arrosage). Le socle V1 pose l'infrastructure lecture ;
les lots suivants la branchent sur les autres modules.

## Nature technique — intégration lecture-seule (pas un CRUD scopé foyer)

Le module météo **ne stocke aucune donnée métier** : il lit des prévisions
externes en direct (Open-Meteo) et les met en cache. Conséquences sur le pattern
« nouvelle feature » habituel :

- **Pas de modèle household-scoped**, donc pas de `WritableSpec`/`SearchableSpec`
  agent en V1 (le contexte agent est le Lot 5, hors périmètre).
- **La seule donnée persistée est la localisation**, portée par `Household`
  (`latitude`, `longitude`, `location_label`) — une maison = un point.
- Le « service » de l'app (`weather.services`) reste la source de vérité, mais
  côté **lecture** : appel HTTP + normalisation + cache. Le viewset l'appelle ;
  aucun double chemin.

## Découpage complet (rappel du backlog PO)

| Lot | Thème | Statut |
|-----|-------|--------|
| **1** | Localisation foyer + service Open-Meteo (cache) + widget dashboard | **V1** |
| **2** | Page météo (horaire du jour + prévisions 7 jours) | **V1** |
| 3 | Tâches météo-conscientes (tag + suggestion de créneau sec) | **livré** (2026-07-14) |
| 4 | Alertes météo (gel/canicule/vent/orage) via module alertes + pings | **livré** (2026-07-14) |
| 5 | Contexte météo exposé à l'agent IA (tool `get_weather`) | **cadré** (à implémenter) |
| 6 | Corrélations conso (électricité/eau) avec l'historique météo | **cadré** (à implémenter) |

## Lot 1 — Fondations

### US1.1 — Configurer la localisation du foyer
- **En tant qu'** owner, **je veux** définir la localisation de ma maison
  (recherche par ville → lat/lon), **afin de** récupérer la météo au bon endroit.
- Localisation portée par `Household` : `latitude`, `longitude`,
  `location_label`. Modifiable **owner uniquement** (permission déjà en place sur
  `HouseholdViewSet.update`).
- Recherche ville via un endpoint de géocodage proxy (`/api/weather/geocode/`)
  qui appelle Open-Meteo geocoding — l'owner tape une ville, choisit un résultat,
  lat/lon + libellé sont pré-remplis.
- État vide tant qu'aucune localisation → CTA « Définir la localisation » visible
  seulement par l'owner.

### US1.2 — Widget météo sur le dashboard
- **En tant que** membre, **je veux** un widget météo (température, condition,
  min/max, icône) **afin de** connaître le temps d'un coup d'œil.
- Skeleton pendant le chargement ; carte masquée si pas de localisation (pour un
  membre non-owner) ou invite à configurer (owner) ; erreur discrète + dernière
  valeur en cache si l'API échoue.
- Respecte `disabled_modules` : masqué si le module `weather` est désactivé.

## Lot 2 — Prévisions

### US2.1 — Page météo 7 jours
- **En tant que** membre, **je veux** les prévisions horaires du jour + 7 jours
  (min/max, condition, probabilité de pluie, vent) **afin de** planifier.
- États vide (pas de localisation) et erreur gérés ; skeleton de chargement ;
  °C par défaut ; i18n complet (en/fr/de/es), y compris les libellés de condition.

## Lot 3 — Tâches météo-conscientes (livré 2026-07-14)

### US3.1 — Repérer les tâches sensibles à la météo
- Champ booléen `Task.needs_dry_weather` (défaut `false`, migration `tasks.0005`,
  opt-in → tâches existantes inchangées). Exposé par `TaskSerializer` (les deux
  chemins d'écriture, REST + agent, passent par lui).
- Case à cocher « nécessite un temps sec » dans le dialog tâche, **masquée si le
  module météo est désactivé** pour le foyer. Pictogramme `CloudSun` sur la card.

### US3.2 — Suggérer le meilleur créneau
- Sur le détail d'une tâche « temps sec » **sans échéance** et non terminée : encart
  `TaskWeatherHint` qui liste les **jours favorables** des 7 prochains jours.
- Règle V1 (`ui/src/features/weather/favorableDays.ts`) : jour favorable =
  `precipitation_probability_max ≤ 30 %` (ou inconnue). Précipitations seulement,
  pas de vent — volontairement simple, seuil ajustable en un point.
- Aucun jour favorable → message neutre ; localisation/prévisions absentes ou module
  désactivé → l'encart **se masque en silence**, jamais de blocage de la tâche.
- **Calcul côté frontend** à partir du `daily[]` déjà fourni par `GET /api/weather/`
  (via `useWeather()`) — pas de nouvel endpoint, pas d'appel Open-Meteo supplémentaire.
- Agent : `needs_dry_weather` câblé dans `create_entity`/`update_entity` (create +
  update via les services `tasks.services`), description du tool étendue.

## Lot 4 — Alertes météo (cadrage validé 2026-07-14)

Objectif : prévenir le foyer quand la météo à venir franchit un seuil à risque
(**gel, canicule, vent fort, orage**). Décisions figées avec le PO :
- **Canaux** : les trois — carte dashboard (in-app, universel), ping Telegram
  (proactif, opt-in), notification cloche in-app.
- **Seuils** : **défauts fixes** (constante registry), l'utilisateur active/désactive
  seulement l'alerte (+ heure d'envoi du ping). Pas d'écran de seuils en V1.
- **Types V1** : gel, canicule, vent fort, orage/forte pluie.

### Décision d'architecture — réutilisation maximale, zéro nouveau modèle

Le socle existant couvre tout ; **aucune nouvelle table** :
- **Ordonnanceur** : le conteneur `send_scheduled_pings --loop` (tick 5 min,
  idempotent) existe déjà — on **ne crée pas de cron**. On enregistre un
  `PingSpec('weather_alert')`.
- **Opt-in + heure** : `PingPreference` (ping_type `weather_alert`) — déjà le
  modèle des préférences de ping. **Anti-spam 1/jour/user** : `PingLog`.
- **Cloche** : `notifications.service.send(...)`.

### Source de vérité unique — l'évaluateur

`apps/weather/alerts.py::evaluate_weather_alerts(household) -> list[WeatherAlert]`
est **pur** (lit `weather.services.get_forecast` + seuils fixes, aucune écriture).
Les **trois canaux le consomment** — jamais de logique de seuil dupliquée :

| Canal | Consommateur | Cadence | Opt-in ? |
|-------|--------------|---------|----------|
| Carte dashboard / page Alertes | `alerts.build_alerts_summary` (5e catégorie `weather`) | on-read | non (juste module actif + localisation) |
| Ping Telegram | `PingSpec('weather_alert').build_message` | scheduler quotidien | oui (`PingPreference`) |
| Notification cloche | créée dans `build_message` quand une alerte se déclenche | idem ping | oui (couplée au ping) |

Seuils par défaut (constante dans `weather/alerts.py`) : gel `temp_min < 0 °C`,
canicule `temp_max > 35 °C`, vent `> 50 km/h`, orage `weather_code ∈ {95,96,99}`.
L'évaluateur inspecte les prochains jours du `daily[]` (fenêtre ~48 h) et renvoie
une liste structurée `{kind, severity, date, value, message}` — le message est
rendu i18n (langue user) pour le ping/cloche ; la carte dashboard reçoit les champs
structurés et rend côté front.

### US4.1 — Voir les risques météo dans l'app (carte)
- **En tant que** membre, **je veux** voir les risques météo à venir sur la carte
  Alertes / le dashboard, **afin de** anticiper sans dépendre de Telegram.
- Toujours visible si module météo actif + localisation définie ; sinon absent.

### US4.2 — Être prévenu proactivement (ping + cloche)
- **En tant que** membre, **je veux** activer un rappel météo qui me pousse une
  alerte (Telegram + cloche) **afin d'** être prévenu sans ouvrir l'app.
- Opt-in via les préférences de ping (comme les autres pings). Anti-spam 1/jour.
- Le ping Telegram requiert un compte Telegram lié (précondition de l'infra pings) ;
  la **carte dashboard reste le canal universel** pour les non-Telegram.

### Hors périmètre Lot 4
- Seuils configurables (V2), alerte poulailler dédiée (peut se greffer plus tard
  via un message contextualisé si module chickens actif), historique des alertes.

## Lot 5 — Contexte météo pour l'agent IA (cadrage — à valider avant code)

Objectif : que l'assistant conversationnel puisse **répondre avec la météo**
(« quand tondre cette semaine ? », « faut-il protéger les tomates ce week-end ? »,
« quel temps demain ? ») en s'appuyant sur les prévisions du foyer.

### Nature — un tool de lecture, pas un `SearchableSpec`

La météo n'a **pas de modèle DB** → elle ne peut pas passer par le registry
`searchables` (qui indexe des lignes). Le bon véhicule est un **tool agent dédié**
en lecture seule, à l'image de `search_household` / `list_entities`.

L'architecture agent le permet **sans toucher `apps/agent/`** : `apps/agent/tools.py`
expose `AgentTool(name, description, input_schema, handler)` + `register()` dans un
`REGISTRY`. On enregistre un `get_weather` depuis `apps/weather/apps.py::ready()`
(comme les apps enregistrent leurs `writables`/`listables`).

### US5.1 — L'agent connaît la météo
- **En tant qu'** utilisateur, **je veux** interroger l'assistant sur la météo à
  venir, **afin d'** obtenir des conseils d'entretien contextualisés.
- Tool `get_weather` : handler → `weather.services.get_forecast` +
  `weather.alerts.evaluate_weather_alerts`, rend un bloc texte (conditions
  actuelles, min/max + pluie sur 7 j, alertes actives). Pas de `hits`/citation
  (donnée externe, pas une entité du foyer).
- `input_schema` minimal (aucun paramètre, ou `days` optionnel).
- Si pas de localisation / module désactivé → le tool renvoie un message clair
  « météo non configurée » (le modèle le relaie sans inventer).

### Décisions à trancher avant implémentation
- **Tool dédié `get_weather`** (recommandé) vs injection systématique de la météo
  dans le contexte de chaque conversation (plus coûteux en tokens, non ciblé).
- **Gating par foyer** : le `REGISTRY` de tools est global (pas de filtre par
  foyer aujourd'hui — cf. `web_search` gated par un flag global dans
  `service.py`). V1 simple = tool toujours déclaré, réponse « non configurée »
  si pas de localisation ; gating fin par foyer = petite extension de `service.py`.
- Faut-il un **tool d'historique** pour « quel temps faisait-il en janvier ? »
  (recoupe le Lot 6) → probablement non en V1, s'en tenir aux prévisions.

### Hors périmètre Lot 5
- Écriture depuis l'agent (la météo est lecture seule), historique conversationnel
  météo, actions automatiques déclenchées par la météo.

## Lot 6 — Corrélations consommation ↔ météo (cadrage — à valider avant code)

Objectif : superposer la **température passée** aux relevés de consommation
(électricité, eau) pour expliquer les pics (chauffage en froid, arrosage en
canicule).

### Nature — historique météo + overlay sur les graphes existants

- **Source** : Open-Meteo **Archive API** (`archive-api.open-meteo.com/v1/archive`,
  gratuit, sans clé) — `daily=temperature_2m_mean` sur la période affichée.
- **Pas de modèle DB** (fidèle à la philosophie lecture seule) : fetch à la
  demande pour la période + cache Django (clé lat/lon + période + granularité).
  Un modèle `WeatherHistory` ne se justifierait que si le volume/agrégation
  devient un coût — à réévaluer, pas en V1.
- **Consommateurs** : les graphes conso existants — `electricity` et `water`
  partagent `ui/src/components/charts/ConsumptionBarChart.tsx` (Recharts). L'overlay
  = passer d'un `BarChart` à un `ComposedChart` (barres conso + **ligne
  température**), activable par un toggle.

### US6.1 — Voir la température sur les graphes de conso
- **En tant que** propriétaire, **je veux** superposer la température moyenne à
  mes courbes élec/eau, **afin de** comprendre mes pics de consommation.
- Toggle « afficher la météo » sur les pages électricité et eau ; la série
  température s'aligne sur les buckets de la période/granularité courante.
- États : pas de localisation → toggle masqué/désactivé ; historique indispo sur
  la période → la conso s'affiche normalement, sans la ligne (dégradation gracieuse).

### Contrat technique pressenti
- **Backend** : endpoint `GET /api/weather/history/?date_from&date_to&granularity`
  → `{ points: [{ ts, temp_mean }] }` (agrégation day/month alignée sur les
  granularités conso). Vit dans `apps/weather/` (concern météo), consommé par le
  front élec/eau — pas de logique météo dupliquée dans ces apps.
- **Frontend** : `ConsumptionBarChart` gagne une prop optionnelle `overlaySeries`
  (ligne) ; les pages élec/eau fetchent l'historique météo et la passent.

### Décisions à trancher avant implémentation
- **Modules couverts** : électricité + eau (recommandé, les deux partagent le
  chart) ; trackers génériques hors scope V1.
- **On-demand + cache** (recommandé) vs persistance `WeatherHistory`.
- **Granularités** : day + month (pas d'historique horaire) ; borne passée de
  l'archive (Open-Meteo remonte loin, mais limiter la fenêtre requêtée).
- Unité/agrégat : température **moyenne** journalière (vs min/max) pour la V1.

### Hors périmètre Lot 6
- Corrélation statistique automatique (coefficient, « +X kWh par °C »),
  autres variables (pluie, degrés-jours de chauffage), export.

## Contrats techniques V1

### Données Open-Meteo
- **Prévisions** : `api.open-meteo.com/v1/forecast` — `current`, `hourly`
  (aujourd'hui), `daily` (7 j), `timezone=auto`.
- **Géocodage** : `geocoding-api.open-meteo.com/v1/search`.
- Pas de clé API. Timeout court, erreurs loggées et non-propagées (dégradation
  gracieuse : le widget/la page affichent un état d'erreur, jamais de 500).

### Codes météo (WMO) → condition
Le backend traduit le `weather_code` WMO en **slug de condition** stable
(`clear`, `partly_cloudy`, `cloudy`, `fog`, `drizzle`, `rain`, `snow`,
`thunderstorm`) + renvoie le code brut. Le frontend traduit le slug via
`weather.condition.<slug>` et choisit l'emoji. Découplage i18n propre.

### Cache
Cache Django (`django.core.cache`) clé par lat/lon arrondis + type
(`current+forecast`). TTL ~30 min. Évite de taper Open-Meteo à chaque render.

### Endpoints
- `GET /api/weather/` → `{ configured, location_label, latitude, longitude,
  timezone, current, hourly[], daily[] }` (household courant). `configured:false`
  si pas de localisation (HTTP 200, pas une erreur).
- `GET /api/weather/geocode/?q=<ville>` → `[{ name, admin1, country, country_code,
  latitude, longitude }]` (max 5).

## Hors périmètre V1 (explicite)
- Alertes, tâches météo-conscientes, contexte agent, corrélations conso.
- Position par zone, unités impériales, multi-localisation.
- Historique météo (arrive au Lot 6).
