# Data Model: Settings Migration

## Entités modifiées

### `accounts.User` (modification)

| Champ | Type | Décision | Notes |
|-------|------|----------|-------|
| `theme` | `CharField(max_length=20, choices, default='system')` | **Nouveau** | Stocke la préférence de thème (light / dark / system) |
| `avatar` | `ImageField(upload_to='avatars/', null=True, blank=True)` | **Nouveau** | Fichier image uploadé via Django media. Remplace la logique Supabase Storage. |
| `avatar_url` | `CharField(max_length=255, blank=True)` | Existant — inchangé | Conservé pour compatibilité. Sera mis à jour automatiquement à partir du champ `avatar` via un signal ou une property. |
| `display_name` | `CharField(max_length=150, blank=True)` | Existant — inchangé | |
| `locale` | `CharField(max_length=10, choices)` | Existant — inchangé | `en`, `fr`, `de`, `es` |

#### Choix du champ `theme` :
```python
THEME_CHOICES = [
    ('light', 'Light'),
    ('dark', 'Dark'),
    ('system', 'System'),
]
theme = models.CharField(max_length=20, choices=THEME_CHOICES, default='system', blank=True)
```

#### Champ `avatar` (nouveau) :
```python
avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
```
> Nécessite Pillow dans `requirements.txt`.

#### Property `avatar_url` calculée (si souhaité) :
```python
@property
def computed_avatar_url(self) -> str:
    if self.avatar:
        return self.avatar.url
    return self.avatar_url or ''
```

### `accounts.User` — Migration

```
python manage.py makemigrations accounts
# Génère: 000X_user_theme_avatar.py
python manage.py migrate
```

---

## Entités inchangées

### `households.Household` (inchangé)

Tous les champs existants sont utilisés tels quels : `name`, `address`, `city`, `country`, `context_notes`, `ai_prompt_context`. Pas de modification de modèle nécessaire.

### `households.HouseholdMember` (inchangé)

Utilisé tel quel via les endpoints existants.

---

## Serializers modifiés

### `accounts.UserSerializer` (modification)

Ajouter `theme` et `avatar` dans les `fields` ; `avatar_url` reste en lecture seule à partir du champ `avatar`. Le champ `avatar` est en `write_only=False` pour permettre la lecture de l'URL.

```python
class Meta:
    model = User
    fields = [
        "id", "email",
        "first_name", "last_name", "display_name",
        "locale", "avatar_url", "avatar",
        "theme",                          # nouveau
        "full_name", "is_active", "is_staff", "date_joined",
    ]
    read_only_fields = ["id", "email", "is_staff", "date_joined", "full_name", "avatar_url"]
```

---

## Règles de validation

| Règle | Implémentation |
|-------|----------------|
| `theme` DOIT être une valeur parmi `light\|dark\|system` | `choices` Django — validé automatiquement par DRF |
| Image : type DOIT être `image/*` | `ImageField` Django (via Pillow) |
| Image : taille max 2 MB | Validation dans l'action `set_avatar`: `if file.size > 2 * 1024 * 1024: error` |
| Nouveau mot de passe : longueur ≥ 8 | Validation dans l'action `change_password` |
| Nouveau mot de passe : correspondance | Validation dans l'action `change_password` (serveur) + React (client) |

---

## Transitions d'état

```
User.avatar: None → fichier → None  (via set_avatar / delete_avatar)
User.theme: 'system' → 'light' | 'dark' | 'system'
User.locale: 'en' → 'fr' | 'de' | 'es' | 'en'
```

---

## Paramètres Django à ajouter

Dans `config/settings/base.py` :
```python
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
```

Dans `config/urls.py` (mode DEBUG uniquement) :
```python
from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

> En production, les fichiers media seront servis par le serveur web (nginx) ou un stockage cloud (S3, etc.).
