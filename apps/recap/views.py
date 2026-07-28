"""Household recap REST API — read-only (parcours 27 lot 3).

A recap does not get edited: it is a memory. ``list`` is the sober history,
``retrieve``/``latest`` are the single recap the story page renders.
"""
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsHouseholdMember

from .models import HouseholdRecap
from .serializers import HouseholdRecapSerializer
from .service import get_or_generate_recap, last_closed_month


class HouseholdRecapViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only monthly recaps of the household."""

    permission_classes = [IsHouseholdMember]
    serializer_class = HouseholdRecapSerializer
    lookup_field = "month"
    lookup_value_regex = r"\d{4}-\d{2}"

    def get_queryset(self):
        qs = HouseholdRecap.objects.for_user_households(self.request.user)
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # Single-recap views get the warm captions; the history list stays cheap.
        ctx["polish"] = self.action in ("latest", "retrieve")
        ctx["disabled_chapters"] = getattr(
            self.request.user, "recap_disabled_chapters", None
        ) or ()
        return ctx

    @action(detail=False, methods=["get"])
    def chapters(self, request):
        """GET /api/recap/chapters/ — the chapter keys this household can be told.

        Served rather than hardcoded in the client for two reasons: a front-side list
        would silently drift from ``CHAPTER_SPECS``, and the gating belongs here — a
        household with the photos module off must not be offered a « Souvenirs »
        toggle for a chapter it will never receive.
        """
        from .chapters import active_chapter_specs

        household = request.household
        if household is None:
            return Response([])
        return Response([spec.key for spec in active_chapter_specs(household)])

    @action(detail=False, methods=["get"])
    def latest(self, request):
        """GET /api/recap/latest/ — ensure + return the last closed month's recap.

        Returns 204 when the month has too little to tell (``RECAP_MIN_CARDS``): the
        snapshot still exists and stays browsable from the history, but there is no
        story to open. « Rien à raconter » is a legitimate answer, not an error.
        """
        from django.conf import settings

        household = request.household
        if household is None:
            return Response(status=status.HTTP_204_NO_CONTENT)

        recap = get_or_generate_recap(household, last_closed_month(household))
        if recap.card_count < int(getattr(settings, "RECAP_MIN_CARDS", 3)):
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(self.get_serializer(recap).data)
