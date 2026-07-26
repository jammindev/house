"""
Banking write service — single source of truth for account writes.

The REST viewset goes through these functions, and so will the statement
importer (lot 2) and any future agent writable: validation (through
``BankAccountSerializer``) and the household-scope invariants live in one place.
Never write accounts via the raw ORM from a caller — always here.
"""
from __future__ import annotations

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from . import importers
from .dedup import assign_discriminants, compute_dedup_hash
from .importers.parsing import normalize_label
from .models import (
    BankAccount,
    BankTransaction,
    ImportStatus,
    StatementImport,
    TransactionDirection,
)
from .serializers import BankAccountSerializer

# Fields a client may change after creation. ``default_provider`` and
# ``import_options`` are excluded on purpose: they are written by the import
# service (lot 2), not by the user.
UPDATABLE_FIELDS = frozenset(
    {
        "name",
        "bank_label",
        "kind",
        "currency",
        "iban_last4",
        "opening_balance",
        "opening_balance_date",
        "archived",
    }
)


def _save_scoped(serializer, household, user, *, creating: bool) -> BankAccount:
    """Persist through the serializer, mapping the uniqueness clash to a 400.

    "One account name per household" can only be checked at write time — a race
    or a duplicate name surfaces as ``IntegrityError``, which we translate into
    the field error a client expects from validation (mirror of
    ``budget.services._save_scoped``).
    """
    try:
        with transaction.atomic():
            if creating:
                return serializer.save(household=household, created_by=user)
            return serializer.save(updated_by=user)
    except IntegrityError as exc:
        if "uq_bank_account_name_per_hh" in str(exc).lower():
            raise ValidationError({"name": "An account with this name already exists."})
        raise ValidationError({"detail": "Could not save the account."})


def create_account(*, household, user, **fields) -> BankAccount:
    """Create an account for ``household`` on behalf of ``user``.

    Reuses ``BankAccountSerializer`` for validation (non-blank name, 3-letter
    currency, cash accounts stripped of their bank fields). Raises
    ``rest_framework.ValidationError`` on invalid input or a duplicate name.
    """
    serializer = BankAccountSerializer(data=fields)
    serializer.is_valid(raise_exception=True)
    return _save_scoped(serializer, household, user, creating=True)


def update_account(*, account: BankAccount, user, fields: dict) -> BankAccount:
    """Update ``account``. Only :data:`UPDATABLE_FIELDS` are editable."""
    payload = {k: v for k, v in fields.items() if k in UPDATABLE_FIELDS}
    serializer = BankAccountSerializer(account, data=payload, partial=True)
    serializer.is_valid(raise_exception=True)
    return _save_scoped(serializer, account.household, user, creating=False)


def archive_account(*, account: BankAccount, user) -> BankAccount:
    """Archive rather than delete — the reversible way to close an account.

    An account owns imported transactions that carry the household's financial
    history; deleting it would take them with it (and ``BankTransaction.account``
    is ``PROTECT``, so the ORM would refuse anyway). The ``DELETE`` verb on the
    viewset maps here, so a user's "delete" gesture is always recoverable.
    """
    return update_account(account=account, user=user, fields={"archived": True})


def remember_import_mapping(*, account: BankAccount, provider: str, options: dict | None) -> None:
    """Persist the column mapping on the account after a successful import.

    This is what makes the second import a drag-and-drop: the user describes
    their bank's format once. Written straight to the DB rather than through
    ``update_account`` because these two fields are deliberately read-only on the
    serializer — only the import owns them.
    """
    account.default_provider = provider
    account.import_options = options or {}
    account.save(update_fields=["default_provider", "import_options", "updated_at"])


def _failed_import(*, household, account, user, filename, provider, error) -> StatementImport:
    """Record a business failure. Not an HTTP error — a row the user can read."""
    return StatementImport.objects.create(
        household=household,
        account=account,
        provider=provider,
        filename=filename,
        status=ImportStatus.FAILED,
        error=str(error),
        created_by=user,
        updated_by=user,
    )


def import_statement_file(
    household,
    user,
    *,
    account: BankAccount,
    uploaded_file,
    provider: str | None = None,
    options: dict | None = None,
) -> StatementImport:
    """Import a statement file onto ``account`` — idempotent by design.

    The whole file is parsed and validated BEFORE anything is written, so a bad
    line leaves a ``status='failed'`` trace and **zero** transactions rather than
    a half-imported statement. Deduplication happens on
    ``(account, dedup_hash)`` via ``ignore_conflicts``: re-importing the same
    file creates nothing, and overlapping files only create what is genuinely new.

    Returns the ``StatementImport`` trace in every case — callers must inspect
    ``status``, never assume success.
    """
    filename = (getattr(uploaded_file, "name", "") or "")[:255]
    raw = uploaded_file.read()

    if provider:
        importer = importers.get_importer(provider)
        if importer is None:
            raise importers.ImporterError(f"unknown provider: {provider}")
    else:
        importer = importers.detect_importer(raw)
        if importer is None:
            return _failed_import(
                household=household,
                account=account,
                user=user,
                filename=filename,
                provider="",
                error="format not recognized — use the generic CSV mapping",
            )

    try:
        rows = importer.parse(raw, options=options)
    except importers.ImporterError as exc:
        return _failed_import(
            household=household,
            account=account,
            user=user,
            filename=filename,
            provider=importer.key,
            error=exc,
        )

    discriminants = assign_discriminants(rows)

    # In-file dedup: the same file may legitimately repeat a line, but the
    # discriminant already told them apart, so an identical hash here means the
    # file itself contains a true duplicate. Keep the first.
    unique: dict[str, tuple] = {}
    for row, discriminant in zip(rows, discriminants):
        label_norm = normalize_label(row.label_raw)
        digest = compute_dedup_hash(
            account_id=account.id,
            booked_on=row.booked_on,
            label_norm=label_norm,
            amount=row.amount,
            currency=row.currency,
            discriminant=discriminant,
        )
        unique.setdefault(digest, (row, label_norm))

    dates = [row.booked_on for row in rows]

    with transaction.atomic():
        imported = StatementImport.objects.create(
            household=household,
            account=account,
            provider=importer.key,
            filename=filename,
            status=ImportStatus.COMPLETED,
            period_start=min(dates),
            period_end=max(dates),
            created_by=user,
            updated_by=user,
        )

        base_qs = BankTransaction.objects.filter(account=account)
        before = base_qs.count()
        BankTransaction.objects.bulk_create(
            [
                BankTransaction(
                    household=household,
                    account=account,
                    booked_on=row.booked_on,
                    value_on=row.value_on,
                    label_raw=row.label_raw,
                    label_norm=label_norm[:255],
                    amount=row.amount,
                    currency=row.currency,
                    direction=(
                        TransactionDirection.OUT if row.amount < 0 else TransactionDirection.IN
                    ),
                    balance_after=row.balance_after,
                    external_id=row.external_id,
                    dedup_hash=digest,
                    source_import=imported,
                    created_by=user,
                )
                for digest, (row, label_norm) in unique.items()
            ],
            ignore_conflicts=True,
        )
        created = base_qs.count() - before
        imported.created_count = created
        imported.skipped_count = len(rows) - created
        imported.save(update_fields=["created_count", "skipped_count", "updated_at"])

        remember_import_mapping(account=account, provider=importer.key, options=options)

    return imported


def preview_statement_file(raw: bytes, *, options: dict | None = None) -> dict:
    """Cheap preview for the import dialog: detected format, columns, first lines.

    Never raises on a malformed file — the dialog must be able to show *something*
    so the user can see what they dropped and fix the mapping.
    """
    importer = importers.detect_importer(raw)
    if importer is None:
        importer = importers.get_importer("generic_csv")

    try:
        columns = importer.columns(raw, options=options)
    except importers.ImporterError:
        columns = []
    try:
        sample_lines = importer.sample_lines(raw)
    except importers.ImporterError:
        sample_lines = []

    return {
        "detected_provider": importer.key,
        "columns": columns,
        "sample_lines": sample_lines,
    }
