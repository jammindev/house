# banking/tests/test_allocation_axes.py
"""Budget and project are two independent axes (parcours 26, lot 3).

The real case: 150 € at the DIY store, 90 € of it for the bathroom job and 60 €
unrelated. Before this lot an allocation line carried only a budget, so those 90 €
counted in the « Bricolage » envelope and in **no project cost at all** —
``projects.services`` aggregates through the polymorphic source FK, which the
allocation creator never set.

The regression test at the bottom is the important one. Removing the
``source_content_type_id is None`` clause from the ownership rule is what keeps a
re-split from leaving a phantom expense behind, still counted in the project.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from banking.dedup import compute_dedup_hash
from banking.models import BankTransaction, TransactionDirection
from banking.services import delete_transaction, set_allocations
from budget.models import Budget
from interactions.kinds import KIND_BANK, KIND_STOCK_PURCHASE
from interactions.models import Interaction
from projects.models import Project
from projects.services import project_actual_cost
from zones.models import Zone

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount="-150.00", booked_on=date(2026, 3, 10), label="CB LEROY MERLIN"):
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
def ctx(db):
    household = HouseholdFactory()
    user = UserFactory()
    account = BankAccountFactory(household=household, opening_balance_date=date(2026, 1, 1))
    bathroom = Project.objects.create(household=household, title="Salle de bain")
    kitchen = Project.objects.create(household=household, title="Cuisine")
    diy = Budget.objects.create(household=household, name="Bricolage", monthly_amount=300)
    return household, user, account, bathroom, kitchen, diy


@pytest.mark.django_db
class TestAllocationCarriesAProject:
    def test_a_split_feeds_two_project_costs(self, ctx):
        household, user, account, bathroom, kitchen, _ = ctx
        txn = make_txn(account)

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {
                    "amount": "90.00",
                    "subject": "Carrelage",
                    "source_type": "projects.project",
                    "source_id": str(bathroom.id),
                },
                {
                    "amount": "60.00",
                    "subject": "Peinture",
                    "source_type": "projects.project",
                    "source_id": str(kitchen.id),
                },
            ],
        )

        assert project_actual_cost(bathroom) == Decimal("90.00")
        assert project_actual_cost(kitchen) == Decimal("60.00")

    def test_a_line_counts_in_a_project_and_a_budget_at_once(self, ctx):
        """The two axes are independent — this is the whole point of the lot."""
        household, user, account, bathroom, _, diy = ctx
        txn = make_txn(account, amount="-90.00")

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {
                    "amount": "90.00",
                    "subject": "Carrelage",
                    "budget_id": str(diy.id),
                    "source_type": "projects.project",
                    "source_id": str(bathroom.id),
                },
            ],
        )

        expense = Interaction.objects.get(bank_transaction=txn)
        assert expense.budget_id == diy.id
        # ``str()`` on both sides: the column is a CharField but the in-memory
        # instance still holds the UUID it was created with.
        assert str(expense.source_object_id) == str(bathroom.id)
        assert project_actual_cost(bathroom) == Decimal("90.00")

    def test_the_kind_stays_bank_even_with_a_source(self, ctx):
        """``kind`` says where the expense came from, not what it is about — and
        the ownership rule reads it and nothing else."""
        household, user, account, bathroom, _, _ = ctx
        txn = make_txn(account, amount="-90.00")

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {
                    "amount": "90.00",
                    "subject": "Carrelage",
                    "source_type": "projects.project",
                    "source_id": str(bathroom.id),
                },
            ],
        )

        assert Interaction.objects.get(bank_transaction=txn).kind == KIND_BANK

    def test_a_line_can_carry_zones_and_a_project(self, ctx):
        household, user, account, bathroom, _, _ = ctx
        zone = Zone.objects.create(household=household, name="Étage")
        txn = make_txn(account, amount="-90.00")

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {
                    "amount": "90.00",
                    "subject": "Carrelage",
                    "zone_ids": [str(zone.id)],
                    "source_type": "projects.project",
                    "source_id": str(bathroom.id),
                },
            ],
        )

        expense = Interaction.objects.get(bank_transaction=txn)
        assert [z.name for z in expense.zones.all()] == ["Étage"]
        assert str(expense.source_object_id) == str(bathroom.id)

    def test_no_source_is_the_ordinary_case(self, ctx):
        household, user, account, _, _, diy = ctx
        txn = make_txn(account, amount="-40.00", label="CB BOULANGERIE")

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "40.00", "subject": "Pain", "budget_id": str(diy.id)}],
        )

        expense = Interaction.objects.get(bank_transaction=txn)
        assert expense.source_content_type_id is None
        assert expense.source_object_id is None


@pytest.mark.django_db
class TestSourceScoping:
    def test_a_project_from_another_household_is_refused(self, ctx):
        """Without this check a client could inflate the cost of a project they
        cannot even see."""
        household, user, account, _, _, _ = ctx
        foreign = Project.objects.create(household=HouseholdFactory(), title="Chez l'autre")
        txn = make_txn(account, amount="-90.00")

        with pytest.raises(ValidationError) as excinfo:
            set_allocations(
                household=household,
                user=user,
                transaction=txn,
                lines=[
                    {
                        "amount": "90.00",
                        "subject": "x",
                        "source_type": "projects.project",
                        "source_id": str(foreign.id),
                    },
                ],
            )
        assert "lines" in excinfo.value.detail
        assert not Interaction.objects.filter(bank_transaction=txn).exists()

    def test_an_unsupported_source_type_is_refused(self, ctx):
        household, user, account, _, _, _ = ctx
        txn = make_txn(account, amount="-90.00")

        with pytest.raises(ValidationError):
            set_allocations(
                household=household,
                user=user,
                transaction=txn,
                lines=[
                    {
                        "amount": "90.00",
                        "subject": "x",
                        "source_type": "budget.budget",
                        "source_id": str(account.id),
                    },
                ],
            )

    def test_a_bad_reference_is_a_400_naming_the_line(self, ctx):
        """A five-line split needs to know *which* line is wrong. Left alone the
        creator's ``ValueError`` would surface as a 500 on a client mistake."""
        household, user, account, bathroom, _, _ = ctx
        txn = make_txn(account)

        with pytest.raises(ValidationError) as excinfo:
            set_allocations(
                household=household,
                user=user,
                transaction=txn,
                lines=[
                    {
                        "amount": "90.00",
                        "subject": "ok",
                        "source_type": "projects.project",
                        "source_id": str(bathroom.id),
                    },
                    {"amount": "60.00", "subject": "bad", "zone_ids": [str(bathroom.id)]},
                ],
            )
        assert "line 2" in str(excinfo.value.detail["lines"])

    def test_source_type_without_source_id_is_refused(self, ctx):
        household, user, account, _, _, _ = ctx
        txn = make_txn(account, amount="-90.00")

        with pytest.raises(ValidationError):
            set_allocations(
                household=household,
                user=user,
                transaction=txn,
                lines=[{"amount": "90.00", "subject": "x", "source_type": "projects.project"}],
            )


@pytest.mark.django_db
class TestOwnershipRuleRegression:
    """THE test of the lot.

    The ownership rule used to require ``kind='bank'`` **and** no source object.
    That clause was redundant until allocation lines could carry a project — after
    which a line attached to one stopped being "owned", and was *detached* instead
    of deleted on re-edit. Every re-split would then leave a phantom expense
    behind, still counted in the project's cost: exactly the orphan the parcours
    exists to remove.
    """

    def test_re_editing_a_project_split_three_times_leaves_no_orphan(self, ctx):
        household, user, account, bathroom, kitchen, diy = ctx
        txn = make_txn(account)

        for first, second in (("90.00", "60.00"), ("100.00", "50.00"), ("120.00", "30.00")):
            set_allocations(
                household=household,
                user=user,
                transaction=txn,
                lines=[
                    {
                        "amount": first,
                        "subject": "Carrelage",
                        "budget_id": str(diy.id),
                        "source_type": "projects.project",
                        "source_id": str(bathroom.id),
                    },
                    {
                        "amount": second,
                        "subject": "Peinture",
                        "source_type": "projects.project",
                        "source_id": str(kitchen.id),
                    },
                ],
            )

        # Two expenses, not six: each re-edit replaced its predecessors.
        assert Interaction.objects.filter(household=household, type="expense").count() == 2
        # And no expense left detached from the line it came from.
        assert not Interaction.objects.filter(
            household=household, type="expense", bank_transaction__isnull=True
        ).exists()
        # The project costs reflect the LAST split, not the sum of all three.
        assert project_actual_cost(bathroom) == Decimal("120.00")
        assert project_actual_cost(kitchen) == Decimal("30.00")

    def test_a_pre_existing_purchase_is_still_only_detached(self, ctx):
        """The asymmetry that justified the rule in the first place is preserved:
        an expense that predates the statement is a fact of its own. Deleting it
        would take its documents, tags and possibly a task with it."""
        household, user, account, bathroom, _, _ = ctx
        txn = make_txn(account)
        purchase = Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Achat de stock",
            type="expense",
            occurred_at=timezone.now(),
            amount=Decimal("40.00"),
            kind=KIND_STOCK_PURCHASE,
            bank_transaction=txn,
        )

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {
                    "amount": "90.00",
                    "subject": "Carrelage",
                    "source_type": "projects.project",
                    "source_id": str(bathroom.id),
                },
            ],
        )

        purchase.refresh_from_db()
        assert purchase.pk is not None
        assert purchase.bank_transaction_id is None
        assert purchase.reconciled_by == ""

    def test_deleting_the_line_takes_its_project_allocations_with_it(self, ctx):
        household, user, account, bathroom, _, _ = ctx
        txn = make_txn(account, amount="-90.00")
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {
                    "amount": "90.00",
                    "subject": "Carrelage",
                    "source_type": "projects.project",
                    "source_id": str(bathroom.id),
                },
            ],
        )

        delete_transaction(user=user, transaction=txn)

        assert not Interaction.objects.filter(household=household, type="expense").exists()
        assert project_actual_cost(bathroom) == Decimal("0.00")
