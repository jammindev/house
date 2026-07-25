# banking/tests/test_models_account.py
"""Model-level tests for BankAccount — invariants that live in the database."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from banking.models import BankAccount

from .factories import BankAccountFactory, HouseholdFactory


@pytest.mark.django_db
class TestBankAccountModel:
    def test_defaults(self):
        account = BankAccountFactory()
        assert account.kind == BankAccount.Kind.BANK
        assert account.currency == "EUR"
        assert account.archived is False
        assert account.opening_balance == Decimal("0")
        assert account.opening_balance_date is None
        assert account.import_options == {}
        assert account.default_provider == ""

    def test_str_includes_bank_when_set(self):
        account = BankAccountFactory(name="Compte joint", bank_label="LCL")
        assert str(account) == "Compte joint (LCL)"

    def test_str_is_name_only_without_bank(self):
        account = BankAccountFactory(name="Espèces", bank_label="", kind=BankAccount.Kind.CASH)
        assert str(account) == "Espèces"

    def test_name_unique_per_household(self):
        household = HouseholdFactory()
        BankAccountFactory(household=household, name="Compte joint")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                BankAccountFactory(household=household, name="Compte joint")

    def test_same_name_allowed_in_another_household(self):
        BankAccountFactory(household=HouseholdFactory(), name="Compte joint")
        other = BankAccountFactory(household=HouseholdFactory(), name="Compte joint")
        assert other.pk is not None

    def test_opening_balance_may_be_negative(self):
        """An account can legitimately start in the red (overdraft)."""
        account = BankAccountFactory(
            opening_balance=Decimal("-250.40"),
            opening_balance_date=date(2026, 1, 1),
        )
        account.refresh_from_db()
        assert account.opening_balance == Decimal("-250.40")

    def test_ordering_puts_archived_last(self):
        household = HouseholdFactory()
        BankAccountFactory(household=household, name="Zebra", archived=False)
        BankAccountFactory(household=household, name="Alpha", archived=True)
        names = list(BankAccount.objects.filter(household=household).values_list("name", flat=True))
        assert names == ["Zebra", "Alpha"]

    def test_requires_household(self):
        with pytest.raises(ValueError):
            BankAccount(name="Orphan").save()
