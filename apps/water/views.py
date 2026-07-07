"""
Water REST API views.

Reading writes (create/update) delegate to ``water.services`` — the single
write path shared with the agent — so validation lives in one place
(``WaterReadingSerializer``). Deleting a reading has no derived state to
refresh (consumption is computed on the fly), so destroy is the default one.
"""
from datetime import date

from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHouseholdMember

from . import services
from .models import WaterReading
from .serializers import WaterReadingSerializer


class WaterReadingViewSet(viewsets.ModelViewSet):
    """Readings CRUD — newest first."""

    permission_classes = [IsHouseholdMember]
    serializer_class = WaterReadingSerializer

    def get_queryset(self):
        qs = WaterReading.objects.for_user_households(self.request.user)
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs.order_by("-reading_date")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.household:
            ctx["household_id"] = self.request.household.id
        return ctx

    def perform_create(self, serializer):
        data = serializer.validated_data
        serializer.instance = services.create_water_reading(
            self.request.household,
            self.request.user,
            reading_date=data["reading_date"],
            index_m3=data["index_m3"],
        )

    def perform_update(self, serializer):
        fields = {
            k: v
            for k, v in serializer.validated_data.items()
            if k in ("reading_date", "index_m3")
        }
        serializer.instance = services.update_water_reading(
            self.request.household, self.request.user, serializer.instance, fields=fields
        )


class WaterConsumptionSummaryView(APIView):
    """Server-side aggregation of the reading-derived consumption."""

    permission_classes = [IsHouseholdMember]

    def get(self, request):
        household = request.household
        if not household:
            raise ValidationError({"household_id": _("A valid household context is required.")})

        granularity = request.query_params.get("granularity", "day")
        if granularity not in services.GRANULARITIES:
            raise ValidationError({"granularity": [_("Must be one of: day, month, year.")]})

        try:
            date_from = date.fromisoformat(request.query_params.get("date_from", ""))
            date_to = date.fromisoformat(request.query_params.get("date_to", ""))
        except ValueError:
            raise ValidationError(
                {"date_from": [_("date_from and date_to must be ISO dates (YYYY-MM-DD).")]}
            )
        if date_to < date_from:
            raise ValidationError({"date_to": [_("date_to must be on or after date_from.")]})

        return Response(
            services.consumption_summary(
                household, granularity=granularity, date_from=date_from, date_to=date_to
            )
        )
