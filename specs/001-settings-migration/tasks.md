# Tasks: Settings Migration — Legacy Next.js → Django app_settings

**Input**: Design documents from `specs/001-settings-migration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Peut être exécuté en parallèle (fichiers distincts, sans dépendance sur une tâche incomplète)
- **[Story]**: User story concernée (US1–US5)
- Chaque description inclut le chemin de fichier exact

---

## Phase 1: Setup (Infrastructure partagée)

**Purpose**: Configurer les prérequis techniques bloquants avant toute implémentation métier.

- [X] T001a [P] Ajouter MEDIA_URL + MEDIA_ROOT dans config/settings/base.py
- [X] T001b [P] Ajouter la route media DEBUG dans config/urls.py
- [X] T002 [P] Ajouter Pillow à requirements.txt (requis pour ImageField)

---

## Phase 2: Foundational (Prérequis bloquants pour toutes les user stories)

**Purpose**: Modèle, migration, serializer, endpoint `me` PATCH, SSR props — tout ce qui doit être en place avant qu'une seule US puisse être implémentée ou testée indépendamment.

**⚠️ CRITIQUE**: Aucune user story ne peut démarrer tant que cette phase n'est pas complète.

- [X] T003 Ajouter `theme` (CharField) et `avatar` (ImageField) au modèle User dans apps/accounts/models.py — inclure la property `avatar_url` calculée (`self.avatar.url` si avatar, sinon fallback sur le CharField existant)
- [X] T004 Générer et appliquer la migration accounts pour les champs theme + avatar (python manage.py makemigrations accounts && migrate)
- [X] T005 [P] Mettre à jour UserSerializer pour inclure `theme` et `avatar` dans apps/accounts/serializers.py
- [X] T006 [P] Étendre l'action `me` sur UserViewSet pour supporter GET + PATCH (display_name, locale, theme) dans apps/accounts/views/api.py
- [X] T007 [P] Mettre à jour app_settings_view pour passer initial_user et initial_households en props SSR dans apps/app_settings/views_web.py
- [X] T008 [P] Mettre à jour settings.html pour rendre les json_script props et adapter le mount point dans apps/app_settings/templates/app_settings/app/settings.html

**Checkpoint**: Foundation prête — les user stories peuvent être implémentées indépendamment.

---

## Phase 3: User Story 1 — Gérer mon profil (Priority: P1) 🎯 MVP

**Goal**: L'utilisateur voit la page settings avec ses données pré-remplis (sans flicker), peut modifier son display name et sa locale.

**Independent Test**: Naviguer vers `/app/settings/` → vérifier que le composant React se monte avec les données SSR → modifier display name → sauvegarder → vérifier la mise à jour → changer la locale → vérifier le changement de langue.

- [X] T009 [US1] Créer UserSettings.tsx skeleton avec la section profil (display name + locale selector) dans apps/app_settings/react/UserSettings.tsx
- [X] T010 [US1] Mettre à jour mount-settings.tsx pour monter UserSettings au lieu de SettingsNode dans apps/app_settings/react/mount-settings.tsx (après T009)
- [X] T011 [P] [US1] Ajouter les clés i18n profil (title, displayName, language, ...) dans ui/src/locales/en/translation.json, fr/translation.json, de/translation.json, es/translation.json
- [X] T012 [P] [US1] Ajouter les tests Django pour GET + PATCH /api/accounts/users/me/ (display_name, locale) dans apps/accounts/tests/test_api.py

---

## Phase 4: User Story 2 — Gérer mes households (Priority: P2)

**Goal**: L'utilisateur voit ses households, peut en créer un, modifier les détails, quitter, supprimer, et gérer les membres (inviter, supprimer, changer le rôle).

**Independent Test**: Depuis la page settings → créer un household → vérifier qu'il apparaît → modifier le nom → vérifier → inviter un membre → vérifier le membre dans la liste.

- [X] T013 [US2] Créer HouseholdManagement.tsx avec la liste des households, empty state, create/delete/leave/edit/invite dans apps/app_settings/react/components/HouseholdManagement.tsx
- [X] T014 [US2] Intégrer HouseholdManagement dans UserSettings.tsx (section en haut de page) dans apps/app_settings/react/UserSettings.tsx
- [X] T015 [P] [US2] Ajouter les clés i18n household (householdCreated, householdDeleted, householdNameRequired, ...) dans ui/src/locales/{en,fr,de,es}/translation.json
- [X] T031 [P] [US2] Ajouter les tests Django pour POST /api/households/, DELETE /{id}/, POST /{id}/leave/, POST /{id}/invite/ dans apps/households/tests/test_api.py (vérifie SC-004)

---

## Phase 5: User Story 3 — Changer mon mot de passe (Priority: P3)

**Goal**: L'utilisateur peut changer son mot de passe avec validation côté client et serveur.

**Independent Test**: Remplir nouveau mot de passe + confirmation → vérifier erreur si non-correspondants → soumettre un mot de passe valide → déconnecter → se reconnecter avec le nouveau mot de passe.

- [X] T016 [US3] Implémenter l'action change_password sur UserViewSet (POST /api/accounts/users/me/change-password/) dans apps/accounts/views/api.py
- [X] T017 [US3] Ajouter la section ChangePassword à UserSettings.tsx dans apps/app_settings/react/UserSettings.tsx
- [X] T018 [P] [US3] Ajouter les clés i18n mot de passe (changePassword, newPassword, confirmPassword, passwordMismatch, ...) dans ui/src/locales/{en,fr,de,es}/translation.json
- [X] T019 [P] [US3] Ajouter les tests Django pour POST /api/accounts/users/me/change-password/ (succès, non-correspondance, trop court) dans apps/accounts/tests/test_api.py

---

## Phase 6: User Story 4 — Gérer mon avatar (Priority: P4)

**Goal**: L'utilisateur peut uploader une photo de profil (image) ou supprimer l'existante.

**Independent Test**: Sélectionner une image valide → vérifier l'aperçu de l'avatar → supprimer → vérifier le retour aux initiales. Tenter un fichier non-image → vérifier le message d'erreur.

- [X] T020 [P] [US4] Implémenter l'action set_avatar (POST /api/accounts/users/me/avatar/) sur UserViewSet dans apps/accounts/views/api.py
- [X] T021 [P] [US4] Implémenter l'action delete_avatar (DELETE /api/accounts/users/me/avatar/) sur UserViewSet dans apps/accounts/views/api.py
- [X] T022 [US4] Ajouter la section Avatar à UserSettings.tsx (aperçu, upload, suppression) dans apps/app_settings/react/UserSettings.tsx
- [X] T023 [P] [US4] Ajouter les clés i18n avatar dans ui/src/locales/{en,fr,de,es}/translation.json
- [X] T024 [P] [US4] Ajouter les tests Django pour POST/DELETE /api/accounts/users/me/avatar/ dans apps/accounts/tests/test_api.py

---

## Phase 7: User Story 5 — Choisir un thème (Priority: P5)

**Goal**: L'utilisateur peut sélectionner un thème (light, dark, system) et voir la persistance après rechargement.

**Independent Test**: Sélectionner "dark" → vérifier que `PATCH /api/accounts/users/me/` est appelé avec `theme: "dark"` → recharger la page → vérifier que le thème "dark" est pré-sélectionné.

- [X] T025 [US5] Ajouter la section Theme (select light/dark/system) à UserSettings.tsx dans apps/app_settings/react/UserSettings.tsx — lire `initial_user.theme` au montage et appliquer la classe CSS correspondante (`light`/`dark`/`system`) sur `<html>` via `document.documentElement.setAttribute('data-theme', theme)`
- [X] T026 [P] [US5] Ajouter les clés i18n thème (theme, themeDescription, themeUpdated) dans ui/src/locales/{en,fr,de,es}/translation.json
- [X] T027 [P] [US5] Ajouter le test Django pour PATCH /api/accounts/users/me/ avec le champ theme dans apps/accounts/tests/test_api.py

---

## Phase Finale: Polish & Transverse

**Purpose**: User details, nettoyage, i18n Django, vérification finale.

- [X] T028 Ajouter la section User Details (id + email en lecture seule) à UserSettings.tsx dans apps/app_settings/react/UserSettings.tsx (FR-012)
- [X] T029 [P] Ajouter les chaînes manquantes dans locale/{en,fr,de,es}/LC_MESSAGES/django.po et compiler (python manage.py compilemessages)
- [X] T030 [P] Supprimer apps/app_settings/react/SettingsNode.tsx (remplacé par UserSettings — vérifier zéro import restant avant suppression)
- [X] T032 Regénérer le client TypeScript API après les nouveaux contrats (npm run gen:api) — Constitution III MUST (3 nouveaux endpoints : me PATCH, avatar, change-password)

---

## Dependencies

```
T001a, T001b, T002 (setup — tous parallèles entre eux)
    ↓
T003 (modèle User — theme + avatar + avatar_url property)
    ↓
T004 (migration)
    ↓
T005, T006, T007, T008 (fondation — tous parallèles entre eux)
    ↓
T009 (UserSettings skeleton) ← dépend de T006 + T007 + T008
├── T010 (mount update — après T009)
├── T011 (i18n profil — parallèle à T009)
└── T012 (tests me GET+PATCH — parallèle à T009)
    ↓
T013 (HouseholdManagement.tsx)
├── T014 (intégration dans UserSettings — après T013)
├── T015 (i18n household — parallèle à T013)
└── T031 (tests household endpoints — parallèle à T013)
    ↓
T016 (endpoint change_password)
├── T017 (section ChangePassword React — après T016)
├── T018 (i18n password — parallèle à T016)
└── T019 (tests change_password — parallèle à T016)
    ↓
T020, T021 (avatar endpoints — parallèles entre eux)
    ↓
T022 (section Avatar React — après T020 + T021)
├── T023 (i18n avatar — parallèle à T022)
└── T024 (tests avatar — parallèle à T022)
    ↓
T025 (section Theme React + application classe HTML — après T005)
├── T026 (i18n theme — parallèle à T025)
└── T027 (test theme — parallèle à T025)
    ↓
T028, T029, T030 (polish — parallèles entre eux)
    ↓
T032 (npm run gen:api — après tous les endpoints)
```

---

## Exemples d'exécution parallèle par story

### US1 (après Foundation complète)
```
Concurrent: T009 + T011 + T012
Sequential: T009 → T010
```

### US2 (après US1)
```
Concurrent: T013 + T015
Sequential: T013 → T014
```

### US3 (après US2)
```
Concurrent: T016 + T018 + T019
Sequential: T016 → T017
```

### US4 (après US3)
```
Concurrent: T020 + T021 + T023 + T024
Sequential: T020 + T021 → T022
```

### US5 (après Foundation — peut démarrer en parallèle de US4)
```
Concurrent: T025 + T026 + T027
```

---

## Stratégie d'implémentation

**MVP recommandé (Phase 1 + 2 + Phase 3)** : T001–T012

Les phases 1–3 livrent une page settings entièrement fonctionnelle avec :
- Montage React sans flicker (données SSR)
- Modification du display name
- Changement de locale

Les phases 4–7 enrichissent progressivement la page :
- Phase 4 : gestion des households (la fonctionnalité la plus utilisée)
- Phase 5 : changement de mot de passe
- Phase 6 : avatar
- Phase 7 : thème
