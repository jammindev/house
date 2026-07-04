"""Owner-only read API over the AI usage aggregations (lot 6, #109)."""
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import resolve_request_household
from households.models import HouseholdMember

from . import aggregations


class AIUsageViewSet(viewsets.ViewSet):
    """``GET /api/ai-usage/{summary,histogram,recent}/`` — household owners only.

    Read-only observability over ``AIUsageLog``. The household is resolved like
    everywhere else (header/query/active household); ownership is enforced
    explicitly — a plain member gets a 403, whatever the endpoint.
    """

    permission_classes = [IsAuthenticated]

    def _owner_household(self, request):
        household = getattr(request, "household", None) or resolve_request_household(request)
        if household is None:
            raise ValidationError("No active household for this user.")
        is_owner = HouseholdMember.objects.filter(
            household_id=household.id,
            user_id=request.user.id,
            role=HouseholdMember.Role.OWNER,
        ).exists()
        if not is_owner:
            raise PermissionDenied("Only household owners can view AI usage.")
        return household

    @action(detail=False, methods=["get"])
    def summary(self, request):
        household = self._owner_household(request)
        return Response(aggregations.summary(household.id), status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def histogram(self, request):
        household = self._owner_household(request)
        try:
            days = int(request.query_params.get("days") or aggregations.HISTOGRAM_DAYS)
        except (TypeError, ValueError):
            days = aggregations.HISTOGRAM_DAYS
        days = max(1, min(days, 90))
        return Response(
            aggregations.histogram(household.id, days=days), status=status.HTTP_200_OK
        )

    @action(detail=False, methods=["get"])
    def recent(self, request):
        household = self._owner_household(request)
        feature = (request.query_params.get("feature") or "").strip() or None
        return Response(
            {"results": aggregations.recent(household.id, feature=feature)},
            status=status.HTTP_200_OK,
        )
