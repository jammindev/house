"""
Registry of entities the agent can list, filter and aggregate structurally.

The structured-read counterpart of ``searchables.py``. Full-text search answers
"the boiler invoice"; it cannot answer "all my overdue tasks" or "how much did
we spend in March" — nothing lexical to match. Each app declares a
``ListableSpec`` from ``apps.py.ready()`` and the single ``list_entities`` tool
covers N entities, with zero touche to ``apps/agent/``.

A spec carries the household-scoped queryset filters it supports (declarative
``ListFilter`` entries), a one-line ``describe`` for compact rendering, and an
optional ``amount_of`` accessor that lets the tool sum amounts over the filtered
set (expenses).
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal

from django.db.models import Model, QuerySet


@dataclass(frozen=True)
class ListFilter:
    """One filter the tool exposes for an entity type.

    ``apply(queryset, value)`` returns the narrowed queryset. ``value`` is always
    the raw string the model sent; the callable owns parsing and may raise
    ``ValueError`` / ``ValidationError`` — the tool turns that into a recoverable
    message for the model.
    """

    name: str
    description: str
    apply: Callable[[QuerySet, str], QuerySet]


@dataclass(frozen=True)
class ListableSpec:
    """Declarative description of a model the agent may list/filter/aggregate."""

    entity_type: str
    """Discriminator used in the ``list_entities`` tool (e.g. 'task')."""

    model: type[Model]
    """The Django model to query — always scoped by ``household_id``."""

    filters: tuple[ListFilter, ...] = ()
    """Filters this entity supports, applied in the order the model sends them."""

    order_by: tuple[str, ...] = ("-created_at",)
    """Default ordering of the listing."""

    describe: Callable[[Model], str] | None = None
    """Optional one-line summary per item (status, dates, amount…) appended to
    the label in the rendered listing."""

    amount_of: Callable[[Model], Decimal | None] | None = None
    """Optional accessor returning the item's monetary amount (or None). When
    set, the tool sums it over the WHOLE filtered set — this is what answers
    "how much did we spend on X"."""


REGISTRY: dict[str, ListableSpec] = {}


def register(spec: ListableSpec) -> None:
    """Add a spec to the registry. Raises if ``entity_type`` is already registered."""
    if spec.entity_type in REGISTRY:
        raise ValueError(
            f"ListableSpec for entity_type={spec.entity_type!r} is already registered"
        )
    REGISTRY[spec.entity_type] = spec


def reset_registry() -> None:
    """Test helper — clears the registry. Do not call from production code."""
    REGISTRY.clear()


def find_spec(entity_type: str) -> ListableSpec | None:
    """Return the registered listable spec for ``entity_type``, or None."""
    return REGISTRY.get(entity_type)


def supported_entity_types() -> list[str]:
    """Stable-sorted list of listable entity types (for recoverable messages)."""
    return sorted(REGISTRY.keys())


def filter_names(spec: ListableSpec) -> list[str]:
    """The filter names a spec supports, in declaration order."""
    return [f.name for f in spec.filters]
