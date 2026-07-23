"""Briefings REST API."""
from django.db.models import Q
from rest_framework import filters, viewsets

from core.permissions import IsHouseholdMember

from .models import Briefing
from .permissions import CanManageBriefing
from .serializers import BriefingSerializer
from .services import create_briefing, update_briefing


class BriefingViewSet(viewsets.ModelViewSet):
    """CRUD for a household's briefings.

    The list is visibility-filtered: every member sees the household's **shared**
    briefings plus their **own private** ones. Writes delegate to
    ``briefings.services`` (the single write path).
    """

    permission_classes = [IsHouseholdMember, CanManageBriefing]
    serializer_class = BriefingSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Briefing.objects.for_user_households(self.request.user).select_related(
            "created_by"
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        # Private briefings are visible only to their creator.
        return qs.filter(Q(is_private=False) | Q(created_by=self.request.user))

    def perform_create(self, serializer):
        data = serializer.validated_data
        briefing = create_briefing(
            self.request.household,
            self.request.user,
            title=data.get("title", ""),
            prompt=data.get("prompt", ""),
            condition=data.get("condition", ""),
            channel=data.get("channel", Briefing.Channel.TELEGRAM),
            briefing_type=data.get("briefing_type", Briefing.Type.RECURRING),
            is_private=data.get("is_private", False),
            is_active=data.get("is_active", False),
        )
        serializer.instance = briefing

    def perform_update(self, serializer):
        update_briefing(
            self.request.household,
            self.request.user,
            serializer.instance,
            fields=serializer.validated_data,
        )
