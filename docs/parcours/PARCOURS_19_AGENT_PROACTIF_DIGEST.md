# Parcours 19 — L'agent me fait un résumé du matin (digest proactif)

> Cadrage + V1 : 2026-07-16. Prolonge le parcours 16 (pings proactifs Telegram).
> Là où un ping pose **une** question templatée (« 🥚 combien d'œufs ? »), le
> digest **agrège** en un seul message quotidien les signaux que chaque module
> sait déjà produire : tâches du jour, alertes météo, stock bas, anomalie de
> facture élec, chute de ponte. C'est le chaînon qui fait passer l'app d'un
> outil qu'on ouvre à un assistant qui **parle en premier**.
>
> Module : [digest.md](../MODULES/digest.md) (sous-package `apps/agent/digest/`).
> Réutilise intégralement le socle pings : [pings.md](../MODULES/pings.md).

## Décisions d'architecture (actées)

1. **Le digest EST un ping.** `ping_type='daily_digest'` enregistré dans le
   registry `PingSpec` depuis `agent/apps.py::ready()`. On hérite gratuitement de
   l'opt-in `(household, user)` + heure locale, du tick idempotent
   (`PingLog`), du fuseau, de la langue (`translation.override`), du gating
   module et de la livraison Telegram. Ce parcours ne code que la **composition**
   du message. Zéro nouvelle table, zéro nouveau scheduler.
2. **Un collecteur par source, aveugle aux autres.** `agent/digest/collectors.py`
   expose un `SectionSpec(key, module, collect)` par rubrique. Chaque `collect`
   est une **lecture pure** qui renvoie une `DigestSection` ou `None` (rien à
   dire). Brancher une rubrique = un collecteur + une entrée dans `SECTION_SPECS`.
   Un collecteur qui lève est loggé et ignoré — il ne coule jamais le reste.
3. **Les collecteurs réutilisent les services existants**, jamais l'ORM
   dupliqué : `weather.alerts.evaluate_weather_alerts`,
   `electricity.services.consumption_summary`, `chickens.services.egg_stats`,
   requêtes `Task`/`StockItem` scellées au foyer.
4. **Anomalie élec robuste** : 30 jours glissants vs les 30 précédents (pas
   « mois en cours » partiel comparé à un mois plein). Silencieux tant qu'il n'y
   a pas une fenêtre antérieure pleine (`prev_wh <= 0` → rien). Seuil
   `DIGEST_ELEC_ANOMALY_THRESHOLD` (défaut +30 %).
5. **Sélection de rubriques par user, en négatif.** `User.digest_disabled_sections`
   (JSONField, liste des rubriques **coupées**) — même sémantique que
   `Household.disabled_modules` : liste vide = tout actif, une rubrique livrée
   plus tard est active par défaut. Une rubrique est rendue si son module est
   activé pour le foyer **et** non coupée par le user.
6. **Repolissage IA optionnel et hors chemin critique.** `digest/polish.py`
   (miroir de `releases.polish_descriptions`) réécrit le digest en un paragraphe
   chaleureux quand `DIGEST_AI_POLISH_ENABLED` est vrai ET qu'une clé API existe.
   Toute erreur (pas de clé, SDK absent, réseau, réponse vide) → `None` → le
   gabarit déterministe part quand même. Off par défaut.
7. **In-app first.** `GET /api/agent/digest/` compose le digest du jour à la
   volée (jamais persisté) : sert l'aperçu de la page dédiée et fonctionne
   **sans** canal Telegram lié.

## Backlog

### Lot 1 — Socle : opt-in & préférences

| # | Story | État |
|---|---|---|
| 1.1 | Activer le digest + choisir l'heure d'envoi (réutilise l'opt-in ping `daily_digest`) | ✅ V1 |
| 1.2 | Choisir les rubriques du digest (`digest_disabled_sections`, rubriques d'un module désactivé masquées) | ✅ V1 |

### Lot 2 — Moteur & livraison

| # | Story | État |
|---|---|---|
| 2.1 | Composer + envoyer le digest à l'heure locale, idempotent, fault-isolé, pas d'envoi si tout est vide (hérité du tick pings) | ✅ V1 |
| 2.2 | Consulter le digest du jour dans l'app (`GET /api/agent/digest/`, aperçu à la volée, fonctionne sans canal) | ✅ V1 |

### Lot 3 — Collecteurs de signaux

| # | Rubrique | Source | État |
|---|---|---|---|
| 3.1 | Tâches du jour + en retard | `Task` (dues ≤ aujourd'hui, non terminées, privées filtrées) | ✅ V1 |
| 3.2 | Alertes météo | `weather.alerts.evaluate_weather_alerts` | ✅ V1 |
| 3.3 | Stock bas / rupture | `StockItem` (`low_stock`/`out_of_stock`) | ✅ V1 |
| 3.4 | Anomalie facture élec | `electricity.services.consumption_summary` (30j vs 30j) | ✅ V1 |
| 3.5 | Chute de ponte | `chickens.services.egg_stats` (moy 7j < 80 % moy 30j) | ✅ V1 |

### Lot 4 — Rédaction naturelle (IA)

| # | Story | État |
|---|---|---|
| 4.1 | Digest repoli par l'IA, fallback gabarit, hors chemin critique | ✅ V1 (câblé, off par défaut) |

### Lot 5 — Poussée sur événement critique

| # | Story | État |
|---|---|---|
| 5.1 | Push immédiat hors digest quotidien pour un événement sévère (ex. alerte gel émise en journée) | ⏳ V2 (extension du même moteur) |

## Limites V1 assumées

- **Un seul canal** : Telegram (le seul canal sortant existant). Le choix de
  canal du cadrage est implicite tant qu'il n'y en a qu'un.
- **Anomalie élec** : énergie (`total_wh`) et non coût — robuste même sans
  tarif renseigné. Pas de corrélation température (la météo est dispo, ce serait
  un raffinement V2).
- **Pas de persistance du digest** : l'aperçu est recomposé à chaque appel.
  Acceptable (lectures bon marché) et toujours à jour ; pas d'historique.
- **Pas de push temps réel** (lot 5) : tout passe par le rendez-vous quotidien.

## Fichiers clés

- Backend : `apps/agent/digest/{collectors,service,polish,ping,api}.py`,
  enregistrement dans `apps/agent/apps.py`, route `apps/agent/urls.py`,
  champ `User.digest_disabled_sections` (`apps/accounts/`), réglages
  `DIGEST_*` (`config/settings/base.py`).
- Frontend : `ui/src/lib/api/digest.ts`, `ui/src/features/digest/`
  (`DigestPage`, `hooks`), route `/app/digest` + entrée sidebar (groupe Compte),
  `daily_digest` retiré de `ProactiveSection` (configuré sur sa page dédiée).
- i18n : namespace `digest` (4 langues) + `settings.pings.types.daily_digest`.
- Tests : `apps/agent/tests/test_digest_*.py`, validation
  `digest_disabled_sections` dans les tests accounts.
