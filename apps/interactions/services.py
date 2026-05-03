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

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .models import Interaction, InteractionZone


# Templates registry: maps a kind discriminator to a translatable subject template.
# Templates use {name} as the source object's display name.
AUTO_SUBJECT_TEMPLATES: dict[str, Any] = {
    "stock_purchase": _("Purchase — {name}"),
    "equipment_purchase": _("Purchase — {name}"),
    "project_purchase": _("Purchase — {name}"),
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

    # Always write the standard expense keys (None when missing) so consumers
    # have a stable shape — extra_metadata can add feature-specific keys.
    metadata: dict[str, Any] = {
        "kind": resolved_kind,
        "source_name": name,
        "amount": str(amount) if amount is not None else None,
        "unit_price": str(unit_price) if unit_price is not None else None,
        "supplier": supplier or "",
    }
    if extra_metadata:
        metadata.update(extra_metadata)

    source_ct = ContentType.objects.get_for_model(source.__class__)

    with transaction.atomic():
        interaction = Interaction.objects.create(
            household_id=source.household_id,
            created_by=user,
            subject=subject,
            content=notes,
            type="expense",
            occurred_at=occurred_at or timezone.now(),
            metadata=metadata,
            source_content_type=source_ct,
            source_object_id=source.pk,
        )
        zone = getattr(source, "zone", None)
        if zone is not None:
            InteractionZone.objects.create(interaction=interaction, zone=zone)

    return interaction
