"""Banking REST API views."""
import json
from calendar import monthrange
from datetime import date
from decimal import Decimal, InvalidOperation

from django.db.models import F, Value

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from core.permissions import IsHouseholdMember
from core.timezones import household_today

from . import importers
from .aggregations import EMPTY_FLOW, compute_account_flow
from .anchoring import (
    FROM_ATTESTATION,
    FROM_STATEMENT,
    anchor_context,
    serialize_anchor_context,
)
from .balances import compute_balance, serialize_balance
from .coverage import serialize_coverage
from .history import (
    balance_series,
    household_series,
    serialize_history,
    serialize_household_history,
)
from .compliance import (
    get_detector,
    group_result,
    open_findings,
    serialize_finding,
    serialize_group,
    serialize_summary,
    waived_findings,
)
from .compliance import summary as compliance_summary
from .matching import (
    auto_reconcile,
    match_recurrences,
    serialize_candidate,
    serialize_recurring_match,
    suggestions_for,
)
from .models import (
    BankAccount,
    BankTransaction,
    ComplianceWaiver,
    InflowNature,
    StatementImport,
    TransactionDirection,
)
from . import queries
from .queries import AMOUNT_FIELD, search
from .validators import allocated_total, remaining_to_allocate
from .serializers import (
    BalanceAnchorInputSerializer,
    BankAccountSerializer,
    BankTransactionSerializer,
    ComplianceWaiverSerializer,
    StatementImportSerializer,
)
from .services import (
    adjust_cash_mirror,
    apply_statement_opening_balance,
    archive_account,
    create_account,
    credit_budget_from_refund,
    import_statement_file,
    record_cash_deposit,
    record_cash_expense,
    link_interaction,
    preview_statement_file,
    record_cash_withdrawal,
    revoke_waiver,
    set_allocations,
    set_refund_allocations,
    set_balance_anchor,
    unlink_counterpart,
    unlink_interaction,
    update_account,
    waive_finding,
)

#: A household statement is a few hundred lines; anything past this is not a
#: statement, and we refuse it before reading it into memory.
STATEMENT_MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _parse_date_param(value: str | None, field: str) -> date | None:
    """Parse a ``YYYY-MM-DD`` query param, rejecting anything else.

    A malformed filter must be a 400, never a silently ignored parameter that
    makes the user believe they are looking at a filtered list.
    """
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({field: "Expected a date in YYYY-MM-DD format."})


#: A balance curve defaults to the last rolling year — long enough to show a
#: season, short enough to stay one screen. ``months=0`` means "everything".
DEFAULT_HISTORY_MONTHS = 12
MAX_HISTORY_MONTHS = 120


def _window_start(request, *, end: date | None, household) -> date | None:
    """Start of the curve window, from ``?from=`` or a rolling ``?months=``.

    An explicit ``from`` wins. Otherwise the window is counted back in calendar
    months from ``end`` — never in 30-day chunks, which would make « les 12
    derniers mois » drift by five days a year.

    "Today" is the household's today (``core.timezones``), never the server's:
    the bound of a period decides which month an operation falls in.
    """
    explicit = _parse_date_param(request.query_params.get("from"), "from")
    if explicit is not None:
        return explicit

    raw = request.query_params.get("months")
    if raw is None:
        months = DEFAULT_HISTORY_MONTHS
    else:
        try:
            months = int(raw)
        except ValueError:
            raise ValidationError({"months": "Expected a whole number of months."})
        if months < 0 or months > MAX_HISTORY_MONTHS:
            raise ValidationError(
                {"months": f"Expected between 0 and {MAX_HISTORY_MONTHS} months."}
            )

    # 0 = the account's whole life: let ``banking.history`` pick its own start,
    # which is the opening balance date — the earliest point that means anything.
    if months == 0:
        return None
    return _months_back(end or household_today(household), months)


def _months_back(day: date, months: int) -> date:
    total = day.year * 12 + (day.month - 1) - months
    year, month = divmod(total, 12)
    month += 1
    return date(year, month, min(day.day, monthrange(year, month)[1]))


class BankAccountViewSet(viewsets.ModelViewSet):
    """CRUD for the household's accounts.

    Every write delegates to ``banking.services`` so the REST path, the statement
    importer (lot 2) and any future agent path stay identical. Any household
    member may manage accounts — money is a household-wide matter, like budgets.

    ``DELETE`` archives instead of destroying: an account owns the imported
    history from lot 2 on, so closing it must stay reversible.
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = BankAccountSerializer

    def get_queryset(self):
        qs = BankAccount.objects.for_user_households(self.request.user).select_related(
            "created_by"
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        if self.request.query_params.get("archived") != "true":
            qs = qs.filter(archived=False)
        return qs

    def _require_household(self):
        household = self.request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})
        return household

    def perform_create(self, serializer):
        # The service owns the write; bind the instance back so DRF's 201
        # response serializes what was actually persisted.
        household = self._require_household()
        serializer.instance = create_account(
            household=household,
            user=self.request.user,
            **serializer.validated_data,
        )

    def perform_update(self, serializer):
        serializer.instance = update_account(
            account=serializer.instance,
            user=self.request.user,
            fields=dict(serializer.validated_data),
        )

    def perform_destroy(self, instance):
        archive_account(account=instance, user=self.request.user)

    @action(detail=True, methods=["get"], url_path="balance")
    def balance(self, request, pk=None):
        """Current balance, how it was obtained, and whether it can be trusted.

        Computed at read time — there is no balance column. When the statement
        chain has a hole, ``is_reliable`` is false and ``gaps`` says where: a
        plausible-looking wrong number is worse than an admitted uncertainty.
        """
        account = self.get_object()
        as_of = _parse_date_param(request.query_params.get("as_of"), "as_of")
        return Response(serialize_balance(compute_balance(account=account, as_of=as_of)))

    @action(detail=True, methods=["get"], url_path="balance-history")
    def balance_history(self, request, pk=None):
        """The same balance, day by day, so its shape can be read.

        Unwound backwards from :func:`compute_balance` rather than recomputed —
        see :mod:`banking.history` for why the curve must end on the figure the
        card already shows.
        """
        account = self.get_object()
        end = _parse_date_param(request.query_params.get("to"), "to")
        start = _window_start(request, end=end, household=account.household)
        return Response(
            serialize_history(balance_series(account=account, start=start, end=end))
        )

    @action(detail=False, methods=["get"], url_path="balance-history")
    def household_balance_history(self, request):
        """Every live account on one shared axis, plus the household total.

        A list route because the shared axis is the product: curves sampled
        account by account would land on different days and could not be read
        against each other, let alone summed.
        """
        household = self._require_household()
        end = _parse_date_param(request.query_params.get("to"), "to")
        start = _window_start(request, end=end, household=household)
        return Response(
            serialize_household_history(
                household_series(household=household, start=start, end=end)
            )
        )

    @action(detail=True, methods=["get"], url_path="coverage")
    def coverage(self, request, pk=None):
        """What the conformity control can — or cannot — assert about this account.

        Its own endpoint rather than fields on the account: the window is derived
        from the imports and the lines, so it changes without the account row ever
        being written, and serializing it inline would make every list of accounts
        pay two aggregates per row.

        ⚠️ It answers with a **reason**, never a bare "no window". An account
        nobody has imported anything into is normal; an account whose opening
        balance date postdates its own statements is invisible to every control,
        and must say so — that confusion once shipped a green checkmark over an
        unchecked account (see ``banking.coverage``).
        """
        return Response(serialize_coverage(self.get_object()))

    @action(detail=True, methods=["get", "post"], url_path="balance-anchor")
    def balance_anchor(self, request, pk=None):
        """Find the opening balance the bank never told the user about.

        ``GET`` returns what House can establish on its own: whether the statement
        carries a balance to read, the last operation it holds (so the user can
        compare it with their bank before attesting anything), and the periods
        missing from the interval.

        ``POST`` records the reconstruction. With a statement balance available it
        takes no input at all — asking for a figure House can read is how a form
        loses its user. Otherwise it takes the balance the user read and subtracts
        the movements back to the start, refusing whenever the subtraction cannot
        be trusted (see :mod:`banking.anchoring`).
        """
        account = self.get_object()
        context = anchor_context(account)

        if request.method == "GET":
            return Response(serialize_anchor_context(context))

        if context.source == FROM_STATEMENT:
            result = apply_statement_opening_balance(account=account, user=request.user)
            return Response(
                {
                    "source": FROM_STATEMENT,
                    "opening_balance": str(result["opening_balance"]),
                    "opening_balance_date": result["opening_balance_date"].isoformat(),
                    "movements": None,
                    "account": BankAccountSerializer(account).data,
                }
            )

        payload = BalanceAnchorInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        from_date = data.get("from_date") or context.earliest_line
        if from_date is None:
            raise ValidationError(
                {
                    "detail": "This account holds no line to reconstruct from.",
                    "code": "no_transactions",
                }
            )

        result = set_balance_anchor(
            account=account,
            user=request.user,
            balance=data["balance"],
            as_of=data["as_of"],
            from_date=from_date,
        )
        return Response(
            {
                "source": FROM_ATTESTATION,
                "opening_balance": str(result["opening_balance"]),
                "opening_balance_date": from_date.isoformat(),
                "movements": str(result["movements"]),
                "account": BankAccountSerializer(account).data,
            }
        )


class StatementImportViewSet(viewsets.ReadOnlyModelViewSet):
    """Statement imports: history (GET), file drop (POST), preview (POST).

    **No ``DELETE``.** Deleting an import then re-importing would recreate the
    transactions with fresh UUIDs and silently drop every allocation attached to
    them (lot 5). The history is append-only by design.

    **A business failure is a 201, not a 400.** An unreadable file or a wrong
    mapping is a normal outcome the user must be able to read and act on: it
    returns the created trace with ``status='failed'`` and zero transactions.
    Only malformed *requests* (missing account, unknown provider, bad JSON) are
    4xx. Same contract as ``electricity.ConsumptionImportViewSet``.
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = StatementImportSerializer
    parser_classes = [MultiPartParser, FormParser]
    # Belt and braces on top of ReadOnlyModelViewSet: no verb can ever remove or
    # rewrite an import trace.
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = StatementImport.objects.for_user_households(self.request.user).select_related(
            "account"
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        account_id = self.request.query_params.get("account")
        if account_id:
            qs = qs.filter(account_id=account_id)
        return qs

    def _require_household(self):
        household = self.request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})
        return household

    def _resolve_account(self, household):
        account_id = self.request.data.get("account")
        if not account_id:
            raise ValidationError({"account": "This field is required."})
        account = BankAccount.objects.filter(household=household, pk=account_id).first()
        if account is None:
            raise ValidationError({"account": "Unknown account for this household."})
        return account

    def _uploaded_file(self):
        uploaded = self.request.FILES.get("file")
        if uploaded is None:
            raise ValidationError({"file": "This field is required."})
        if uploaded.size > STATEMENT_MAX_SIZE:
            raise ValidationError(
                {"file": f"File is too large (max {STATEMENT_MAX_SIZE // (1024 * 1024)} MB)."}
            )
        return uploaded

    def _options(self):
        """Parse the mapping options — a JSON string when sent as multipart."""
        raw = self.request.data.get("options")
        if raw in (None, ""):
            return None
        if isinstance(raw, dict):
            return raw
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            raise ValidationError({"options": "Expected a JSON object."})
        if not isinstance(parsed, dict):
            raise ValidationError({"options": "Expected a JSON object."})
        return parsed

    def create(self, request, *args, **kwargs):
        household = self._require_household()
        account = self._resolve_account(household)
        uploaded = self._uploaded_file()
        options = self._options()

        provider = (request.data.get("provider") or "").strip() or None
        if provider and importers.get_importer(provider) is None:
            raise ValidationError({"provider": f"Unknown provider: {provider}"})

        imported = import_statement_file(
            household,
            request.user,
            account=account,
            uploaded_file=uploaded,
            provider=provider,
            options=options,
        )
        return Response(
            self.get_serializer(imported).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="preview")
    def preview(self, request):
        """Detected format, column names and first lines — to build the mapping."""
        self._require_household()
        uploaded = self._uploaded_file()
        return Response(preview_statement_file(uploaded.read(), options=self._options()))


class BankTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """The bank journal: read and qualify statement lines.

    A transaction is **immutable in substance** — ``label_raw``, ``amount``,
    ``booked_on`` and ``direction`` are what the bank says, and the serializer
    marks them read-only. What a user may do is *qualify* the line: flag it as an
    internal movement, or attach a note. Hence a narrow ``qualify`` action rather
    than a generic PATCH: the set of writable fields is a decision, not an
    oversight.
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = BankTransactionSerializer
    # ``put`` and ``delete`` are here only for the ``allocations`` /
    # ``unlink-cash`` actions: the viewset has no ``update`` and no ``destroy``,
    # so a plain PUT or DELETE on a transaction is still a 405.
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    class Pagination(LimitOffsetPagination):
        default_limit = 50
        max_limit = 200

    pagination_class = Pagination

    def get_queryset(self):
        # ``with_allocation`` so the serializer can badge « ventilée / partielle /
        # non ventilée » without one query per line.
        #
        # ⚠️ The explicit ``order_by`` is not decoration: since Django 3.1 a
        # ``GROUP BY`` query **ignores** ``Meta.ordering``, so annotating silently
        # served the journal in insertion order — oldest first. Same tuple as
        # ``BankTransaction.Meta.ordering``.
        qs = (
            queries.with_allocation(
                BankTransaction.objects.for_user_households(self.request.user)
            )
            .select_related("account")
            .prefetch_related("refund_allocations__budget")
            .order_by("-booked_on", "-line_no", "-created_at")
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)

        params = self.request.query_params

        account_id = params.get("account")
        if account_id:
            qs = qs.filter(account_id=account_id)

        date_from = _parse_date_param(params.get("date_from"), "date_from")
        if date_from:
            qs = qs.filter(booked_on__gte=date_from)
        date_to = _parse_date_param(params.get("date_to"), "date_to")
        if date_to:
            qs = qs.filter(booked_on__lte=date_to)

        # « Quelles lignes pourraient porter cette dépense ? » — le pendant, depuis
        # la dépense, de la file « À ranger » qui part de la ligne.
        #
        # Le matcher automatique ne répondra jamais à ça : un achat de 90 € face à
        # une ligne de 150 € est rejeté par ``score_pair``, à raison — 60 € d'écart
        # n'est pas un appariement plausible. Mais c'est un cas réel, et le seul
        # qui sache trancher est l'utilisateur. On lui montre donc ce qui a
        # *matériellement* la place : le reste à ventiler doit couvrir le montant.
        fits = params.get("fits")
        if fits:
            try:
                needed = Decimal(fits)
            except (InvalidOperation, TypeError):
                raise ValidationError({"fits": "Expected a decimal amount."})
            if needed <= 0:
                raise ValidationError({"fits": "Expected a positive amount."})
            qs = qs.filter(
                direction=TransactionDirection.OUT,
                is_internal=False,
                transfer_counterpart__isnull=True,
            ).filter(outflow_value__gte=F("allocated") + Value(needed, output_field=AMOUNT_FIELD))

        # Les remboursements d'une enveloppe — ce qui permet à la page d'un budget
        # d'afficher la ligne qui lui a rendu de l'argent, à côté des dépenses qui
        # l'ont consommé.
        refund_budget = params.get("refund_budget")
        if refund_budget:
            qs = qs.filter(refund_allocations__budget_id=refund_budget).distinct()

        direction = params.get("direction")
        if direction:
            if direction not in TransactionDirection.values:
                raise ValidationError({"direction": "Expected 'out' or 'in'."})
            qs = qs.filter(direction=direction)

        internal = params.get("is_internal")
        if internal is not None and internal != "":
            qs = qs.filter(is_internal=internal.lower() in ("1", "true", "yes"))

        # « À traiter » : les lignes que le contrôle réclame, et rien d'autre.
        #
        # Le marqueur par ligne existe depuis #413, mais il n'y avait aucun moyen
        # de ne voir que celles-là — sur un relevé de 160 lignes, le badge disait
        # quoi faire sans qu'on puisse s'y rendre. Le filtre passe par
        # ``detectors.pending_outflows``, donc par le **même** jugement que le
        # compteur : une liste dont le nombre contredirait le badge serait pire
        # que pas de filtre du tout.
        if params.get("allocation") == "todo":
            household = self.request.household
            if household is None:
                return qs.none()
            from .detectors import pending_outflows

            qs = qs.filter(pk__in=pending_outflows(household).values("pk"))

        term = params.get("q")
        if term:
            qs = search(qs, term)

        return qs

    @action(detail=True, methods=["patch"], url_path="qualify")
    def qualify(self, request, pk=None):
        """Flag a line as internal, or annotate it.

        The only mutation a statement line accepts. Everything else about it
        belongs to the bank.
        """
        instance = self.get_object()
        updated_fields = []

        if "is_internal" in request.data:
            instance.is_internal = bool(request.data.get("is_internal"))
            updated_fields.append("is_internal")
        if "notes" in request.data:
            instance.notes = str(request.data.get("notes") or "")
            updated_fields.append("notes")
        if "inflow_nature" in request.data:
            nature = str(request.data.get("inflow_nature") or "")
            if nature and nature not in InflowNature.values:
                raise ValidationError(
                    {"inflow_nature": f"Expected one of {', '.join(InflowNature.values)}."}
                )
            if nature and instance.amount < 0:
                # An outflow has no nature: the field exists to say what a *receipt*
                # is. Silently accepting it would create rows the detector cannot
                # reason about.
                raise ValidationError(
                    {"inflow_nature": "Only a receipt can be classified."}
                )
            instance.inflow_nature = nature
            updated_fields.append("inflow_nature")
            # Reclasser un remboursement en salaire efface ses attributions.
            # Sinon des enveloppes restent recréditées par une ligne qui ne
            # prétend plus rembourser quoi que ce soit — un orphelin silencieux,
            # et le pire : un plafond qui reste faux dans le bon sens.
            if nature != InflowNature.REFUND:
                instance.refund_allocations.all().delete()

        if not updated_fields:
            raise ValidationError(
                {"detail": "Provide 'is_internal', 'inflow_nature' and/or 'notes'."}
            )

        instance.updated_by = request.user
        instance.save(update_fields=[*updated_fields, "updated_by", "updated_at"])
        return Response(self.get_serializer(instance).data)

    @action(detail=False, methods=["post"], url_path="cash-expense")
    def cash_expense(self, request):
        """Spend cash: create the operation **and** its allocation, together.

        The point of going through the account rather than creating a bare expense:
        a spend that exists only as an ``Interaction`` is an expense the bank never
        saw, which the conformity control can only ever report as an écart nobody
        can resolve. Recording it as a real account line removes that orphan by
        construction.

        Atomic on purpose — see ``services.record_cash_expense``. Creating the line
        and letting the user allocate it later would drop a freshly created
        operation straight into the "unallocated" queue: the app manufacturing its
        own écarts.
        """
        from interactions.serializers import InteractionSerializer

        household = request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})

        account_id = request.data.get("account")
        if not account_id:
            raise ValidationError({"account": "This field is required."})
        account = BankAccount.objects.filter(household=household, pk=account_id).first()
        if account is None:
            raise ValidationError({"account": "Unknown account for this household."})

        # ``household_today`` et non ``date.today()`` : une dépense en espèces
        # saisie le soir à Paris serait datée du lendemain par l'horloge UTC du
        # serveur — donc rangée dans le mois suivant deux fois par an.
        booked_on = _parse_date_param(
            request.data.get("booked_on"), "booked_on"
        ) or household_today(household)

        try:
            transaction_row, allocations = record_cash_expense(
                household=household,
                user=request.user,
                account=account,
                booked_on=booked_on,
                label=str(request.data.get("label") or ""),
                amount=request.data.get("amount") or 0,
                budget_id=request.data.get("budget_id"),
                zone_ids=request.data.get("zone_ids") or [],
                source_type=request.data.get("source_type"),
                source_id=request.data.get("source_id"),
                notes=str(request.data.get("notes") or ""),
            )
        except (TypeError, ValueError, InvalidOperation):
            # A non-numeric amount is a client mistake, not a server fault.
            raise ValidationError({"amount": "Expected a decimal amount."})

        return Response(
            {
                "transaction": self.get_serializer(transaction_row).data,
                "allocations": InteractionSerializer(allocations, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="cash-deposit")
    def cash_deposit(self, request):
        """Cash that came in from outside: a gift, a sale, a share paid in coins.

        The missing half of the cash story — until now the only way cash could
        enter was mirroring a bank withdrawal, so money handed over in notes had no
        representation at all. The advice one could give was to inflate the opening
        balance, which rewrites history to record a dated fact.

        Born classified (``inflow_nature`` required), for the same reason a cash
        spend is born allocated: the app must not create its own écart.
        """
        household = request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})

        account_id = request.data.get("account")
        if not account_id:
            raise ValidationError({"account": "This field is required."})
        account = BankAccount.objects.filter(household=household, pk=account_id).first()
        if account is None:
            raise ValidationError({"account": "Unknown account for this household."})

        booked_on = _parse_date_param(
            request.data.get("booked_on"), "booked_on"
        ) or household_today(household)

        try:
            transaction_row = record_cash_deposit(
                household=household,
                user=request.user,
                account=account,
                booked_on=booked_on,
                label=str(request.data.get("label") or ""),
                amount=request.data.get("amount") or 0,
                inflow_nature=str(request.data.get("inflow_nature") or ""),
                refund_lines=request.data.get("refund_lines") or None,
                notes=str(request.data.get("notes") or ""),
            )
        except (TypeError, ValueError, InvalidOperation):
            raise ValidationError({"amount": "Expected a decimal amount."})

        return Response(
            self.get_serializer(transaction_row).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["get"], url_path="flow")
    def flow(self, request):
        """Money in / out over a period, internal movements excluded.

        Never add this to a budget or expense total — see the module docstring of
        ``banking.aggregations``.
        """
        household = request.household
        if household is None:
            return Response(EMPTY_FLOW)

        account = None
        account_id = request.query_params.get("account")
        if account_id:
            account = BankAccount.objects.filter(household=household, pk=account_id).first()
            if account is None:
                raise ValidationError({"account": "Unknown account for this household."})

        return Response(
            compute_account_flow(
                household=household,
                account=account,
                date_from=_parse_date_param(request.query_params.get("date_from"), "date_from"),
                date_to=_parse_date_param(request.query_params.get("date_to"), "date_to"),
            )
        )

    @action(detail=True, methods=["post"], url_path="withdraw-to-cash")
    def withdraw_to_cash(self, request, pk=None):
        """Mirror this withdrawal as a credit on a cash account.

        Both legs become internal movements, so neither shows up in spending —
        the money is counted once, later, when the cash is actually spent.
        """
        instance = self.get_object()
        household = request.household or instance.household

        cash_account_id = request.data.get("cash_account")
        if not cash_account_id:
            raise ValidationError({"cash_account": "This field is required."})
        cash_account = BankAccount.objects.filter(
            household=household, pk=cash_account_id
        ).first()
        if cash_account is None:
            raise ValidationError({"cash_account": "Unknown account for this household."})

        mirror = record_cash_withdrawal(
            user=request.user,
            transaction=instance,
            cash_account=cash_account,
            amount=request.data.get("amount"),
        )
        return Response(self.get_serializer(mirror).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="cash-mirror")
    def cash_mirror(self, request, pk=None):
        """Corriger **quelle part** de ce retrait est entrée dans la caisse.

        La résolution de l'écart `cash_mirror_partial`. Déclarer 60 € d'un retrait
        de 100 € était possible dès le départ ; le corriger à 100 € ne l'était pas —
        il fallait délier puis refaire, ce qui détruit et recrée la ligne espèces.
        """
        instance = self.get_object()
        mirror = adjust_cash_mirror(
            user=request.user,
            transaction=instance,
            amount=request.data.get("amount"),
        )
        return Response(self.get_serializer(mirror).data)

    @action(detail=True, methods=["delete"], url_path="unlink-cash")
    def unlink_cash(self, request, pk=None):
        """Undo the cash counterpart — deletes only the leg we generated."""
        instance = self.get_object()
        unlink_counterpart(user=request.user, transaction=instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "put"], url_path="allocations")
    def allocations(self, request, pk=None):
        """Read or replace the split of this operation.

        ``PUT`` is a **set**: the client sends the whole split it wants. That is
        the only way "80/40 becomes 100/20" stays atomic — per-line CRUD would
        pass through states that violate the invariant.
        """
        instance = self.get_object()

        if request.method == "GET":
            return Response(self._allocation_payload(instance))

        lines = request.data.get("lines")
        if not isinstance(lines, list):
            raise ValidationError({"lines": "Expected a list of allocation lines."})

        household = request.household or instance.household
        set_allocations(
            household=household, user=request.user, transaction=instance, lines=lines
        )
        # Re-read through the annotated queryset rather than ``refresh_from_db``:
        # the latter reloads columns but leaves the stale ``allocated`` annotation
        # in place, so the response would badge the line with its pre-write state.
        return Response(self._allocation_payload(self.get_object()))

    @action(detail=True, methods=["put"], url_path="refund-allocations")
    def refund_allocations_write(self, request, pk=None):
        """Remplacer la répartition d'un remboursement sur les enveloppes.

        ``PUT`` et non des CRUD par ligne, pour la raison qui vaut aussi pour les
        sorties : « 40/30 devient 50/20 » doit être atomique, sinon on traverse
        un état où la somme dépasse ce que la recette a rapporté.
        """
        instance = self.get_object()

        lines = request.data.get("lines")
        if not isinstance(lines, list):
            raise ValidationError({"lines": "Expected a list of refund allocation lines."})

        household = request.household or instance.household
        set_refund_allocations(
            household=household, user=request.user, transaction=instance, lines=lines
        )
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=["post"], url_path="credit-budget")
    def credit_budget(self, request, pk=None):
        """Créditer une seule enveloppe depuis ce remboursement.

        ``POST`` d'une paire (budget, montant) et non le ``PUT`` complet d'à
        côté : ce geste part d'**une** dépense et ne connaît que son enveloppe.
        Passer par le ``PUT`` effacerait ce que les autres dépenses ont déjà
        rattaché à la même recette — voir
        :func:`banking.services.credit_budget_from_refund`.
        """
        instance = self.get_object()
        household = request.household or instance.household

        credit_budget_from_refund(
            household=household,
            user=request.user,
            transaction=instance,
            budget_id=request.data.get("budget"),
            amount=request.data.get("amount"),
        )
        return Response(self.get_serializer(self.get_object()).data)

    def _allocation_payload(self, instance) -> dict:
        from interactions.serializers import InteractionSerializer

        allocations = list(
            instance.interactions.all().select_related(
                "budget", "household", "bank_transaction__account"
            )
        )
        return {
            "transaction": self.get_serializer(instance).data,
            "allocations": InteractionSerializer(allocations, many=True).data,
            "allocated": str(allocated_total(instance)),
            "remaining": str(remaining_to_allocate(instance)),
        }

    @action(detail=True, methods=["post"], url_path="link")
    def link(self, request, pk=None):
        """Attach an existing expense to this operation (manual reconciliation)."""
        from interactions.models import Interaction
        from interactions.serializers import InteractionSerializer

        instance = self.get_object()
        interaction_id = request.data.get("interaction")
        if not interaction_id:
            raise ValidationError({"interaction": "This field is required."})

        interaction = Interaction.objects.filter(
            pk=interaction_id, household_id=instance.household_id
        ).first()
        if interaction is None:
            raise ValidationError({"interaction": "Unknown expense for this household."})

        link_interaction(user=request.user, transaction=instance, interaction=interaction)
        return Response(InteractionSerializer(interaction).data)

    @action(detail=True, methods=["delete"], url_path="unlink/(?P<interaction_id>[^/.]+)")
    def unlink(self, request, pk=None, interaction_id=None):
        """Detach an expense from this operation. The expense itself survives."""
        from interactions.models import Interaction

        instance = self.get_object()
        interaction = Interaction.objects.filter(
            pk=interaction_id, bank_transaction=instance
        ).first()
        if interaction is None:
            raise ValidationError({"interaction": "Not allocated to this operation."})

        unlink_interaction(user=request.user, interaction=interaction)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="reconcile")
    def reconcile(self, request):
        """Run the matcher on demand.

        Covers the other direction of the delay: the user recorded a purchase
        *after* importing the statement, so the import-time pass could not see it.
        """
        household = request.household
        if household is None:
            return Response(
                {
                    "auto_matched": 0,
                    "suggestions": [],
                    "recurring_confirmed": 0,
                    "recurring_suggestions": [],
                }
            )

        outcome = auto_reconcile(
            household=household,
            user=request.user,
            date_from=_parse_date_param(request.data.get("date_from"), "date_from"),
            date_to=_parse_date_param(request.data.get("date_to"), "date_to"),
        )
        # Puis les récurrences, sur ce qui reste libre (parcours 26 lot 6). Même
        # raison que pour les dépenses : l'utilisateur a pu créer la récurrence
        # *après* l'import, donc le passage à l'import ne pouvait pas la voir.
        recurring = match_recurrences(household=household, user=request.user)

        return Response(
            {
                "auto_matched": outcome["auto_matched"],
                "suggestions": [serialize_candidate(c) for c in outcome["suggestions"]],
                "recurring_confirmed": recurring["confirmed"],
                "recurring_suggestions": [
                    serialize_recurring_match(m) for m in recurring["suggestions"]
                ],
            }
        )

    @action(detail=True, methods=["get"], url_path="suggestions")
    def suggestions(self, request, pk=None):
        """Best candidate expenses for this line, for the manual dialog."""
        from interactions.models import Interaction
        from interactions.serializers import InteractionSerializer

        instance = self.get_object()
        candidates = suggestions_for(transaction=instance)
        by_id = {
            str(i.pk): i
            for i in Interaction.objects.filter(
                pk__in=[c.interaction_id for c in candidates]
            ).select_related("budget")
        }
        return Response(
            [
                {
                    **serialize_candidate(candidate),
                    "interaction": InteractionSerializer(
                        by_id[candidate.interaction_id]
                    ).data,
                }
                for candidate in candidates
                if candidate.interaction_id in by_id
            ]
        )


class ComplianceViewSet(viewsets.ViewSet):
    """The conformity control — every écart the app knows how to detect.

    Two endpoints, and the split between them is a performance decision, not a
    stylistic one:

    - ``GET /compliance/`` returns **counts only**. The shell badge reads it on
      every navigation, so it must cost a bounded number of indexed ``COUNT(*)``,
      never a scan materialised into Python.
    - ``GET /compliance/{kind}/`` returns the paginated list of one group, and only
      runs for the group the user actually opened.

    ``?waived=true`` returns the audit list instead of the actionable one: the
    arbitrated écarts, each with its motive, revocable in one click. The two lists
    together account for every detected écart — ``open + waived == detected``.
    """

    permission_classes = [IsHouseholdMember]

    #: The list is read at every navigation; keep the page small and bounded.
    DEFAULT_LIMIT = 25
    MAX_LIMIT = 200

    def _require_household(self):
        household = self.request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})
        return household

    def list(self, request):
        household = request.household
        if household is None:
            return Response({"groups": [], "open_total": 0, "waived_total": 0, "stale_total": 0})
        return Response(serialize_summary(compliance_summary(household)))

    def retrieve(self, request, pk=None):
        """One group's findings. ``pk`` is the detector kind."""
        household = self._require_household()
        spec = get_detector(pk)
        if spec is None:
            raise ValidationError({"kind": f"Unknown compliance check: {pk}"})

        limit, offset = self._page(request)
        wants_waived = request.query_params.get("waived") == "true"
        findings = (
            waived_findings(household, spec, limit=limit, offset=offset)
            if wants_waived
            else open_findings(household, spec, limit=limit, offset=offset)
        )
        return Response(
            {
                # ``group_result`` et non ``summary`` : ouvrir un groupe ne doit
                # pas recompter les treize autres, dont la marche arithmétique sur
                # la chaîne de soldes et le calcul du solde espèces. Le badge lit
                # le résumé complet, c'est son travail ; le détail n'a besoin que
                # de son propre en-tête.
                **serialize_group(group_result(household, spec)),
                "results": [serialize_finding(f) for f in findings],
                "limit": limit,
                "offset": offset,
            }
        )

    def _page(self, request) -> tuple[int, int]:
        def _int(name, default):
            raw = request.query_params.get(name)
            if raw in (None, ""):
                return default
            try:
                return max(0, int(raw))
            except ValueError:
                raise ValidationError({name: "Expected an integer."})

        return min(_int("limit", self.DEFAULT_LIMIT), self.MAX_LIMIT), _int("offset", 0)


class ComplianceWaiverViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Arbitrations: list, create, revoke.

    No ``PATCH``: re-arbitrating goes through ``POST`` again, which
    ``waive_finding`` turns into an update of the motive *and* of the fingerprint.
    Letting a client PATCH the motive alone would leave a stale fingerprint
    behind — a waiver that looks current but arbitrates a situation that has moved.

    ``DELETE`` brings the écart back identical. That reversibility is what makes
    the control trustworthy: nothing here destroys information.
    """

    permission_classes = [IsHouseholdMember]
    serializer_class = ComplianceWaiverSerializer

    def get_queryset(self):
        qs = ComplianceWaiver.objects.for_user_households(self.request.user).select_related(
            "created_by"
        )
        if self.request.household:
            qs = qs.filter(household=self.request.household)
        kind = self.request.query_params.get("finding_kind")
        if kind:
            qs = qs.filter(finding_kind=kind)
        return qs

    def create(self, request, *args, **kwargs):
        household = request.household
        if household is None:
            raise ValidationError({"household_id": "A valid household context is required."})

        waiver = waive_finding(
            household=household,
            user=request.user,
            finding_kind=(request.data.get("finding_kind") or "").strip(),
            object_id=(request.data.get("object_id") or "").strip(),
            reason=request.data.get("reason") or "",
        )
        return Response(
            self.get_serializer(waiver).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_destroy(self, instance):
        revoke_waiver(waiver=instance)
