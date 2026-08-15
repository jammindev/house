"""
Orchard REST API views.

Every business write delegates to ``orchard.services`` — the same functions the
agent writables call — so REST and agent cannot drift apart.
"""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsHouseholdMember
from documents.mixins import DocumentLinkActionsMixin

from . import queries, services
from .models import Harvest, Tree, TreeEvent
from .serializers import HarvestSerializer, TreeEventSerializer, TreeSerializer


def _csv_param(request, name):
    """Split a comma-separated query param into a clean list (empty → None)."""
    raw = request.query_params.get(name)
    if raw is None:
        return None
    values = [v.strip() for v in raw.split(',') if v.strip()]
    return values or None


class TreeViewSet(DocumentLinkActionsMixin, viewsets.ModelViewSet):
    """Orchard register CRUD + document/photo links."""

    permission_classes = [IsHouseholdMember]
    serializer_class = TreeSerializer

    def get_queryset(self):
        qs = Tree.objects.for_user_households(self.request.user).select_related(
            'zone', 'household'
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)

        zone_ids = _csv_param(self.request, 'zone')
        if zone_ids:
            qs = qs.filter(zone_id__in=zone_ids)

        kinds = _csv_param(self.request, 'kind')
        if kinds:
            qs = qs.filter(kind__in=kinds)

        # Default view is the living orchard. Dead and removed subjects keep their
        # harvest history — they are filtered out, never deleted.
        statuses = _csv_param(self.request, 'status')
        if statuses == ['all']:
            return qs
        if statuses:
            return qs.filter(status__in=statuses)
        return qs.filter(status__in=Tree.LIVING_STATUSES)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.household:
            ctx['household_id'] = self.request.household.id
        return ctx

    def perform_create(self, serializer):
        data = dict(serializer.validated_data)
        serializer.instance = services.create_tree(
            self.request.household,
            self.request.user,
            name=data.get('name', ''),
            zone_id=data.get('zone_id'),
            kind=data.get('kind'),
            species=data.get('species', ''),
            rootstock=data.get('rootstock', ''),
            planted_on=data.get('planted_on'),
            flowering_start_month=data.get('flowering_start_month'),
            flowering_end_month=data.get('flowering_end_month'),
            status=data.get('status'),
            notes=data.get('notes', ''),
        )

    def perform_update(self, serializer):
        serializer.instance = services.update_tree(
            self.request.household,
            self.request.user,
            serializer.instance,
            fields=dict(serializer.validated_data),
        )

    def perform_destroy(self, instance):
        services.delete_tree(self.request.household, self.request.user, instance)


class TreeEventViewSet(viewsets.ModelViewSet):
    """Care journal CRUD."""

    permission_classes = [IsHouseholdMember]
    serializer_class = TreeEventSerializer

    def get_queryset(self):
        qs = TreeEvent.objects.for_user_households(self.request.user).select_related(
            'tree', 'household'
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)

        tree_ids = _csv_param(self.request, 'tree')
        if tree_ids:
            qs = qs.filter(tree_id__in=tree_ids)

        types = _csv_param(self.request, 'type')
        if types:
            qs = qs.filter(type__in=types)

        date_from = self.request.query_params.get('from')
        if date_from:
            qs = qs.filter(occurred_on__gte=date_from)
        date_to = self.request.query_params.get('to')
        if date_to:
            qs = qs.filter(occurred_on__lte=date_to)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.household:
            ctx['household_id'] = self.request.household.id
        return ctx

    def perform_create(self, serializer):
        data = dict(serializer.validated_data)
        serializer.instance = services.create_event(
            self.request.household,
            self.request.user,
            tree=data.get('tree'),
            type=data.get('type'),
            title=data.get('title', ''),
            occurred_on=data.get('occurred_on'),
            notes=data.get('notes', ''),
        )

    def perform_update(self, serializer):
        serializer.instance = services.update_event(
            self.request.household,
            self.request.user,
            serializer.instance,
            fields=dict(serializer.validated_data),
        )

    def perform_destroy(self, instance):
        services.delete_event(self.request.household, self.request.user, instance)


class HarvestViewSet(viewsets.ModelViewSet):
    """Harvest CRUD."""

    permission_classes = [IsHouseholdMember]
    serializer_class = HarvestSerializer

    def get_queryset(self):
        qs = Harvest.objects.for_user_households(self.request.user).select_related(
            'tree', 'household'
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)

        tree_ids = _csv_param(self.request, 'tree')
        if tree_ids:
            qs = qs.filter(tree_id__in=tree_ids)

        season = self.request.query_params.get('season')
        if season:
            qs = qs.filter(harvested_on__year=season)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.household:
            ctx['household_id'] = self.request.household.id
        return ctx

    def perform_create(self, serializer):
        data = dict(serializer.validated_data)
        serializer.instance = services.create_harvest(
            self.request.household,
            self.request.user,
            tree=data.get('tree'),
            quantity=data.get('quantity'),
            unit=data.get('unit'),
            harvested_on=data.get('harvested_on'),
            notes=data.get('notes', ''),
        )

    def perform_update(self, serializer):
        serializer.instance = services.update_harvest(
            self.request.household,
            self.request.user,
            serializer.instance,
            fields=dict(serializer.validated_data),
        )

    def perform_destroy(self, instance):
        services.delete_harvest(self.request.household, self.request.user, instance)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Season series — orchard-wide, or for one subject with ``?tree=``.

        One endpoint for both readings: the page shows the orchard's current
        season, the subject sheet shows its own history. Two endpoints would be
        two definitions of the same total.
        """
        tree_id = request.query_params.get('tree')
        try:
            seasons = int(request.query_params.get('seasons', queries.DEFAULT_SEASON_COUNT))
        except (TypeError, ValueError):
            seasons = queries.DEFAULT_SEASON_COUNT

        if tree_id:
            # Scope check before aggregating: an unscoped id would leak another
            # household's totals through a filter.
            if not Tree.objects.filter(
                household_id=request.household.id, pk=tree_id
            ).exists():
                return Response({'detail': 'Unknown subject.'}, status=404)

        return Response(
            queries.harvest_series(
                request.household, tree=tree_id or None, seasons=max(1, min(seasons, 20))
            )
        )
