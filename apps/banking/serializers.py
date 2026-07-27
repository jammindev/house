"""Banking serializers — account CRUD + statement import API."""
from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from . import queries
from .coverage import covered_period
from .models import BankAccount, BankTransaction, ComplianceWaiver, StatementImport

ZERO = Decimal("0.00")


class BankAccountSerializer(serializers.ModelSerializer):
    """Full read/write serializer for the account API.

    ``name`` is required and non-blank; the "unique name per household" invariant
    can only be checked at write time, so the service layer maps the DB clash to
    a clean 400 (see ``banking.services``).

    ``opening_balance`` is deliberately NOT constrained to be positive — an
    account can legitimately start in the red (overdraft).
    """

    class Meta:
        model = BankAccount
        fields = [
            "id",
            "household",
            "name",
            "bank_label",
            "kind",
            "currency",
            "iban_last4",
            "opening_balance",
            "opening_balance_date",
            "attested_balance",
            "attested_on",
            "default_provider",
            "import_options",
            "archived",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = [
            "id",
            "household",
            "created_at",
            "updated_at",
            "created_by",
            # Written by the import service (lot 2), never by the client.
            "default_provider",
            "import_options",
            # Written only by the balance-anchor action, which recomputes
            # ``opening_balance`` from them in the same transaction. Letting a
            # client PATCH one of the two apart would store an attestation that
            # contradicts the opening balance it is supposed to justify.
            "attested_balance",
            "attested_on",
        ]

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("This field cannot be blank.")
        return value

    def validate_currency(self, value):
        value = (value or "").strip().upper()
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError("Expected a 3-letter currency code.")
        return value

    def validate_iban_last4(self, value):
        """Guard the "no full IBAN in the database" rule at the API boundary.

        Anything longer than 4 characters is a sign the client sent a whole IBAN,
        which must never be persisted — reject rather than silently truncate.
        """
        value = (value or "").strip().upper()
        if value and not value.isalnum():
            raise serializers.ValidationError("Expected up to 4 alphanumeric characters.")
        return value

    def validate(self, attrs):
        """A cash account has no bank behind it: keep its bank fields empty.

        And **on creation, the opening balance date is required** (parcours 26,
        lot 7). Without it the account has no conformity window: its balance is a
        guess, and no other control can assert anything about it — the lot 1
        detector reports exactly that, as a blocking prerequisite. Closing the door
        at creation is cheaper than asking the user to come back and fix it.

        Only on creation: an existing account without one is handled by the
        detector, and forcing the field on every PATCH would make an unrelated
        rename impossible until the user fills it in.
        """
        kind = attrs.get("kind", getattr(self.instance, "kind", BankAccount.Kind.BANK))
        if kind == BankAccount.Kind.CASH:
            attrs["bank_label"] = ""
            attrs["iban_last4"] = ""

        if self.instance is None and attrs.get("opening_balance_date") is None:
            raise serializers.ValidationError(
                {
                    "opening_balance_date": (
                        "Required: without a starting point the balance is a guess, "
                        "and no conformity check can cover this account."
                    )
                }
            )

        return attrs


class BalanceAnchorInputSerializer(serializers.Serializer):
    """Input of ``POST /accounts/{id}/balance-anchor/``.

    ``balance`` may be negative — an overdraft is a balance like any other. The
    dates are checked against the account's own lines by
    :mod:`banking.anchoring`, which is the only place that can tell whether the
    subtraction is safe; validating them here would duplicate that judgement with
    half the information.
    """

    balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    as_of = serializers.DateField()
    #: Defaults to the account's oldest line, which is what the user wants in
    #: nearly every case: cover everything you hold.
    from_date = serializers.DateField(required=False, allow_null=True)


class StatementImportSerializer(serializers.ModelSerializer):
    """Read serializer for the import history.

    Everything is read-only: an import trace is a fact, not a form. A failed
    import is a perfectly valid row — the client reads ``status`` and ``error``
    rather than relying on the HTTP code (see ``StatementImportViewSet``).
    """

    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = StatementImport
        fields = [
            "id",
            "account",
            "account_name",
            "provider",
            "filename",
            "status",
            "created_count",
            "skipped_count",
            "auto_matched_count",
            "error",
            "period_start",
            "period_end",
            "created_at",
        ]
        read_only_fields = fields


class BankTransactionSerializer(serializers.ModelSerializer):
    """Read serializer for a statement line.

    ``label_raw``, ``amount``, ``direction`` and ``dedup_hash`` are immutable:
    this is what the bank says. Only the qualification fields (``is_internal``,
    ``notes``) are writable — and only through the lot 3 ``qualify`` action.

    **Où en est cette ligne** (``allocation_state``) is computed here rather than
    in the client: the answer depends on the account's conformity window, which
    the journal has no business re-deriving, and it has to agree — line by line —
    with what the Contrôle tab counts. Both read
    :func:`banking.queries.allocation_state`.
    """

    allocated_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    allocation_state = serializers.SerializerMethodField()

    class Meta:
        model = BankTransaction
        fields = [
            "id",
            "account",
            "booked_on",
            "value_on",
            "label_raw",
            "amount",
            "currency",
            "direction",
            "is_internal",
            "inflow_nature",
            "balance_after",
            "external_id",
            "notes",
            "source_import",
            "transfer_counterpart",
            "allocated_amount",
            "remaining_amount",
            "allocation_state",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "account",
            "booked_on",
            "value_on",
            "label_raw",
            "amount",
            "currency",
            "direction",
            "balance_after",
            "external_id",
            "source_import",
            "transfer_counterpart",
            "created_at",
        ]

    def get_allocated_amount(self, obj) -> str:
        return str(self._allocated(obj))

    def get_remaining_amount(self, obj) -> str:
        """What is still owed an explanation, never negative.

        Over-allocating is already impossible (``assert_allocation_fits``); if a
        legacy row ever went past, showing « reste −5 € » would invite someone to
        fix it by adding more.
        """
        if obj.amount >= 0:
            return str(ZERO)
        return str(max(-obj.amount - self._allocated(obj), ZERO))

    def get_allocation_state(self, obj) -> str:
        return queries.allocation_state(
            obj, allocated=self._allocated(obj), window=self._window(obj)
        )

    def _allocated(self, obj) -> Decimal:
        """Prefer the queryset annotation; fall back to a query for lone objects.

        The journal annotates via ``queries.with_allocation`` — without it, fifty
        rows would mean fifty extra queries. But single-object responses (the
        ``qualify`` action, the cash counterpart) serialize an unannotated
        instance, and answering « 0 » there would badge a fully sorted line as
        untreated.
        """
        annotated = getattr(obj, "allocated", None)
        if annotated is not None:
            return annotated
        total = obj.interactions.filter(type="expense").aggregate(t=Sum("amount"))["t"]
        return total or ZERO

    def _window(self, obj):
        """Conformity window of the line's account, memoized per response.

        ``covered_period`` costs two aggregates; a household has a handful of
        accounts and a page has fifty lines.
        """
        cache = self.context.setdefault("_allocation_windows", {})
        if obj.account_id not in cache:
            cache[obj.account_id] = covered_period(obj.account)
        return cache[obj.account_id]


class ComplianceWaiverSerializer(serializers.ModelSerializer):
    """Read serializer for an arbitration.

    Writes go through ``services.waive_finding``, never through this serializer:
    creating a waiver requires re-running the detector (to prove the écart exists
    and to capture its fingerprint), which is service work, not field validation.
    """

    class Meta:
        model = ComplianceWaiver
        fields = [
            "id",
            "finding_kind",
            "object_id",
            "reason",
            "fingerprint",
            "created_at",
            "created_by",
        ]
        read_only_fields = fields
