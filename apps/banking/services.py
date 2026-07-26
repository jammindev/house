"""
Banking write service — single source of truth for account writes.

The REST viewset goes through these functions, and so will the statement
importer (lot 2) and any future agent writable: validation (through
``BankAccountSerializer``) and the household-scope invariants live in one place.
Never write accounts via the raw ORM from a caller — always here.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import IntegrityError, transaction
# Imported directly so the cash-counterpart helpers can take a parameter named
# ``transaction`` (a BankTransaction) without shadowing the Django module.
from django.db.transaction import atomic
from rest_framework.exceptions import ValidationError

from . import importers
from .dedup import assign_discriminants, compute_dedup_hash
from .validators import assert_allocation_fits
from .importers.parsing import normalize_label
from .rules import guess_inflow_nature, guess_internal
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
                    # Heuristiques appliquées comme **valeurs de départ**, jamais
                    # comme vérités : l'utilisateur les corrige depuis le journal,
                    # et un mouvement interne sans contrepartie est un écart que le
                    # contrôle signale — donc une mauvaise devinette remonte au lieu
                    # de se cacher. Voir ``banking.rules``.
                    is_internal=guess_internal(label_norm, amount=row.amount),
                    inflow_nature=(
                        guess_inflow_nature(label_norm) if row.amount > 0 else ""
                    ),
                    balance_after=row.balance_after,
                    external_id=row.external_id,
                    dedup_hash=digest,
                    source_import=imported,
                    line_no=row.line_no,
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

        # Reconcile inside the same transaction, and only against the rows we
        # just created: an import that links nothing is an import the user has
        # to sort out by hand, 160 lines a month.
        from .matching import auto_reconcile, match_recurrences

        created_rows = list(base_qs.filter(source_import=imported))
        outcome = auto_reconcile(
            household=household, user=user, transactions=created_rows
        )

        # Puis les récurrences (parcours 26 lot 6), sur ce qui reste libre. Dans cet
        # ordre volontairement : une dépense déjà saisie par l'utilisateur est une
        # information plus sûre qu'une échéance prévue, donc elle gagne la ligne. La
        # récurrence, elle, sera confirmée par le relevé du mois suivant.
        # Une seule requête, pas un ``exists()`` par ligne : sur un relevé de
        # 160 lignes la version naïve coûtait 160 allers-retours (attrapé par
        # ``test_a_large_import_does_not_explode_in_queries``).
        still_free = list(
            base_qs.filter(source_import=imported, interactions__isnull=True).distinct()
        )
        recurring_outcome = match_recurrences(
            household=household, user=user, transactions=still_free
        )

        imported.auto_matched_count = outcome["auto_matched"] + recurring_outcome["confirmed"]
        imported.save(update_fields=["auto_matched_count", "updated_at"])

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


# --- Cash counterpart (lot 4) ------------------------------------------------


def record_cash_withdrawal(*, user, transaction, cash_account, amount=None):
    """Mirror an ATM withdrawal as a credit on the cash account.

    Without this, tracking a cash balance is pointless: the withdrawal leaves the
    bank account but nothing ever *arrives* in the cash one, so the cash balance
    goes negative on the first coffee paid in coins.

    Both legs are flagged ``is_internal``: the withdrawal is not spending, it is
    money changing pocket. It is counted once — later, when that cash is actually
    spent. Both legs point at each other, so either side can find the other.

    Proposed, never imposed: not every withdrawal ends up in the household's
    common pot, so this is an explicit user action.
    """
    from .models import BankAccount, BankTransaction, TransactionDirection

    if transaction.amount >= 0:
        raise ValidationError({"transaction": "Only an outgoing operation can feed cash."})
    if cash_account.kind != BankAccount.Kind.CASH:
        raise ValidationError({"cash_account": "Target account must be a cash account."})
    if cash_account.household_id != transaction.household_id:
        raise ValidationError({"cash_account": "Account belongs to another household."})
    if transaction.transfer_counterpart_id is not None:
        raise ValidationError({"transaction": "This operation already has a counterpart."})

    value = abs(Decimal(amount)) if amount is not None else transaction.outflow
    if value <= 0:
        raise ValidationError({"amount": "Amount must be positive."})
    if value > transaction.outflow:
        raise ValidationError({"amount": "Amount cannot exceed the withdrawal."})

    with atomic():
        mirror = BankTransaction.objects.create(
            household=transaction.household,
            account=cash_account,
            booked_on=transaction.booked_on,
            label_raw=transaction.label_raw,
            label_norm=transaction.label_norm,
            amount=value,
            currency=transaction.currency,
            direction=TransactionDirection.IN,
            is_internal=True,
            # Derived from the source operation's id: deterministic, unique, and
            # it makes the generated row impossible to confuse with an imported
            # one (which always carries a hash of its file line).
            dedup_hash=compute_dedup_hash(
                account_id=cash_account.id,
                booked_on=transaction.booked_on,
                label_norm=transaction.label_norm,
                amount=value,
                currency=transaction.currency,
                discriminant=f"cash-of:{transaction.id}",
            ),
            transfer_counterpart=transaction,
            created_by=user,
            updated_by=user,
        )
        transaction.transfer_counterpart = mirror
        transaction.is_internal = True
        transaction.updated_by = user
        transaction.save(
            update_fields=["transfer_counterpart", "is_internal", "updated_by", "updated_at"]
        )

    return mirror


def unlink_counterpart(*, user, transaction) -> None:
    """Undo a cash counterpart.

    Deletes only the leg **we** generated — recognised by having no
    ``source_import`` and living on a cash account. An imported line is never
    destroyed here: it is merely unlinked and un-flagged, exactly like the lot 5
    allocation editor which only removes what it created.
    """
    from .models import BankAccount

    counterpart = transaction.transfer_counterpart
    if counterpart is None:
        return

    with atomic():
        generated = counterpart.source_import_id is None and (
            counterpart.account.kind == BankAccount.Kind.CASH
        )
        # SET_NULL on the self-FK clears the other side by itself.
        transaction.transfer_counterpart = None
        transaction.is_internal = False
        transaction.updated_by = user
        transaction.save(
            update_fields=["transfer_counterpart", "is_internal", "updated_by", "updated_at"]
        )

        if generated:
            counterpart.delete()
        else:
            counterpart.transfer_counterpart = None
            counterpart.is_internal = False
            counterpart.updated_by = user
            counterpart.save(
                update_fields=[
                    "transfer_counterpart",
                    "is_internal",
                    "updated_by",
                    "updated_at",
                ]
            )


# --- Allocations (lot 5) -----------------------------------------------------


def set_allocations(*, household, user, transaction, lines: list[dict]) -> list:
    """Replace the whole allocation of ``transaction`` with ``lines``.

    A **set** operation, not per-line CRUD: the client sends the split it wants
    and gets it, which is the only way an "80/40 becomes 100/20" edit stays
    atomic.

    The destructive half is deliberately narrow. Only the expenses this editor
    created (``kind='bank'``) are deleted; anything else — a stock purchase that
    was reconciled onto this line — is **detached**, not destroyed. Deleting it
    would take its documents, tags, zones and possibly a
    ``Task.source_interaction`` with it, to undo a split.

    ⚠️ The rule reads ``kind`` **alone**. It used to also require no source
    object, which was redundant (a stock purchase has ``kind='stock_purchase'``,
    never ``'bank'``) — and became actively wrong in parcours 26 lot 3, when
    allocation lines started carrying a project. With the extra clause, a line
    attached to a project stopped being "owned" and was detached instead of
    deleted on re-edit: **every re-split would leave a phantom expense behind**,
    still counted in the project's cost. Exactly the orphan this parcours exists
    to remove.

    The row is locked for the duration so two concurrent edits cannot each see a
    stale total and jointly overshoot.
    """
    from interactions.kinds import OWNED_BY_ALLOCATION_EDITOR
    from interactions.models import Interaction
    from interactions.services import create_bank_expense_interaction

    with atomic():
        locked = BankTransaction.objects.select_for_update().get(pk=transaction.pk)
        assert_allocation_fits(transaction=locked, extra_amount=Decimal("0.00"))

        total = sum((Decimal(str(line.get("amount") or 0)) for line in lines), Decimal("0.00"))
        if total > locked.outflow:
            raise ValidationError(
                {"amount": f"Allocations would total {total} on an operation of {locked.outflow}."}
            )

        existing = list(locked.interactions.all())
        for interaction in existing:
            owned = interaction.kind in OWNED_BY_ALLOCATION_EDITOR
            if owned:
                interaction.delete()
            else:
                interaction.bank_transaction = None
                interaction.reconciled_by = ""
                interaction.updated_by = user
                interaction.save(
                    update_fields=[
                        "bank_transaction",
                        "reconciled_by",
                        "updated_by",
                        "updated_at",
                    ]
                )

        created = []
        for index, line in enumerate(lines):
            amount = Decimal(str(line.get("amount") or 0))
            if amount <= 0:
                raise ValidationError({"amount": "Each allocation must be strictly positive."})
            try:
                created.append(
                    create_bank_expense_interaction(
                        household=household,
                        user=user,
                        transaction=locked,
                        subject=str(line.get("subject") or "").strip(),
                        amount=amount,
                        budget_id=line.get("budget_id"),
                        zone_ids=line.get("zone_ids"),
                        notes=str(line.get("notes") or ""),
                        # Budget and project are independent axes (lot 3): a line
                        # can carry both, and counts in both.
                        source_type=line.get("source_type"),
                        source_id=line.get("source_id"),
                    )
                )
            except ValueError as exc:
                # The creator signals bad references (unknown zone, budget from
                # another household, source outside the household) with
                # ``ValueError``. Left alone it surfaces as a 500 on what is a
                # plain client mistake — and the line number is what makes the
                # message actionable on a five-line split.
                raise ValidationError({"lines": f"line {index + 1}: {exc}"})

        # Refresh so the caller sees the linked state rather than a stale copy.
        Interaction.objects.filter(pk__in=[i.pk for i in created])
        return created


def link_interaction(*, user, transaction, interaction, by: str = "manual"):
    """Attach an existing expense to a bank line — the manual reconciliation."""
    if interaction.household_id != transaction.household_id:
        raise ValidationError({"interaction": "Belongs to another household."})
    if interaction.type != "expense":
        raise ValidationError({"interaction": "Only an expense can be allocated."})
    if interaction.bank_transaction_id == transaction.pk:
        return interaction

    with atomic():
        locked = BankTransaction.objects.select_for_update().get(pk=transaction.pk)
        assert_allocation_fits(
            transaction=locked,
            extra_amount=interaction.amount or Decimal("0.00"),
        )
        interaction.bank_transaction = locked
        interaction.reconciled_by = by
        interaction.updated_by = user
        interaction.save(
            update_fields=["bank_transaction", "reconciled_by", "updated_by", "updated_at"]
        )
    return interaction


def unlink_interaction(*, user, interaction):
    """Detach an expense from its bank line. The expense itself survives."""
    interaction.bank_transaction = None
    interaction.reconciled_by = ""
    interaction.updated_by = user
    interaction.save(
        update_fields=["bank_transaction", "reconciled_by", "updated_by", "updated_at"]
    )
    return interaction


def delete_transaction(*, user, transaction) -> None:
    """Delete a bank line, keeping every fact the household journalled.

    Same asymmetry as ``set_allocations``, and the same ownership rule: ``kind``
    alone decides. The expenses this line generated go with it, the pre-existing
    ones are only detached. ``SET_NULL`` on the FK would handle the detaching by
    itself, but doing it explicitly also clears ``reconciled_by`` — a
    reconciliation marker with nothing to point at is a lie waiting to confuse
    the matcher.
    """
    from interactions.kinds import OWNED_BY_ALLOCATION_EDITOR

    with atomic():
        for interaction in list(transaction.interactions.all()):
            owned = interaction.kind in OWNED_BY_ALLOCATION_EDITOR
            if owned:
                interaction.delete()
            else:
                unlink_interaction(user=user, interaction=interaction)
        transaction.delete()


# --- Compliance arbitration (parcours 26, lot 1) -----------------------------


def waive_finding(*, household, user, finding_kind: str, object_id: str, reason: str):
    """Record a motivated arbitration of one écart.

    Not a "hide" button. Four properties make it an arbitration rather than an
    erasure, and all four are enforced here:

    - the écart must **currently exist** — arbitrating a hypothesis would let a
      waiver sit in wait to silence a future problem;
    - the detector must allow it (``waivable``) — the catalogue's "aucun flag
      légitime" column becomes a 400, not a comment;
    - ``reason`` must be non-blank;
    - the fingerprint is taken from the écart as it stands *now*, so the waiver
      expires by itself when the situation moves (see ``banking.compliance``).

    Re-arbitrating the same écart updates the motive and the fingerprint instead
    of stacking rows — which is also how the UI's "ré-arbitrer" on a stale waiver
    works.
    """
    from django.contrib.contenttypes.models import ContentType

    from .compliance import get_detector
    from .models import ComplianceWaiver

    spec = get_detector(finding_kind)
    if spec is None:
        raise ValidationError({"finding_kind": f"Unknown compliance check: {finding_kind}"})
    if not spec.waivable:
        raise ValidationError(
            {
                "finding_kind": (
                    "This écart cannot be arbitrated — it has to be fixed. "
                    f"({finding_kind})"
                )
            }
        )

    reason = (reason or "").strip()
    if not reason:
        raise ValidationError(
            {"reason": "A motive is required: an arbitration without one hides the problem."}
        )

    found = spec.findings(household, pks=[object_id])
    if not found:
        raise ValidationError(
            {"object_id": "This écart does not currently exist — nothing to arbitrate."}
        )
    finding = found[0]

    content_type = ContentType.objects.get_for_model(spec.model)
    waiver, created = ComplianceWaiver.objects.update_or_create(
        household=household,
        finding_kind=finding_kind,
        content_type=content_type,
        object_id=str(object_id),
        defaults={
            "reason": reason,
            "fingerprint": finding.fingerprint,
            "updated_by": user,
        },
    )
    if created:
        waiver.created_by = user
        waiver.save(update_fields=["created_by"])
    return waiver


def revoke_waiver(*, waiver) -> None:
    """Undo an arbitration. The écart comes back identical — that is the point."""
    waiver.delete()


# --- Manual account lines (parcours 26, lot 4) --------------------------------


def create_manual_transaction(
    *,
    household,
    user,
    account,
    booked_on,
    label: str,
    amount: Decimal,
    notes: str = "",
):
    """Record an operation nobody's bank will ever export.

    Cash is the case that forced this: a note handed over at the market leaves no
    statement line, so before this lot such a spend could only exist as a bare
    ``Interaction`` — an expense the bank never saw, which the conformity control
    can only ever report as an écart nobody can resolve. Making it a real account
    line **removes that orphan by construction** rather than teaching the user to
    arbitrate it every month.

    ``dedup_hash`` carries a ``manual:{uuid4}`` discriminant. Two consequences,
    both wanted:

    - a manual entry is never a duplicate of itself (typing the same 20 € twice is
      two spends, and only the user knows whether that is a mistake);
    - it can never collide with an imported line, whose discriminant always comes
      from the file (reference, balance, or occurrence index).
    """
    import uuid

    from .models import BankAccount, BankTransaction, TransactionDirection

    if account.household_id != household.id:
        raise ValidationError({"account": "Account belongs to another household."})
    if account.archived:
        raise ValidationError({"account": "This account is archived."})

    value = Decimal(str(amount))
    if value == 0:
        raise ValidationError({"amount": "Amount cannot be zero."})

    label = (label or "").strip()
    if not label:
        raise ValidationError({"label": "A label is required."})

    normalized = normalize_label(label)
    return BankTransaction.objects.create(
        household=household,
        account=account,
        booked_on=booked_on,
        label_raw=label[:500],
        label_norm=normalized[:255],
        amount=value,
        currency=account.currency or "EUR",
        direction=TransactionDirection.OUT if value < 0 else TransactionDirection.IN,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=booked_on,
            label_norm=normalized,
            amount=value,
            currency=account.currency or "EUR",
            discriminant=f"manual:{uuid.uuid4()}",
        ),
        notes=notes or "",
        created_by=user,
        updated_by=user,
    )


def record_cash_expense(
    *,
    household,
    user,
    account,
    booked_on,
    label: str,
    amount: Decimal,
    budget_id=None,
    zone_ids=None,
    source_type: str | None = None,
    source_id=None,
    notes: str = "",
):
    """Spend cash: the operation and its allocation are born together.

    Composed in **one** transaction on purpose. Creating the line first and
    letting the user allocate it later would put a freshly created operation
    straight into the "unallocated" queue — the app would be manufacturing its own
    écarts. Here there is no window during which the line exists unaccounted for.

    ``amount`` is given positive (what the user spent) and stored **signed**, like
    every outflow.
    """
    value = abs(Decimal(str(amount)))
    if value <= 0:
        raise ValidationError({"amount": "Amount must be positive."})

    with atomic():
        transaction_row = create_manual_transaction(
            household=household,
            user=user,
            account=account,
            booked_on=booked_on,
            label=label,
            amount=-value,
            notes=notes,
        )
        allocations = set_allocations(
            household=household,
            user=user,
            transaction=transaction_row,
            lines=[
                {
                    "subject": label,
                    "amount": f"{value:.2f}",
                    "budget_id": budget_id,
                    "zone_ids": zone_ids or [],
                    "source_type": source_type,
                    "source_id": source_id,
                    "notes": notes,
                }
            ],
        )

    return transaction_row, allocations
