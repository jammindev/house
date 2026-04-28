"""Read-only endpoint that aggregates household alerts."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHouseholdMember

from .services import build_alerts_summary


class AlertsSummaryView(APIView):
    """GET /api/alerts/summary/ — overdue tasks, expiring warranties, due maintenances."""

    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get(self, request, *args, **kwargs):
        household = request.household
        if household is None:
            return Response(
                {"overdue_tasks": [], "expiring_warranties": [], "due_maintenances": [], "total": 0}
            )
        return Response(build_alerts_summary(household))
