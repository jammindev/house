# banking/tests/test_cash_expense.py
"""Tout est une ligne de compte (parcours 26, lot 4).

Une dépense en espèces ne laisse aucune ligne de relevé. Avant ce lot elle ne
pouvait exister que comme `Interaction` nue — donc comme une dépense que la banque
n'a jamais vue, que le contrôle de conformité ne peut que **signaler** sans que
personne puisse la résoudre. Chaque mois, la même liste d'écarts inarbitrables.

En faire une vraie opération de compte supprime l'orphelin **par construction**.
C'est ce que ces tests protègent : l'opération et sa ventilation naissent
ensemble, donc il n'existe aucun instant où la ligne est non affectée.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from banking.detectors import (
    ACCOUNT_CASH_NEGATIVE,
    EXPENSE_UNRECONCILED,
    TRANSACTION_UNALLOCATED,
)
from banking.compliance import get_detector, open_findings, summary
from banking.models import BankAccount, BankTransaction, ImportStatus, StatementImport
from banking.services import (
    create_manual_transaction,
    record_cash_expense,
    record_cash_withdrawal,
)
from banking.validators import remaining_to_allocate
from budget.models import Budget
from interactions.kinds import KIND_BANK
from interactions.models import Interaction
from projects.models import Project
from projects.services import project_actual_cost

from .factories import BankAccountFactory, HouseholdFactory, UserFactory


@pytest.fixture
def ctx(db):
    household = HouseholdFactory()
    user = UserFactory()
    cash = BankAccountFactory(
        household=household,
        name="Espèces",
        kind=BankAccount.Kind.CASH,
        bank_label="",
        opening_balance=Decimal("200.00"),
        opening_balance_date=date(2026, 1, 1),
    )
    budget = Budget.objects.create(household=household, name="Courses", monthly_amount=400)
    return household, user, cash, budget


def group(household, kind):
    return next(g for g in summary(household) if g.spec.kind == kind)


@pytest.mark.django_db
class TestCreateManualTransaction:
    def test_creates_a_signed_outflow(self, ctx):
        household, user, cash, _ = ctx
        txn = create_manual_transaction(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("-18.50"),
        )
        assert txn.amount == Decimal("-18.50")
        assert txn.direction == "out"
        assert txn.label_raw == "Marché"
        assert txn.label_norm == "MARCHE"

    def test_typing_the_same_spend_twice_creates_two_lines(self, ctx):
        """A manual entry is never a duplicate of itself: two 20 € handed over are
        two spends, and only the user knows whether that was a mistake."""
        household, user, cash, _ = ctx
        for _ in range(2):
            create_manual_transaction(
                household=household,
                user=user,
                account=cash,
                booked_on=date(2026, 3, 10),
                label="Boulangerie",
                amount=Decimal("-4.20"),
            )
        assert BankTransaction.objects.filter(account=cash).count() == 2

    def test_its_hash_can_never_collide_with_an_imported_line(self, ctx):
        household, user, cash, _ = ctx
        txn = create_manual_transaction(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("-18.50"),
        )
        # An imported line's discriminant always comes from the file (reference,
        # balance, occurrence index) — never from a uuid.
        assert txn.dedup_hash
        other = create_manual_transaction(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("-18.50"),
        )
        assert txn.dedup_hash != other.dedup_hash

    def test_a_zero_amount_is_refused(self, ctx):
        household, user, cash, _ = ctx
        with pytest.raises(ValidationError):
            create_manual_transaction(
                household=household,
                user=user,
                account=cash,
                booked_on=date(2026, 3, 10),
                label="Rien",
                amount=Decimal("0"),
            )

    def test_a_blank_label_is_refused(self, ctx):
        household, user, cash, _ = ctx
        with pytest.raises(ValidationError):
            create_manual_transaction(
                household=household,
                user=user,
                account=cash,
                booked_on=date(2026, 3, 10),
                label="   ",
                amount=Decimal("-10.00"),
            )

    def test_an_account_from_another_household_is_refused(self, ctx):
        household, user, _, _ = ctx
        foreign = BankAccountFactory(household=HouseholdFactory())
        with pytest.raises(ValidationError):
            create_manual_transaction(
                household=household,
                user=user,
                account=foreign,
                booked_on=date(2026, 3, 10),
                label="Marché",
                amount=Decimal("-10.00"),
            )

    def test_an_archived_account_is_refused(self, ctx):
        household, user, cash, _ = ctx
        cash.archived = True
        cash.save(update_fields=["archived"])
        with pytest.raises(ValidationError):
            create_manual_transaction(
                household=household,
                user=user,
                account=cash,
                booked_on=date(2026, 3, 10),
                label="Marché",
                amount=Decimal("-10.00"),
            )


@pytest.mark.django_db
class TestRecordCashExpense:
    def test_the_line_and_its_allocation_are_born_together(self, ctx):
        """No window during which the operation sits unallocated — the app must not
        manufacture its own écarts."""
        household, user, cash, budget = ctx

        txn, allocations = record_cash_expense(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("18.50"),
            budget_id=str(budget.id),
        )

        assert txn.amount == Decimal("-18.50")
        assert len(allocations) == 1
        assert allocations[0].amount == Decimal("18.50")
        assert allocations[0].budget_id == budget.id
        assert allocations[0].kind == KIND_BANK
        assert remaining_to_allocate(txn) == Decimal("0.00")

    def test_the_amount_is_given_positive_and_stored_signed(self, ctx):
        household, user, cash, _ = ctx
        txn, _ = record_cash_expense(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("18.50"),
        )
        assert txn.amount < 0
        assert Interaction.objects.get(bank_transaction=txn).amount == Decimal("18.50")

    def test_it_produces_no_unallocated_ecart(self, ctx):
        household, user, cash, budget = ctx
        record_cash_expense(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("18.50"),
            budget_id=str(budget.id),
        )
        assert group(household, TRANSACTION_UNALLOCATED).detected == 0

    def test_it_produces_no_unreconciled_ecart_either(self, ctx):
        """THE point of the lot: the expense is attached to a line, so it is not an
        expense the bank never saw."""
        household, user, cash, budget = ctx
        record_cash_expense(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("18.50"),
            budget_id=str(budget.id),
        )
        assert group(household, EXPENSE_UNRECONCILED).detected == 0

    def test_it_can_carry_a_project(self, ctx):
        household, user, cash, budget = ctx
        project = Project.objects.create(household=household, title="Salle de bain")

        record_cash_expense(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Quincaillerie",
            amount=Decimal("22.00"),
            budget_id=str(budget.id),
            source_type="projects.project",
            source_id=str(project.id),
        )

        assert project_actual_cost(project) == Decimal("22.00")

    def test_a_negative_amount_is_refused(self, ctx):
        household, user, cash, _ = ctx
        with pytest.raises(ValidationError):
            record_cash_expense(
                household=household,
                user=user,
                account=cash,
                booked_on=date(2026, 3, 10),
                label="Marché",
                amount=Decimal("0"),
            )

    def test_a_bad_budget_rolls_the_whole_thing_back(self, ctx):
        """Atomic: a rejected allocation must not leave the operation behind, or we
        would have created the very orphan this service exists to prevent."""
        household, user, cash, _ = ctx
        foreign_budget = Budget.objects.create(
            household=HouseholdFactory(), name="Ailleurs", monthly_amount=100
        )

        with pytest.raises(ValidationError):
            record_cash_expense(
                household=household,
                user=user,
                account=cash,
                booked_on=date(2026, 3, 10),
                label="Marché",
                amount=Decimal("18.50"),
                budget_id=str(foreign_budget.id),
            )

        assert not BankTransaction.objects.filter(account=cash).exists()
        assert not Interaction.objects.filter(household=household, type="expense").exists()


@pytest.mark.django_db
class TestNegativeCashDetector:
    def test_spending_more_cash_than_declared_is_an_ecart(self, ctx):
        household, user, cash, budget = ctx
        # Opening balance is 200 €; spend 250 € and the pot goes impossible.
        record_cash_expense(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("250.00"),
            budget_id=str(budget.id),
        )

        findings = open_findings(household, get_detector(ACCOUNT_CASH_NEGATIVE))
        assert [f.object_id for f in findings] == [str(cash.pk)]
        assert findings[0].detail["balance"] == "-50.00"

    def test_declaring_the_withdrawal_resolves_it(self, ctx):
        household, user, cash, budget = ctx
        bank = BankAccountFactory(
            household=household, name="Courant", opening_balance_date=date(2026, 1, 1)
        )
        StatementImport.objects.create(
            household=household,
            account=bank,
            provider="generic_csv",
            status=ImportStatus.COMPLETED,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 3, 31),
        )
        record_cash_expense(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("250.00"),
            budget_id=str(budget.id),
        )
        assert group(household, ACCOUNT_CASH_NEGATIVE).detected == 1

        withdrawal = create_manual_transaction(
            household=household,
            user=user,
            account=bank,
            booked_on=date(2026, 3, 1),
            label="RETRAIT DAB",
            amount=Decimal("-100.00"),
        )
        record_cash_withdrawal(user=user, transaction=withdrawal, cash_account=cash)

        assert group(household, ACCOUNT_CASH_NEGATIVE).detected == 0

    def test_a_positive_cash_balance_is_not_an_ecart(self, ctx):
        household, user, cash, budget = ctx
        record_cash_expense(
            household=household,
            user=user,
            account=cash,
            booked_on=date(2026, 3, 10),
            label="Marché",
            amount=Decimal("18.50"),
            budget_id=str(budget.id),
        )
        assert group(household, ACCOUNT_CASH_NEGATIVE).detected == 0

    def test_a_bank_account_in_the_red_is_not_this_ecart(self, ctx):
        """An overdraft is legitimate; an impossible pot of cash is not. Only cash
        accounts are checked."""
        household, user, _, _ = ctx
        bank = BankAccountFactory(
            household=household,
            name="Courant",
            opening_balance=Decimal("-300.00"),
            opening_balance_date=date(2026, 1, 1),
        )
        create_manual_transaction(
            household=household,
            user=user,
            account=bank,
            booked_on=date(2026, 3, 10),
            label="Frais",
            amount=Decimal("-10.00"),
        )
        assert group(household, ACCOUNT_CASH_NEGATIVE).detected == 0

    def test_it_cannot_be_arbitrated(self, ctx):
        """No motive makes physically impossible money acceptable — there is an
        operation missing, not a judgement call to record."""
        assert get_detector(ACCOUNT_CASH_NEGATIVE).waivable is False
