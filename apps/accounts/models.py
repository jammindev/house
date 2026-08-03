import hashlib
import secrets
import uuid
from django.contrib.auth.models import BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.base_user import AbstractBaseUser


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("The email must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    display_name = models.CharField(max_length=150, blank=True, help_text=_("Display name shown in the UI"))
    locale = models.CharField(
        max_length=10,
        choices=[
            ('en', _('English')),
            ('fr', _('Français')),
            ('de', _('Deutsch')),
            ('es', _('Español')),
        ],
        null=True,
        blank=True,
        default=None,
        help_text=_("User's preferred language. Null means use browser detection.")
    )
    def _avatar_upload_path(instance, filename):
        return f'avatars/{instance.pk}/{filename}'

    avatar = models.ImageField(
        upload_to=_avatar_upload_path,
        null=True,
        blank=True,
        help_text=_("User's avatar image file")
    )
    THEME_CHOICES = [
        ('light', 'Light'),
        ('dark', 'Dark'),
        ('system', 'System'),
    ]
    theme = models.CharField(
        max_length=20,
        choices=THEME_CHOICES,
        default='system',
        blank=True,
        help_text=_("User's preferred theme (light/dark/system)")
    )
    COLOR_THEME_CHOICES = [
        ('theme-house', 'House'),
        ('theme-blue', 'Blue'),
        ('theme-sass', 'Sass'),
        ('theme-sass2', 'Sass 2'),
        ('theme-sass3', 'Sass 3'),
        ('theme-purple', 'Purple'),
        ('theme-green', 'Green'),
        ('theme-crimson', 'Crimson'),
        ('theme-teal', 'Teal'),
        ('theme-amber', 'Amber'),
        ('theme-indigo', 'Indigo'),
        ('theme-rose', 'Rose'),
        ('theme-cyan', 'Cyan'),
        ('theme-slate', 'Slate'),
        ('theme-emerald', 'Emerald'),
        ('theme-lavender', 'Lavender'),
        ('theme-midnight', 'Midnight'),
    ]
    color_theme = models.CharField(
        max_length=30,
        choices=COLOR_THEME_CHOICES,
        default='theme-house',
        blank=True,
        help_text=_("User's preferred color palette")
    )
    active_household = models.ForeignKey(
        'households.Household',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='active_for_users',
        help_text=_("User's currently active household"),
        verbose_name=_("active household"),
    )

    # Navigation entries pinned to the top of the sidebar, in display order
    # (keys from households.modules.PINNABLE_MODULES).
    pinned_modules = models.JSONField(
        default=list,
        blank=True,
        help_text=_("Sidebar module keys pinned by the user, in order."),
    )

    # Tutorial keys (guides + getting-started items) the user marked as done.
    # Keys are defined by the frontend content registry
    # (ui/src/features/tutorials/content.ts) — the backend only validates shape.
    completed_tutorials = models.JSONField(
        default=list,
        blank=True,
        help_text=_("Tutorial keys the user has completed."),
    )

    # Notification types this user silenced. Opt-OUT (empty = receives all),
    # like digest_disabled_sections: a preference the user only touches when
    # something bothers them. Only types in notifications.MUTABLE_TYPES can be
    # listed — an invitation is not something a checkbox may hide.
    muted_notification_types = models.JSONField(
        default=list,
        blank=True,
        help_text=_("Notification types the user does not want to receive."),
    )

    agent_memory_enabled = models.BooleanField(
        default=True,
        help_text=_(
            "When enabled, the AI agent automatically remembers durable facts "
            "about the user from conversations and uses them in its answers. "
            "When disabled, memories are neither captured automatically nor "
            "injected; explicit 'remember that…' requests still work."
        ),
    )

    # Digest sections the user turned OFF (keys from agent.digest.collectors).
    # Storing the *disabled* list means a newly shipped section is active by
    # default; empty list = every section active. Delivery (on/off + time) is a
    # separate opt-in living on the 'daily_digest' PingPreference.
    digest_disabled_sections = models.JSONField(
        default=list,
        blank=True,
        help_text=_("Daily-digest section keys the user turned off."),
    )

    # Recap chapters the user turned OFF (keys from recap.chapters). Same shape and
    # same reasoning as the digest above: storing the *disabled* list means a newly
    # shipped chapter is active by default. This is a **read** preference — a muted
    # chapter disappears from the rendering but stays in the frozen snapshot, so
    # turning it back on restores months already told.
    recap_disabled_chapters = models.JSONField(
        default=list,
        blank=True,
        help_text=_("Monthly-recap chapter keys the user turned off."),
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def __str__(self) -> str:
        return self.email

    @property
    def full_name(self) -> str:
        """Return display_name if set, otherwise first_name + last_name"""
        if self.display_name:
            return self.display_name
        return f"{self.first_name} {self.last_name}".strip() or self.email


class DeviceToken(models.Model):
    """Un jeton d'appareil — le droit d'**envoyer**, et rien d'autre.

    Il existe parce qu'un raccourci iOS ne peut pas emprunter la session du
    navigateur : sans lui, le seul moyen d'envoyer une photo depuis un téléphone est
    d'y stocker l'email et le mot de passe du compte, en clair, dans un objet qui se
    partage d'un geste. Un jeton, lui, ne vaut que ce qu'il permet, et se révoque
    sans toucher au compte.

    ⚠️ **Le secret n'est jamais stocké.** Seule son empreinte l'est ; le clair n'est
    rendu qu'une fois, à l'émission. Un jeton qu'on peut relire en base a exactement
    la même valeur qu'un mot de passe, donc n'a plus de raison d'exister.
    """

    #: Préfixe du secret — le rend reconnaissable dans un journal ou un presse-papier.
    PREFIX = "mzn_"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="device_tokens",
    )
    name = models.CharField(
        max_length=100,
        help_text=_("Device name, chosen by the user (« iPhone de Ben »)."),
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("device token")
        verbose_name_plural = _("device tokens")

    def __str__(self) -> str:
        return f"{self.name} ({self.user_id})"

    @staticmethod
    def hash_secret(raw: str) -> str:
        """L'empreinte d'un secret. SHA-256 suffit : le secret est déjà à haute
        entropie, donc les attaques par dictionnaire qui justifient un hachage lent
        pour un mot de passe n'ont pas de prise ici."""
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    def issue(cls, *, user, name: str) -> tuple["DeviceToken", str]:
        """Émet un jeton et renvoie ``(instance, secret en clair)``.

        Le second élément est la **seule** occasion de lire le secret.
        """
        raw = cls.PREFIX + secrets.token_urlsafe(32)
        token = cls.objects.create(user=user, name=name, token_hash=cls.hash_secret(raw))
        return token, raw

    @classmethod
    def resolve(cls, raw: str) -> "DeviceToken | None":
        """Le jeton **vivant** correspondant à ce secret, ou ``None``."""
        if not raw:
            return None
        return (
            cls.objects.select_related("user")
            .filter(token_hash=cls.hash_secret(raw), revoked_at__isnull=True)
            .first()
        )

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    def revoke(self) -> None:
        """Révoquer coupe à la requête suivante — pas au prochain déploiement."""
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.save(update_fields=["revoked_at"])

    def touch(self) -> None:
        """Trace du dernier usage, pour qu'un jeton oublié se repère."""
        self.last_used_at = timezone.now()
        self.save(update_fields=["last_used_at"])
