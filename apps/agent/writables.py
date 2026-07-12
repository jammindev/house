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

    update: Callable[..., Model] | None = None
    """Optional ``update(household, user, instance, fields) -> instance``.

    Same rules as ``create``: reuse the app's own service/serializer, never raw
    ORM writes. When None, the entity is creatable but not updatable and
    ``update_entity`` refuses it."""

    updatable_fields: tuple[str, ...] = ()
    """Field names the agent may change through ``update_entity``. Anything else
    in the tool input is dropped before calling ``update``. Also drives the undo
    snapshot (previous values of exactly these keys)."""

    resolve: Callable[..., Model | None] | None = None
    """Optional ``resolve(household, raw_id) -> instance | None`` for updates.

    Needed because a writable entity_type is not always a searchable one
    (``'note'`` is an ``Interaction`` restricted to ``type='note'``). Must scope
    by household and may narrow further (only notes, not private items of other
    users…). May raise ``ValueError``/``ValidationError`` on malformed ids —
    the tool turns that into a recoverable message."""

    module: str | None = None
    """Optional module key (households.modules.OPTIONAL_MODULES). When the
    household disabled that module, ``create_entity``/``update_entity`` refuse
    the entity type. None = core."""

    delete: Callable[..., None] | None = None
    """Optional ``delete(household, user, object_id) -> None`` — the undo of
    ``create``.

    Backend mirror of the frontend's ``UNDO_HANDLERS``: it must do exactly what
    the entity's DELETE API does (archive for a task, hard delete for a note),
    by reusing the app's own service. Must scope by household and raise
    ``LookupError`` when the item no longer exists — callers treat that as
    "already undone" so a double-tap stays idempotent. When None, channels
    simply don't offer an undo for this entity."""


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


def can_delete(entity_type: str) -> bool:
    """True if ``entity_type`` is registered and exposes an undo (``delete``)."""
    spec = REGISTRY.get(entity_type)
    return spec is not None and spec.delete is not None


def delete_created(entity_type: str, household, user, object_id) -> None:
    """Undo a created entity through its ``WritableSpec.delete``.

    The single entry point channels use to reverse a creation (the backend
    mirror of the frontend's ``UNDO_HANDLERS``). Raises ``LookupError`` if the
    type isn't undoable or the item is already gone — callers treat that as
    "nothing to undo" so a double-tap is idempotent.
    """
    spec = REGISTRY.get(entity_type)
    if spec is None or spec.delete is None:
        raise LookupError(f"{entity_type!r} is not undoable")
    spec.delete(household, user, object_id)


def supported_entity_types() -> list[str]:
    """Stable-sorted list of creatable entity types (for prompt/description)."""
    return sorted(REGISTRY.keys())


def updatable_entity_types() -> list[str]:
    """Stable-sorted list of entity types the agent may update."""
    return sorted(et for et, spec in REGISTRY.items() if spec.update is not None)


def as_created_dict(spec: WritableSpec, instance: Model) -> dict[str, Any]:
    """Serialize a freshly-created instance into the ``created`` payload shape."""
    return {
        "entity_type": spec.entity_type,
        "id": str(instance.pk),
        "label": resolve_label(spec, instance),
        "url_path": resolve_url(spec, instance),
    }


def as_updated_dict(
    spec: WritableSpec,
    instance: Model,
    *,
    previous: dict[str, Any],
    changed: dict[str, Any],
) -> dict[str, Any]:
    """Serialize an updated instance into the ``updated`` payload shape.

    ``previous`` holds the JSON-safe values of the changed fields BEFORE the
    update — the frontend's undo re-applies them through the entity's normal
    update API.
    """
    return {
        "entity_type": spec.entity_type,
        "id": str(instance.pk),
        "label": resolve_label(spec, instance),
        "url_path": resolve_url(spec, instance),
        "previous": previous,
        "changed": changed,
    }
