"""
In-app digest endpoint.

``GET /api/agent/digest/`` composes *today's* digest for the requesting user in
the active household and returns it as structured sections, plus the metadata
the settings UI needs (which sections are available, which the user turned off).
The digest is computed on demand and never persisted — it always reflects the
current household state, which also serves the "generate now" preview.
"""
from __future__ import annotations

from django.utils import timezone, translation
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHouseholdMember

from .collectors import SECTION_KEYS
from .service import active_section_specs, build_digest


def _recipient_language(user, household) -> str:
    if getattr(user, "locale", None):
        return user.locale
    return getattr(household, "preferred_language", None) or "en"


class DigestView(APIView):
    """Today's composed digest for the current user + section metadata."""

    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get(self, request):
        household = request.household
        user = request.user
        today = timezone.localdate()

        disabled = [k for k in (user.digest_disabled_sections or []) if k in SECTION_KEYS]

        with translation.override(_recipient_language(user, household)):
            result = build_digest(
                household, user, today=today, disabled_sections=disabled
            )
            sections = [
                {
                    "key": s.key,
                    "emoji": s.emoji,
                    "title": s.title,
                    "lines": s.lines,
                }
                for s in result.sections
            ]

        available = [
            {"key": spec.key, "module": spec.module}
            for spec in active_section_specs(household)
        ]
        return Response(
            {
                "generated_on": today.isoformat(),
                "sections": sections,
                "available_sections": available,
                "disabled_sections": disabled,
            }
        )
