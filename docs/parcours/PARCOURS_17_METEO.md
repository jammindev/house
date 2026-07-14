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
| 3 | Tâches météo-conscientes (tag + suggestion de créneau sec) | backlog |
| 4 | Alertes météo (gel/canicule/vent/orage) via module alertes + job périodique | backlog |
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
