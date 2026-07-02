"""
Registry of entities the agent is allowed to *create*.

The write counterpart of ``searchables.py``. Same philosophy: the agent core
never hardcodes the list of creatable entities — each app declares its own
``WritableSpec`` from ``apps.py.ready()``, so the single ``create_entity`` tool
covers N entities and adding one is ~5 lines with zero touche to ``apps/agent/``.

A spec carries how to *create* one instance (``create``) plus how to turn the
result into a citable, linkable reference (``label_attr`` / ``url_template``) so
the agent can confirm and cite what it just made, and the frontend can offer an
undo.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from django.db.models import Model


@dataclass(frozen=True)
class WritableSpec:
    """Declarative description of a model the agent may create."""

    entity_type: str
    """Discriminator used in the ``create_entity`` tool (e.g. 'task')."""

    create: Callable[..., Model]
    """``create(household, user, fields, *, anchor=None) -> instance``.

    ``fields`` is the raw dict the model produced; the callable is responsible
    for mapping/validating it and for reusing the app's own service/serializer
    (never raw ORM shortcuts that bypass validation). ``anchor`` is the current
    conversation anchor ``(entity_type, object_id)`` or ``None`` — used to
    default a link (e.g. attach the new task to the anchored project)."""

    label_attr: str | Callable[[Model], str]
    """Attribute name or callable producing the created item's human label."""

    url_template: str
    """URL template for the created item's link. Must contain ``{id}``."""


REGISTRY: dict[str, WritableSpec] = {}


def register(spec: WritableSpec) -> None:
    """Add a spec to the registry. Raises if ``entity_type`` is already registered."""
    if spec.entity_type in REGISTRY:
        raise ValueError(
            f"WritableSpec for entity_type={spec.entity_type!r} is already registered"
        )
    REGISTRY[spec.entity_type] = spec


def reset_registry() -> None:
    """Test helper — clears the registry. Do not call from production code."""
    REGISTRY.clear()


def find_spec(entity_type: str) -> WritableSpec | None:
    """Return the registered writable spec for ``entity_type``, or None."""
    return REGISTRY.get(entity_type)


def resolve_label(spec: WritableSpec, instance: Model) -> str:
    """Resolve the label for a created instance using the spec's ``label_attr``."""
    if callable(spec.label_attr):
        return str(spec.label_attr(instance))
    return str(getattr(instance, spec.label_attr, "") or "")


def resolve_url(spec: WritableSpec, instance: Model) -> str:
    """Build the created item's URL path from the spec template."""
    return spec.url_template.format(id=instance.pk)


def supported_entity_types() -> list[str]:
    """Stable-sorted list of creatable entity types (for prompt/description)."""
    return sorted(REGISTRY.keys())


def as_created_dict(spec: WritableSpec, instance: Model) -> dict[str, Any]:
    """Serialize a freshly-created instance into the ``created`` payload shape."""
    return {
        "entity_type": spec.entity_type,
        "id": str(instance.pk),
        "label": resolve_label(spec, instance),
        "url_path": resolve_url(spec, instance),
    }
