"""
Project cost computation.

The actual cost is no longer a maintained counter: it is the SUM of the
`metadata.amount` of the expense Interactions linked to the project via the
polymorphic source FK (#131 / #234). The DB column `actual_cost_cached` is
kept for now but never written anymore — every creation/edit/deletion path
(purchase dialog, agent, undo) is reflected without sync logic.

Amounts are stored as str(Decimal) in metadata (service convention, see
`interactions.aggregations`), hence the Postgres cast before summing.
"""
from __future__ import annotations

from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db.models import DecimalField, OuterRef, Subquery, Sum, Value
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce

from interactions.models import Interaction

_AMOUNT_FIELD = DecimalField(max_digits=14, decimal_places=2)
_ZERO = Value(Decimal("0.00"), output_field=_AMOUNT_FIELD)


def _expense_amounts(project_ref):
    from .models import Project

    return Interaction.objects.filter(
        type="expense",
        source_content_type=ContentType.objects.get_for_model(Project),
        source_object_id=project_ref,
    ).annotate(
        amount_decimal=Cast(KeyTextTransform("amount", "metadata"), _AMOUNT_FIELD)
    )


def annotate_actual_cost(queryset):
    """Annotate each project with ``actual_cost_computed`` (one subquery, no N+1)."""
    totals = (
        _expense_amounts(OuterRef("pk"))
        .values("source_object_id")
        .annotate(total=Sum("amount_decimal"))
        .values("total")[:1]
    )
    return queryset.annotate(
        actual_cost_computed=Coalesce(Subquery(totals, output_field=_AMOUNT_FIELD), _ZERO)
    )


def project_actual_cost(project) -> Decimal:
    """Single-project fallback when the annotation is absent (e.g. fresh instance)."""
    return _expense_amounts(project.pk).aggregate(
        total=Coalesce(Sum("amount_decimal"), _ZERO)
    )["total"]
