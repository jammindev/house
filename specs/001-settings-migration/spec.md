# Feature Specification: Settings Migration — Legacy Next.js → Django app_settings

**Feature Branch**: `001-settings-migration`  
**Created**: 2026-02-27  
**Status**: Draft  
**Input**: Migrer la page settings de legacy Next.js vers l'app Django app_settings avec le même composant UserSettings (profil, household, mot de passe)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Gérer mon profil (Priority: P1)

Un utilisateur connecté accède à `/app/settings/` et peut modifier son display name et sa langue préférée (locale).

**Why this priority**: Les données d'identité de base (nom affiché, langue) sont utilisées partout dans l'app. La locale est déjà stockée sur `User.locale` — très faible risque d'implémentation.

**Independent Test**: Naviguer vers `/app/settings/` → modifier le display name → sauvegarder → vérifier que le nom change. Changer la locale → vérifier que la langue de la page bascule.

**Acceptance Scenarios**:

1. **Given** un utilisateur connecté, **When** il accède à `/app/settings/`, **Then** le composant `UserSettings` se monte avec son display name et sa locale pré-remplis (données SSR, sans loading flicker).
2. **Given** le formulaire display name, **When** l'utilisateur soumet un nouveau nom, **Then** `PATCH /api/accounts/users/me/` est appelé et la UI se met à jour.
3. **Given** le sélecteur de langue, **When** l'utilisateur choisit `fr`, **Then** `PATCH /api/accounts/users/me/` enregistre `locale: "fr"` et la page recharge avec la langue appropriée.

---

### User Story 2 — Gérer mes households (Priority: P2)

Un utilisateur peut voir ses memberships de household, créer un nouveau household, modifier les détails d'un household dont il est owner, quitter un household où il est membre, supprimer un household dont il est owner, et gérer les membres (inviter, supprimer, changer le rôle).

**Why this priority**: Le household est l'entité multi-tenant centrale. La gestion de la liste des households est une des raisons principales d'aller dans les settings.

**Independent Test**: Depuis la page settings → créer un household → vérifier qu'il apparaît dans la liste → modifier son nom → vérifier la mise à jour.

**Acceptance Scenarios**:

1. **Given** un utilisateur connecté, **When** il ouvre la section Household Management, **Then** il voit tous ses households avec son rôle (owner / member) et le nombre de membres.
2. **Given** un utilisateur owner d'un household, **When** il clique "Supprimer" et confirme, **Then** `DELETE /api/households/{id}/` est appelé et le household disparaît de la liste.
3. **Given** un utilisateur membre (non owner), **When** il clique "Quitter", **Then** `POST /api/households/{id}/leave/` est appelé et le household est retiré de sa liste.
4. **Given** un utilisateur, **When** il crée un household avec un nom, **Then** `POST /api/households/` le crée, l'utilisateur devient owner, et il apparaît dans la liste.
5. **Given** un owner, **When** il invite un utilisateur par email, **Then** `POST /api/households/{id}/invite/` est appelé et le membre apparaît dans la liste.

---

### User Story 3 — Changer mon mot de passe (Priority: P3)

Un utilisateur connecté peut changer son mot de passe depuis la page settings.

**Why this priority**: Fonctionnalité de sécurité standard; Django gère nativement le hashage de mot de passe.

**Independent Test**: Remplir nouveau mot de passe + confirmation → soumettre → se déconnecter → se reconnecter avec le nouveau mot de passe.

**Acceptance Scenarios**:

1. **Given** un utilisateur sur la page settings, **When** les mots de passe ne correspondent pas, **Then** une erreur client-side s'affiche sans appel API.
2. **Given** des mots de passe correspondants, **When** soumis, **Then** `POST /api/accounts/users/me/change-password/` met à jour le mot de passe et affiche un message de succès.

---

### User Story 4 — Gérer mon avatar (Priority: P4)

Un utilisateur peut uploader une photo de profil ou supprimer la photo existante.

**Why this priority**: Identité visuelle; légèrement complexe (upload de fichier, stockage media Django).

**Independent Test**: Sélectionner une image → vérifier l'aperçu → supprimer → vérifier le retour aux initiales.

**Acceptance Scenarios**:

1. **Given** un utilisateur, **When** il sélectionne une image et soumet, **Then** `POST /api/accounts/users/me/avatar/` stocke le fichier et met à jour `avatar_url`.
2. **Given** un utilisateur avec un avatar, **When** il clique "Supprimer l'avatar", **Then** `DELETE /api/accounts/users/me/avatar/` supprime le fichier et vide `avatar_url`.
3. **Given** un utilisateur qui sélectionne un fichier non-image, **When** il tente l'upload, **Then** un message d'erreur s'affiche et aucun appel API n'est fait.

---

### User Story 5 — Choisir un thème (Priority: P5)

Un utilisateur peut sélectionner un thème d'interface (light, dark, system).

**Why this priority**: Confort UX; nécessite un changement de modèle mineur (`theme` field sur `User`).

**Independent Test**: Sélectionner "dark" → vérifier que la classe de thème est appliquée → recharger la page → vérifier la persistance.

**Acceptance Scenarios**:

1. **Given** un utilisateur, **When** il change le thème, **Then** `PATCH /api/accounts/users/me/` enregistre `theme` et la page applique la classe correspondante.

---

### Edge Cases

- Que se passe-t-il si l'utilisateur n'a aucun household ? → Afficher un état vide avec un CTA "Créer mon premier household".
- Que se passe-t-il si le dernier owner tente de quitter un household ? → Bloquer l'action avec un message explicatif.
- Que se passe-t-il en cas d'upload d'un fichier trop volumineux ? → Compresser l'image côté client avant l'envoi (max 0.75 MB, max 512 px) via `browser-image-compression` ou équivalent; rejeter uniquement les fichiers non-image avant compression.
- Que se passe-t-il si l'email d'invitation n'est pas trouvé ? → Retourner un message d'erreur clair (sans révéler l'existence ou non de l'utilisateur).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La page settings DOIT être servie par Django sur `/app/settings/` avec session auth Django.
- **FR-002**: La page DOIT monter un mini-SPA React `UserSettings` en remplacement du placeholder `SettingsNode`.
- **FR-003**: Le composant React DOIT recevoir les données initiales de l'utilisateur (id, email, display_name, locale, theme, avatar_url) via un JSON script SSR prop pour éviter le loading flicker.
- **FR-004**: Les mises à jour de profil (display_name, locale, theme) DOIVENT utiliser `PATCH /api/accounts/users/me/`.
- **FR-005**: Le changement de mot de passe DOIT utiliser `POST /api/accounts/users/me/change-password/` avec validation `new_password` + `confirm_password` côté serveur.
- **FR-006**: L'upload d'avatar DOIT utiliser `POST /api/accounts/users/me/avatar/` (multipart/form-data); la suppression DOIT utiliser `DELETE /api/accounts/users/me/avatar/`.
- **FR-007**: La gestion des households DOIT utiliser les endpoints existants sous `/api/households/`.
- **FR-008**: Le champ `theme` (choices: light/dark/system, default: system) DOIT être ajouté au modèle `accounts.User` avec une migration Django.
- **FR-009**: Toutes les chaînes i18n React DOIVENT utiliser `useTranslation` sous le namespace `settings.*` et être présentes dans les 4 fichiers locale (en, fr, de, es). Le sélecteur de langue DOIT exposer les 4 langues : en, fr, de, es.
- **FR-010**: Toutes les chaînes Django template DOIVENT utiliser `{% trans %}` et être ajoutées dans les 4 fichiers `.po`.
- **FR-011**: La limite SSR/React DOIT être explicite : le view Django rend le shell + les props initiales; React gère toutes les interactions.
- **FR-012**: La page DOIT afficher l'id et l'email de l'utilisateur en lecture seule dans une section "Détails du compte".
- **FR-013**: La parité visuelle avec le legacy DOIT être structurelle : le composant `UserSettings` Django reproduit le **même ordre de sections** (HouseholdManagement → Langue → Display Name → Avatar → Thème → Détails du compte → Mot de passe → MFA) et la **même hiérarchie visuelle** (Card > CardHeader > CardTitle/CardDescription > CardContent) en utilisant les composants `Card`, `Button`, `Alert`, `Input` de `ui/src/design-system/` — sans copier les classes Tailwind du legacy.
- **FR-014**: La section MFA est **hors scope** de cette migration. Le composant DOIT afficher une Card placeholder en dernière position (titre "Double authentification", description "Bientôt disponible") pour conserver la parité de layout — sans logique TOTP ni backend auth secondaire.
- **FR-015**: Avant l'upload d'avatar, le composant DOIT compresser l'image côté client (max 0.75 MB, max 512 px, qualité initiale 0.8) via `browser-image-compression` ou `compressFileForUpload` (parité comportementale avec le legacy). Seuls les fichiers non-image (`image/png`, `image/jpeg`, `image/webp`) DOIVENT être rejetés avant compression, sans appel API.
- **FR-016**: La gestion des households DOIT être extraite dans un composant React dédié `HouseholdManagement.tsx` (sous `apps/app_settings/react/components/`), monté en premier dans `UserSettings` — parité architecturale avec le legacy.
- **FR-017**: Le dossier `apps/app_settings/react/` DOIT reproduire l’architecture standard du legacy, soit :
  ```
  apps/app_settings/react/
  ├── UserSettings.tsx          # composant racine
  ├── mount-settings.tsx        # point d’entrée de montage React
  ├── types.ts                  # types TypeScript locaux (User, Household, HouseholdMember…)
  ├── components/
  │   └── HouseholdManagement.tsx  # (+ sous-composants si besoin)
  └── hooks/
      ├── useUserProfile.ts        # PATCH profil, avatar, thème, locale
      └── useHouseholds.ts         # CRUD households + membres
  ```
  Les CSS Modules (`.module.css`) sont optionnels : à créer uniquement si un composant nécessite des styles non couverts par Tailwind/design-system.

### Key Entities

- **User** (`accounts.User`): display_name, locale, avatar_url, theme (nouveau champ), email, id — modifiables depuis settings.
- **Household** (`households.Household`): name, address, city, country, context_notes, ai_prompt_context — modifiables par l'owner.
- **HouseholdMember** (`households.HouseholdMember`): role (owner/member), user, household — géré depuis settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur connecté peut mettre à jour son display name et voir le changement reflété immédiatement (< 1s) après la sauvegarde.
- **SC-002**: Un utilisateur peut changer sa locale dans settings et la langue de la page change (avec rechargement minimal).
- **SC-003**: Un utilisateur sans household voit un état vide et peut en créer un en ≤ 3 clics.
- **SC-004**: Toutes les interactions API (profil, household, mot de passe) ont des tests DRF couvrant les cas de succès et d'erreur.
- **SC-005**: Toutes les nouvelles clés i18n sont présentes dans les 4 fichiers locale (zéro avertissement de clé manquante en console).

## Clarifications

### Session 2026-02-27

- Q: Quel niveau de parité visuelle est requis entre le nouveau composant Django et le legacy UserSettings ? → A: Parité structurelle — mêmes sections dans le même ordre, même hiérarchie Card/CardHeader/CardContent, en utilisant les composants du design-system Django (`ui/src/design-system/`), sans reproduire les classes Tailwind du legacy.
- Q: La section MFA est-elle dans le scope de cette migration ? → A: Hors scope — afficher une Card placeholder "Double authentification / Bientôt disponible" en dernière position pour maintenir la parité de layout, sans implémenter le backend MFA.
- Q: L'upload d'avatar doit-il compresser l'image côté client à l'identique du legacy ? → A: Oui — compression client-side avant upload (max 0.75 MB, max 512 px, qualité 0.8) via `browser-image-compression`; rejection sans compression uniquement pour les fichiers non-image.
- Q: `HouseholdManagement` doit-il être un composant séparé ou inline dans `UserSettings` ? → A: Composant séparé `HouseholdManagement.tsx` dans `apps/app_settings/react/components/`, monté en premier dans `UserSettings` — parité architecturale legacy.
- Q: Quelles langues le sélecteur de locale doit-il exposer ? → A: 4 langues — en, fr, de, es — cohérent avec FR-009 et les fichiers locale existants.
- Q: Quelle architecture de dossier pour `apps/app_settings/react/` ? → A: Parité pattern legacy — `UserSettings.tsx` + `mount-settings.tsx` + `types.ts` + `components/` + `hooks/` (useUserProfile, useHouseholds); CSS Modules optionnels.
