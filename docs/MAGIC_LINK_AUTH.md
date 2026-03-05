# Magic Link — Connexion par email

> Statut : **RFC / À implémenter**
> Mise à jour : mars 2026

## Principe

Au lieu d'un mot de passe, l'utilisateur saisit son email et reçoit un lien de connexion à usage unique, valide 15 minutes. En cliquant, une session Django est créée normalement.

```
1. User saisit son email
2. Backend génère un token sécurisé + envoie un email avec un lien
3. User clique → token validé → session Django créée → redirect dashboard
```

Compatible avec l'auth existante (session Django, `auth_login()`, `IsAuthenticated`) — aucune rupture.

---

## Architecture

### Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `apps/accounts/models.py` | Ajouter `EmailLoginToken` |
| `apps/accounts/migrations/` | Migration auto générée |
| `apps/accounts/views/template_views.py` | Ajouter 3 vues |
| `apps/accounts/throttles.py` | Ajouter throttle magic link |
| `apps/accounts/web_urls.py` | Ajouter 3 routes |
| `templates/accounts/magic_link_request.html` | Formulaire email |
| `templates/accounts/magic_link_sent.html` | Confirmation envoi |
| `config/settings/base.py` | `DEFAULT_FROM_EMAIL`, throttle rate |

---

## Modèle : `EmailLoginToken`

```python
# apps/accounts/models.py
import secrets
import hashlib
from django.conf import settings
from django.db import models
from django.utils import timezone
from datetime import timedelta


class EmailLoginToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="login_tokens",
    )
    token_hash = models.CharField(max_length=64, unique=True)  # SHA-256, jamais le token brut
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    EXPIRY_MINUTES = 15

    class Meta:
        indexes = [models.Index(fields=["token_hash"])]

    @classmethod
    def create_for_user(cls, user):
        """Génère un token brut (envoyé par email) et stocke seulement son hash."""
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        obj = cls.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(minutes=cls.EXPIRY_MINUTES),
        )
        return raw_token, obj

    @classmethod
    def consume(cls, raw_token):
        """Valide et consomme le token (usage unique). Retourne le user ou None."""
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        try:
            obj = cls.objects.select_related("user").get(
                token_hash=token_hash,
                used_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
        except cls.DoesNotExist:
            return None
        obj.used_at = timezone.now()
        obj.save(update_fields=["used_at"])
        return obj.user
```

---

## Vues : `apps/accounts/views/template_views.py`

```python
from django.contrib.auth import login as auth_login
from django.contrib import messages
from django.core.mail import send_mail
from django.conf import settings
from django.shortcuts import render, redirect
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme

from apps.accounts.models import User, EmailLoginToken


def magic_link_request_view(request):
    """Formulaire de demande de lien de connexion."""
    if request.user.is_authenticated:
        return redirect("app_dashboard")

    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()

        # Réponse identique que l'user existe ou non (anti-énumération)
        try:
            user = User.objects.get(email=email, is_active=True)
            raw_token, _ = EmailLoginToken.create_for_user(user)
            verify_url = request.build_absolute_uri(
                reverse("magic_link_verify") + f"?token={raw_token}"
            )
            send_mail(
                subject="Votre lien de connexion",
                message=(
                    f"Bonjour,\n\n"
                    f"Cliquez sur le lien ci-dessous pour vous connecter (valide 15 min) :\n"
                    f"{verify_url}\n\n"
                    f"Si vous n'avez pas demandé ce lien, ignorez cet email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
            )
        except User.DoesNotExist:
            pass  # Silencieux volontairement

        return redirect("magic_link_sent")

    return render(request, "accounts/magic_link_request.html")


def magic_link_sent_view(request):
    """Page de confirmation après envoi du lien."""
    return render(request, "accounts/magic_link_sent.html")


def magic_link_verify_view(request):
    """Vérifie le token et ouvre une session Django."""
    raw_token = request.GET.get("token", "")
    if not raw_token:
        messages.error(request, "Lien invalide.")
        return redirect("magic_link_request")

    user = EmailLoginToken.consume(raw_token)
    if user is None:
        messages.error(request, "Ce lien est invalide ou a expiré.")
        return redirect("magic_link_request")

    auth_login(request, user, backend="django.contrib.auth.backends.ModelBackend")

    next_url = request.GET.get("next")
    if next_url and url_has_allowed_host_and_scheme(
        url=next_url,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return redirect(next_url)
    return redirect("app_dashboard")
```

---

## URLs : `apps/accounts/web_urls.py`

```python
path("login/magic/", magic_link_request_view, name="magic_link_request"),
path("login/magic/sent/", magic_link_sent_view, name="magic_link_sent"),
path("login/magic/verify/", magic_link_verify_view, name="magic_link_verify"),
```

---

## Rate limiting : `apps/accounts/throttles.py`

Le throttle existant est DRF-based. Pour les vues template, utiliser le cache Django directement :

```python
from django.core.cache import cache
from django.http import HttpResponse

MAGIC_LINK_LIMIT = 3       # requêtes max
MAGIC_LINK_WINDOW = 3600   # fenêtre en secondes (1h)

def check_magic_link_rate_limit(email: str) -> bool:
    """Retourne True si la limite est dépassée."""
    key = f"magic_link_rl:{email}"
    count = cache.get(key, 0)
    if count >= MAGIC_LINK_LIMIT:
        return True
    cache.set(key, count + 1, MAGIC_LINK_WINDOW)
    return False
```

Utilisation dans `magic_link_request_view` :

```python
from apps.accounts.throttles import check_magic_link_rate_limit

if check_magic_link_rate_limit(email):
    # Même message que succès (anti-énumération)
    return redirect("magic_link_sent")
```

> En prod, le cache doit pointer vers Redis (`django-redis`) pour cohérence multi-workers — comme pour les throttles DRF existants.

---

## Nettoyage des tokens expirés

Ajouter dans une commande de management ou une tâche périodique (cron/Celery) :

```python
from apps.accounts.models import EmailLoginToken
from django.utils import timezone

EmailLoginToken.objects.filter(expires_at__lt=timezone.now()).delete()
```

Commande de management suggérée : `python manage.py cleanup_login_tokens`

---

## Email backends par environnement

Déjà configurés dans les settings :

| Environnement | Backend |
|---|---|
| `local.py` | `console` — affiche dans le terminal |
| `test.py` | `locmem` — capturé dans `django.test` |
| `production.py` | `smtp` — via `EMAIL_BACKEND` env var |

Ajouter dans `base.py` :

```python
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@example.com")
```

---

## Sécurité

| Risque | Mitigation |
|---|---|
| Token volé en base | Stocké hashé SHA-256 uniquement |
| Rejeu de token | `used_at` → usage unique |
| Token expiré actif | `expires_at` obligatoire (15 min) |
| Énumération d'emails | Réponse identique si email inconnu |
| Redirect ouvert | Validation `url_has_allowed_host_and_scheme` |
| Brute force / spam | Rate limiting 3 req/h par email (cache Django) |

---

## Tests à écrire

```python
# apps/accounts/tests/test_magic_link.py

def test_request_sends_email_for_existing_user(...)
def test_request_silent_for_unknown_email(...)
def test_verify_valid_token_opens_session(...)
def test_verify_expired_token_is_rejected(...)
def test_verify_used_token_is_rejected(...)
def test_rate_limit_blocks_after_3_requests(...)
```
