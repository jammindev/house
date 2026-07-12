"""
Proactive-pings REST API.

Two endpoints, both delegating to ``pings.services`` (the same functions the
scheduler uses), so the module-gating and defaults logic lives in one place:

- ``GET /api/pings/`` — available pings for the active household, merged with
  the requesting user's preferences.
- ``PUT /api/pings/<ping_type>/`` — opt in/out and set the local send time.
"""
from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHouseholdMember

from . import services
from .serializers import PingRowSerializer, PingUpdateSerializer


class PingListView(APIView):
    permission_classes = [IsHouseholdMember]

    def get(self, request):
        rows = services.available_pings(request.household, request.user)
        return Response(PingRowSerializer(rows, many=True).data)


class PingPreferenceView(APIView):
    permission_classes = [IsHouseholdMember]

    def put(self, request, ping_type: str):
        serializer = PingUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            pref = services.upsert_preference(
                request.household,
                request.user,
                ping_type=ping_type,
                enabled=serializer.validated_data["enabled"],
                send_at=serializer.validated_data.get("send_at"),
            )
        except LookupError:
            return Response(status=status.HTTP_404_NOT_FOUND)
        row = {
            "ping_type": pref.ping_type,
            "module": None,
            "enabled": pref.enabled,
            "send_at": pref.send_at,
        }
        from .registry import find_spec

        spec = find_spec(pref.ping_type)
        if spec is not None:
            row["module"] = spec.module
        return Response(PingRowSerializer(row).data)
