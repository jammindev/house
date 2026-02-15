"""
Custom permissions for household-scoped access control.
Mimics Supabase RLS at Django level.
"""
from rest_framework import permissions


class IsHouseholdMember(permissions.BasePermission):
    """
    Permission that checks if user is a member of the household.
    Equivalent to Supabase RLS: EXISTS(SELECT 1 FROM household_members WHERE user_id = auth.uid())
    """

    def has_permission(self, request, view):
        """Check if user is authenticated."""
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        """Check if user is member of object's household."""
        if not hasattr(obj, 'household_id'):
            return False

        # Import here to avoid circular imports
        from households.models import HouseholdMember

        return HouseholdMember.objects.filter(
            household_id=obj.household_id,
            user_id=request.user.id
        ).exists()


class IsHouseholdOwner(permissions.BasePermission):
    """
    Permission that checks if user is the owner of the household.
    """

    def has_object_permission(self, request, view, obj):
        """Check if user is owner of object's household."""
        if not hasattr(obj, 'household_id'):
            return False

        from households.models import HouseholdMember

        return HouseholdMember.objects.filter(
            household_id=obj.household_id,
            user_id=request.user.id,
            role='owner'
        ).exists()


class CanViewPrivateContent(permissions.BasePermission):
    """
    Permission for visibility system (is_private field).
    User can view if: content is public OR user is the creator.
    """

    def has_object_permission(self, request, view, obj):
        """Check visibility permissions."""
        if not hasattr(obj, 'is_private'):
            return True  # No privacy restriction

        # Public content = everyone in household can see
        if not obj.is_private:
            return True

        # Private content = only creator can see
        return obj.created_by_id == request.user.id
