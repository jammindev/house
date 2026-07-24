"""
Service helpers used by other apps to auto-create Interactions linked to a
domain object via the polymorphic `(source_content_type, source_object_id)` FK.

The shared piece is the auto-subject (rendered write-time in the creator's
locale via gettext) plus the kind discriminator in metadata. Side-effects
specific to a source model (adjust stock quantity, snapshot equipment fields,
etc.) stay in the calling view — the service only owns the Interaction.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from zones.models import Zone

from .models import Interaction, InteractionZone


# Templates registry: maps a kind discriminator to a translatable subject template.
# Templates use {name} as the source object's display name.
AUTO_SUBJECT_TEMPLATES: dict[str, Any] = {
    "stock_purchase": _("Purchase — {name}"),
    "equipment_purchase": _("Purchase — {name}"),
    "project_purchase": _("Purchase — {name}"),
    "chickens_purchase": _("Purchase — {name}"),
}


def _purchase_kind_for_source(source) -> str:
    """Return the kind discriminator for a purchase action on this source.

    Convention: `<source_app_label>_purchase`. Examples: stock_purchase,
    equipment_purchase. Callers can override with an explicit kind.
    """
    return f"{source._meta.app_label}_purchase"


def _resolve_subject_template(kind: str) -> Any:
    """Find a registered subject template for a kind, fall back to a generic one."""
    if kind in AUTO_SUBJECT_TEMPLATES:
        return AUTO_SUBJECT_TEMPLATES[kind]
    return _("Interaction — {name}")


def _source_name(source) -> str:
    return getattr(source, "name", None) or getattr(source, "title", None) or str(source)


def _build_expense_metadata(
    *,
    kind: str,
    source_name: str | None,
    amount: Decimal | None = None,
    unit_price: Decimal | None = None,
    supplier: str = "",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Single source of truth for the `metadata` shape on expense interactions.

    Both `create_expense_interaction` and `create_manual_expense_interaction`
    flow through this helper, so adding a new key (e.g. `currency`) in the
    future means touching one place.

    `extra` overrides standard keys when collisions occur — intentional escape
    hatch for feature-specific metadata.
    """
    metadata: dict[str, Any] = {
        "kind": kind,
        "source_name": source_name,
        "amount": str(amount) if amount is not None else None,
        "unit_price": str(unit_price) if unit_price is not None else None,
        "supplier": supplier or "",
    }
    if extra:
        metadata.update(extra)
    return metadata


# --- Renovation log ----------------------------------------------------------
#
# A renovation/decoration log entry is a plain Interaction discriminated by
# ``metadata.kind == "renovation"`` (parcours 13). No dedicated model: it reuses
# the existing interaction types and the M2M zones (so one entry can cover many
# rooms — e.g. "changed all the windows"). Structured fields live in metadata,
# built through a single helper for a uniform shape (mirrors expenses).

# element = *what* was renovated. Keys are stored in metadata; labels are
# localized write-time for the auto-composed subject.
RENOVATION_ELEMENTS: dict[str, Any] = {
    "paint": _("Paint"),
    "floor": _("Flooring"),
    "wall": _("Wall"),
    "ceiling": _("Ceiling"),
    "joinery": _("Joinery"),
    "plumbing": _("Plumbing"),
    "electrical": _("Electrical"),
    "heating": _("Heating"),
    "furniture": _("Furniture"),
    "other": _("Other"),
}

# type = *which action* — a curated subset of Interaction.INTERACTION_TYPES.
RENOVATION_TYPES: set[str] = {
    "installation",
    "replacement",
    "upgrade",
    "repair",
    "maintenance",
}

# Auto-subject template for a renovation entry, e.g. "Flooring — Léa's room".
RENOVATION_SUBJECT_TEMPLATE = _("{element} — {name}")


def _build_renovation_metadata(
    *,
    element: str,
    product: str = "",
    brand: str = "",
    reference: str = "",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Single source of truth for the `metadata` shape on renovation entries.

    Adding a standard key later (e.g. ``warranty_until``) means touching one place.
    ``extra`` overrides standard keys on collision — feature-specific escape hatch.
    """
    metadata: dict[str, Any] = {
        "kind": "renovation",
        "element": element,
        "product": product or "",
        "brand": brand or "",
        "reference": reference or "",
    }
    if extra:
        metadata.update(extra)
    return metadata


def _resolve_expense_budget(household_id, budget_id):
    """Resolve an optional budget id to a named ``Budget`` scoped to the household.

    Returns ``None`` when ``budget_id`` is falsy. Raises ``ValueError`` when the
    budget does not belong to the household or is the global budget (the global
    cap covers everything and is never a per-expense assignment target).
    """
    if not budget_id:
        return None
    from budget.models import Budget

    budget = Budget.objects.filter(id=budget_id, household_id=household_id).first()
    if budget is None:
        raise ValueError("budget not found in this household")
    if budget.is_global:
        raise ValueError("cannot attach an expense to the global budget")
    return budget


def _resolve_household_zones(household, zone_ids) -> list[Zone]:
    """Resolve zone ids to Zone instances scoped to the household, order preserved.

    Dedups while keeping the first-seen order (the first zone drives the
    auto-subject). Raises ValueError if any id is missing or out of household.
    """
    ordered_ids: list[UUID] = []
    for raw in zone_ids or []:
        try:
            zid = raw if isinstance(raw, UUID) else UUID(str(raw))
        except (ValueError, TypeError):
            raise ValueError(f"invalid zone id: {raw!r}")
        if zid not in ordered_ids:
            ordered_ids.append(zid)
    if not ordered_ids:
        raise ValueError("at least one zone is required")

    zones_by_id = {
        zone.id: zone
        for zone in Zone.objects.filter(id__in=ordered_ids, household_id=household.id)
    }
    if len(zones_by_id) != len(ordered_ids):
        raise ValueError("one or more zones do not belong to the household")
    return [zones_by_id[zid] for zid in ordered_ids]


def create_renovation_interaction(
    *,
    household,
    user,
    element: str,
    product: str = "",
    brand: str = "",
    reference: str = "",
    interaction_type: str = "installation",
    subject: str | None = None,
    occurred_at: datetime | None = None,
    notes: str = "",
    zone_ids: list[UUID] | None = None,
    extra_metadata: dict[str, Any] | None = None,
) -> Interaction:
    """Create a renovation/decoration log entry (an ``Interaction``) for a household.

    The entry is discriminated by ``metadata.kind == "renovation"``. It carries a
    curated interaction ``type`` (installation/replacement/upgrade/repair/
    maintenance) and structured fields in ``metadata`` (element, product, brand,
    reference). It can be attached to several zones at once (the "all the windows
    in the house" case).

    Args:
        household: Household instance (required).
        user: request.user (created_by + locale provider for the auto-subject).
        element: one of ``RENOVATION_ELEMENTS`` keys (what was renovated).
        product, brand, reference: free-text structured detail.
        interaction_type: one of ``RENOVATION_TYPES`` (defaults to "installation").
        subject: user title. Auto-composed ("{element} — {zone}") when blank,
            rendered write-time in the user's locale, then stored verbatim.
        occurred_at: when the work happened (defaults to now).
        notes: free-text body (stored in ``content``).
        zone_ids: at least one zone; all must belong to the household.
        extra_metadata: merged into the metadata payload.
    """
    if element not in RENOVATION_ELEMENTS:
        raise ValueError(f"unknown renovation element: {element!r}")
    if interaction_type not in RENOVATION_TYPES:
        raise ValueError(f"unsupported renovation type: {interaction_type!r}")

    zones = _resolve_household_zones(household, zone_ids)

    if subject and subject.strip():
        subject_text = subject.strip()
    else:
        subject_text = RENOVATION_SUBJECT_TEMPLATE.format(
            element=str(RENOVATION_ELEMENTS[element]),
            name=zones[0].name,
        )

    metadata = _build_renovation_metadata(
        element=element,
        product=product,
        brand=brand,
        reference=reference,
        extra=extra_metadata,
    )

    with transaction.atomic():
        interaction = Interaction.objects.create(
            household_id=household.id,
            created_by=user,
            subject=subject_text,
            content=notes or "",
            type=interaction_type,
            occurred_at=occurred_at or timezone.now(),
            metadata=metadata,
        )
        for zone in zones:
            InteractionZone.objects.create(interaction=interaction, zone=zone)

    return interaction


def update_renovation_interaction(
    *,
    household,
    user,
    interaction: Interaction,
    fields: dict,
    zone_ids: list[UUID] | None = None,
) -> Interaction:
    """Update a renovation entry — shared by the REST edit action and the agent.

    Only renovation entries (``metadata.kind == "renovation"``) are editable here.
    Scalar fields flow through ``fields`` (element, product, brand, reference,
    interaction_type, subject, notes/content, occurred_at); ``zone_ids`` resyncs
    the M2M when provided (None = leave zones untouched).
    """
    if (interaction.metadata or {}).get("kind") != "renovation":
        raise ValueError("update_renovation_interaction: not a renovation entry")
    if interaction.household_id != household.id:
        raise ValueError("update_renovation_interaction: entry belongs to another household")

    metadata = dict(interaction.metadata or {})
    for key in ("element", "product", "brand", "reference"):
        if key not in fields:
            continue
        value = fields.get(key)
        if key == "element" and value not in RENOVATION_ELEMENTS:
            raise ValueError(f"unknown renovation element: {value!r}")
        metadata[key] = value if key == "element" else (value or "")

    if "interaction_type" in fields:
        new_type = fields.get("interaction_type")
        if new_type not in RENOVATION_TYPES:
            raise ValueError(f"unsupported renovation type: {new_type!r}")
        interaction.type = new_type

    if "subject" in fields:
        subject = (fields.get("subject") or "").strip()
        if not subject:
            raise ValueError("update_renovation_interaction: subject cannot be blank")
        interaction.subject = subject

    if "notes" in fields:
        interaction.content = fields.get("notes") or ""
    elif "content" in fields:
        interaction.content = fields.get("content") or ""

    if "occurred_at" in fields and fields.get("occurred_at") is not None:
        interaction.occurred_at = fields["occurred_at"]

    interaction.metadata = metadata
    interaction.updated_by = user

    with transaction.atomic():
        interaction.save()
        if zone_ids is not None:
            zones = _resolve_household_zones(household, zone_ids)
            interaction.zones.clear()
            for zone in zones:
                InteractionZone.objects.create(interaction=interaction, zone=zone)

    return interaction


def delete_renovation_interaction(*, household, user, interaction: Interaction) -> None:
    """Delete a renovation entry — the undo of ``create_renovation_interaction``.

    Restricted to renovation entries, scoped to the household. A plain hard
    delete, mirroring the interaction DELETE API so the agent's undo and a manual
    delete behave identically.
    """
    if (interaction.metadata or {}).get("kind") != "renovation":
        raise ValueError("delete_renovation_interaction: not a renovation entry")
    if interaction.household_id != household.id:
        raise ValueError("delete_renovation_interaction: entry belongs to another household")
    interaction.delete()


def create_expense_interaction(
    *,
    source,
    user,
    amount: Decimal | None = None,
    unit_price: Decimal | None = None,
    supplier: str = "",
    occurred_at: datetime | None = None,
    notes: str = "",
    extra_metadata: dict[str, Any] | None = None,
    kind: str | None = None,
    budget_id=None,
) -> Interaction:
    """Create an Interaction(type=expense) linked to `source` via polymorphic FK.

    The subject is auto-localized at write time using the user's active locale
    (set by `core.middleware.UserLocaleMiddleware`). The interaction inherits
    the source's household and zone (if any).

    Args:
        source: any HouseholdScopedModel instance (StockItem, Equipment, etc.)
        user: request.user (used as created_by + locale provider)
        amount, unit_price, supplier, occurred_at, notes: expense details
        extra_metadata: feature-specific metadata (delta, unit, etc.) merged
            into the standard payload.
        kind: override the auto-derived kind (e.g. "stock_purchase").

    Side-effects on the source object (adjust quantity, snapshot purchase
    fields, etc.) stay in the caller — this service owns the Interaction only.
    """
    if not hasattr(source, "household_id"):
        raise ValueError(
            "create_expense_interaction: source must be a HouseholdScopedModel "
            f"(got {type(source).__name__})"
        )

    resolved_kind = kind or _purchase_kind_for_source(source)
    template = _resolve_subject_template(resolved_kind)
    name = _source_name(source)
    subject = template.format(name=name)

    metadata = _build_expense_metadata(
        kind=resolved_kind,
        source_name=name,
        amount=amount,
        unit_price=unit_price,
        supplier=supplier,
        extra=extra_metadata,
    )

    source_ct = ContentType.objects.get_for_model(source.__class__)

    budget = _resolve_expense_budget(source.household_id, budget_id)

    with transaction.atomic():
        interaction = Interaction.objects.create(
            household_id=source.household_id,
            created_by=user,
            subject=subject,
            content=notes,
            type="expense",
            occurred_at=occurred_at or timezone.now(),
            amount=amount,
            kind=resolved_kind,
            supplier=supplier or "",
            metadata=metadata,
            source_content_type=source_ct,
            source_object_id=source.pk,
            budget=budget,
        )
        zone = getattr(source, "zone", None)
        if zone is not None:
            InteractionZone.objects.create(interaction=interaction, zone=zone)

    return interaction


def create_manual_expense_interaction(
    *,
    household,
    user,
    subject: str,
    amount: Decimal | None = None,
    supplier: str = "",
    occurred_at: datetime | None = None,
    notes: str = "",
    zone_ids: list[UUID] | None = None,
    extra_metadata: dict[str, Any] | None = None,
    budget_id=None,
    kind: str = "manual",
) -> Interaction:
    """Create an Interaction(type=expense) NOT linked to a domain source object.

    For ad-hoc expenses (restaurant, gift, one-off purchase…) where no domain
    object triggered the action. The subject is provided by the user — no
    gettext template, the user's text is what gets stored.

    Args:
        household: Household instance (required, not derived from a source)
        user: request.user (used as created_by)
        subject: user-provided subject text (required, not blank)
        amount, supplier, occurred_at, notes: expense details
        zone_ids: optional list of zone UUIDs to attach. Each zone must belong
            to the household.
        extra_metadata: feature-specific metadata merged into the standard payload.
        kind: expense discriminator (default "manual"). Pass an explicit kind
            (e.g. "recurring" from a confirmed recurrence) so the ``kind`` column
            and ``metadata.kind`` stay in sync — do NOT slip it through
            ``extra_metadata``.

    metadata.source_name is None to keep the shape uniform with
    `create_expense_interaction` for downstream consumers (RAG agent, exports,
    summary aggregations).
    """
    if not subject or not subject.strip():
        raise ValueError("create_manual_expense_interaction: subject is required")

    metadata = _build_expense_metadata(
        kind=kind,
        source_name=None,
        amount=amount,
        unit_price=None,
        supplier=supplier,
        extra=extra_metadata,
    )

    zones: list[Zone] = []
    if zone_ids:
        zones = list(Zone.objects.filter(id__in=zone_ids, household_id=household.id))
        if len(zones) != len(zone_ids):
            raise ValueError(
                "create_manual_expense_interaction: one or more zones do not "
                "belong to the household"
            )

    budget = _resolve_expense_budget(household.id, budget_id)

    with transaction.atomic():
        interaction = Interaction.objects.create(
            household_id=household.id,
            created_by=user,
            subject=subject.strip(),
            content=notes,
            type="expense",
            occurred_at=occurred_at or timezone.now(),
            amount=amount,
            kind=kind,
            supplier=supplier or "",
            metadata=metadata,
            source_content_type=None,
            source_object_id=None,
            budget=budget,
        )
        for zone in zones:
            InteractionZone.objects.create(interaction=interaction, zone=zone)

    return interaction


def create_note_interaction(
    *,
    household,
    user,
    subject: str,
    content: str = "",
    occurred_at: datetime | None = None,
    project=None,
    zone_ids: list[UUID] | None = None,
) -> Interaction:
    """Create an Interaction(type=note) — a free-form note in the household log.

    Used by the agent's ``create_entity`` tool (entity_type='note'). The subject
    is provided by the user (no gettext template). Optionally linked to a project
    (e.g. an anchored conversation) via the polymorphic source FK, and/or zones.
    No expense metadata: a note carries no amount/supplier, so ``metadata`` stays
    at its model default.

    Args:
        household: Household instance (required).
        user: request.user (used as created_by).
        subject: note title (required, not blank).
        content: note body (optional).
        occurred_at: defaults to now.
        project: optional Project instance or pk to link the note to.
        zone_ids: optional list of zone UUIDs (each must belong to the household).
    """
    if not subject or not subject.strip():
        raise ValueError("create_note_interaction: subject is required")

    source_ct = None
    source_object_id = None
    if project is not None:
        from projects.models import Project

        source_ct = ContentType.objects.get_for_model(Project)
        source_object_id = getattr(project, "pk", project)

    zones: list[Zone] = []
    if zone_ids:
        zones = list(Zone.objects.filter(id__in=zone_ids, household_id=household.id))
        if len(zones) != len(zone_ids):
            raise ValueError(
                "create_note_interaction: one or more zones do not belong to the household"
            )

    with transaction.atomic():
        interaction = Interaction.objects.create(
            household_id=household.id,
            created_by=user,
            subject=subject.strip(),
            content=content or "",
            type="note",
            occurred_at=occurred_at or timezone.now(),
            source_content_type=source_ct,
            source_object_id=source_object_id,
        )
        for zone in zones:
            InteractionZone.objects.create(interaction=interaction, zone=zone)

    return interaction


def update_note_interaction(
    *,
    household,
    user,
    interaction: Interaction,
    fields: dict,
) -> Interaction:
    """Update a note (``Interaction`` type=note) — shared by the agent's ``update_entity``.

    Only ``subject`` and ``content`` are editable, only on notes. Private notes
    of another user are rejected (the resolver should not surface them, this is
    the defensive second layer).
    """
    if interaction.type != "note":
        raise ValueError("update_note_interaction: only notes can be updated")
    if interaction.is_private and interaction.created_by_id != getattr(user, "pk", None):
        raise ValueError("update_note_interaction: cannot edit another user's private note")

    updates: dict = {}
    if "subject" in fields:
        subject = (fields.get("subject") or "").strip()
        if not subject:
            raise ValueError("update_note_interaction: subject cannot be blank")
        updates["subject"] = subject
    if "content" in fields:
        updates["content"] = fields.get("content") or ""
    if not updates:
        return interaction

    for key, value in updates.items():
        setattr(interaction, key, value)
    interaction.updated_by = user
    interaction.save(update_fields=[*updates.keys(), "updated_by", "updated_at"])
    return interaction


def delete_note_interaction(*, household, user, interaction: Interaction) -> None:
    """Delete a note — the undo of ``create_note_interaction``.

    Mirrors the interaction DELETE API (a plain hard delete) so the agent's
    channel undo and a manual delete behave identically. Restricted to notes,
    scoped to the household, and defensive about another user's private note.
    """
    if interaction.type != "note":
        raise ValueError("delete_note_interaction: only notes can be deleted")
    if interaction.household_id != household.id:
        raise ValueError("delete_note_interaction: note belongs to another household")
    if interaction.is_private and interaction.created_by_id != getattr(user, "pk", None):
        raise ValueError("delete_note_interaction: cannot delete another user's private note")
    interaction.delete()
