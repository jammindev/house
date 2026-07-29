"""Budget REST API views."""
import calendar
import uuid
from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import IsHouseholdMember
from core.timezones import household_today
from interactions.aggregations import UNBUDGETED

from .aggregations import compute_budget_overview, compute_cashflow_projection
from .analysis import DEFAULT_MONTHS, compute_budget_analysis
from .insights import compute_budget_insights
from .models import Budget, BudgetCategory, BudgetReport, RecurringExpense
from .report.service import get_or_generate_report, last_closed_month
from .serializers import (
    BudgetCategorySerializer,
    BudgetReportSerializer,
    BudgetSerializer,
    ConfirmOccurrenceSerializer,
    RecurringExpenseSerializer,
)
from .services import (
    confirm_recurring_occurrence,
    create_budget,
    create_budget_category,
    create_recurring_expense,
    delete_budget,
    delete_budget_category,
    delete_recurring_expense,
    update_budget,
    update_budget_category,
    update_recurring_expense,
)


class BudgetViewSet(viewsets.ModelViewSet):
    """CRUD for household budgets + the monthly overview.

    Every write delegates to ``budget.services`` so the REST path and the agent
    path stay identical. Any household member may manage budgets (Lot 1 decision).
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = BudgetSerializer

    def get_queryset(self):
        qs = Budget.objects.for_user_households(self.request.user).select_related("created_by")
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs

    def _require_household(self):
        household = self.request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})
        return household

    def perform_create(self, serializer):
        # The service owns the write (shared with the agent); bind the created
        # instance back so DRF's 201 response serializes it.
        #
        # ⚠️ Every field the client may send has to appear here. This hand-copied
        # list is what killed the previous grouping feature: the serializer
        # validated the group, the panel offered it, and this call dropped it on
        # the floor without a word. Adding a writable field to BudgetSerializer
        # means adding it here too — regression: ``test_categories.py``.
        household = self._require_household()
        category = serializer.validated_data.get("category")
        serializer.instance = create_budget(
            household,
            self.request.user,
            name=serializer.validated_data["name"],
            # ``.get``: an omitted amount is a category with no ceiling, not a 400.
            monthly_amount=serializer.validated_data.get("monthly_amount"),
            is_global=serializer.validated_data.get("is_global", False),
            category_id=category.id if category is not None else None,
        )

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        serializer.instance = update_budget(
            household,
            self.request.user,
            serializer.instance,
            fields=dict(serializer.validated_data),
        )

    def perform_destroy(self, instance):
        household = self.request.household or instance.household
        delete_budget(household, self.request.user, instance)

    @action(detail=False, methods=["get"])
    def overview(self, request):
        """GET /api/budget/budgets/overview/

        The month's budgets with spent/ceiling, the "hors budget" total and the
        optional global cap. Empty-but-valid shape when no household context.
        """
        household = request.household
        if household is None:
            return Response(
                {
                    "month": None,
                    "global": None,
                    "budgets": [],
                    "categories": [],
                    "unbudgeted": "0.00",
                    "total_spent": "0.00",
                    "total_attested": "0.00",
                    "total_pending": "0.00",
                    "total_committed": "0.00",
                    "named_total_amount": "0.00",
                    "named_exceeds_global": False,
                }
            )
        return Response(compute_budget_overview(household=household))

    @action(detail=False, methods=["get"])
    def analysis(self, request):
        """GET /api/budget/budgets/analysis/?months=12&budget=<id>

        La lecture longue : séries mensuelles par budget, répartition,
        fournisseurs, plus grosses dépenses. Le panneau Budgets ne répond qu'à
        « ce mois-ci tient-il ? » ; une dérive lente, ou une catégorie sans
        plafond, n'y produisent aucun signal.

        ``budget`` restreint tout le calcul à une enveloppe. Un id inconnu du
        foyer donne une fenêtre vide, jamais les données d'un autre foyer : le
        filtre s'applique **après** le scope, il ne peut pas l'élargir.
        """
        household = request.household
        if household is None:
            return Response(
                {
                    "months": [],
                    "series": [],
                    "breakdown": [],
                    "suppliers": [],
                    "biggest": [],
                    "total": "0.00",
                    "monthly_average": "0.00",
                }
            )

        raw_months = request.query_params.get("months")
        try:
            months = int(raw_months) if raw_months else DEFAULT_MONTHS
        except (TypeError, ValueError):
            raise ValidationError({"months": "Expected an integer number of months."})

        budget_id = request.query_params.get("budget") or None
        if budget_id:
            try:
                known = Budget.objects.filter(household_id=household.id, pk=budget_id).exists()
            except (ValueError, DjangoValidationError):
                # A malformed UUID reaches the DB driver as a crash, not a lookup:
                # a bad query parameter is a 400, never a 500.
                known = False
            if not known:
                raise ValidationError({"budget": "Unknown budget for this household."})

        return Response(
            compute_budget_analysis(
                household=household, months=months, budget_id=budget_id
            )
        )

    @action(detail=False, methods=["get"])
    def insights(self, request):
        """GET /api/budget/budgets/insights/?budget=<id|none>&category=<id>&from=&to=

        De quoi la fiche d'une enveloppe est faite : le total de la période, le
        même total sur la période **précédente équivalente** avec l'écart, la
        série jour par jour (ou mois par mois sur une longue fenêtre) et la
        répartition par fournisseur.

        Tout part d'un seul appel : refaire ces quatre lectures dans le
        navigateur imposerait d'y charger toutes les dépenses de la fenêtre, et
        donnerait au compteur déjà affiché une seconde définition.

        ``budget=none`` ouvre le seau « hors budget » — même page, même geste.
        Sans période, on répond sur le mois en cours **chez le foyer** : ouvrir
        une enveloppe doit afficher le total sur lequel on vient de cliquer.

        ``category=<id>`` ouvre la fiche d'une **catégorie** : mêmes lectures sur
        toutes ses enveloppes, plus la répartition entre elles (``budgets``).
        C'est ici que ça se joue et non sur ``BudgetCategoryViewSet``, qui ne
        porte aucune agrégation : le sous-total d'une catégorie n'a le droit
        d'exister qu'à un seul endroit, sinon la fiche et le panneau finissent
        par répondre chacun le sien à « combien a-t-on dépensé ? ».
        """
        household = request.household
        if household is None:
            return Response(_EMPTY_INSIGHTS)

        budget = request.query_params.get("budget") or None
        category = request.query_params.get("category") or None
        if budget and category:
            raise ValidationError(
                {"category": "Pass a budget or a category, never both."}
            )
        if budget and budget != UNBUDGETED:
            try:
                uuid.UUID(budget)
            except ValueError:
                # Un id malformé atteint le driver comme un crash, pas comme un
                # filtre : un mauvais paramètre est un 400, jamais un 500.
                raise ValidationError({"budget": 'Expected a budget id or "none".'})
            if not Budget.objects.filter(household_id=household.id, pk=budget).exists():
                raise ValidationError({"budget": "Unknown budget for this household."})
        if category:
            try:
                uuid.UUID(category)
            except ValueError:
                raise ValidationError({"category": "Expected a budget category id."})
            # Le scope s'applique **après** le foyer, donc il ne peut pas
            # l'élargir ; on refuse quand même une catégorie inconnue plutôt que
            # de répondre une fenêtre vide, qui se lirait « rien dépensé ».
            if not BudgetCategory.objects.filter(household_id=household.id, pk=category).exists():
                raise ValidationError({"category": "Unknown budget category for this household."})

        start, end = _parse_window(
            request.query_params.get("from"), request.query_params.get("to"), household
        )
        return Response(
            compute_budget_insights(
                household=household,
                budget=budget,
                category=category,
                start=start,
                end=end,
            )
        )


#: Réponse hors foyer — la **forme** complète, jamais un objet vide. Un front qui
#: reçoit `{}` doit deviner ce qui manque ; il finit par afficher « 0 € » là où la
#: bonne réponse est « pas de foyer sélectionné ».
_EMPTY_INSIGHTS = {
    "period": {"from": None, "to": None},
    "previous_period": {"from": None, "to": None},
    "current": {"total": "0.00", "refunded": "0.00", "net_total": "0.00", "count": 0},
    "previous": {"total": "0.00", "refunded": "0.00", "net_total": "0.00", "count": 0},
    "delta": {"amount": "0.00", "ratio": None},
    "granularity": "day",
    "buckets": [],
    "suppliers": [],
    "kinds": [],
    "budgets": [],
    "budgets_returned": [],
    "budgets_net_total": "0.00",
}


def _parse_window(from_param, to_param, household) -> tuple[date, date]:
    """Les deux dates de calendrier de la fenêtre, mois en cours par défaut.

    Le défaut passe par ``core.timezones``, la **même** source que le panneau
    Budgets : c'est ce qui garantit qu'ouvrir une enveloppe affiche le total sur
    lequel on vient de cliquer, et non celui d'un mois décalé par le fuseau du
    serveur.
    """
    today = household_today(household)
    default_start = today.replace(day=1)
    default_end = today.replace(day=calendar.monthrange(today.year, today.month)[1])

    start = _parse_date(from_param, "from") or default_start
    end = _parse_date(to_param, "to") or default_end
    if end < start:
        raise ValidationError({"to": "The end of the window precedes its start."})
    return start, end


def _parse_date(value, field: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({field: "Expected a YYYY-MM-DD date."})


class BudgetCategoryViewSet(viewsets.ModelViewSet):
    """CRUD for budget categories — the headings budgets are filed under.

    Deliberately plain: a category holds no money, so there is no overview action
    and no aggregation here. Its total lives in the budget overview, computed
    once alongside the envelopes it groups (one query, one definition of
    « dépensé »), never recomputed on a second endpoint that would eventually
    disagree with the first.
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = BudgetCategorySerializer

    def get_queryset(self):
        # ``budget_count`` est annoté ici plutôt que compté par ligne dans le
        # sérialiseur : un ``obj.budgets.count()`` par catégorie fait un
        # aller-retour de plus à chaque ligne, pour un chiffre que le même
        # GROUP BY donne gratuitement.
        qs = (
            BudgetCategory.objects.for_user_households(self.request.user)
            .select_related("created_by")
            .annotate(budgets_total=Count("budgets"))
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs

    def perform_create(self, serializer):
        household = self.request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})
        serializer.instance = create_budget_category(
            household,
            self.request.user,
            name=serializer.validated_data["name"],
            monthly_amount=serializer.validated_data.get("monthly_amount"),
        )

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        serializer.instance = update_budget_category(
            household,
            self.request.user,
            serializer.instance,
            fields=dict(serializer.validated_data),
        )

    def perform_destroy(self, instance):
        household = self.request.household or instance.household
        delete_budget_category(household, self.request.user, instance)


class RecurringExpenseViewSet(viewsets.ModelViewSet):
    """CRUD for recurring expenses + due list, 1-click confirm, cash-flow projection.

    Every write delegates to ``budget.services`` (shared with the agent). Any
    household member may manage recurrences (parcours 21 decision).
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = RecurringExpenseSerializer

    def get_queryset(self):
        qs = RecurringExpense.objects.for_user_households(self.request.user).select_related(
            "created_by", "budget"
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs

    def _require_household(self):
        household = self.request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})
        return household

    def perform_create(self, serializer):
        household = self._require_household()
        data = serializer.validated_data
        serializer.instance = create_recurring_expense(
            household,
            self.request.user,
            label=data["label"],
            amount=data["amount"],
            cadence=data["cadence"],
            next_due_date=data["next_due_date"],
            supplier=data.get("supplier", ""),
            notes=data.get("notes", ""),
            budget_id=self.request.data.get("budget_id"),
        )

    def perform_update(self, serializer):
        household = self.request.household or serializer.instance.household
        fields = dict(serializer.validated_data)
        # budget_id is write-only and not echoed in validated_data as a model field;
        # forward it explicitly when the client sent it (including null to detach).
        if "budget_id" in self.request.data:
            fields["budget_id"] = self.request.data.get("budget_id")
        serializer.instance = update_recurring_expense(
            household, self.request.user, serializer.instance, fields=fields
        )

    def perform_destroy(self, instance):
        household = self.request.household or instance.household
        delete_recurring_expense(household, self.request.user, instance)

    @action(detail=False, methods=["get"])
    def due(self, request):
        """GET /api/budget/recurring/due/ — recurrences due now (next_due_date <= today)."""
        household = request.household
        if household is None:
            return Response([])
        today = household_today(household)
        qs = self.get_queryset().filter(next_due_date__lte=today)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def projection(self, request):
        """GET /api/budget/recurring/projection/ — upcoming outflows over 30/90 days."""
        household = request.household
        if household is None:
            return Response({"today": None, "horizons": []})
        return Response(compute_cashflow_projection(household=household))

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """POST /api/budget/recurring/{id}/confirm/ — confirm a due occurrence.

        Creates the real expense (optionally with an edited ``amount``) and advances
        the schedule. Returns the updated recurrence + the created interaction id so
        the client can offer an exact undo (delete expense + restore next_due_date).
        """
        recurring = self.get_object()
        household = request.household or recurring.household

        serializer = ConfirmOccurrenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interaction, recurring = confirm_recurring_occurrence(
            household,
            request.user,
            recurring,
            amount=serializer.validated_data.get("amount"),
        )
        return Response(
            {
                "recurring": self.get_serializer(recurring).data,
                "interaction_id": str(interaction.id),
            }
        )


class BudgetReportViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only monthly budget reports (parcours 21 lot 3).

    ``list`` = history (deterministic text, cheap). ``latest`` ensures the last
    closed month's report exists then returns it with the AI-polished narrative.
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = BudgetReportSerializer
    lookup_field = "month"
    lookup_value_regex = r"\d{4}-\d{2}"

    def get_queryset(self):
        qs = BudgetReport.objects.for_user_households(self.request.user)
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # Single-report views render the warm narrative; the list stays cheap.
        ctx["polish"] = self.action in ("latest", "retrieve")
        return ctx

    @action(detail=False, methods=["get"])
    def latest(self, request):
        """GET /api/budget/reports/latest/ — ensure + return last closed month's report."""
        household = request.household
        if household is None:
            return Response(None)
        report = get_or_generate_report(household, last_closed_month(household))
        return Response(self.get_serializer(report).data)
