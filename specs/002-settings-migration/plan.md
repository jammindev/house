# Implementation Plan: Settings Migration — Legacy Next.js → Django app_settings

**Branch**: `002-settings-migration` | **Date**: 2026-02-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-settings-migration/spec.md`

## Summary

Remplacer le composant placeholder `SettingsNode` dans `apps/app_settings/react/` par un composant `UserSettings` complet, fidèle à la structure de `legacy/nextjs/src/features/user-settings/UserSettings.tsx`. Les sections couvertes : gestion du profil (display name, locale, avatar, thème), gestion des households (via les endpoints DRF existants), et changement de mot de passe. Les appels Supabase sont remplacés par les APIs DRF de session. Un champ `theme` est ajouté au modèle `User`. Deux nouveaux endpoints sont créés : `change-password` et gestion de l'avatar.

## Technical Context

**Language/Version**: Python 3.11, TypeScript 5.x  
**Primary Dependencies**: Django 5 + DRF, React 19, i18next + react-i18next, Tailwind CSS, Lucide icons, django-vite  
**Storage**: PostgreSQL (profil utilisateur + households), media file system Django (`MEDIA_ROOT`) pour les avatars  
**Testing**: pytest + DRF APIClient  
**Target Platform**: Web (Django hybrid — SSR shell + mini-SPA React ciblé)  
**Project Type**: mini-SPA migration dans une app Django existante  
**Performance Goals**: Zéro loading flicker sur données initiales (SSR props via JSON script), interactions API < 300ms p95  
**Constraints**: Session auth Django (pas de JWT), household scope via `HouseholdMember`, fichiers media Django (pas Supabase Storage)  
**Scale/Scope**: 1 page, 1 mini-SPA React, ~5 nouveaux endpoints ou actions, 1 migration modèle

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Django reste l'autorité sur les routes, l'auth session et les permissions pour cette feature.
- [x] La limite serveur/client est explicite : le view Django rend le shell HTML + les `initial_user` props via JSON script; React gère toutes les interactions post-hydratation.
- [x] Tous les nouveaux/modifiés endpoints API ont un contrat dans `contracts/`.
- [x] Le scope household n'est pas pertinent pour les données User (scopées par l'utilisateur lui-même). Les opérations Household respectent `IsHouseholdMember` via les endpoints existants.
- [x] Chaque user story est testable indépendamment avec des critères mesurables.
- [x] La page hybride inclut : mount point (`#settings-root`), contrat de données initiales (SSR `initial_user`), et impact bundle documenté.

## Project Structure

### Documentation (this feature)

```text
specs/002-settings-migration/
├── plan.md              ← ce fichier
├── spec.md              ← spécification fonctionnelle
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── user-profile.md
│   ├── user-avatar.md
│   ├── user-change-password.md
│   └── households.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Backend Django
apps/
├── accounts/
│   ├── models.py               ← ajouter champ theme
│   ├── migrations/             ← nouvelle migration theme
│   ├── serializers.py          ← ajouter theme dans UserSerializer
│   └── views/
│       └── api.py              ← ajouter actions: me (PATCH), change_password, set_avatar, delete_avatar
└── app_settings/
    ├── views_web.py            ← passer initial_user data au template
    └── templates/app_settings/app/
        └── settings.html       ← passer initial_user via json_script, adapter mount

# Frontend React
apps/app_settings/react/
├── UserSettings.tsx            ← composant principal (remplace SettingsNode)
├── components/
│   └── HouseholdManagement.tsx ← sous-composant gestion households
└── mount-settings.tsx          ← mettre à jour pour monter UserSettings

# i18n
ui/src/locales/{en,fr,de,es}/translation.json  ← enrichir namespace settings.*

# Django i18n
locale/{en,fr,de,es}/LC_MESSAGES/django.po    ← nouvelles chaînes (template shell)
```

**Structure Decision**: Structure hybride Django + mini-SPA React. On suit le pattern `apps/<app>/react/` existant, en ajoutant un sous-dossier `components/` pour `HouseholdManagement`.

## Complexity Tracking

> Aucune violation de la Constitution. Aucune justification requise.
