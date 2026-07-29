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

**Le plafond est optionnel ; la catégorie ne l'est pas.** ``monthly_amount`` may
be ``NULL`` — « catégorie suivie, non plafonnée ». A budget is the only axis that
classifies a euro (``Interaction.budget``), and the conformity control asks for
one on every expense in the window; requiring a ceiling to get a category forced
users to invent a number for « Cadeaux » or « Santé », and a panel full of
made-up ceilings makes every bar meaningless. The *global* budget is the
exception: it exists only to cap, so its amount stays required.
"""
import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class BudgetCategory(HouseholdScopedModel):
    """A named grouping of budgets — « Maison » over « Bricolage » and « Énergie ».

    **A category is not a budget.** It is a separate entity with a name, an
    optional ceiling, and nothing else: no expense can ever land on it, because
    ``Interaction.budget`` points at a ``Budget`` and a category is not one. That
    single fact is what makes the grouping cost nothing — ``spent`` keeps exactly
    one meaning, and the nine amount aggregations keep their definition.

    The previous shape (a self-FK ``Budget.parent``, so a budget *became* a group
    by acquiring children) had to spend four validation rules, a derived
    ``is_group`` flag and a refusal for parents already carrying expenses just to
    re-establish that same separation — and it never worked, because a budget
    that is sometimes a target and sometimes a subtotal has to be filtered out of
    six expense selectors and thread its parent through every write path. Two
    types cannot be confused; one type with a mode always will be.

    ``monthly_amount`` is optional, exactly like a budget's. ``NULL`` = the
    category is a pure subtotal (its ceiling is the sum of what it contains);
    a value means the category caps its budgets as a whole, and **replaces**
    their sum in the global comparison (see ``aggregations.compute_budget_overview``).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    monthly_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_(
            "Optional monthly ceiling for the whole category. NULL = pure "
            "subtotal, worth the sum of the budgets it holds. When set, it "
            "REPLACES that sum — adding both would count the same commitment "
            "twice and cry overshoot at a perfectly coherent household."
        ),
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "budget_categories"
        verbose_name = _("budget category")
        verbose_name_plural = _("budget categories")
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "name"],
                name="unique_budget_category_name_per_household",
            ),
        ]

    def __str__(self):
        if self.monthly_amount is None:
            return f"{self.name} (subtotal)"
        return f"{self.name} ({self.monthly_amount}/mo)"


class Budget(HouseholdScopedModel):
    """A named monthly spending envelope, or the household's global ceiling."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    monthly_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_(
            "Monthly ceiling. NULL = tracked category with no ceiling — the "
            "counters still add up what it spent, nothing is ever 'over'. "
            "Required on the global budget, which exists only to cap."
        ),
    )
    is_global = models.BooleanField(
        default=False,
        help_text=_(
            "The single household-wide budget that caps all expenses "
            "(budgeted + hors budget). At most one per household."
        ),
    )
    category = models.ForeignKey(
        "budget.BudgetCategory",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="budgets",
        help_text=_(
            "Optional category this envelope is filed under. SET_NULL: deleting "
            "a category is deleting a heading, and a heading that disappears "
            "must never take the envelopes that carry the money with it."
        ),
    )
    #: DEPRECATED — replaced by ``category``. Kept for exactly one deploy so the
    #: column drop is a separate release: the deploy migrates on a throwaway
    #: container of the new image and only then switches the live one, so between
    #: those two moments the OLD code runs against the NEW schema. Dropping
    #: ``parent_id`` in the same release would make every budget query of the
    #: still-running old container select a column that no longer exists.
    #: Nothing reads it any more; the drop migration is the follow-up.
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
        help_text=_("Deprecated — superseded by `category`. Dropped next release."),
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
        if self.monthly_amount is None:
            return f"{self.name} (no ceiling)"
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


class BudgetReport(HouseholdScopedModel):
    """Persisted monthly budget report — parcours 21 lot 3.

    One immutable snapshot per (household, month): the numeric ``stats`` are
    computed once when the month closes and frozen (so later budget/expense edits
    don't rewrite history). The prose is NOT stored as such — it is rendered from
    ``stats`` at read time in the viewer's language (deterministic template), with
    an optional LLM-polished narrative memoized per language inside ``stats``.
    ``month`` is the reported period as ``YYYY-MM``.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    month = models.CharField(max_length=7, help_text="Reported period, 'YYYY-MM'.")
    stats = models.JSONField(default=dict, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "budget_reports"
        verbose_name = _("budget report")
        verbose_name_plural = _("budget reports")
        ordering = ["-month"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "month"],
                name="unique_budget_report_per_month",
            ),
        ]

    def __str__(self):
        return f"Budget report {self.month}"
