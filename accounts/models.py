import uuid
from django.conf import settings
from django.contrib.auth.models import BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
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
    display_name = models.CharField(max_length=150, blank=True, help_text="Display name shown in the UI")
    locale = models.CharField(
        max_length=10,
        choices=[('en', 'English'), ('fr', 'Français')],
        default='en',
        help_text="User's preferred language"
    )
    avatar_url = models.CharField(max_length=255, blank=True, help_text="URL to user's avatar image")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    def __str__(self) -> str:
        return self.email

    @property
    def full_name(self) -> str:
        """Return display_name if set, otherwise first_name + last_name"""
        if self.display_name:
            return self.display_name
        return f"{self.first_name} {self.last_name}".strip() or self.email


class Household(models.Model):
    """Represents a household/home that can have multiple members."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Name of the household")
    created_at = models.DateTimeField(auto_now_add=True)
    address = models.TextField(blank=True, default='', help_text="Physical address of the household")
    city = models.CharField(max_length=100, blank=True, default='', help_text="City where the household is located")
    country = models.CharField(max_length=100, blank=True, default='', help_text="Country where the household is located")
    context_notes = models.TextField(blank=True, default='', help_text="General notes and context about the household")
    ai_prompt_context = models.TextField(
        blank=True,
        default='',
        help_text="Specific context information to include in AI prompts for better responses"
    )
    inbound_email_alias = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        help_text="Email alias for receiving documents/quotes by email"
    )
    default_household = models.BooleanField(
        default=False,
        help_text="Indicates if this household is the default for email processing"
    )

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['city'], name='idx_household_city'),
            models.Index(fields=['country'], name='idx_household_country'),
            models.Index(fields=['inbound_email_alias'], name='idx_household_email'),
        ]

    def __str__(self) -> str:
        return self.name


class HouseholdMember(models.Model):
    """Junction table linking users to households with role information."""
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('member', 'Member'),
    ]

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='household_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('household', 'user')]
        indexes = [
            models.Index(fields=['household', 'user'], name='idx_household_user'),
            models.Index(fields=['user'], name='idx_member_user'),
        ]
        ordering = ['joined_at']

    def __str__(self) -> str:
        return f"{self.user.email} - {self.household.name} ({self.role})"
