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


class RecurringExpense(HouseholdScopedModel):
    """A recurring expense (subscription, insurance, bill) — parcours 21 lot 2.

    A dedicated model (not an ``Interaction``): it carries a **schedule** whose
    ``next_due_date`` advances each time an occurrence is confirmed (a small state
    machine) and is **queried** by due date for the treasury projection and the
    "à confirmer" list — two of the criteria that, per the CLAUDE.md decision rule,
    call for a dedicated model over a flat journal entry.

    Confirming an occurrence creates a real ``Interaction(type='expense')`` via
    ``interactions.services`` (so it feeds the journal, the budget counters and the
    RAG) and advances ``next_due_date`` by the cadence. Recurrences are never
    auto-materialized — confirmation is always an explicit user action.
    """

    class Cadence(models.TextChoices):
        MONTHLY = "monthly", _("Monthly")
        QUARTERLY = "quarterly", _("Quarterly")
        YEARLY = "yearly", _("Yearly")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    cadence = models.CharField(max_length=12, choices=Cadence.choices, default=Cadence.MONTHLY)
    next_due_date = models.DateField()
    supplier = models.CharField(max_length=200, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    budget = models.ForeignKey(
        "budget.Budget",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recurring_expenses",
        help_text=_(
            "Optional budget each confirmed occurrence counts against, and whose "
            "'committed' (engagé à venir) it feeds. Null resets on budget delete."
        ),
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "recurring_expenses"
        verbose_name = _("recurring expense")
        verbose_name_plural = _("recurring expenses")
        ordering = ["next_due_date", "label"]
        indexes = [
            models.Index(fields=["household", "next_due_date"], name="idx_recexp_hh_due"),
        ]

    def __str__(self):
        return f"{self.label} ({self.amount}/{self.cadence})"
