# Quickstart: Settings Migration

## Prérequis

```bash
source venv/bin/activate
pip install Pillow  # si pas déjà installé (requis pour ImageField)
npm install          # pas de nouvelles dépendances React prévues
```

---

## Étape 1 — Migration du modèle User

### 1.1 Ajouter les champs dans `apps/accounts/models.py`

```python
# Ajouter dans la classe User :
THEME_CHOICES = [
    ('light', 'Light'),
    ('dark', 'Dark'),
    ('system', 'System'),
]
theme = models.CharField(max_length=20, choices=THEME_CHOICES, default='system', blank=True)
avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
```

### 1.2 Ajouter MEDIA_ROOT dans `config/settings/base.py`

```python
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
```

### 1.3 Ajouter la route media dans `config/urls.py` (mode DEBUG)

```python
from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

### 1.4 Générer et appliquer la migration

```bash
python manage.py makemigrations accounts
python manage.py migrate
```

---

## Étape 2 — Nouveaux endpoints Django (accounts)

Modifier `apps/accounts/views/api.py` :

- Étendre l'action `me` pour accepter `PATCH` (display_name, locale, theme)
- Ajouter l'action `set_avatar` : `POST /api/accounts/users/me/avatar/`
- Ajouter l'action `delete_avatar` : `DELETE /api/accounts/users/me/avatar/`
- Ajouter l'action `change_password` : `POST /api/accounts/users/me/change-password/`

Mettre à jour `apps/accounts/serializers.py` :

- Ajouter `theme` et `avatar` dans les `fields` de `UserSerializer`

---

## Étape 3 — View Django (SSR props)

Modifier `apps/app_settings/views_web.py` pour passer les données initiales :

```python
from accounts.serializers import UserSerializer
from households.views import HouseholdViewSet  # ou serializer direct

@login_required
def app_settings_view(request):
    from households.models import Household, HouseholdMember
    from households.serializers import HouseholdSerializer
    
    membership_ids = HouseholdMember.objects.filter(user=request.user).values_list('household_id', flat=True)
    households = Household.objects.filter(id__in=membership_ids)
    
    return render(request, 'app_settings/app/settings.html', {
        'title': 'Settings',
        'initial_user': UserSerializer(request.user, context={'request': request}).data,
        'initial_households': HouseholdSerializer(households, many=True).data,
        'mount_id': 'settings-root',
    })
```

---

## Étape 4 — Template Django

Modifier `apps/app_settings/templates/app_settings/app/settings.html` :

```html
{{ initial_user|json_script:"settings-user-props" }}
{{ initial_households|json_script:"settings-households-props" }}
```

---

## Étape 5 — Composant React

Créer `apps/app_settings/react/UserSettings.tsx` en suivant la structure de:
`legacy/nextjs/src/features/user-settings/UserSettings.tsx`

Adaptations clés :
- Remplacer `createSPASassClient()` par `fetch('/api/accounts/users/me/', { credentials: 'include' })`
- Utiliser le CSRF token Django : `document.querySelector('[name=csrfmiddlewaretoken]')?.value` ou cookie `csrftoken`
- Lire les props initiales depuis `document.getElementById('settings-user-props').textContent`
- Sections : HouseholdManagement, Locale, DisplayName, Avatar, Theme, UserDetails, ChangePassword

Créer `apps/app_settings/react/components/HouseholdManagement.tsx` en suivant:
`legacy/nextjs/src/features/user-settings/components/HouseholdManagement.tsx`

Mettre à jour `apps/app_settings/react/mount-settings.tsx` :

```tsx
import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import UserSettings from './UserSettings';

onDomReady(() => {
  mountWithJsonScriptProps('settings-root', 'settings-user-props', UserSettings);
});
```

---

## Étape 6 — i18n

### React (4 fichiers à mettre à jour)

Ajouter les clés manquantes sous `settings.*` dans :
- `ui/src/locales/en/translation.json`
- `ui/src/locales/fr/translation.json`
- `ui/src/locales/de/translation.json`
- `ui/src/locales/es/translation.json`

Clés à ajouter (référence legacy) :
```json
{
  "settings": {
    "title": "Settings",
    "subtitle": "Manage your profile and preferences",
    "displayName": "Display Name",
    "displayNameDescription": "Name shown to other household members",
    "displayNameLabel": "Display name",
    "displayNamePlaceholder": "Your name",
    "displayNameHelper": "Leave empty to use your email",
    "displayNameUpdated": "Display name updated",
    "language": "Language",
    "languageDescription": "Choose your preferred language",
    "languageUpdated": "Language updated",
    "avatar": "Profile Picture",
    "avatarDescription": "Upload a profile photo",
    "avatarHelper": "PNG, JPG or WEBP (max 2 MB)",
    "avatarAlt": "Profile picture",
    "avatarRemove": "Remove picture",
    "avatarUpdated": "Profile picture updated",
    "avatarRemoved": "Profile picture removed",
    "avatarUnsupportedType": "Please select an image file",
    "theme": "Theme",
    "themeDescription": "Choose your display theme",
    "themeUpdated": "Theme updated",
    "userDetails": "Account Details",
    "accountInfo": "Your account information",
    "userId": "User ID",
    "email": "Email",
    "changePassword": "Change Password",
    "updatePassword": "Update your password",
    "newPassword": "New password",
    "confirmPassword": "Confirm password",
    "passwordMismatch": "Passwords do not match",
    "passwordUpdated": "Password updated",
    "updating": "Updating...",
    "updatePasswordCta": "Update password",
    "householdNameRequired": "Household name is required",
    "householdCreated": "Household created",
    "householdDeleted": "Household deleted",
    "householdCreateFailed": "Failed to create household"
  }
}
```

### Django (templates shell)

```bash
python manage.py makemessages -l fr -l de -l es
# Éditer locale/{fr,de,es}/LC_MESSAGES/django.po avec les nouvelles chaînes
python manage.py compilemessages
```

---

## Étape 7 — Tests

```bash
pytest apps/accounts/tests/ -v
```

Nouveaux tests à créer dans `apps/accounts/tests/test_api.py` :
- `test_me_get_returns_current_user()`
- `test_me_patch_updates_display_name()`
- `test_me_patch_updates_locale()`
- `test_me_patch_updates_theme()`
- `test_set_avatar_valid_image()`
- `test_delete_avatar()`
- `test_change_password_success()`
- `test_change_password_mismatch()`
- `test_change_password_too_short()`

---

## Vérification rapide

```bash
# Lancer le serveur
python manage.py runserver

# Naviguer vers
http://localhost:8000/app/settings/

# Vérifier le JSON script dans le DOM
# → document.getElementById('settings-user-props').textContent
```
