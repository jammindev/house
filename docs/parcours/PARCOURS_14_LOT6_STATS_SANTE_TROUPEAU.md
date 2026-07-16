# Parcours 14 — Lot 6 : Stats & santé du troupeau

> **État** — cadrage (2026-07-16). Fait suite au module poulailler V1
> (parcours 14, lots 1-5) et à la refonte trackers/stock (parcours 11 lot 7 :
> la nourriture est un `StockItem`, plus un tracker CONSUMPTION).

## Résumé

Le module poulailler enregistre déjà le troupeau (`Chicken`), la ponte
quotidienne (`EggLog`, upsert `unique(household, date)`) et le journal
(`ChickenEvent`, dont les types `molt`/mue). Ce lot exploite ces données pour
**trois lectures** à forte valeur, sans nouveau modèle :

1. **Courbe de ponte** — évolution dans le temps, avec sélecteur de période et
   **taux de relevé** honnête (les jours non relevés ne comptent pas comme 0).
2. **Alerte de chute de ponte anormale** — détectée sur la baseline, **qualifiée**
   par la cause probable (mue en cours / météo extrême / inconnue), remontée dans
   le module alertes existant.
3. **Coût au œuf** — déjà calculé en V1 ; ce lot le rend **transparent**
   (répartition alimentation / soins) et cohérent avec la décision produit.

## Décision produit clé — le « zéro » n'existe pas sans relevé

C'est le pivot du lot. Il faut distinguer **trois états**, pas deux :

| État | Sémantique | Traitement |
|---|---|---|
| `EggLog` avec `count > 0` | fait réel | point plein sur la courbe |
| `EggLog` avec `count = 0` | fait réel (froid, mue…) | point posé sur l'axe (creux visible) |
| Pas de `EggLog` ce jour | **inconnu** | trou dans la courbe, exclu des agrégats |

Le modèle sépare déjà nativement ces cas : **ligne présente = fait (y compris 0),
ligne absente = inconnu** (grâce à l'upsert `unique(household, date)`). Aucune
migration.

**Conséquences directes :**

- **Agrégats calculés sur les jours *relevés* uniquement** — moyenne =
  `somme œufs ÷ nombre de jours relevés`, jamais ÷ jours calendaires. C'est déjà
  ce que fait `egg_stats` en V1 (`_avg` ignore les jours absents).
- **Taux de relevé (couverture)** exposé partout : `{logged_days, total_days,
  rate}`. Nouvelle primitive partagée par la courbe (affichage), le coût
  (transparence) et l'alerte (garde-fou anti-faux-positif).
- **Pas d'imputation dans les chiffres.** Combler les trous par une moyenne
  glissante fabriquerait des œufs → fausse le coût au œuf et *masque* la chute
  qu'on veut détecter. L'estimation reste, si un jour on la veut, un pur confort
  visuel cloisonné (hors périmètre de ce lot).
- **Visuel :** trou = ligne interrompue/grisée ; vrai 0 = point sur l'axe ; une
  bande « couverture » sous la courbe (une case/jour, pleine = relevé) rend les
  trous lisibles d'un coup d'œil.

## Lot 6.1 — Courbe de ponte

**Backend** — `egg_stats(household, *, period=30, today=None)` :
- `period` ∈ {7, 30, 90, 365} (jours). Défaut 30 (rétrocompat).
- Renvoie, en plus de l'existant (`today`, `avg_7d`, `avg_30d`, `month_total`,
  `total`) : `series` (un point/jour sur la période, `count=null` si non relevé),
  `coverage: {logged_days, total_days, rate}`, `period_total`, `period_avg`
  (sur jours relevés), `best_day: {date, count}`, `period` (echo).
- Endpoint : `GET /api/chickens/egg-logs/stats/?period=90`.

**Frontend** — `EggStatsSection` :
- `FilterPill` 7 / 30 / 90 / 365 j (persisté via `useSessionState`).
- Ligne couverture : « 24/30 jours relevés ».
- Composant `EggChart` (SVG sans dépendance, style `Sparkline`) : points relevés
  reliés, trous = segment interrompu, vrai 0 = point sur l'axe, bande couverture
  dessous.

## Lot 6.2 — Coût au œuf (transparence)

Décision produit : **coût au œuf = alimentation + soins**, hors équipement
durable amorti.

Traduction concrète sur l'existant (aucun champ « catégorie » à ajouter) :
- **Alimentation** = achats du `StockItem` nourriture lié (`kind='stock_purchase'`
  sur l'item), déjà compté.
- **Soins / troupeau** = achats déclarés sur une poule
  (`kind='chickens_purchase'` : vétérinaire, vermifuge, acquisition), déjà comptés.
- **Équipement durable** (mangeoire, poulailler) vit dans son propre module et
  **n'est pas** un `chickens_purchase` → naturellement exclu.

`_cost_totals` renvoie en plus une **répartition** `{feed_total, flock_total}`
pour que la card affiche ce qui est compté (transparence). Le coût au œuf reste
`dépenses ÷ œufs total`. Cas limites conservés : 0 œuf → `per_egg=null` (pas de
division par zéro) ; 0 dépense → `per_egg=null`.

## Lot 6.3 — Alerte de chute de ponte anormale (croisée météo / mue)

**Backend** — `chickens/alerts.py::evaluate_egg_drop_alert(household, today=None)`,
fonction **pure** (aucune écriture), sur le modèle de `weather/alerts.py` :

- **Baseline** : moyenne des œufs/jour-relevé sur les jours `[today-37 .. today-8]`
  (≈ 30 j finissant une semaine avant).
- **Récent** : moyenne sur `[today-6 .. today]`.
- **Garde-fou couverture** : pas d'alerte si baseline < `MIN_BASELINE_DAYS`
  (10 jours relevés) ou récent < `MIN_RECENT_DAYS` (3 jours relevés). Évite de
  crier « effondrement » sur quelques jours non saisis.
- **Déclenchement** : `recent_avg <= baseline_avg × (1 − DROP_THRESHOLD)`
  (`DROP_THRESHOLD = 0.4`, soit −40 %). Sévérité `critical` si chute ≥ 60 %.
- **Cause probable** (ordre de priorité) :
  - `molt` — un `ChickenEvent` type `molt` daté dans les ~45 derniers jours ;
  - `weather` — `weather.alerts.evaluate_weather_alerts` renvoie frost/heatwave ;
  - `unknown` — sinon (« à surveiller »).
- Renvoie `{kind:'egg_drop', severity, drop_pct, baseline_avg, recent_avg, cause,
  entity_url:'/app/chickens'}` ou `None`.

**Câblage alertes** — `alerts.services.build_alerts_summary` gagne
`egg_drop_alerts` (liste 0/1), gaté par `'chickens' in disabled_modules`
(comme `_weather_alerts` pour la météo). Même pattern : import direct de la
fonction pure de l'app propriétaire, rendu client-side depuis les champs
structurés.

**Frontend** — type `EggDropAlert` + section dédiée dans `AlertsPage`, message
selon la cause (`alerts.eggDrop.molt` / `.weather` / `.unknown`).

**V1 : canal on-read uniquement** (dashboard/page alertes). Pas de ping Telegram
dédié — le garde-fou couverture et la fenêtre glissante suffisent ; un ping
pourra s'ajouter plus tard via `PingSpec` (comme `weather_alert`).

## Lot 6.4 — Tool agent `get_chicken_stats`

Comme la météo (`get_weather`), les stats sont des **agrégats**, pas des lignes
listables → tool de lecture dédié plutôt qu'un `SearchableSpec`.

`chickens/agent.py::get_chicken_stats` (enregistré depuis `chickens/apps.py`,
zéro modification de `apps/agent/`) : renvoie effectif, ponte du jour / 7 j / 30 j,
taux de relevé, coût au œuf, et l'état de l'alerte de chute (avec cause). Permet
« combien d'œufs cette semaine ? », « la ponte a-t-elle baissé ? », « combien me
coûte un œuf ? ».

## Carte d'intégration

| Brique existante | Connexion |
|---|---|
| `EggLog` | Source des stats + baseline de l'alerte (jours relevés only) |
| `ChickenEvent` (molt) | Qualifie la cause « mue » de l'alerte |
| `weather.alerts` | Qualifie la cause « météo » (lecture seule, gaté module) |
| `interactions` | Coût au œuf (feed stock_purchase + chickens_purchase) |
| `alerts` | Nouvelle catégorie `egg_drop` dans le résumé |
| `agent` | Tool `get_chicken_stats` déclaré depuis `chickens/apps.py` |

## Découpage en lots / issues

- **Lot 6.1 — Courbe de ponte** : `egg_stats` période + couverture, `EggChart` (feat, app:chickens, i18n)
- **Lot 6.2 — Coût au œuf** : répartition + transparence (feat, app:chickens, i18n)
- **Lot 6.3 — Alerte de chute** : `chickens/alerts.py` + câblage `alerts` + météo/mue (feat, app:chickens, app:alerts, app:weather, i18n)
- **Lot 6.4 — Tool agent** : `get_chicken_stats` (feat, app:chickens, app:agent)

Issues GitHub : « Parcours 14 — Lot 6.N : … ».

## Limites acceptées (V1 de ce lot)

- Coût au œuf sur **tout l'historique** (pas ramené à la période) — chiffre
  « depuis toujours », stable ; la répartition feed/flock donne le détail.
- Alerte de chute **on-read** seulement (pas de push).
- Estimation visuelle des jours manquants : **hors périmètre** (décision : ne
  jamais imputer dans les chiffres ; l'estimation resterait un toggle purement
  cosmétique).
- Seuils de l'alerte figés en constantes (pas d'UI de réglage).
