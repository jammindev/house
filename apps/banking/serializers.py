"""Banking serializers — account CRUD + statement import API."""
from rest_framework import serializers

from .models import BankAccount, BankTransaction, StatementImport


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
        """A cash account has no bank behind it: keep its bank fields empty."""
        kind = attrs.get("kind", getattr(self.instance, "kind", BankAccount.Kind.BANK))
        if kind == BankAccount.Kind.CASH:
            attrs["bank_label"] = ""
            attrs["iban_last4"] = ""
        return attrs


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
    """

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
            "balance_after",
            "external_id",
            "notes",
            "source_import",
            "transfer_counterpart",
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
