# banking/tests/test_allocations_aggregations.py
"""The acceptance criterion of lot 5, written as tests.

Choosing "an expense *is* an allocation" over a dedicated ``Allocation`` table
was justified by one claim: ``amount`` stays a scalar column, so the project's
nine ``Sum("amount")`` aggregations keep working untouched and no join can
double-count. These tests are that claim, checked.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone

from banking.dedup import compute_dedup_hash
from banking.models import BankTransaction, TransactionDirection
from banking.services import set_allocations
from budget.aggregations import compute_budget_overview
from budget.models import Budget
from interactions.aggregations import compute_expense_summary

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount="-120.00", booked_on=None, label="CB LECLERC"):
    booked_on = booked_on or timezone.localdate()
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=booked_on,
        label_raw=label,
        label_norm=label.upper(),
        amount=value,
        direction=TransactionDirection.OUT if value < 0 else TransactionDirection.IN,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=booked_on,
            label_norm=label.upper(),
            amount=value,
            currency="EUR",
            discriminant=f"#{next(_counter)}",
        ),
    )


@pytest.fixture
def context(db):
    household = HouseholdFactory()
    user = UserFactory()
    account = BankAccountFactory(household=household)
    groceries = Budget.objects.create(household=household, name="Courses", monthly_amount=400)
    diy = Budget.objects.create(household=household, name="Bricolage", monthly_amount=200)
    return household, user, account, groceries, diy


@pytest.mark.django_db
class TestSplitFeedsTwoBudgets:
    def test_budget_overview_sees_each_half_in_its_own_envelope(self, context):
        """120 € split 80/40 must land as 80 in Courses and 40 in Bricolage."""
        household, user, account, groceries, diy = context
        txn = make_txn(account)

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {"subject": "Courses", "amount": "80.00", "budget_id": groceries.id},
                {"subject": "Vis", "amount": "40.00", "budget_id": diy.id},
            ],
        )

        overview = compute_budget_overview(household=household)
        spent = {row["name"]: row["spent"] for row in overview["budgets"]}

        assert spent["Courses"] == "80.00"
        assert spent["Bricolage"] == "40.00"
        assert overview["total_spent"] == "120.00"

    def test_no_double_counting_when_a_line_carries_several_expenses(self, context):
        """The failure mode a JOIN-based Allocation table would have introduced."""
        household, user, account, groceries, diy = context
        txn = make_txn(account)
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {"subject": "A", "amount": "80.00", "budget_id": groceries.id},
                {"subject": "B", "amount": "40.00", "budget_id": diy.id},
            ],
        )

        now = timezone.now()
        summary = compute_expense_summary(
            household_id=household.id,
            from_dt=now - timezone.timedelta(days=1),
            to_dt=now + timezone.timedelta(days=1),
        )

        assert Decimal(summary["total"]) == Decimal("120.00")
        assert summary["count"] == 2

    def test_an_unallocated_line_moves_no_expense_figure(self, context):
        """Importing a statement must not, by itself, change any budget total."""
        household, _, account, _, _ = context
        before = compute_budget_overview(household=household)

        make_txn(account, amount="-500.00")

        after = compute_budget_overview(household=household)
        assert after["total_spent"] == before["total_spent"] == "0.00"


@pytest.mark.django_db
class TestProjectCostIsUnaffected:
    def test_actual_cost_still_counts_a_reconciled_purchase_once(self, context):
        """`annotate_actual_cost` groups on the polymorphic source, not the bank line."""
        from django.contrib.contenttypes.models import ContentType

        from interactions.models import Interaction
        from projects.models import Project
        from projects.services import project_actual_cost

        household, user, account, _, _ = context
        project = Project.objects.create(household=household, title="Salle de bain")
        txn = make_txn(account, amount="-89.90")

        purchase = Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Achat carrelage",
            type="expense",
            occurred_at=timezone.now(),
            amount=Decimal("89.90"),
            kind="project_purchase",
            source_content_type=ContentType.objects.get_for_model(Project),
            source_object_id=project.pk,
        )

        before = project_actual_cost(project)

        from banking.services import link_interaction

        link_interaction(user=user, transaction=txn, interaction=purchase)

        assert project_actual_cost(project) == before == Decimal("89.90")
