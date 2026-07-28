# Module — households

> Audit : 2026-04-28. Rôle : multi-tenancy — foyer, membres, rôles, invitations et household actif.

## État synthétique

- **Backend** : Présent
- **Frontend** : Complet — gestion intégrée dans `ui/src/features/settings/components/HouseholdManagement/` et `PendingInvitations.tsx` ; pas de page dédiée (settings)
- **Locales (en/fr/de/es)** : ok — clés sous le namespace `settings` présent dans les 4 locales (pas de namespace `households` dédié)
- **Tests** : oui — `tests.py`, `test_invitations.py` (invite / lien partagé / join / révocation) + `e2e/invitation-link.spec.ts`
- **Migrations** : 12

## Modèles & API

- Modèles principaux : `Household` (UUID PK, soft-delete via `archived_at`, `inbound_email_alias`, `country`, `timezone`), `HouseholdMember` (composite unique sur `household + user`, `role` owner/member), `HouseholdInvitation` (status pending/accepted/declined/revoked, `token` unique, `email` facultatif, `expires_at`) — `apps/households/models.py`
- Endpoints exposés sous `/api/households/` :
  - `GET|POST /` (list = mes households non archivés), `GET|PATCH|DELETE /{id}/` (DELETE = soft archive)
  - `GET /{id}/members/`, `GET /active-members/`, `POST /{id}/leave/`
  - `POST /switch/` (change l'`active_household` du user)
  - `POST /{id}/invite/` (crée un lien), `GET /{id}/invitations/` (liens en attente, owner), `POST /{id}/revoke-invitation/`
  - `POST /{id}/remove_member/`, `POST /{id}/update_role/`
  - `GET /invitations/` (les miennes en attente), `POST /invitations/{id}/accept/`, `POST /invitations/{id}/decline/`
  - `GET|POST /join/{token}/` — **public** (`AllowAny`, throttlé `invitation_join`) : aperçu, puis création de compte + adhésion
- Permissions : `IsAuthenticated` partout **sauf `/join/{token}/`** ; `IsHouseholdOwner` pour `update`, `partial_update`, `destroy`, `invite`, `invitations`, `revoke_invitation`, `remove_member`, `update_role` ; `IsHouseholdMember` pour `retrieve`, `members`, `leave` (`apps/households/views.py:30-36`)

## Notes

- **Modules activables (parcours 15)** : `Household.disabled_modules` (JSONField, défaut `[]`)
  stocke les clés de modules optionnels masqués pour le foyer, validées contre
  `apps/households/modules.py::OPTIONAL_MODULES` (miroir frontend : `ui/src/lib/modules.ts`
  — les clés doivent rester identiques des deux côtés). Modifié par l'owner via le `PATCH`
  household standard (section « Modules » de `/app/settings`). Consommé par la sidebar, le
  dashboard, le guard de route (`ui/src/components/ModuleRoute.tsx`) et le gating agent
  (`apps/agent/modules.py`). Désactiver ne touche à aucune donnée ; on stocke les
  *désactivés* (pas les activés) → un nouveau module livré est actif par défaut.
  Les épinglés perso vivent côté `accounts` (`User.pinned_modules`).
- Soft-delete via `archived_at` (`destroy` met simplement le timestamp). Filtrage `archived_at__isnull=True` dans `get_queryset` (`apps/households/views.py:41`).
- Signaux `post_save` / `post_delete` sur `HouseholdMember` gèrent automatiquement `User.active_household` à l'arrivée et au départ d'un membre — `apps/households/signals.py`.
- Signal `post_save` sur `Household` crée automatiquement une zone racine "Maison" (`parent=None`) à la création de chaque foyer — `apps/households/signals.py:7-13`.
- Le routing déclare `join/{token}/` **et** le `SimpleRouter` de `/invitations/` **avant** le router household : le détail est `<pk>/`, dont la regex avalerait les deux — `apps/households/urls.py`.
- Le dernier owner ne peut ni quitter, ni être dému/retiré (vérifications dans `leave`, `remove_member`, `update_role`).
- **Une invitation est un lien, pas un message.** `invite` ne demande plus de
  compte pré-existant : il crée un `token` et renvoie un `join_url` que l'owner
  transmet lui-même. C'est ce qui a rendu la fonctionnalité utilisable — elle
  exigeait un compte House que rien ne permettait de créer, et répondait 404 :
  zéro invitation en prod depuis l'origine. Corollaires à préserver :
  - **Aucun mail ne part du serveur** (la prod n'a pas de `EMAIL_HOST`). Un
    parcours d'invitation qui dépend d'un envoi serait muet exactement comme
    l'ancien 404. La notification in-app reste, mais **en plus** du lien et
    seulement quand l'adresse a déjà un compte.
  - **La recherche d'adresse est `iexact`** (`services.find_user_by_email`),
    comme le login et le reset. En exact, une majuscule donnait le même 404
    qu'un compte absent.
  - **Une invitation adressée épingle son adresse** : le join anonyme ignore
    l'email soumis. Sans ça un lien transféré ouvrait un compte sur n'importe
    quelle adresse.
  - **Le join ne touche jamais un compte existant** (400 « connectez-vous puis
    réouvrez le lien ») et **ne consomme pas le lien** en cas de refus.
  - **Un lien se révoque**, et un lien révoqué/consommé répond 404 sans nommer
    le foyer — `services.get_pending_invitation` ne renvoie que du `pending`.
    Un lien *expiré* reste visible, lui : « expiré » est actionnable
    (redemander un lien), « invalide » ne l'est pas.
  - **Le join renvoie une paire JWT** et ouvre une session, comme
    `TokenObtainPairWithSessionView` : sans ça la personne atterrit sur `/login`
    pour retaper le mot de passe qu'elle vient de choisir.
  - Les refus passent par `services.InvitationError` (`APIException`), **jamais**
    par `serializers.ValidationError` : celle-ci emballe les valeurs dans une
    liste, et tout le front lit `data.detail` comme une string.
- `FRONTEND_URL` fabrique le `join_url` (`serializers.invitation_join_url`) : un
  `FRONTEND_URL` faux produit des liens qui ne mènent nulle part.
