"""Banking REST API views."""
import json
from datetime import date

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from core.permissions import IsHouseholdMember

from . import importers
from .aggregations import EMPTY_FLOW, compute_account_flow
from .models import BankAccount, BankTransaction, StatementImport, TransactionDirection
from .queries import search
from .serializers import (
    BankAccountSerializer,
    BankTransactionSerializer,
    StatementImportSerializer,
)
from .services import (
    archive_account,
    create_account,
    import_statement_file,
    preview_statement_file,
    update_account,
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
    http_method_names = ["get", "post", "patch", "head", "options"]

    class Pagination(LimitOffsetPagination):
        default_limit = 50
        max_limit = 200

    pagination_class = Pagination

    def get_queryset(self):
        qs = BankTransaction.objects.for_user_households(self.request.user).select_related(
            "account"
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

        direction = params.get("direction")
        if direction:
            if direction not in TransactionDirection.values:
                raise ValidationError({"direction": "Expected 'out' or 'in'."})
            qs = qs.filter(direction=direction)

        internal = params.get("is_internal")
        if internal is not None and internal != "":
            qs = qs.filter(is_internal=internal.lower() in ("1", "true", "yes"))

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

        if not updated_fields:
            raise ValidationError({"detail": "Provide 'is_internal' and/or 'notes'."})

        instance.updated_by = request.user
        instance.save(update_fields=[*updated_fields, "updated_by", "updated_at"])
        return Response(self.get_serializer(instance).data)

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
