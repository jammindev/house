# electricity/permissions.py
"""Electricity permissions."""

from rest_framework import permissions

from households.models import HouseholdMember


class IsElectricityOwnerWriteMemberRead(permissions.BasePermission):
    """Members can read, only owners can write electricity resources."""

    write_methods = {"POST", "PUT", "PATCH", "DELETE"}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        household = request.household
        if household is None:
            return request.method in permissions.SAFE_METHODS

        if request.method in permissions.SAFE_METHODS:
            return HouseholdMember.objects.filter(
                household_id=household.id,
                user_id=request.user.id,
            ).exists()

        return HouseholdMember.objects.filter(
            household_id=household.id,
            user_id=request.user.id,
            role=HouseholdMember.Role.OWNER,
        ).exists()

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        household_id = getattr(obj, "household_id", None)
        if not household_id:
            return False

        if request.method in permissions.SAFE_METHODS:
            return HouseholdMember.objects.filter(
                household_id=household_id,
                user_id=request.user.id,
            ).exists()

        return HouseholdMember.objects.filter(
            household_id=household_id,
            user_id=request.user.id,
            role=HouseholdMember.Role.OWNER,
        ).exists()
