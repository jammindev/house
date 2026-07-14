# Module — weather

> Créé : 2026-07-14 (parcours 17, Lot 1+2). Rôle : afficher la **météo locale du foyer** — conditions actuelles, prévisions horaires du jour et sur 7 jours — pour en faire un contexte transverse de l'app (dashboard + page dédiée). Fournisseur : **Open-Meteo** (gratuit, sans clé).

## État synthétique

- **Backend** : Présent (`apps/weather/` — **aucun modèle**, intégration lecture-seule)
- **Frontend** : Complet dans `ui/src/features/weather/` (page + widget dashboard + champ localisation réutilisé dans Réglages)
- **Locales (en/fr/de/es)** : ok (namespace `weather.*`)
- **Tests** : `apps/weather/tests/` (services + views, httpx mocké) + E2E `e2e/weather.spec.ts`
- **Migrations** : 0 pour l'app weather ; 1 sur `households` (localisation)

## Nature — intégration lecture-seule (pas un CRUD scopé foyer)

Le module **ne stocke aucune donnée météo** : il lit Open-Meteo en direct et met en
cache. La seule donnée persistée est la **localisation**, portée par `Household` :
`latitude`, `longitude`, `location_label` (migration `households.0010`). Une maison
= un point. Conséquence : **pas de `SearchableSpec`/`ListableSpec`/`WritableSpec`
agent** en V1 (le contexte agent est le Lot 5, hors périmètre) → `apps.py::ready()`
est volontairement vide.

## API

- `GET /api/weather/` → météo du foyer courant. Toujours **HTTP 200** :
  - `{ "configured": false }` si le foyer n'a pas de localisation (état « à configurer », pas une erreur) ;
  - `{ "configured": true, "error": true, ...loc }` si Open-Meteo est injoignable (dégradation gracieuse) ;
  - sinon `{ configured, error:false, latitude, longitude, location_label, timezone, units, current, hourly[], daily[] }`.
- `GET /api/weather/geocode/?q=<ville>` → `{ results: [{name, admin1, country, country_code, latitude, longitude}], error }` (proxy du géocodage Open-Meteo, utilisé par le champ localisation des Réglages).
- Permissions : `IsHouseholdMember` (météo) ; `IsAuthenticated` (géocodage — la coordonnée n'est *persistée* que via l'update foyer, owner-only).

## Architecture — décisions

- **Source de vérité lecture** : `apps/weather/services.py` — `get_forecast()` (appel + normalisation + cache) et `geocode()`. Le viewset les appelle ; jamais d'appel Open-Meteo ailleurs.
- **Codes WMO → slug de condition** : `condition_for_code()` mappe le `weather_code` brut vers un slug stable (`clear`, `partly_cloudy`, `cloudy`, `fog`, `drizzle`, `rain`, `snow`, `thunderstorm`, `unknown`). Le backend renvoie code brut **et** slug ; le frontend possède l'emoji + le libellé i18n (`weather.condition.<slug>`). Découplage i18n propre — aucune localisation dans le backend.
- **Cache** : `django.core.cache` (LocMemCache par défaut), clé par lat/lon arrondis (~1 km), TTL 30 min. Un « storm » de renders tape Open-Meteo au plus une fois par fenêtre.
- **Dégradation gracieuse** : erreurs réseau/HTTP loggées et converties en `WeatherUnavailable`, jamais propagées en 500. Le widget se masque, la page affiche `weather.error`.
- **Normalisation** : `hourly` ne garde que les créneaux du **jour courant** ; `daily` = 7 jours. La forme aplatie (objets au lieu des tableaux parallèles d'Open-Meteo) est ce que le frontend consomme.

## Frontend

- `ui/src/lib/api/weather.ts` : types + `fetchWeather()` / `geocodePlace()`.
- `ui/src/features/weather/hooks.ts` : `useWeather()` (React Query, `staleTime` 30 min).
- `ui/src/features/weather/conditions.tsx` : `<ConditionIcon>` (switch → icônes lucide littérales, conforme à `react-hooks/static-components`). `conditionEmoji.ts` séparé (une fonction + un composant dans le même fichier viole `react-refresh/only-export-components`).
- `WeatherPage.tsx` : header + localisation, état « non configuré » (EmptyState → `/app/settings`), conditions actuelles, bande horaire, liste 7 jours.
- `ui/src/features/dashboard/WeatherCard.tsx` : widget dashboard (gated `!disabled.has('weather')`), se masque si non configuré / erreur / pas de données.
- `ui/src/features/weather/WeatherLocationField.tsx` : recherche de ville débattue (geocode) réutilisée par `HouseholdFormFields` (Réglages) — sélectionner un résultat remplit `location_label` + `latitude` + `longitude`.
- Invalidation : `useUpdateHousehold` (settings) invalide `['weather']` + `['households','list']` → widget/page se rafraîchissent dès qu'on définit la localisation.

## Module optionnel

`weather` est dans `OPTIONAL_MODULES` (backend `apps/households/modules.py` + front `ui/src/lib/modules.ts`) et `PINNABLE_MODULES`. Désactivable par l'owner ; route gardée par `ModuleRoute`. Entrée sidebar groupe « Maison », icône `CloudSun`.

## Consommateurs transverses

- **Tâches (Lot 3, livré)** : `Task.needs_dry_weather` tague une tâche d'extérieur. Le
  détail tâche affiche `TaskWeatherHint` (jours favorables des 7 prochains jours,
  calculés côté front via `useWeather()` + `favorableDays.ts`, seuil pluie ≤ 30 %).
  L'intégration ne touche pas `apps/weather/` — elle consomme l'endpoint existant.
- **Alertes (Lot 4, livré)** : `apps/weather/alerts.py::evaluate_weather_alerts`
  (pur, seuils fixes gel/canicule/vent/orage) est la source de vérité, consommée par
  trois canaux : carte dashboard/Alertes (`alerts.build_alerts_summary`, on-read),
  ping Telegram (`PingSpec('weather_alert')`, opt-in, anti-spam `PingLog` 1/jour) et
  notification cloche (`notifications.service.send`, idempotente par jour via
  `payload.day`). Le `daily[]` du forecast expose `wind_gusts_max` pour le seuil vent.
  Aucun nouveau modèle, aucun cron : réutilise le scheduler `send_scheduled_pings`.

## Limitations connues / lots suivants (parcours 17)

- **Lot 5** — contexte météo exposé à l'agent (searchable/tool lecture).
- **Lot 6** — corrélations conso (électricité/eau) avec l'historique météo.
- Une seule localisation par foyer (pas par zone) ; °C uniquement ; pas d'historique (arrive au Lot 6).
- Cache LocMem non partagé entre workers en prod — acceptable (données non critiques, TTL court) ; passer sur un cache partagé si l'app scale horizontalement.
