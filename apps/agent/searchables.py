"""
Registry of searchable entities for the agent's retrieval layer.

Each app contributes its own searchable specs from `apps.py.ready()`.
The agent does not know the list — adding a module = 5 lines, zero touche to apps/agent/.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from django.db.models import Model


@dataclass(frozen=True)
class SearchableSpec:
    """Declarative description of a model that should be searched by the agent."""

    entity_type: str
    """Free-form discriminator returned in Hit.entity_type (e.g. 'document', 'task')."""

    model: type[Model]
    """The Django model class to query."""

    search_fields: tuple[str, ...]
    """Tuple of field names participating in the SearchVector."""

    label_attr: str | Callable[[Model], str]
    """Attribute name or callable producing the human-readable label."""

    url_template: str
    """URL template used to build Hit.url_path. Must contain `{id}`."""


REGISTRY: list[SearchableSpec] = []


def register(spec: SearchableSpec) -> None:
    """Add a spec to the registry. Raises if (entity_type) is already registered."""
    for existing in REGISTRY:
        if existing.entity_type == spec.entity_type:
            raise ValueError(
                f"SearchableSpec for entity_type={spec.entity_type!r} is already registered"
            )
    REGISTRY.append(spec)


def reset_registry() -> None:
    """Test helper — clears the registry. Do not call from production code."""
    REGISTRY.clear()


def resolve_label(spec: SearchableSpec, instance: Model) -> str:
    """Resolve the label for a given instance using the spec's label_attr."""
    if callable(spec.label_attr):
        return str(spec.label_attr(instance))
    return str(getattr(instance, spec.label_attr, "") or "")
