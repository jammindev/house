"""
Chicken coop REST API views.

All business writes delegate to ``chickens.services`` — the same functions the
agent writables call — so REST and agent behave identically.
"""
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsHouseholdMember
from interactions.services import create_expense_interaction

from . import services
from .models import Chicken, ChickenEvent, EggLog
from .serializers import (
    ChickenEventSerializer,
    ChickenPurchaseSerializer,
    ChickenSerializer,
    ChickenSettingsSerializer,
    EggLogSerializer,
)


class ChickenViewSet(viewsets.ModelViewSet):
    """Flock register CRUD + per-hen purchase declaration."""

    permission_classes = [IsHouseholdMember]
    serializer_class = ChickenSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']

    def get_queryset(self):
        qs = Chicken.objects.for_user_households(self.request.user).select_related('zone')
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        # ?in_flock=true → only hens currently in the flock (default page filter)
        if self.request.query_params.get('in_flock') == 'true':
            qs = qs.filter(status__in=Chicken.FLOCK_STATUSES)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.household:
            ctx['household_id'] = self.request.household.id
        return ctx

    def perform_create(self, serializer):
        # Validation already ran; re-route through the service for one write path.
        data = {k: v for k, v in serializer.validated_data.items()}
        instance = services.create_chicken(
            self.request.household,
            self.request.user,
            name=data.get('name', ''),
            breed=data.get('breed', ''),
            color=data.get('color', ''),
            hatched_on=data.get('hatched_on'),
            acquired_on=data.get('acquired_on'),
            status=data.get('status'),
            notes=data.get('notes', ''),
            zone_id=data.get('zone_id'),
        )
        serializer.instance = instance

    def perform_update(self, serializer):
        fields = {k: v for k, v in serializer.validated_data.items()}
        instance = services.update_chicken(
            self.request.household, self.request.user, serializer.instance, fields=fields
        )
        serializer.instance = instance

    def perform_destroy(self, instance):
        services.delete_chicken(self.request.household, self.request.user, instance)

    @action(detail=True, methods=['post'], url_path='purchase')
    def purchase(self, request, pk=None):
        """Declare an expense on this hen (purchase of the hen, gear…) — US-7.

        Creates an Interaction(type=expense, kind='chickens_purchase') through
        the shared service; no side-effect on the hen itself.
        """
        chicken = self.get_object()
        serializer = ChickenPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        interaction = create_expense_interaction(
            source=chicken,
            user=request.user,
            amount=serializer.validated_data.get('amount'),
            supplier=serializer.validated_data.get('supplier', '') or '',
            occurred_at=serializer.validated_data.get('occurred_at') or timezone.now(),
            notes=serializer.validated_data.get('notes', '') or '',
            kind='chickens_purchase',
        )

        payload = ChickenSerializer(chicken, context=self.get_serializer_context()).data
        payload['interaction_id'] = str(interaction.id)
        return Response(payload, status=status.HTTP_201_CREATED)


class EggLogViewSet(viewsets.ModelViewSet):
    """Daily egg logs. POST is an upsert on (household, date) — 201 created, 200 updated."""

    permission_classes = [IsHouseholdMember]
    serializer_class = EggLogSerializer

    def get_queryset(self):
        qs = EggLog.objects.for_user_households(self.request.user)
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        date_from = self.request.query_params.get('date_from', '').strip()
        date_to = self.request.query_params.get('date_to', '').strip()
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        egg_log, created = services.log_eggs(
            request.household,
            request.user,
            date=serializer.validated_data['date'],
            count=serializer.validated_data['count'],
            note=serializer.validated_data.get('note', ''),
        )
        out = self.get_serializer(egg_log)
        return Response(
            out.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def perform_destroy(self, instance):
        services.delete_egg_log(self.request.household, self.request.user, instance)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Egg-laying stats: today, 7/30-day averages, month total, 30-day series."""
        return Response(services.egg_stats(request.household))


class ChickenEventViewSet(viewsets.ModelViewSet):
    """Flock journal CRUD, filterable by hen."""

    permission_classes = [IsHouseholdMember]
    serializer_class = ChickenEventSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['type', 'chicken']

    def get_queryset(self):
        qs = ChickenEvent.objects.for_user_households(self.request.user).select_related('chicken')
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.household:
            ctx['household_id'] = self.request.household.id
        return ctx

    def perform_create(self, serializer):
        data = serializer.validated_data
        instance = services.create_event(
            self.request.household,
            self.request.user,
            type=data['type'],
            title=data['title'],
            occurred_on=data.get('occurred_on'),
            chicken=data.get('chicken'),
            notes=data.get('notes', ''),
            reminder_due_date=data.get('reminder_due_date'),
        )
        serializer.instance = instance

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        services.delete_event(self.request.household, self.request.user, instance)


class ChickenSettingsView(APIView):
    """GET/PUT the household's module settings (feed tracker link) — US-8."""

    permission_classes = [IsHouseholdMember]

    def get(self, request):
        settings_obj = services.get_settings(request.household)
        return Response(
            ChickenSettingsSerializer(
                settings_obj, context={'household_id': request.household.id}
            ).data
        )

    def put(self, request):
        settings_obj = services.get_settings(request.household)
        serializer = ChickenSettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,
            context={'household_id': request.household.id},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


class ChickenSummaryView(APIView):
    """GET the module summary (dashboard widget + page header) — US-9/US-10."""

    permission_classes = [IsHouseholdMember]

    def get(self, request):
        return Response(services.flock_summary(request.household))
