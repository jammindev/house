# Module — releases (Changelog / « Nouveautés »)

> Créé : 2026-07-11. Rôle : donner **à un coup d'œil** la liste de ce qui a été livré en prod, avec un résumé lisible par changement — sans aller fouiller les commits/PR sur GitHub. Alimenté **automatiquement** depuis le `git log`.

## État synthétique

- **Backend** : Présent (`apps/releases/` — 2 modèles, 1 command, API lecture seule)
- **Frontend** : Complet dans `ui/src/features/changelog/` (page unique, filtres par module)
- **Locales (en/fr/de/es)** : ok (namespace `changelog.*`)
- **Tests** : `apps/releases/tests/` (parsing services + API)
- **Migrations** : 1
- **Déploiement** : ok — step « Generate changelog » du job `deploy` (`.github/workflows/ci.yml`), mode `--from-stdin`, `continue-on-error`

## Particularité — modèle global, non household-scoped

Contrairement à la quasi-totalité des modèles du projet, `ChangelogEntry` n'hérite
**pas** de `HouseholdScopedModel` : le changelog est le même pour tous les foyers
(c'est de l'infra applicative, pas de la donnée foyer). L'API est en lecture seule
et **réservée au staff/superuser Django** — permission `IsAdminUser` (pas
`IsHouseholdMember` ni le rôle owner de foyer : c'est de l'info de développement
plateforme, visible du seul admin). Le front reflète ça : entrée sidebar dans la
section Admin (gate `user.is_staff`) + garde-fou page (message si non-staff).

## Modèles & API

- `ChangelogEntry` : `commit_sha` (unique), `pr_number`, `module` (= scope du
  commit), `change_type` (`feat`/`fix`/`perf`), `summary` (phrase FR repolie),
  `raw_subject` (sujet de commit d'origine), `committed_at`.
- `ChangelogState` (singleton, pk=1) : `head_sha` + `head_committed_at` du tip de
  `main` à la dernière génération → carte « Production à jour ».
- Endpoints :
  - `GET /api/releases/changelog/` — liste anti-chrono, filtres `?module=`,
    `?change_type=`, pagination limit/offset.
  - `GET /api/releases/changelog/state/` — état live (ou `null` si jamais généré).

## Pipeline de génération (`services.py` + command)

1. `read_git_log` → `git log` au format interne (records `\x1e`, champs `\x1f`).
2. `parse_git_log` → parse `type(scope)!: description (#PR)`, ne garde que
   `feat`/`fix`/`perf`, extrait le **dernier** `(#N)` comme PR de merge, met
   `module=general` si pas de scope.
3. `polish_descriptions` → **un seul appel Claude** pour tout le lot (ton
   cohérent, moins cher), via le **SDK Anthropic directement** — pas la couche
   `agent.llm` (couplée au scope foyer + `AIUsageLog`). Fallback gracieux sur la
   description brute si pas de `ANTHROPIC_API_KEY`, SDK absent, ou réponse
   malformée. **Jamais bloquant.**
4. `generate_changelog` → filtre les commits déjà stockés (idempotent), crée les
   entrées, met à jour `ChangelogState`.

```bash
python manage.py generate_changelog            # incrémental
python manage.py generate_changelog --all      # backfill complet
python manage.py generate_changelog --no-llm   # descriptions brutes
python manage.py generate_changelog --dry-run  # aperçu, n'écrit rien
python manage.py generate_changelog --rebuild  # purge + reconstruit
```

## Frontend

- `ui/src/lib/api/changelog.ts` : client + `prUrl()` (lien GitHub PR).
- `ui/src/features/changelog/hooks.ts` : `useChangelog()` + `useChangelogState()`.
- `ui/src/features/changelog/ChangelogPage.tsx` : pattern feature-page standard —
  carte « Production à jour », `FilterPill` par module (triés par fréquence),
  liste de cards (badge type + chip module + résumé + date + lien PR).
- Nav : entrée « Nouveautés » (icône `Rocket`) dans la **section Admin** de la
  sidebar (visible si `user.is_staff`) ; route `/app/admin/changelog`.

## Contrat de commit

Le module dépend de commits conventionnels bien formés. Voir la section
« Format des commits — contrat pour le changelog » de `CLAUDE.md`. En résumé :
`type(scope): description` — `scope` obligatoire (= module/chip), `type` dans
`feat|fix|perf` pour apparaître, description repolie par l'IA.

## Génération au déploiement (fait — PR #245)

Après chaque push sur `main`, le job `deploy` pipe l'historique du runner vers le
conteneur (`git log --pretty=… | docker compose exec -T web python manage.py
generate_changelog --from-stdin`) — le conteneur n'a pas le `.git` (exclu par
`.dockerignore`). Step en `continue-on-error` : un échec de génération ne bloque
jamais le deploy.

## À faire

- **Blocage dur du format de commit** (optionnel) : hook `commit-msg` /
  commitlint pour refuser un commit mal formé, en complément de la doc + du skill
  `/ship`.
