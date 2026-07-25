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

from .models import BankAccount
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

    From lot 2 on, an account owns imported transactions that carry the
    household's financial history; deleting it would take them with it. The
    ``DELETE`` verb on the viewset maps here, so a user's "delete" gesture is
    always recoverable.
    """
    return update_account(account=account, user=user, fields={"archived": True})
