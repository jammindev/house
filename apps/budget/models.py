"""
Budget models — monthly spending envelopes for a household (parcours 21).

A ``Budget`` is a named monthly ceiling. Expenses (``interactions.Interaction``
of type ``expense``) attach to at most one budget via a nullable FK on the
interaction (``Interaction.budget``); unattached expenses fall into the
"hors budget" bucket. A household may also have a single *global* budget
(``is_global=True``) that caps ALL expenses regardless of assignment — the
safety net over the named envelopes.

No per-month rows: a budget carries one ``monthly_amount`` reconducted every
month. The spent side is computed on the fly from the interactions journal
(see ``budget.aggregations``), never denormalized.
"""
import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class Budget(HouseholdScopedModel):
    """A named monthly spending envelope, or the household's global ceiling."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    monthly_amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_global = models.BooleanField(
        default=False,
        help_text=_(
            "The single household-wide budget that caps all expenses "
            "(budgeted + hors budget). At most one per household."
        ),
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "budgets"
        verbose_name = _("budget")
        verbose_name_plural = _("budgets")
        ordering = ["-is_global", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["household"],
                condition=models.Q(is_global=True),
                name="one_global_budget_per_household",
            ),
            models.UniqueConstraint(
                fields=["household", "name"],
                name="unique_budget_name_per_household",
            ),
        ]
        indexes = [
            models.Index(fields=["household", "is_global"], name="idx_budget_hh_global"),
        ]

    def __str__(self):
        return f"{self.name} ({self.monthly_amount}/mo)"
