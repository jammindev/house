"""
Households models - multi-tenancy foundation.
"""
import secrets
import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model

User = get_user_model()

#: How long a shared invitation link stays usable.
INVITATION_TTL_DAYS = 7


def generate_invitation_token():
    """Unguessable token for an invitation link (~43 chars of url-safe base64)."""
    return secrets.token_urlsafe(32)


def default_invitation_expiry():
    return timezone.now() + timedelta(days=INVITATION_TTL_DAYS)


class Household(models.Model):
    """
    Household - the core multi-tenancy entity.
    Users belong to households via HouseholdMember.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Optional address fields
    address = models.TextField(default='', blank=True)
    city = models.TextField(default='', blank=True)
    postal_code = models.CharField(max_length=20, default='', blank=True)
    country = models.CharField(max_length=2, default='', blank=True,
                               help_text=_("ISO 3166-1 alpha-2 country code (e.g. FR, DE, US)"))
    timezone = models.CharField(max_length=64, default='', blank=True,
                                help_text=_("IANA timezone (e.g. Europe/Paris). Leave blank for UTC."))

    # Weather module (parcours 17) — one household = one point on the map.
    # Set by the owner via a city search (Open-Meteo geocoding). Null coords =
    # the weather module has nothing to show yet (state "not configured").
    latitude = models.FloatField(null=True, blank=True,
                                 help_text=_("Latitude for the weather module (decimal degrees)."))
    longitude = models.FloatField(null=True, blank=True,
                                  help_text=_("Longitude for the weather module (decimal degrees)."))
    location_label = models.CharField(max_length=255, default='', blank=True,
                                      help_text=_("Human-readable place name shown in the weather module."))

    # AI/context fields
    context_notes = models.TextField(default='', blank=True)
    ai_prompt_context = models.TextField(default='', blank=True)

    # Placeholder for future full-text search stemming and i18n agent prompts.
    # Not consumed by the retrieval layer in V1 (config='simple').
    class PreferredLanguage(models.TextChoices):
        FR = 'fr', _("French")
        EN = 'en', _("English")
        DE = 'de', _("German")
        ES = 'es', _("Spanish")

    preferred_language = models.CharField(
        max_length=2,
        choices=PreferredLanguage.choices,
        default=PreferredLanguage.FR,
    )
    
    # Optional modules disabled for this household (keys from
    # households.modules.OPTIONAL_MODULES). Empty list = everything active,
    # so newly shipped modules are enabled by default.
    disabled_modules = models.JSONField(
        default=list,
        blank=True,
        help_text=_("Optional module keys hidden for this household."),
    )

    # Email ingestion
    inbound_email_alias = models.CharField(max_length=255, unique=True, blank=True, null=True)
    
    # Soft-delete
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'households'
        verbose_name = _("household")
        verbose_name_plural = _("households")
        indexes = [
            models.Index(fields=['city'], name='idx_hh_city', condition=models.Q(city__gt='')),
            models.Index(fields=['country'], name='idx_hh_country', condition=models.Q(country__gt='')),
            models.Index(fields=['inbound_email_alias'], name='idx_hh_email_alias'),
        ]

    def __str__(self):
        return self.name

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None


class HouseholdMember(models.Model):
    """
    Join table for household membership.
    Composite PK: (household_id, user_id)
    """
    
    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'
        MEMBER = 'member', 'Member'
    
    household = models.ForeignKey(
        Household,
        on_delete=models.CASCADE,
        db_column='household_id'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column='user_id'
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER
    )

    class Meta:
        db_table = 'household_members'
        unique_together = [['household', 'user']]
        indexes = [
            models.Index(fields=['household']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.household.name} ({self.role})"


class HouseholdInvitation(models.Model):
    """
    Pending invitation to join a household.

    An invitation carries an unguessable `token`: the owner shares the resulting
    `/join/<token>` link themselves, and whoever opens it can create their
    account and land in the household. `invited_user` is therefore **nullable** —
    it is only known upfront when the invited email already has an account (in
    which case the in-app notification path applies too), and gets filled in when
    the invitation is accepted.
    """

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        ACCEPTED = "accepted", _("Accepted")
        DECLINED = "declined", _("Declined")
        REVOKED = "revoked", _("Revoked")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    household = models.ForeignKey(
        Household,
        on_delete=models.CASCADE,
        related_name="invitations",
        db_column="household_id",
    )
    invited_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="household_invitations",
        db_column="invited_user_id",
    )
    email = models.EmailField(
        default="",
        blank=True,
        help_text=_("Invited email, lowercased. Blank for a link addressed to nobody in particular."),
    )
    token = models.CharField(
        max_length=64,
        unique=True,
        default=generate_invitation_token,
        help_text=_("Secret carried by the shared link."),
    )
    expires_at = models.DateTimeField(default=default_invitation_expiry)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_household_invitations",
        db_column="invited_by_id",
    )
    role = models.CharField(
        max_length=20,
        choices=HouseholdMember.Role.choices,
        default=HouseholdMember.Role.MEMBER,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "household_invitations"
        indexes = [
            models.Index(fields=["invited_user", "status"], name="hhinv_user_status_idx"),
            models.Index(fields=["household", "status"], name="hhinv_hh_status_idx"),
            models.Index(fields=["email", "status"], name="hhinv_email_status_idx"),
        ]

    def save(self, *args, **kwargs):
        # One email = one spelling. Matching is case-insensitive everywhere else
        # (login, password reset), and a stored "Jean@X.com" would make an
        # invitation impossible to find back by its own address.
        if self.email:
            self.email = self.email.strip().lower()
        return super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_usable(self):
        """A link only opens a household while pending *and* unexpired."""
        return self.status == self.Status.PENDING and not self.is_expired

    def __str__(self):
        who = self.email or (self.invited_user.email if self.invited_user else _("shared link"))
        return f"Invitation: {who} → {self.household.name} [{self.status}]"
