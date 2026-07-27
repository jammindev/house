"""
Banking models — the household's accounts (parcours 25, lot 1).

A ``BankAccount`` is where money actually moves: one per bank the household
uses, plus an optional ``cash`` account for physical money. It is the anchor of
the whole parcours — statement imports, transactions, balances and allocations
all hang off it.

Why dedicated models rather than ``Interaction``: an account is a container with
a DB uniqueness invariant, and a ``BankTransaction`` is not a fact of household
life but a line of a bank statement, made idempotent by
``unique(account, dedup_hash)``. That uniqueness constraint *is* the import
guarantee — the same criterion that gives ``EggLog`` its own table per the
CLAUDE.md « Interaction vs modèle dédié » rule.

Note on balances: they are NEVER stored as a column. ``opening_balance`` is only
the starting point of a computation done at read time (lot 4, #387), exactly like
the budget "spent" of parcours 21. A denormalized balance would be a competing
source of truth that drifts on the first partial import.

``attested_balance`` does not break that rule: like ``opening_balance`` it is an
**input** the user typed, not a figure House computed. It is a second point on
the same curve, and the whole reason to keep it is that comparing it to the
computed balance is what catches a drift instead of hiding one.
"""
import uuid
from decimal import Decimal

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel


class BankAccount(HouseholdScopedModel):
    """A household account — a bank account, or the cash the household holds."""

    class Kind(models.TextChoices):
        BANK = "bank", _("Bank account")
        CASH = "cash", _("Cash")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    bank_label = models.CharField(
        max_length=120,
        blank=True,
        default="",
        help_text=_("Bank name, free text. Empty for a cash account."),
    )
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.BANK)
    currency = models.CharField(max_length=3, default="EUR")
    iban_last4 = models.CharField(
        max_length=4,
        blank=True,
        default="",
        help_text=_(
            "Last 4 characters of the IBAN, to tell two accounts apart. "
            "The full IBAN is NEVER stored."
        ),
    )
    opening_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        help_text=_(
            "Balance at 'opening_balance_date'. Starting point of the derived "
            "balance computation; may be negative (overdraft)."
        ),
    )
    opening_balance_date = models.DateField(
        null=True,
        blank=True,
        help_text=_("Date the opening balance refers to. Null = not set yet."),
    )
    attested_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_(
            "Balance the user read on their bank at 'attested_on', used to "
            "reconstruct 'opening_balance' by subtracting the movements in "
            "between. Kept so the arithmetic can be re-checked forever after "
            "(parcours 26, lot 8) — banks that export no balance column give us "
            "no other anchor."
        ),
    )
    attested_on = models.DateField(
        null=True,
        blank=True,
        help_text=_("Date 'attested_balance' was read. Null = never attested."),
    )
    default_provider = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text=_("Statement importer key remembered from the last import (lot 2)."),
    )
    import_options = models.JSONField(
        default=dict,
        blank=True,
        help_text=_(
            "Column mapping remembered for this bank's export, so the format is "
            "described once and not at every import (lot 2)."
        ),
    )
    archived = models.BooleanField(
        default=False,
        help_text=_("Closed account: hidden from the default list, never deleted."),
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "bank_accounts"
        verbose_name = _("bank account")
        verbose_name_plural = _("bank accounts")
        ordering = ["archived", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "name"],
                name="uq_bank_account_name_per_hh",
            ),
        ]
        indexes = [
            models.Index(fields=["household", "archived"], name="idx_bankacct_hh_arch"),
        ]

    def __str__(self):
        if self.bank_label:
            return f"{self.name} ({self.bank_label})"
        return self.name


class ImportStatus(models.TextChoices):
    COMPLETED = "completed", _("Completed")
    FAILED = "failed", _("Failed")


class StatementImport(HouseholdScopedModel):
    """Audit trail of one statement file drop.

    A business failure (unreadable file, bad mapping) is **not** an HTTP error:
    it is a row with ``status='failed'``, zero transactions written, and an
    ``error`` the user can act on. Mirror of ``electricity.ConsumptionImport``.

    Deliberately **not deletable** (the viewset forbids ``DELETE``): deleting an
    import then re-importing would recreate the transactions with fresh UUIDs and
    silently drop every allocation attached to them (lot 5).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(
        BankAccount,
        on_delete=models.CASCADE,
        related_name="imports",
    )
    provider = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text=_("Importer key used (e.g. generic_csv). Empty when unrecognized."),
    )
    filename = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=10, choices=ImportStatus.choices)
    created_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(
        default=0,
        help_text=_("Lines already present — the normal outcome of a re-import."),
    )
    auto_matched_count = models.PositiveIntegerField(
        default=0,
        help_text=_(
            "Lines this import reconciled by itself with expenses already typed "
            "into the app (lot 6). The number the user actually cares about: it "
            "is what they did NOT have to sort out by hand."
        ),
    )
    error = models.TextField(blank=True, default="")
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "bank_statement_imports"
        verbose_name = _("statement import")
        verbose_name_plural = _("statement imports")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["household", "-created_at"], name="idx_stmtimp_hh_created"),
        ]

    def __str__(self):
        return f"{self.filename or self.provider} ({self.status})"


class TransactionDirection(models.TextChoices):
    OUT = "out", _("Money out")
    IN = "in", _("Money in")


class InflowNature(models.TextChoices):
    """What a receipt actually is. Empty = not classified yet (parcours 26, lot 5).

    Receipts do not enter the expense journal — a salary is not an ``Interaction``.
    But leaving them entirely unqualified makes the bank view unreadable: a 2 100 €
    credit could be a wage, a refund of something already recorded as spending, or
    the other leg of a transfer between the household's own accounts, and those
    three mean completely different things about how much money the household
    actually has.

    ``refund`` is the interesting one: it is the only receipt that *offsets* an
    expense, which is why ``Interaction.amount`` never goes negative — a refund is
    a bank line with a nature, not a negative expense (that would break
    ``top_expenses`` and every ``Sum("amount")``).
    """

    SALARY = "salary", _("Income")
    REFUND = "refund", _("Refund")
    TRANSFER = "transfer", _("Transfer between own accounts")
    OTHER = "other", _("Other")


class BankTransaction(HouseholdScopedModel):
    """One line of a bank statement — immutable in substance.

    ``label_raw`` and ``amount`` are never rewritten: this is what the bank says,
    and correcting it would destroy the only external reference the household
    has. What the user *may* do is qualify the line (internal transfer, note) and
    allocate it (lot 5).

    ``amount`` is **signed**, negative for money leaving the account, while
    ``Interaction.amount`` is always positive. Comparisons between the two always
    go through ``abs()`` — centralised in ``banking.queries`` (lot 3), never
    rewritten inline.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(
        BankAccount,
        on_delete=models.PROTECT,
        related_name="transactions",
        help_text=_(
            "PROTECT: an account holding transactions cannot be deleted — it is "
            "archived instead (see services.archive_account)."
        ),
    )
    booked_on = models.DateField(help_text=_("Operation date as printed on the statement."))
    value_on = models.DateField(null=True, blank=True, help_text=_("Value date, when provided."))
    label_raw = models.CharField(
        max_length=500,
        editable=False,
        help_text=_("Raw bank label. Never rewritten."),
    )
    label_norm = models.CharField(
        max_length=255,
        editable=False,
        default="",
        help_text=_("Normalized label: feeds the dedup hash and the lot 6 matcher."),
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text=_("Signed: negative = money out."),
    )
    currency = models.CharField(max_length=3, default="EUR")
    direction = models.CharField(max_length=3, choices=TransactionDirection.choices)
    is_internal = models.BooleanField(
        default=False,
        help_text=_(
            "Internal movement (ATM withdrawal, transfer between the household's "
            "own accounts). Excluded from spending aggregates — counting it would "
            "double the money."
        ),
    )
    inflow_nature = models.CharField(
        max_length=10,
        choices=InflowNature.choices,
        blank=True,
        default="",
        help_text=_(
            "What this receipt is (parcours 26, lot 5). Empty on an outflow, and "
            "empty on an unclassified receipt — which is an écart the conformity "
            "control reports."
        ),
    )
    refund_budget = models.ForeignKey(
        "budget.Budget",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="refunds",
        help_text=_(
            "Budget this refund credits back. Only meaningful on an inflow "
            "classified `refund`: returning a 40 € item means the envelope "
            "consumed 110 € of the 150 € spent, not 150 €. Kept here rather than "
            "as a negative Interaction — `Interaction.amount` never goes negative, "
            "which is what protects the nine Sum('amount') aggregations. SET_NULL: "
            "deleting a budget must never destroy a bank line."
        ),
    )
    balance_after = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_(
            "Running balance after this operation, when the bank exports it. "
            "Anchors the lot 4 balance and its chain check."
        ),
    )
    external_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text=_("Bank-provided operation reference, when available."),
    )
    dedup_hash = models.CharField(
        max_length=64,
        editable=False,
        help_text=_(
            "Natural key of the line. Set once at creation and NEVER recomputed: "
            "re-hashing after a label cleanup would resurrect duplicates."
        ),
    )
    source_import = models.ForeignKey(
        StatementImport,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
        help_text=_("SET_NULL: transactions outlive the trace of their import."),
    )
    line_no = models.PositiveIntegerField(
        default=0,
        help_text=_(
            "Row position in the source file. Two operations booked the same day "
            "must keep the statement's own order, otherwise the balance chain "
            "check (banking.balances) cannot tell which balance follows which — "
            "and 'created_at' is not dependable for that after a bulk_create."
        ),
    )
    transfer_counterpart = models.OneToOneField(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="counterpart_of",
        help_text=_(
            "The other leg of an internal movement — typically an ATM withdrawal "
            "and the matching credit on the cash account. SET_NULL so deleting "
            "one leg never leaves the other pointing at nothing."
        ),
    )
    notes = models.TextField(blank=True, default="")

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "bank_transactions"
        verbose_name = _("bank transaction")
        verbose_name_plural = _("bank transactions")
        # Newest first for reading; ``line_no`` keeps same-day operations in the
        # statement's own order, which the balance chain check depends on.
        ordering = ["-booked_on", "-line_no", "-created_at"]
        constraints = [
            # THE import guarantee: re-importing the same file writes nothing.
            models.UniqueConstraint(
                fields=["account", "dedup_hash"],
                name="uq_bank_txn_account_dedup",
            ),
            models.CheckConstraint(
                condition=~models.Q(amount=0),
                name="bank_txn_amount_not_zero",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(direction=TransactionDirection.OUT, amount__lt=0)
                    | models.Q(direction=TransactionDirection.IN, amount__gt=0)
                ),
                name="bank_txn_direction_matches_sign",
            ),
            # A budget on anything but a refund would credit an envelope from a
            # salary or a transfer. The serializer refuses it too, but this is the
            # kind of invariant that survives a future write path only if the
            # database holds it.
            models.CheckConstraint(
                condition=(
                    models.Q(refund_budget__isnull=True)
                    | models.Q(inflow_nature=InflowNature.REFUND)
                ),
                name="bank_txn_refund_budget_only_on_refund",
            ),
        ]
        indexes = [
            models.Index(fields=["household", "booked_on"], name="idx_bank_txn_hh_date"),
            models.Index(fields=["account", "booked_on"], name="idx_bank_txn_acct_date"),
            models.Index(
                fields=["household", "direction", "is_internal"],
                name="idx_bank_txn_hh_dir",
            ),
        ]

    def __str__(self):
        return f"{self.booked_on} {self.amount} {self.label_raw[:40]}"

    @property
    def outflow(self) -> Decimal:
        """Positive magnitude when money left, else zero.

        The one place the sign convention is bridged: everything comparing a
        transaction to an ``Interaction.amount`` (always positive) uses this.
        """
        return -self.amount if self.amount < 0 else Decimal("0.00")


class ComplianceWaiver(HouseholdScopedModel):
    """A motivated, dated, signed and revocable arbitration of one écart.

    Parcours 26 rests on a single rule: every entity is either **resolved** or
    **flagged with a motive** — nothing stays in a silent in-between. This model
    is the "flagged" half, and it is deliberately **one uniform table** rather
    than a ``dismissed_at`` here, an ``ignored`` there and an ``accepted_gap``
    somewhere else. Scattered flags would be exactly what the parcours is trying
    to remove: heterogeneous states nobody can count together.

    Consequences of that choice, all of them load-bearing:

    - **``reason`` is required.** A flag without a motive carries no information
      and would just be a mute "hide" button. The serializer refuses a blank one.
    - **Revocable.** Deleting the waiver brings the écart back identical. The
      counter reaches zero because everything was *arbitrated*, never because
      something was hidden.
    - **``fingerprint`` makes it expire.** It records what the écart looked like
      when the arbitration was made. If the figures move, the waiver no longer
      matches and the écart reappears as stale — see ``banking.compliance``.
      Without this field, arbitrating "the rest of this line does not interest me"
      and then re-splitting the line would leave money covered by a motive that
      describes nothing.
    - **Polymorphic target**, same pattern as ``Interaction.source_*``: any model
      can be the subject of an écart without a schema change per detector.

    Not every écart may be waived: ``DetectorSpec.waivable`` carries the
    catalogue's "aucun flag légitime" column, and the service turns it into a 400.
    A missing opening balance is a prerequisite, a negative cash balance is an
    inconsistency — neither is an arbitration.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    finding_kind = models.CharField(
        max_length=64,
        help_text=_("Detector key from banking.compliance.REGISTRY."),
    )
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name="+",
        help_text=_("Model of the object being arbitrated."),
    )
    object_id = models.CharField(max_length=64)
    target = GenericForeignKey("content_type", "object_id")
    reason = models.TextField(
        help_text=_(
            "Why this écart is acceptable. Required: an arbitration without a "
            "motive is indistinguishable from hiding the problem."
        ),
    )
    fingerprint = models.CharField(
        max_length=64,
        help_text=_(
            "State of the écart when it was arbitrated. When it no longer "
            "matches, the waiver is stale and the écart resurfaces."
        ),
    )

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "banking_compliance_waivers"
        verbose_name = _("compliance waiver")
        verbose_name_plural = _("compliance waivers")
        ordering = ["-created_at"]
        constraints = [
            # One arbitration per (écart, object): re-arbitrating updates the
            # motive and the fingerprint instead of stacking rows nobody can read.
            models.UniqueConstraint(
                fields=["household", "finding_kind", "content_type", "object_id"],
                name="uq_waiver_per_finding_object",
            ),
        ]
        indexes = [
            models.Index(
                fields=["household", "finding_kind"],
                name="idx_waiver_hh_kind",
            ),
        ]

    def __str__(self):
        return f"{self.finding_kind} on {self.object_id}"
