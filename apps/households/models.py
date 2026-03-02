"""
Households models - multi-tenancy foundation.
"""
import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model

User = get_user_model()


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
    
    # AI/context fields
    context_notes = models.TextField(default='', blank=True)
    ai_prompt_context = models.TextField(default='', blank=True)
    
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
    Created when an owner invites a user; stays pending until accepted or declined.
    """

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        ACCEPTED = "accepted", _("Accepted")
        DECLINED = "declined", _("Declined")

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
        related_name="household_invitations",
        db_column="invited_user_id",
    )
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
        ]

    def __str__(self):
        return f"Invitation: {self.invited_user.email} → {self.household.name} [{self.status}]"
