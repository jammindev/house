"""
Banking models — the household's accounts (parcours 25, lot 1).

A ``BankAccount`` is where money actually moves: one per bank the household
uses, plus an optional ``cash`` account for physical money. It is the anchor of
the whole parcours — statement imports, transactions, balances and allocations
all hang off it.

Only the account lives here in lot 1. ``StatementImport`` and ``BankTransaction``
arrive in lot 2 (#385).

Why a dedicated model rather than an ``Interaction``: an account is not a dated
flat fact but a container with a DB uniqueness invariant (one name per
household) and a typed FK that later rows cascade/protect against — two of the
criteria the CLAUDE.md « Interaction vs modèle dédié » rule calls out.

Note on balances: they are NEVER stored. ``opening_balance`` is only the starting
point of a computation done at read time (lot 4, #387), exactly like the budget
"spent" of parcours 21. A denormalized balance column would be a competing source
of truth that drifts on the first partial import.
"""
import uuid

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
