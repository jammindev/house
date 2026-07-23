"""Object-level access control for briefings.

Read: a shared briefing is visible to every household member; a private one only
to its creator. Write (edit/delete): a private briefing only by its creator; a
shared one by its creator **or** a household owner.
"""
from rest_framework import permissions


def _is_household_owner(user, household_id) -> bool:
    from households.models import HouseholdMember

    return HouseholdMember.objects.filter(
        household_id=household_id, user_id=user.id, role="owner"
    ).exists()


class CanManageBriefing(permissions.BasePermission):
    """Enforce the private/shared visibility + edit rules at the object level."""

    def has_object_permission(self, request, view, obj):
        is_creator = obj.created_by_id == request.user.id

        if request.method in permissions.SAFE_METHODS:
            # Read: private → creator only; shared → any member (membership is
            # already enforced by IsHouseholdMember + the queryset).
            return is_creator or not obj.is_private

        # Write: creator always; shared may also be managed by an owner.
        if is_creator:
            return True
        if not obj.is_private:
            return _is_household_owner(request.user, obj.household_id)
        return False
