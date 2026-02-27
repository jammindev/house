"""
Custom querysets and managers for household-scoped models.
"""
from django.db import models


class HouseholdScopedQuerySet(models.QuerySet):
    """
    QuerySet that automatically filters by household.
    """

    def for_household(self, household_id):
        """Filter queryset to specific household."""
        return self.filter(household_id=household_id)

    def for_user_households(self, user):
        """Filter queryset to all households user belongs to."""
        from households.models import HouseholdMember

        household_ids = HouseholdMember.objects.filter(
            user_id=user.id
        ).values_list('household_id', flat=True)

        return self.filter(household_id__in=household_ids)


class HouseholdScopedManager(models.Manager):
    """
    Manager that provides household scoping methods.
    """

    def get_queryset(self):
        return HouseholdScopedQuerySet(self.model, using=self._db)

    def for_household(self, household_id):
        return self.get_queryset().for_household(household_id)

    def for_user_households(self, user):
        return self.get_queryset().for_user_households(user)
