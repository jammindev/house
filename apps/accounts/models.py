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
        default='en',
        help_text=_("User's preferred language")
    )
    avatar = models.ImageField(
        upload_to='avatars/',
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
