"""
Project cost computation.

The actual cost is no longer a maintained counter: it is the SUM of the
`amount` of the expense Interactions linked to the project via the polymorphic
source FK (#131 / #234). The DB column `actual_cost_cached` is kept for now but
never written anymore — every creation/edit/deletion path (purchase dialog,
agent, undo) is reflected without sync logic.

Expense amount/kind/supplier are real columns on Interaction; the shared
`interactions.queries` helpers own the expense-select convention.
"""
from __future__ import annotations

from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db.models import OuterRef, Subquery, Sum
from django.db.models.functions import Coalesce

from interactions.models import Interaction
from interactions.queries import AMOUNT_FIELD, ZERO, expenses


def _expense_amounts(project_ref):
    from .models import Project

    return expenses(
        base=Interaction.objects.filter(
            source_content_type=ContentType.objects.get_for_model(Project),
            source_object_id=project_ref,
        )
    )


def annotate_actual_cost(queryset):
    """Annotate each project with ``actual_cost_computed`` (one subquery, no N+1)."""
    totals = (
        _expense_amounts(OuterRef("pk"))
        .values("source_object_id")
        .annotate(total=Sum("amount"))
        .values("total")[:1]
    )
    return queryset.annotate(
        actual_cost_computed=Coalesce(Subquery(totals, output_field=AMOUNT_FIELD), ZERO)
    )


def project_actual_cost(project) -> Decimal:
    """Single-project fallback when the annotation is absent (e.g. fresh instance)."""
    return _expense_amounts(project.pk).aggregate(
        total=Coalesce(Sum("amount"), ZERO)
    )["total"]


def project_tab_counts(project) -> dict[str, int]:
    """Number of items behind each tab of the project detail page.

    Consumed by ``ProjectSerializer`` (detail only) so the frontend can hide
    empty tabs. Handful of aggregate queries — acceptable for a single object,
    NOT to be used on a list (would N+1). Mirrors exactly what each tab shows:
    active trackers only, documents excluding photos, interactions split by type.
    """
    from django.contrib.contenttypes.models import ContentType

    from documents.models import DocumentLink
    from interactions.models import Interaction
    from tasks.models import Task
    from trackers.models import Tracker

    from .models import Project

    project_ct = ContentType.objects.get_for_model(Project)
    interactions = Interaction.objects.filter(
        source_content_type=project_ct, source_object_id=project.id
    )
    links = DocumentLink.objects.filter(content_type=project_ct, object_id=project.id)

    return {
        "tasks": Task.objects.filter(project=project).count(),
        "trackers": Tracker.objects.filter(project=project, is_active=True).count(),
        "notes": interactions.filter(type="note").count(),
        "expenses": interactions.filter(type="expense").count(),
        "documents": links.exclude(document__type="photo").count(),
        "photos": links.filter(document__type="photo").count(),
        "timeline": interactions.count(),
    }
