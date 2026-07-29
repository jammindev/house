"""Budget serializers — CRUD API."""
from decimal import Decimal

from rest_framework import serializers

from .models import Budget, BudgetCategory, BudgetReport, RecurringExpense


class BudgetCategorySerializer(serializers.ModelSerializer):
    """Read/write serializer for a budget category.

    A category is a **heading**, so it validates almost nothing: a non-blank name
    and, when given, a strictly positive ceiling. There is no rule about what it
    may contain, because there is nothing to protect — no expense can point at a
    category, so a category can never hold money of its own.
    """

    monthly_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
        allow_null=True,
    )
    budget_count = serializers.SerializerMethodField()

    class Meta:
        model = BudgetCategory
        fields = [
            "id",
            "household",
            "name",
            "monthly_amount",
            "budget_count",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by"]

    def get_budget_count(self, obj):
        # Annoté par la vue liste (``budgets_total``) ; le ``count()`` reste le
        # repli pour une instance fraîchement créée, qui n'est pas annotée.
        annotated = getattr(obj, "budgets_total", None)
        return annotated if annotated is not None else obj.budgets.count()

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field cannot be blank.")
        return value


class BudgetSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the Budget API.

    ``monthly_amount`` is **optional** — omitted or ``null`` means « catégorie
    suivie, non plafonnée ». When given it must be strictly positive: a ceiling
    of zero is not a ceiling, it is a budget nobody can respect. ``is_global`` is
    writable but the "one global per household" invariant is enforced at the DB
    level (unique constraint) and surfaced as a clean 400 by the service layer.
    """

    monthly_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
        allow_null=True,
    )
    category_id = serializers.UUIDField(required=False, allow_null=True)
    category = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = [
            "id",
            "household",
            "name",
            "monthly_amount",
            "is_global",
            "category",
            "category_id",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by"]

    def get_category(self, obj):
        if not obj.category_id:
            return None
        return {"id": str(obj.category_id), "name": obj.category.name}

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field cannot be blank.")
        return value

    def _validate_category(self, attrs):
        """Resolve ``category_id`` to a household-scoped ``BudgetCategory``.

        Two rules, and that is the whole of it — because a category is a distinct
        type, not a budget in a particular mode. It cannot be its own parent, it
        cannot nest, it cannot already carry expenses, and it can never be
        mistaken for a spending target in one of the six expense selectors. None
        of those questions exist to be answered:

        1. **household scope** — filing an envelope under a category you cannot
           see would leak that category's name back to you through the panel;
        2. **the global budget is filed under nothing** — it already caps every
           category at once, so putting it inside one would make it a member of
           what it measures.

        A ``None`` id is meaningful and kept: it takes the budget *out* of its
        category. A missing key (partial PATCH) leaves the filing untouched.
        """
        if "category_id" not in attrs:
            return
        category_id = attrs.pop("category_id")
        if category_id is None:
            attrs["category"] = None
            return

        is_global = attrs.get("is_global", getattr(self.instance, "is_global", False))
        if is_global:
            raise serializers.ValidationError(
                {
                    "category_id": (
                        "The global budget caps every category at once; it is "
                        "filed under none of them."
                    )
                }
            )

        request = self.context.get("request")
        household_id = (
            self.instance.household_id
            if self.instance is not None
            else getattr(getattr(request, "household", None), "id", None)
        )
        category = BudgetCategory.objects.filter(
            id=category_id, household_id=household_id
        ).first()
        if category is None:
            raise serializers.ValidationError(
                {"category_id": "Unknown category in this household."}
            )

        attrs["category"] = category

    def validate(self, attrs):
        """The global budget keeps its ceiling: capping is its only job.

        A named envelope without a ceiling is a category — useful. A *global*
        budget without one caps nothing and would sit at the top of the panel
        saying nothing at all.

        Read through to the instance on a PATCH: renaming the global budget must
        not require re-sending its amount, and clearing the amount of an existing
        global one must still be refused.
        """
        self._validate_category(attrs)

        is_global = attrs.get("is_global", getattr(self.instance, "is_global", False))
        if not is_global:
            return attrs

        # ⚠️ L'invariant ne doit pas dépendre des clés que le client a envoyées.
        # Refuser ``category_id`` sur un budget global (plus haut) ne couvre que
        # les requêtes qui en parlent : un PATCH portant le seul ``is_global``
        # n'atteint jamais ce contrôle, et laissait un budget global rangé dans
        # une catégorie — c'est-à-dire membre de ce qu'il mesure. On le sort,
        # plutôt que de refuser : promouvoir une enveloppe en plafond global est
        # une demande claire, et sa catégorie n'a simplement plus de sens.
        attrs["category"] = None

        amount = attrs.get(
            "monthly_amount", getattr(self.instance, "monthly_amount", None)
        )
        if amount is None:
            raise serializers.ValidationError(
                {
                    "monthly_amount": (
                        "Required on the global budget: it exists only to cap "
                        "total spending."
                    )
                }
            )
        return attrs


class RecurringExpenseSerializer(serializers.ModelSerializer):
    """Read/write serializer for recurring expenses.

    ``amount`` must be strictly positive. ``budget_id`` (write) attaches an
    optional named budget; ``budget`` (read) echoes ``{id, name}``. Household
    scope + no-global-target validation live in the service layer.
    """

    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    budget = serializers.SerializerMethodField()
    budget_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = RecurringExpense
        fields = [
            "id",
            "household",
            "label",
            "amount",
            "cadence",
            "next_due_date",
            "supplier",
            "notes",
            "budget",
            "budget_id",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by"]

    def get_budget(self, obj):
        if not obj.budget_id:
            return None
        return {"id": str(obj.budget_id), "name": obj.budget.name}

    def validate_label(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field cannot be blank.")
        return value


class BudgetReportSerializer(serializers.ModelSerializer):
    """Read serializer for a monthly budget report.

    ``text`` is rendered from the frozen ``stats`` in the request user's active
    language. ``polish`` in the serializer context enables the LLM narrative
    (used for the single latest/detail views, not the history list — one LLM
    call per row would be wasteful). The internal ``_polished`` cache is stripped
    from the exposed ``stats``.
    """

    text = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = BudgetReport
        fields = ["id", "month", "text", "stats", "created_at"]

    def get_text(self, obj):
        from .report.service import render_report

        return render_report(obj, polish=bool(self.context.get("polish", False)))

    def get_stats(self, obj):
        return {k: v for k, v in (obj.stats or {}).items() if k != "_polished"}


class ConfirmOccurrenceSerializer(serializers.Serializer):
    """Input for POST /budget/recurring/{id}/confirm/.

    Validates the optional amount override the same way as the recurrence amount
    (strictly positive), so a bad value can never reach ``metadata.amount`` and
    poison the expense aggregations.
    """

    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=Decimal("0.01"),
    )
