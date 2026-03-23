# Audit architectural — `house` (mars 2026)

> Audit réalisé le 2026-03-23. Scope : organisation des fichiers, extensibilité, duplication back/front, préparation mobile.

---

## Verdict global : 8.5 / 10

Les fondations sont solides. La discipline est visible. Ce document identifie ce qui fonctionne bien et ce qui mérite attention.

---

## Ce qui est bien en place

### Backend — multi-tenancy défensive

La hiérarchie `TimestampedModel → HouseholdScopedModel` + le manager `HouseholdScopedQuerySet` + le middleware `ActiveHouseholdMiddleware` + `IsHouseholdMember` crée une isolation à 4 niveaux :

| Niveau | Mécanisme |
|--------|-----------|
| Base de données | FK `household` sur tous les modèles |
| ORM | Manager `.for_household(id)` + `.for_user_households(user)` |
| API | Middleware injecte `request.household` |
| Sérialisation | `HouseholdScopedModelSerializer` (base class) |

### Frontend — feature modules

`ui/src/features/<feature>/` avec `Page`, `Dialog`, `hooks.ts` + `lib/api/<feature>.ts` séparé (sans React) — découpe correcte. Le layer fetch est agnostique à React, ce qui est essentiel pour la future app mobile.

### Type safety bout-en-bout

OpenAPI → `gen:api:refresh` → TypeScript. Source de vérité unique pour les types entre back et front.

### Authentification JWT

`djangorestframework-simplejwt` + intercepteur Axios avec refresh automatique. C'est exactement ce qu'Expo/React Native consomme nativement. Aucun changement côté API requis pour le mobile.

### Documentation projet

`CLAUDE.md` + `docs/FEATURE_PATTERN.md` assurent la cohérence dans le temps, même en solo.

---

## La question du doublon back/front

C'est une réalité, mais elle est partiellement déjà résolue.

| Couche | Où | Nature de la duplication |
|--------|-----|--------------------------|
| **Types** | `serializers.py` ↔ `ui/src/lib/api/<app>.ts` | Interfaces TS qui redéfinissent ce que le serializer décrit déjà |
| **Validation** | DRF validators ↔ validation inline dans les dialogs | Règles souvent répétées (champs requis, longueurs) |
| **Nommage** | `ElectricityBoard` (Python) ↔ `ElectricityBoard` (TypeScript) | Cohérent, mais maintenu à la main |

**Types :** le problème est quasi résolu par `gen:api:refresh` (drf-spectacular → types générés). Il faut s'y tenir systématiquement.

**Validation :** la duplication est **acceptable et intentionnelle**. Le serveur valide pour la sécurité/intégrité. Le client valide pour l'UX. Ce sont deux rôles différents — ne pas chercher à les unifier.

---

## Axes d'amélioration

### 1. `HouseholdScopedModelSerializer` dans `core/`, pas dans `electricity/`

Cette base class devrait vivre dans `apps/core/serializers.py` et être importée par tous les apps. Elle est actuellement définie dans `apps/electricity/serializers.py`.

```python
# apps/core/serializers.py  ← à créer
class HouseholdScopedModelSerializer(serializers.ModelSerializer):
    """Base pour la validation household sur tous les modèles scoped."""
    ...
```

### 2. Répertoire `legacy/` ✅ Fait (2026-03-23)

~~À archiver dans une branche git dédiée puis supprimer du `main`.~~

Archivé dans la branche `archive/legacy`, supprimé du `main`.

### 3. Uniformiser `tests.py` → `tests/`

Certains apps utilisent `tests.py`, d'autres le dossier `tests/test_views.py`. Standardiser vers la structure dossier pour toute la codebase.

```
apps/<app>/tests/
├── __init__.py
├── factories.py
├── test_models.py
├── test_serializers.py
└── test_views.py
```

### 4. Documenter les patterns avancés

Ces patterns existent et sont bons, mais ne sont pas documentés dans `docs/` :

- `useSessionState` — persistance d'état via `window.history.state`
- `useDeleteWithUndo` — suppression optimiste avec undo toast
- Structure des query key factories (`zoneKeys`, `electricityKeys`, etc.)

---

## Préparation pour une app mobile (Expo)

L'architecture actuelle est déjà compatible. Rien à refactorer maintenant.

### Ce qui fonctionne déjà tel quel

- **API REST JWT** — Expo consomme exactement ce format
- **`ui/src/lib/api/*.ts`** — fonctions fetch sans React, déjà agnostiques au renderer
- **Types générés** — portables dans n'importe quel projet TypeScript

### La migration naturelle si tu vas mobile

La structure actuelle peut évoluer vers un monorepo sans réécriture :

```
packages/
  api/           ← extrait de ui/src/lib/api/ + ui/src/gen/api/ (partagé)
  web/           ← app Vite actuelle
  mobile/        ← future app Expo
```

Avec Turborepo ou workspace npm/pnpm. Le layer `api/` devient un package partagé, le reste reste identique.

### Quand faire cette migration

Pas maintenant. Uniquement quand tu démarres réellement le projet mobile. L'extraction de `lib/api/` est une opération de quelques heures, pas une réécriture.

---

## Feuille de route

| Priorité | Action | Effort estimé |
|----------|--------|---------------|
| 🔴 Haute | Déplacer `HouseholdScopedModelSerializer` → `core/serializers.py` | ~30 min |
| ✅ ~~🟠 Moyenne~~ | ~~Archiver `legacy/` dans une branche, supprimer du main~~ | Fait le 2026-03-23 |
| 🟡 Normale | Uniformiser tous les `tests.py` → `tests/` | ~1-2h |
| 🟢 Basse | Documenter `useSessionState`, `useDeleteWithUndo`, query keys | ~30 min |
| 🔵 Plus tard | Monorepo pour app mobile | Quand tu démarres le mobile |

---

## Stack complète (état actuel)

| Couche | Technologie | Version |
|--------|-------------|---------|
| Backend | Django | 5.2.11 |
| API | Django REST Framework | 3.16.1 |
| Auth | djangorestframework-simplejwt | 5.5.1 |
| Schéma API | drf-spectacular | 0.29.0 |
| Base de données | PostgreSQL | — |
| Frontend | React | 19.2.0 |
| Router | React Router | 7.13.0 |
| Data fetching | TanStack Query | 5.90.21 |
| State management | Zustand | 5.0.11 |
| Styling | Tailwind CSS | 4.1.18 |
| UI primitives | Radix UI | — |
| Build | Vite | 7.3.1 |
| Language | TypeScript | 5.9.3 |
| Tests E2E | Playwright | 1.58.2 |
| Tests backend | pytest + factory_boy | — |
