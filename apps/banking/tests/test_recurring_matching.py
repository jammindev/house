# banking/tests/test_recurring_matching.py
"""Le relevé confirme les récurrences (parcours 26, lot 6).

Une douzaine de prélèvements tombent chaque mois. Les confirmer un par un est la
corvée qui fait qu'on arrête de confirmer — après quoi « échéance passée non
confirmée » s'empile et la projection de trésorerie ment. Le relevé sait déjà
qu'ils ont eu lieu.

Les deux protections sont les mêmes que pour le rapprochement des dépenses, et pour
les mêmes raisons : **montant strictement égal** pour l'auto-confirmation, et
**affectation greedy stable** pour que deux abonnements à 15 € face à deux lignes à
15 € ne se croisent pas.
"""
from __future__ import annotations

import itertools
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from banking.compliance import get_detector, open_findings, summary
from banking.dedup import compute_dedup_hash
from banking.detectors import RECURRING_DOUBLE_CONFIRMED, RECURRING_OVERDUE
from banking.matching import match_recurrences
from banking.models import BankTransaction, ImportStatus, StatementImport, TransactionDirection
from budget.models import Budget, RecurringExpense
from budget.services import confirm_recurring_occurrence
from interactions.kinds import KIND_RECURRING
from interactions.models import Interaction

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount, booked_on, label):
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
    account = BankAccountFactory(
        household=household, name="Courant", opening_balance_date=date(2026, 1, 1)
    )
    StatementImport.objects.create(
        household=household,
        account=account,
        provider="generic_csv",
        status=ImportStatus.COMPLETED,
        period_start=date(2026, 1, 1),
        period_end=date(2026, 3, 31),
    )
    budget = Budget.objects.create(household=household, name="Abonnements", monthly_amount=100)
    return household, user, account, budget


def make_recurring(household, *, label="Netflix", amount="15.99", due, supplier="", budget=None):
    return RecurringExpense.objects.create(
        household=household,
        label=label,
        amount=Decimal(amount),
        cadence=RecurringExpense.Cadence.MONTHLY,
        next_due_date=due,
        supplier=supplier,
        budget=budget,
    )


def group(household, kind):
    return next(g for g in summary(household) if g.spec.kind == kind)


@pytest.mark.django_db
class TestMatchRecurrences:
    def test_a_debit_confirms_its_recurrence(self, ctx):
        household, user, account, budget = ctx
        recurring = make_recurring(
            household, due=date(2026, 3, 10), supplier="NETFLIX", budget=budget
        )
        txn = make_txn(account, amount="-15.99", booked_on=date(2026, 3, 10), label="PRLV NETFLIX")

        outcome = match_recurrences(household=household, user=user, transactions=[txn])

        assert outcome["confirmed"] == 1
        expense = Interaction.objects.get(bank_transaction=txn)
        assert expense.kind == KIND_RECURRING
        assert expense.recurring_expense_id == recurring.id
        assert expense.budget_id == budget.id
        assert expense.amount == Decimal("15.99")
        # La clé JSON reste pour l'affichage.
        assert expense.metadata["recurring_id"] == str(recurring.id)

    def test_the_schedule_advances(self, ctx):
        household, user, account, _ = ctx
        recurring = make_recurring(household, due=date(2026, 3, 10), supplier="NETFLIX")
        txn = make_txn(account, amount="-15.99", booked_on=date(2026, 3, 10), label="PRLV NETFLIX")

        match_recurrences(household=household, user=user, transactions=[txn])

        recurring.refresh_from_db()
        assert recurring.next_due_date == date(2026, 4, 10)

    def test_the_line_is_fully_allocated(self, ctx):
        """Sinon on créerait un écart « sortie partiellement ventilée » en
        confirmant — l'app fabriquerait son propre travail."""
        from banking.validators import remaining_to_allocate

        household, user, account, _ = ctx
        make_recurring(household, due=date(2026, 3, 10), supplier="NETFLIX")
        txn = make_txn(account, amount="-15.99", booked_on=date(2026, 3, 10), label="PRLV NETFLIX")

        match_recurrences(household=household, user=user, transactions=[txn])

        assert remaining_to_allocate(txn) == Decimal("0.00")

    def test_a_differing_amount_is_only_a_suggestion(self, ctx):
        """Une facture qui varie de cinq centimes est probablement la même facture,
        mais la confirmer écrirait une occurrence que l'utilisateur n'a pas vérifiée,
        à un montant qu'il n'a jamais vu."""
        household, user, account, _ = ctx
        make_recurring(household, amount="15.99", due=date(2026, 3, 10), supplier="NETFLIX")
        txn = make_txn(account, amount="-16.02", booked_on=date(2026, 3, 10), label="PRLV NETFLIX")

        outcome = match_recurrences(household=household, user=user, transactions=[txn])

        assert outcome["confirmed"] == 0
        assert len(outcome["suggestions"]) == 1
        assert not Interaction.objects.filter(bank_transaction=txn).exists()

    def test_a_line_outside_the_window_is_ignored(self, ctx):
        household, user, account, _ = ctx
        make_recurring(household, due=date(2026, 3, 10), supplier="NETFLIX")
        txn = make_txn(account, amount="-15.99", booked_on=date(2026, 2, 1), label="PRLV NETFLIX")

        outcome = match_recurrences(household=household, user=user, transactions=[txn])
        assert outcome["confirmed"] == 0
        assert outcome["suggestions"] == []

    def test_two_identical_subscriptions_do_not_cross_assign(self, ctx):
        """L'affectation est un passage greedy stable, jamais un argmax par ligne."""
        household, user, account, _ = ctx
        make_recurring(household, label="Abo A", amount="15.00", due=date(2026, 3, 10),
                       supplier="ABO A")
        make_recurring(household, label="Abo B", amount="15.00", due=date(2026, 3, 10),
                       supplier="ABO B")
        first = make_txn(account, amount="-15.00", booked_on=date(2026, 3, 10), label="PRLV ABO A")
        second = make_txn(account, amount="-15.00", booked_on=date(2026, 3, 10), label="PRLV ABO B")

        outcome = match_recurrences(
            household=household, user=user, transactions=[first, second]
        )

        assert outcome["confirmed"] == 2
        # Chaque ligne porte une dépense, et chaque récurrence exactement une.
        assert Interaction.objects.filter(bank_transaction=first).count() == 1
        assert Interaction.objects.filter(bank_transaction=second).count() == 1
        assert (
            Interaction.objects.filter(recurring_expense__label="Abo A").count() == 1
        )

    def test_an_inflow_is_never_matched(self, ctx):
        household, user, account, _ = ctx
        make_recurring(household, due=date(2026, 3, 10), supplier="NETFLIX")
        txn = make_txn(account, amount="15.99", booked_on=date(2026, 3, 10), label="NETFLIX AVOIR")

        assert match_recurrences(household=household, user=user, transactions=[txn])[
            "confirmed"
        ] == 0

    def test_a_second_run_confirms_nothing_more(self, ctx):
        """Idempotence : ce qui est déjà ventilé sort du pool, et l'anti-doublon
        protège le reste."""
        household, user, account, _ = ctx
        make_recurring(household, due=date(2026, 3, 10), supplier="NETFLIX")
        txn = make_txn(account, amount="-15.99", booked_on=date(2026, 3, 10), label="PRLV NETFLIX")

        match_recurrences(household=household, user=user, transactions=[txn])
        again = match_recurrences(household=household, user=user, transactions=[txn])

        assert again["confirmed"] == 0
        assert Interaction.objects.filter(bank_transaction=txn).count() == 1

    def test_an_already_confirmed_due_date_is_not_confirmed_twice(self, ctx):
        """Le cas de la course entre la confirmation manuelle et l'import."""
        household, user, account, budget = ctx
        recurring = make_recurring(
            household, due=date(2026, 3, 10), supplier="NETFLIX", budget=budget
        )
        Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Netflix",
            type="expense",
            occurred_at=timezone.make_aware(timezone.datetime(2026, 3, 10, 12, 0)),
            amount=Decimal("15.99"),
            kind=KIND_RECURRING,
            recurring_expense=recurring,
        )
        txn = make_txn(account, amount="-15.99", booked_on=date(2026, 3, 10), label="PRLV NETFLIX")

        outcome = match_recurrences(household=household, user=user, transactions=[txn])

        assert outcome["confirmed"] == 0
        assert Interaction.objects.filter(recurring_expense=recurring).count() == 1

    def test_a_household_without_recurrences_is_a_no_op(self, ctx):
        household, user, account, _ = ctx
        txn = make_txn(account, amount="-15.99", booked_on=date(2026, 3, 10), label="PRLV X")
        assert match_recurrences(household=household, user=user, transactions=[txn]) == {
            "confirmed": 0,
            "suggestions": [],
        }


# --- Détecteur : échéance passée non confirmée --------------------------------


@pytest.mark.django_db
class TestOverdueRecurring:
    def test_a_past_due_date_is_an_ecart(self, ctx):
        household, _, _, _ = ctx
        recurring = make_recurring(household, due=date.today() - timedelta(days=5))

        findings = open_findings(household, get_detector(RECURRING_OVERDUE))
        assert [f.object_id for f in findings] == [str(recurring.pk)]
        assert findings[0].detail["days_late"] == 5

    def test_a_future_due_date_is_not(self, ctx):
        household, _, _, _ = ctx
        make_recurring(household, due=date.today() + timedelta(days=5))
        assert group(household, RECURRING_OVERDUE).detected == 0

    def test_confirming_resolves_it(self, ctx):
        household, user, _, _ = ctx
        recurring = make_recurring(household, due=date.today() - timedelta(days=5))
        assert group(household, RECURRING_OVERDUE).detected == 1

        confirm_recurring_occurrence(household, user, recurring)

        assert group(household, RECURRING_OVERDUE).detected == 0

    def test_it_can_be_arbitrated_when_the_debit_stopped(self, ctx):
        from banking.services import waive_finding

        household, user, _, _ = ctx
        recurring = make_recurring(household, due=date.today() - timedelta(days=40))

        waive_finding(
            household=household,
            user=user,
            finding_kind=RECURRING_OVERDUE,
            object_id=str(recurring.pk),
            reason="prélèvement arrêté",
        )

        result = group(household, RECURRING_OVERDUE)
        assert (result.open, result.waived) == (0, 1)

    def test_the_arbitration_expires_when_the_schedule_moves(self, ctx):
        """Le fingerprint porte la date d'échéance : confirmer une occurrence la fait
        avancer, donc un « prélèvement arrêté » doit être reconsidéré."""
        from banking.services import waive_finding

        household, user, _, _ = ctx
        recurring = make_recurring(household, due=date.today() - timedelta(days=40))
        waive_finding(
            household=household,
            user=user,
            finding_kind=RECURRING_OVERDUE,
            object_id=str(recurring.pk),
            reason="prélèvement arrêté",
        )

        recurring.next_due_date = date.today() - timedelta(days=10)
        recurring.save(update_fields=["next_due_date"])

        reopened = open_findings(household, get_detector(RECURRING_OVERDUE))
        assert [f.is_stale for f in reopened] == [True]


# --- Détecteur : double confirmation ------------------------------------------


@pytest.mark.django_db
class TestDoubleConfirmed:
    def _occurrence(self, household, user, recurring, day):
        return Interaction.objects.create(
            household=household,
            created_by=user,
            subject=recurring.label,
            type="expense",
            occurred_at=timezone.make_aware(
                timezone.datetime(day.year, day.month, day.day, 12, 0)
            ),
            amount=recurring.amount,
            kind=KIND_RECURRING,
            recurring_expense=recurring,
        )

    def test_two_occurrences_on_the_same_day_is_an_ecart(self, ctx):
        household, user, _, _ = ctx
        recurring = make_recurring(household, due=date(2026, 4, 10))
        self._occurrence(household, user, recurring, date(2026, 3, 10))
        self._occurrence(household, user, recurring, date(2026, 3, 10))

        findings = open_findings(household, get_detector(RECURRING_DOUBLE_CONFIRMED))
        assert [f.object_id for f in findings] == [str(recurring.pk)]
        assert findings[0].detail["occurrences"][0]["count"] == 2

    def test_two_occurrences_on_different_days_are_fine(self, ctx):
        """Un prélèvement mensuel produit une occurrence par mois — c'est normal."""
        household, user, _, _ = ctx
        recurring = make_recurring(household, due=date(2026, 5, 10))
        self._occurrence(household, user, recurring, date(2026, 3, 10))
        self._occurrence(household, user, recurring, date(2026, 4, 10))

        assert group(household, RECURRING_DOUBLE_CONFIRMED).detected == 0

    def test_deleting_the_duplicate_resolves_it(self, ctx):
        household, user, _, _ = ctx
        recurring = make_recurring(household, due=date(2026, 4, 10))
        self._occurrence(household, user, recurring, date(2026, 3, 10))
        duplicate = self._occurrence(household, user, recurring, date(2026, 3, 10))
        assert group(household, RECURRING_DOUBLE_CONFIRMED).detected == 1

        duplicate.delete()

        assert group(household, RECURRING_DOUBLE_CONFIRMED).detected == 0

    def test_it_cannot_be_arbitrated(self, ctx):
        """Compter une facture deux fois n'est jamais acceptable : l'une des deux
        doit partir."""
        assert get_detector(RECURRING_DOUBLE_CONFIRMED).waivable is False
