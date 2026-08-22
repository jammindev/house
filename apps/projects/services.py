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


def project_tab_counts(project, viewer=None) -> dict[str, int]:
    """Number of items behind each tab of the project detail page.

    Consumed by ``ProjectSerializer`` (detail only) so the frontend can hide
    empty tabs. Handful of aggregate queries — acceptable for a single object,
    NOT to be used on a list (would N+1). Mirrors exactly what each tab shows:
    active trackers only, documents excluding photos, interactions split by type.

    ⚠️ ``viewer`` n'est pas un raffinement, c'est la condition pour que le nombre
    veuille dire quelque chose. Ces compteurs comptaient **tout le foyer** pendant
    que les listes derrière chaque onglet filtrent la confidentialité : Bob lisait
    « Tâches (3) » et l'onglet lui en servait deux. Un compteur ne peut pas avoir
    deux définitions — et celui-ci trahissait en prime l'existence de la tâche
    privée d'Alice, alors que hors argent « privé » veut dire absent, sans trace.

    ``viewer=None`` reste fail-closed (voir ``core.visibility``) : un appelant qui
    oublie le lecteur sous-compte, il ne fuit pas.
    """
    from django.contrib.contenttypes.models import ContentType

    from core.visibility import visible_to_creator
    from documents.models import Document, DocumentLink
    from interactions.models import Interaction
    from interactions.visibility import visible_interactions
    from tasks.models import Task
    from trackers.models import Tracker

    from .models import Project

    project_ct = ContentType.objects.get_for_model(Project)
    interactions = visible_interactions(
        Interaction.objects.filter(
            source_content_type=project_ct, source_object_id=project.id
        ),
        viewer,
    )
    # Le lien n'a pas de drapeau : c'est le **document** qu'il pointe qui en porte
    # un. On borne donc par les documents lisibles, plutôt que de réécrire ici la
    # règle avec un préfixe de relation — deux écritures de la même règle, et c'est
    # toujours la plus permissive qui gagne en silence.
    links = DocumentLink.objects.filter(
        content_type=project_ct,
        object_id=project.id,
        document__in=visible_to_creator(Document.objects.all(), viewer),
    )

    return {
        "tasks": visible_to_creator(Task.objects.filter(project=project), viewer).count(),
        "trackers": Tracker.objects.filter(project=project, is_active=True).count(),
        "notes": interactions.filter(type="note").count(),
        "expenses": interactions.filter(type="expense").count(),
        "documents": links.exclude(document__type="photo").count(),
        "photos": links.filter(document__type="photo").count(),
        "timeline": interactions.count(),
    }
