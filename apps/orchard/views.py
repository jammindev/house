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
from .models import CareRule, Harvest, Tree, TreeEvent
from .serializers import (
    CareRuleSerializer,
    TreePurchaseSerializer,
    HarvestSerializer,
    TreeEventSerializer,
    TreeSerializer,
)


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

    @action(detail=True, methods=['post'], url_path='purchase')
    def purchase(self, request, pk=None):
        """Declare what a subject cost — through the shared expense service.

        A tree bought 39 € is a household expense like any other: it must land in
        `/app/money/expenses`, count against a budget, and carry the subject's
        zone. Building an `Interaction` by hand here would give the money a second
        write path, which is exactly what `create_expense_interaction` exists to
        prevent.
        """
        from django.utils import timezone

        from interactions.services import create_expense_interaction, validate_expense_budget

        tree = self.get_object()
        serializer = TreePurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        budget_id = validate_expense_budget(
            tree.household_id, serializer.validated_data.get('budget_id')
        )
        interaction = create_expense_interaction(
            source=tree,
            user=request.user,
            amount=serializer.validated_data.get('amount'),
            supplier=serializer.validated_data.get('supplier', '') or '',
            occurred_at=serializer.validated_data.get('occurred_at') or timezone.now(),
            notes=serializer.validated_data.get('notes', '') or '',
            kind='orchard_purchase',
            budget_id=budget_id,
        )
        payload = TreeSerializer(tree, context=self.get_serializer_context()).data
        payload['interaction_id'] = str(interaction.id)
        return Response(payload, status=201)


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


class CareRuleViewSet(viewsets.ModelViewSet):
    """Seasonal care rules — CRUD, the season panel, and « c'est fait »."""

    permission_classes = [IsHouseholdMember]
    serializer_class = CareRuleSerializer

    def get_queryset(self):
        qs = CareRule.objects.for_user_households(self.request.user).select_related(
            'tree', 'household'
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        if self.request.query_params.get('active') != 'false':
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.household:
            ctx['household_id'] = self.request.household.id
        return ctx

    def list(self, request, *args, **kwargs):
        """Compute every (rule, subject) state **once** for the whole page.

        Serializing rule by rule would recompute the pairs per row — the same
        mistake `compliance.group_result` had to undo when serializing a single
        header relaunched all fourteen detectors.
        """
        rules = list(self.filter_queryset(self.get_queryset()))
        states = queries.rule_states(request.household, rules=rules)
        serializer = self.get_serializer(
            rules, many=True, context={**self.get_serializer_context(), 'rule_states': states}
        )
        return Response(serializer.data)

    def perform_create(self, serializer):
        data = dict(serializer.validated_data)
        serializer.instance = services.create_rule(
            self.request.household,
            self.request.user,
            name=data.get('name', ''),
            start_month=data.get('start_month'),
            end_month=data.get('end_month'),
            event_type=data.get('event_type'),
            tree=data.get('tree'),
            kind=data.get('kind', ''),
            emoji=data.get('emoji', ''),
            notes=data.get('notes', ''),
        )

    def perform_update(self, serializer):
        serializer.instance = services.update_rule(
            self.request.household,
            self.request.user,
            serializer.instance,
            fields=dict(serializer.validated_data),
        )

    def perform_destroy(self, instance):
        services.delete_rule(self.request.household, self.request.user, instance)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        """« C'est fait » on one subject — writes the journal entry, nothing else."""
        rule = self.get_object()
        try:
            event = services.complete_rule(
                request.household,
                request.user,
                rule,
                request.data.get('tree'),
                occurred_on=request.data.get('occurred_on') or None,
                notes=request.data.get('notes') or '',
            )
        except (ValueError, Tree.DoesNotExist) as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(TreeEventSerializer(event).data, status=201)

    @action(detail=True, methods=['post'], url_path='create-task')
    def create_task(self, request, pk=None):
        """Turn an open window into a dated task — on demand, never in the background.

        The module creates **no reminder mechanism of its own**: the app already
        holds three definitions of « en retard », and a fourth would end up
        contradicting them. A rule proposes; the household disposes. Nothing is
        materialised in a background job either — a rule that manufactures its
        own occurrences fills the task list with things nobody asked for, and
        deleting the rule then leaves orphans behind.
        """
        from tasks.services import create_task as create_task_service

        rule = self.get_object()
        tree_id = request.data.get('tree')
        tree = Tree.objects.filter(household_id=request.household.id, pk=tree_id).first()
        if tree is None:
            return Response({'detail': 'Unknown subject.'}, status=400)

        state = next(
            (
                item
                for item in queries.rule_states(request.household, rules=[rule])
                if item['tree'].id == tree.id
            ),
            None,
        )
        if state is None:
            return Response(
                {'detail': 'This rule does not concern that subject.'}, status=400
            )

        task = create_task_service(
            request.household,
            request.user,
            subject=f"{rule.name} — {tree.name}",
            # The deadline is the end of the window, not an invented date: the
            # window is what the gesture actually obeys.
            due_date=state['window_end'],
            zone_ids=[str(tree.zone_id)],
        )
        return Response({'id': str(task.id), 'subject': task.subject}, status=201)

    @action(detail=False, methods=['get'], url_path='season')
    def season(self, request):
        """What the season asks for — the panel that opens the page.

        Returns one row per (rule, subject) that is `due` or `missed`. `missed`
        is **said**, never hidden: a shut window cannot be caught up, but it is
        still the thing the household most needs to know.
        """
        states = queries.rule_states(request.household)
        rows = [
            {
                'rule': str(state['rule'].id),
                'rule_name': state['rule'].name,
                'emoji': state['rule'].emoji,
                'tree': str(state['tree'].id),
                'tree_name': state['tree'].name,
                'state': state['state'],
                'season': state['season'],
                'window_start': state['window_start'],
                'window_end': state['window_end'],
                'last_done_on': state['last_done_on'],
            }
            for state in states
            if state['state'] in ('due', 'missed')
        ]
        rows.sort(key=lambda row: (row['state'] != 'missed', row['rule_name'], row['tree_name']))
        return Response({'rows': rows, 'total': len(rows)})
