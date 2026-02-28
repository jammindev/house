"""
Custom permissions for household-scoped access control.
Mimics Supabase RLS at Django level.
"""
from rest_framework import permissions
from rest_framework.request import Request


def _extract_household_id(request: Request):
    """Extract household id from common request locations."""
    headers = getattr(request, "headers", {}) or {}
    header_value = headers.get("X-Household-Id")
    if header_value:
        return header_value

    query_params = getattr(request, "query_params", None)
    if query_params is None:
        query_params = getattr(request, "GET", {})

    query_value = query_params.get("household_id")
    if query_value:
        return query_value

    data = getattr(request, "data", None)
    if isinstance(data, dict):
        data_value = data.get("household_id") or data.get("household")
        if data_value:
            return str(data_value)

    post_data = getattr(request, "POST", None)
    if post_data is not None:
        post_value = post_data.get("household_id") or post_data.get("household")
        if post_value:
            return str(post_value)

    return None


def resolve_request_household(request: Request, required: bool = False):
    """
    Resolve current household from request and validate membership.

    Priority:
    1) X-Household-Id header
    2) household_id query param
    3) household_id / household in body
    4) if user has exactly one household, auto-select it
    """
    from households.models import Household, HouseholdMember

    if not request.user or not request.user.is_authenticated:
        if required:
            return None
        return None

    household_id = _extract_household_id(request)
    if household_id:
        is_member = HouseholdMember.objects.filter(
            household_id=household_id,
            user_id=request.user.id,
        ).exists()
        if not is_member:
            return None
        return Household.objects.filter(id=household_id).first()

    # FK on User.active_household (set via switch-household view)
    active_hid = getattr(request.user, 'active_household_id', None)
    if active_hid:
        is_member = HouseholdMember.objects.filter(
            household_id=active_hid,
            user_id=request.user.id,
        ).exists()
        if is_member:
            return Household.objects.filter(id=active_hid).first()

    memberships = HouseholdMember.objects.filter(user_id=request.user.id).values_list("household_id", flat=True)
    membership_ids = list(memberships)
    if len(membership_ids) == 1:
        return Household.objects.filter(id=membership_ids[0]).first()

    if required:
        return None
    return None


class IsHouseholdMember(permissions.BasePermission):
    """
    Permission that checks if user is a member of the household.
    Equivalent to Supabase RLS: EXISTS(SELECT 1 FROM household_members WHERE user_id = auth.uid())
    """

    def has_permission(self, request, view):
        """Authenticated users + membership check when a household is explicitly targeted."""
        if not request.user or not request.user.is_authenticated:
            return False

        household_id = _extract_household_id(request)
        if not household_id:
            return True

        from households.models import HouseholdMember

        return HouseholdMember.objects.filter(
            household_id=household_id,
            user_id=request.user.id,
        ).exists()

    def has_object_permission(self, request, view, obj):
        """Check if user is member of object's household."""
        # Support both household-scoped objects (obj.household_id) and Household objects themselves (obj.id)
        household_id = getattr(obj, "household_id", None) or getattr(obj, "id", None)
        if not household_id:
            return False

        # Import here to avoid circular imports
        from households.models import HouseholdMember

        return HouseholdMember.objects.filter(
            household_id=household_id,
            user_id=request.user.id
        ).exists()


class IsHouseholdOwner(permissions.BasePermission):
    """
    Permission that checks if user is the owner of the household.
    """

    def has_permission(self, request, view):
        """Authenticated users + owner check when household id is provided."""
        if not request.user or not request.user.is_authenticated:
            return False

        household_id = _extract_household_id(request)
        if not household_id:
            return True

        from households.models import HouseholdMember

        return HouseholdMember.objects.filter(
            household_id=household_id,
            user_id=request.user.id,
            role='owner',
        ).exists()

    def has_object_permission(self, request, view, obj):
        """Check if user is owner of object's household."""
        household_id = getattr(obj, "household_id", None) or getattr(obj, "id", None)
        if not household_id:
            return False

        from households.models import HouseholdMember

        return HouseholdMember.objects.filter(
            household_id=household_id,
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
