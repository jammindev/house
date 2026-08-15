"""
Orchard services — single source of truth for writes.

Both the REST viewsets and the agent's ``create_entity``/``update_entity``
writables call these functions, so validation (through the serializers), the
household scoping and the defaults live in exactly one place. Nothing here
touches the ORM directly for a business write.
"""
from __future__ import annotations

from uuid import UUID

from core.timezones import household_today

from .models import CareRule, Harvest, Tree, TreeEvent
from .serializers import (
    CareRuleSerializer,
    HarvestSerializer,
    TreeEventSerializer,
    TreeSerializer,
)


# --- subjects -----------------------------------------------------------------


def create_tree(
    household,
    user,
    *,
    name: str,
    zone_id,
    kind: str | None = None,
    species: str = '',
    rootstock: str = '',
    planted_on=None,
    flowering_start_month=None,
    flowering_end_month=None,
    status: str | None = None,
    notes: str = '',
) -> Tree:
    """Create a subject for ``household`` on behalf of ``user`` (REST + agent)."""
    payload: dict = {'name': name, 'zone_id': zone_id}
    if kind:
        payload['kind'] = kind
    if species:
        payload['species'] = species
    if rootstock:
        payload['rootstock'] = rootstock
    if planted_on is not None:
        payload['planted_on'] = planted_on
    if flowering_start_month is not None:
        payload['flowering_start_month'] = flowering_start_month
    if flowering_end_month is not None:
        payload['flowering_end_month'] = flowering_end_month
    if status:
        payload['status'] = status
    if notes:
        payload['notes'] = notes

    serializer = TreeSerializer(data=payload, context={'household_id': household.id})
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


TREE_UPDATABLE_FIELDS = frozenset({
    'name', 'kind', 'species', 'rootstock', 'planted_on',
    'flowering_start_month', 'flowering_end_month', 'status', 'notes', 'zone_id',
})


def update_tree(household, user, tree: Tree, *, fields: dict) -> Tree:
    """Update a subject — shared by the REST PATCH and the agent's ``update_entity``."""
    payload = {k: v for k, v in fields.items() if k in TREE_UPDATABLE_FIELDS}
    serializer = TreeSerializer(
        tree, data=payload, partial=True, context={'household_id': household.id}
    )
    serializer.is_valid(raise_exception=True)
    return serializer.save(updated_by=user)


def delete_tree(household, user, tree: Tree) -> None:
    """Hard delete a subject — its journal and harvests cascade."""
    if tree.household_id != household.id:
        raise ValueError("delete_tree: tree belongs to another household")
    tree.delete()


def resolve_tree(household, raw) -> Tree:
    """Find a subject by id **or by name**, scoped to the household.

    A household says « le prunier », never a UUID — so the agent needs to look up
    by name. An ambiguous name is **refused with the candidates named** rather
    than resolved at random: silently picking one of two plum trees would write a
    harvest onto the wrong subject, and nothing would ever say so.
    """
    text = str(raw or '').strip()
    if not text:
        raise ValueError("a tree is required (its name or its id)")

    try:
        UUID(text)
    except (ValueError, AttributeError, TypeError):
        pass
    else:
        tree = Tree.objects.filter(household_id=household.id, pk=text).first()
        if tree is not None:
            return tree

    scoped = Tree.objects.filter(household_id=household.id)
    matches = list(scoped.filter(name__iexact=text)) or list(
        scoped.filter(name__icontains=text)[:5]
    )
    if not matches:
        raise ValueError(f"no subject matching {text!r} in this orchard")
    if len(matches) > 1:
        names = ', '.join(t.name for t in matches)
        raise ValueError(f"{text!r} matches several subjects ({names}) — be more specific")
    return matches[0]


def tree_tab_counts(tree: Tree) -> dict:
    """Counts behind the detail tabs — computed on retrieve only."""
    return {
        'events': tree.events.count(),
        'harvests': tree.harvests.count(),
        'documents': tree.document_links.count(),
    }


# --- journal ------------------------------------------------------------------


def create_event(
    household,
    user,
    *,
    tree,
    type: str,
    title: str,
    occurred_on=None,
    notes: str = '',
    care_rule=None,
) -> TreeEvent:
    """Add a journal entry. ``occurred_on`` defaults to **the household's** today."""
    payload = {
        'tree': getattr(tree, 'pk', tree),
        'type': type,
        'title': title,
        'occurred_on': occurred_on or household_today(household),
        'notes': notes or '',
    }
    if care_rule is not None:
        payload['care_rule'] = getattr(care_rule, 'pk', care_rule)
    serializer = TreeEventSerializer(data=payload, context={'household_id': household.id})
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


EVENT_UPDATABLE_FIELDS = frozenset({'type', 'occurred_on', 'title', 'notes'})


def update_event(household, user, event: TreeEvent, *, fields: dict) -> TreeEvent:
    payload = {k: v for k, v in fields.items() if k in EVENT_UPDATABLE_FIELDS}
    serializer = TreeEventSerializer(
        event, data=payload, partial=True, context={'household_id': household.id}
    )
    serializer.is_valid(raise_exception=True)
    return serializer.save(updated_by=user)


def delete_event(household, user, event: TreeEvent) -> None:
    if event.household_id != household.id:
        raise ValueError("delete_event: event belongs to another household")
    event.delete()


# --- harvests -----------------------------------------------------------------


def create_harvest(
    household,
    user,
    *,
    tree,
    quantity,
    unit: str | None = None,
    harvested_on=None,
    notes: str = '',
) -> Harvest:
    """Record a picking. Several per season and per subject — never an upsert.

    One picks an apple tree over three weekends; folding those into one row would
    lose the only thing the household actually observed.
    """
    payload = {
        'tree': getattr(tree, 'pk', tree),
        'quantity': quantity,
        'unit': unit or Harvest.Unit.KG,
        'harvested_on': harvested_on or household_today(household),
        'notes': notes or '',
    }
    serializer = HarvestSerializer(data=payload, context={'household_id': household.id})
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


HARVEST_UPDATABLE_FIELDS = frozenset({'quantity', 'unit', 'harvested_on', 'notes'})


def update_harvest(household, user, harvest: Harvest, *, fields: dict) -> Harvest:
    payload = {k: v for k, v in fields.items() if k in HARVEST_UPDATABLE_FIELDS}
    serializer = HarvestSerializer(
        harvest, data=payload, partial=True, context={'household_id': household.id}
    )
    serializer.is_valid(raise_exception=True)
    return serializer.save(updated_by=user)


def delete_harvest(household, user, harvest: Harvest) -> None:
    if harvest.household_id != household.id:
        raise ValueError("delete_harvest: harvest belongs to another household")
    harvest.delete()


# --- seasonal care rules ------------------------------------------------------


def create_rule(
    household,
    user,
    *,
    name: str,
    start_month: int,
    end_month: int,
    event_type: str | None = None,
    tree=None,
    kind: str = '',
    emoji: str = '',
    notes: str = '',
) -> CareRule:
    """Create a seasonal rule (REST + agent)."""
    payload: dict = {
        'name': name,
        'start_month': start_month,
        'end_month': end_month,
        'kind': kind or '',
        'emoji': emoji or '',
        'notes': notes or '',
    }
    if event_type:
        payload['event_type'] = event_type
    if tree is not None:
        payload['tree'] = getattr(tree, 'pk', tree)

    serializer = CareRuleSerializer(data=payload, context={'household_id': household.id})
    serializer.is_valid(raise_exception=True)
    return serializer.save(household=household, created_by=user)


RULE_UPDATABLE_FIELDS = frozenset({
    'name', 'emoji', 'start_month', 'end_month', 'event_type', 'tree', 'kind',
    'is_active', 'notes',
})


def update_rule(household, user, rule: CareRule, *, fields: dict) -> CareRule:
    payload = {k: v for k, v in fields.items() if k in RULE_UPDATABLE_FIELDS}
    serializer = CareRuleSerializer(
        rule, data=payload, partial=True, context={'household_id': household.id}
    )
    serializer.is_valid(raise_exception=True)
    return serializer.save(updated_by=user)


def delete_rule(household, user, rule: CareRule) -> None:
    """Drop a cadence. Its journal entries survive (``care_rule`` is SET_NULL)."""
    if rule.household_id != household.id:
        raise ValueError("delete_rule: rule belongs to another household")
    rule.delete()


def complete_rule(household, user, rule: CareRule, tree, *, occurred_on=None, notes: str = ''):
    """« C'est fait » — writes the journal entry that satisfies the rule.

    This is the **only** path that satisfies a rule, and it does so by adding a
    fact to the journal rather than by stamping a date on the cadence. The due
    state then rolls back on its own when that entry is deleted, because it was
    never stored (same design as ``ChickenChore``).
    """
    from .queries import rule_targets

    tree_id = getattr(tree, 'pk', tree)
    if not rule_targets(rule).filter(pk=tree_id).exists():
        raise ValueError("complete_rule: this rule does not concern that subject")

    resolved = Tree.objects.get(pk=tree_id)
    return create_event(
        household,
        user,
        tree=resolved,
        type=rule.event_type,
        title=f"{rule.name} — {resolved.name}",
        occurred_on=occurred_on,
        notes=notes,
        care_rule=rule,
    )
