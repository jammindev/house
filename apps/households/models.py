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
    country = models.TextField(default='', blank=True)
    
    # AI/context fields
    context_notes = models.TextField(default='', blank=True)
    ai_prompt_context = models.TextField(default='', blank=True)
    
    # Email ingestion
    inbound_email_alias = models.CharField(max_length=255, unique=True, blank=True, null=True)
    
    # Default household flag (per-user, enforced via triggers in Supabase)
    default_household = models.BooleanField(default=False)

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
