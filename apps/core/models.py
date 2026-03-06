"""
Core models and mixins used across the application.
"""
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class TimestampedModel(models.Model):
    """
    Abstract base model with audit timestamps.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
        db_column="created_by"
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_updated",
        db_column="updated_by"
    )

    class Meta:
        abstract = True


class HouseholdScopedModel(TimestampedModel):
    """
    Abstract base model for household-scoped entities.
    Includes audit timestamps from TimestampedModel + household FK.
    """
    household = models.ForeignKey(
        'households.Household',
        on_delete=models.CASCADE,
        related_name="%(class)s_set",
        db_column="household_id"
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """Ensure household is set before saving."""
        if not self.household_id:
            raise ValueError(f"{self.__class__.__name__} requires household")
        super().save(*args, **kwargs)
