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
| 5 | Contexte météo exposé à l'agent IA | backlog |
| 6 | Corrélations conso (électricité/eau/poules) avec l'historique météo | backlog |

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
