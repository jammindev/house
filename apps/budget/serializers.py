"""Budget serializers — CRUD API."""
from decimal import Decimal

from rest_framework import serializers

from .models import Budget, BudgetReport, RecurringExpense


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
    parent_id = serializers.UUIDField(required=False, allow_null=True)
    parent = serializers.SerializerMethodField()
    #: Vrai dès que le budget porte des enfants : il devient un sous-total, et
    #: cesse d'être une cible de ventilation. Le front en a besoin pour ne pas
    #: proposer un groupe dans ses six sélecteurs de dépense.
    is_group = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = [
            "id",
            "household",
            "name",
            "monthly_amount",
            "is_global",
            "parent",
            "parent_id",
            "is_group",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "household", "created_at", "updated_at", "created_by"]

    def get_parent(self, obj):
        if not obj.parent_id:
            return None
        return {"id": str(obj.parent_id), "name": obj.parent.name}

    def get_is_group(self, obj):
        return obj.children.exists()

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field cannot be blank.")
        return value

    def _validate_parent(self, attrs):
        """Les quatre règles qui gardent « un euro, une feuille ».

        Un groupe est un **sous-total**, jamais une case. Tout ce qui pourrait
        rendre cette phrase fausse est refusé ici, en 400 nommé :

        1. **deux niveaux** — un budget qui a déjà un parent ne peut pas en
           devenir un. Une profondeur libre demanderait une CTE récursive pour
           chaque total et un sélecteur en arbre dans six formulaires ; ce n'est
           pas le besoin, et on pourra toujours l'ouvrir plus tard ;
        2. **le budget global ne se range pas** et ne range personne : il plafonne
           déjà tout ;
        3. **pas de cycle**, ni de budget son propre parent ;
        4. **un budget qui porte déjà des dépenses ne peut pas recevoir d'enfants**
           — ses dépenses deviendraient le « propre » d'un parent, c'est-à-dire
           exactement l'ambiguïté qu'on refuse.
        """
        if "parent_id" not in attrs:
            return
        parent_id = attrs.pop("parent_id")
        if parent_id is None:
            attrs["parent"] = None
            return

        is_global = attrs.get("is_global", getattr(self.instance, "is_global", False))
        if is_global:
            raise serializers.ValidationError(
                {"parent_id": "The global budget caps everything; it belongs to no group."}
            )

        household_id = (
            self.instance.household_id
            if self.instance is not None
            else self.context["request"].household.id
        )
        parent = Budget.objects.filter(id=parent_id, household_id=household_id).first()
        if parent is None:
            raise serializers.ValidationError({"parent_id": "Unknown budget in this household."})
        if parent.is_global:
            raise serializers.ValidationError(
                {"parent_id": "The global budget cannot be a group."}
            )
        if self.instance is not None and parent.id == self.instance.id:
            raise serializers.ValidationError({"parent_id": "A budget cannot be its own group."})
        if parent.parent_id is not None:
            raise serializers.ValidationError(
                {"parent_id": "Groups are two levels deep: this budget is already inside one."}
            )
        if self.instance is not None and self.instance.children.exists():
            raise serializers.ValidationError(
                {"parent_id": "This budget is already a group; a group cannot be nested."}
            )

        from interactions.models import Interaction

        carried = Interaction.objects.filter(budget_id=parent.id).count()
        if carried:
            raise serializers.ValidationError(
                {
                    "parent_id": (
                        f"« {parent.name} » already carries {carried} expense(s): a group is a "
                        "subtotal, so it cannot hold money of its own. Move them first."
                    )
                }
            )

        attrs["parent"] = parent

    def validate(self, attrs):
        """The global budget keeps its ceiling: capping is its only job.

        A named envelope without a ceiling is a category — useful. A *global*
        budget without one caps nothing and would sit at the top of the panel
        saying nothing at all.

        Read through to the instance on a PATCH: renaming the global budget must
        not require re-sending its amount, and clearing the amount of an existing
        global one must still be refused.
        """
        self._validate_parent(attrs)

        is_global = attrs.get("is_global", getattr(self.instance, "is_global", False))
        if not is_global:
            return attrs

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
