# Module — digest (résumé quotidien proactif)

> Rôle : **le récap du matin**. Une fois par jour (opt-in, par user), le foyer
> reçoit un message unique agrégeant les signaux que chaque module sait déjà
> produire : tâches dues, alertes météo, stock bas, anomalie élec, chute de
> ponte. Prolonge les pings (une question) vers un **digest** (une synthèse).
> L'app parle en premier.
>
> Sous-package de l'agent : `apps/agent/digest/`. Parcours :
> `docs/parcours/PARCOURS_19_AGENT_PROACTIF_DIGEST.md`. Socle réutilisé :
> [pings.md](./pings.md) (scheduler, opt-in, livraison), [agent.md](./agent.md).

## État synthétique

- **Backend** : `apps/agent/digest/`
  - `collectors.py` — `DigestSection`, `SectionSpec`, `SECTION_SPECS`,
    `SECTION_KEYS` + un collecteur par rubrique (`collect_tasks`,
    `collect_weather`, `collect_stock`, `collect_electricity`,
    `collect_chickens`). Chaque `collect(household, user, *, today)` est une
    lecture pure → `DigestSection | None`. Imports des apps sources **paresseux**.
  - `service.py` — `build_digest(household, user, *, today, disabled_sections)`
    (assemble les rubriques actives, isole un collecteur qui lève),
    `active_section_specs(household)` (gating module), `render_telegram(result)`
    (HTML, titres `<b>`, contenu échappé).
  - `polish.py` — `polish_digest(result)` : repolissage LLM optionnel, fallback
    `None` (miroir `releases.polish_descriptions`). Off par défaut.
  - `ping.py` — `build_daily_digest_message(household, user, *, today)` :
    l'entrée `PingSpec`. Lit `user.digest_disabled_sections`, compose, renvoie
    `None` si vide, sinon la version repolie (si activée, échappée) ou le gabarit.
  - `api.py` — `DigestView` : `GET /api/agent/digest/` (aperçu à la volée,
    rendu dans la langue du user, jamais persisté).
- **Enregistrement** : `apps/agent/apps.py::ready()` enregistre le
  `PingSpec(ping_type='daily_digest', default_send_at=07:30, module=None)`.
- **Préférence de rubriques** : `User.digest_disabled_sections` (JSONField,
  liste des rubriques coupées) — validée dans `accounts.serializers`, éditable
  via `PATCH /api/accounts/users/me/`.
- **Frontend** : `ui/src/features/digest/` (`DigestPage` = envoi + rubriques +
  aperçu du jour ; `hooks.ts`), client `ui/src/lib/api/digest.ts`, route
  `/app/digest` (sidebar, groupe Compte). `daily_digest` est masqué de
  `settings/components/ProactiveSection` (configuré sur sa page dédiée).
- **Locales (en/fr/de/es)** : namespace `digest` +
  `settings.pings.types.daily_digest`.
- **Réglages** (`config/settings/base.py`) : `DIGEST_ELEC_ANOMALY_THRESHOLD`
  (défaut `0.30`), `DIGEST_AI_POLISH_ENABLED` (défaut `False`).
- **Tests** : `apps/agent/tests/test_digest_*.py` (collecteurs, assemblage,
  gating, rendu/échappement, ping, endpoint) + validation prefs dans les tests
  accounts.

## Ajouter une rubrique (~10 lignes)

1. Écrire un collecteur dans `collectors.py` :
   `def collect_foo(household, user, *, today) -> DigestSection | None:` — lecture
   pure via le **service** de l'app source (pas d'ORM dupliqué), `gettext` pour
   les libellés (appelé dans la langue du destinataire), `None` si rien à dire.
2. Ajouter `SectionSpec('foo', module='foo_or_None', collect_foo)` à
   `SECTION_SPECS`. Le `module` gate la rubrique sur `Household.disabled_modules`.
3. Ajouter la clé i18n `digest.sections.foo` (4 langues) pour le libellé du
   toggle.

Aucune autre modification : le gating user/foyer, l'assemblage, l'aperçu et
l'envoi sont génériques.

## Pourquoi ce design

- **Zéro nouvelle infra** : le digest est un `PingSpec`, donc opt-in, heure
  locale, idempotence (`PingLog`), fuseau, langue, gating et livraison Telegram
  sont hérités du parcours 16. Le seul état propre est la préférence de
  rubriques sur `User`.
- **Composition découplée** : un collecteur par source, aveugle aux autres,
  fault-isolé. Le digest reste lisible même si un module part en erreur.
- **Déterministe par défaut** : le gabarit part toujours ; l'IA n'est qu'un
  vernis optionnel qui ne peut jamais bloquer ni casser l'envoi.

## Limites V1

- Canal unique (Telegram). Anomalie élec sur l'énergie (pas le coût), 30j
  glissants. Pas de persistance (aperçu recomposé). Pas de push temps réel
  hors rendez-vous quotidien (lot 5, différé).
