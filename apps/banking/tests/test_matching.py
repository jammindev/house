# banking/tests/test_matching.py
"""Automatic reconciliation.

The lot that decides whether the system is used or abandoned: two banks are
~160 lines a month, and if each one needs a click the user drops off.

Two properties are non-negotiable and get most of the tests here:

- **auto-link only on a strictly equal amount** — an approximate match would
  break the allocation invariant and leave unexplainable residues;
- **stable greedy assignment** — two 20 € purchases facing two 20 € lines must
  not cross-assign or double-assign.
"""
from __future__ import annotations

import itertools
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from banking.dedup import compute_dedup_hash
from banking.matching import auto_reconcile, score_pair, suggestions_for
from banking.models import BankTransaction, TransactionDirection
from interactions.models import Interaction

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()
UTC = ZoneInfo("UTC")


def make_txn(account, *, amount="-32.50", booked_on=date(2026, 7, 14), label="CB LECLERC", **extra):
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
        **extra,
    )


def make_expense(household, *, amount="32.50", day=date(2026, 7, 12), supplier="Leclerc", kind="stock_purchase"):
    return Interaction.objects.create(
        household=household,
        subject=f"Achat {supplier}",
        type="expense",
        occurred_at=datetime.combine(day, time(12, 0), tzinfo=UTC),
        amount=Decimal(amount),
        kind=kind,
        supplier=supplier,
    )


@pytest.fixture
def context(db):
    household = HouseholdFactory()
    return household, UserFactory(), BankAccountFactory(household=household)


@pytest.mark.django_db
class TestAutoMatch:
    def test_the_canonical_case(self, context):
        """Stock purchase 32,50 € on the 12th, CB LECLERC -32,50 € on the 14th."""
        household, user, account = context
        expense = make_expense(household)
        txn = make_txn(account)

        outcome = auto_reconcile(household=household, user=user, transactions=[txn])

        assert outcome["auto_matched"] == 1
        expense.refresh_from_db()
        assert expense.bank_transaction_id == txn.id
        assert expense.reconciled_by == "auto"

    def test_an_approximate_amount_is_only_a_suggestion(self, context):
        """32,45 vs 32,50: probably right, but never linked silently."""
        household, user, account = context
        expense = make_expense(household, amount="32.50")
        txn = make_txn(account, amount="-32.45")

        outcome = auto_reconcile(household=household, user=user, transactions=[txn])

        assert outcome["auto_matched"] == 0
        assert len(outcome["suggestions"]) == 1
        expense.refresh_from_db()
        assert expense.bank_transaction_id is None

    def test_an_expense_out_of_the_window_is_ignored(self, context):
        household, user, account = context
        make_expense(household, day=date(2026, 6, 1))
        txn = make_txn(account)

        outcome = auto_reconcile(household=household, user=user, transactions=[txn])

        assert outcome["auto_matched"] == 0
        assert outcome["suggestions"] == []

    def test_a_recurring_confirmation_matches_its_direct_debit(self, context):
        """A recurring bill almost always faces a matching debit — free win."""
        household, user, account = context
        expense = make_expense(
            household, amount="49.99", supplier="Orange", kind="recurring"
        )
        txn = make_txn(account, amount="-49.99", label="PRLV ORANGE SA")

        outcome = auto_reconcile(household=household, user=user, transactions=[txn])

        assert outcome["auto_matched"] == 1
        expense.refresh_from_db()
        assert expense.bank_transaction_id == txn.id

    def test_an_already_reconciled_expense_is_not_reused(self, context):
        household, user, account = context
        make_expense(household)
        first = make_txn(account)
        auto_reconcile(household=household, user=user, transactions=[first])

        second = make_txn(account, booked_on=date(2026, 7, 15))
        outcome = auto_reconcile(household=household, user=user, transactions=[second])

        assert outcome["auto_matched"] == 0

    def test_internal_movements_are_never_matched(self, context):
        household, user, account = context
        make_expense(household, amount="100.00", supplier="Retrait")
        txn = make_txn(account, amount="-100.00", label="RETRAIT DAB", is_internal=True)

        outcome = auto_reconcile(household=household, user=user, transactions=[txn])

        assert outcome["auto_matched"] == 0

    def test_incoming_operations_are_never_matched(self, context):
        household, user, account = context
        make_expense(household, amount="2100.00", supplier="Salaire")
        txn = make_txn(account, amount="2100.00", label="VIR SALAIRE")

        outcome = auto_reconcile(household=household, user=user, transactions=[txn])

        assert outcome["auto_matched"] == 0

    def test_is_idempotent(self, context):
        household, user, account = context
        make_expense(household)
        txn = make_txn(account)

        first = auto_reconcile(household=household, user=user, transactions=[txn])
        second = auto_reconcile(household=household, user=user, transactions=[txn])

        assert first["auto_matched"] == 1
        assert second["auto_matched"] == 0


@pytest.mark.django_db
class TestGreedyAssignment:
    def test_two_identical_pairs_map_one_to_one(self, context):
        """The failure an argmax-per-line would produce: crossed or doubled."""
        household, user, account = context
        make_expense(household, amount="20.00", supplier="Boulangerie")
        make_expense(household, amount="20.00", supplier="Boulangerie")
        first = make_txn(account, amount="-20.00", label="CB BOULANGERIE")
        second = make_txn(account, amount="-20.00", label="CB BOULANGERIE", booked_on=date(2026, 7, 15))

        outcome = auto_reconcile(
            household=household, user=user, transactions=[first, second]
        )

        assert outcome["auto_matched"] == 2
        linked = Interaction.objects.filter(bank_transaction__isnull=False)
        assert linked.count() == 2
        assert {i.bank_transaction_id for i in linked} == {first.id, second.id}

    def test_one_expense_two_candidate_lines_links_only_once(self, context):
        household, user, account = context
        expense = make_expense(household, amount="20.00", supplier="Boulangerie")
        first = make_txn(account, amount="-20.00", label="CB BOULANGERIE")
        second = make_txn(
            account, amount="-20.00", label="CB BOULANGERIE", booked_on=date(2026, 7, 15)
        )

        outcome = auto_reconcile(
            household=household, user=user, transactions=[first, second]
        )

        assert outcome["auto_matched"] == 1
        expense.refresh_from_db()
        assert expense.bank_transaction_id in {first.id, second.id}

    def test_two_interchangeable_rivals_still_reconcile(self, context):
        """Same amount, same score: either choice gives identical books."""
        household, user, account = context
        make_expense(household, amount="20.00", supplier="Boulangerie", day=date(2026, 7, 13))
        make_expense(household, amount="20.00", supplier="Boulangerie", day=date(2026, 7, 13))
        txn = make_txn(account, amount="-20.00", label="CB BOULANGERIE")

        outcome = auto_reconcile(household=household, user=user, transactions=[txn])

        assert outcome["auto_matched"] == 1

    def test_two_genuinely_different_rivals_are_not_auto_linked(self, context):
        """Bakery or pharmacy? The budget attribution differs — so ask."""
        household, user, account = context
        make_expense(household, amount="20.00", supplier="Boulangerie", day=date(2026, 7, 13))
        make_expense(household, amount="20.00", supplier="Pharmacie", day=date(2026, 7, 14))
        txn = make_txn(account, amount="-20.00", label="CB PAIEMENT 20,00")

        outcome = auto_reconcile(household=household, user=user, transactions=[txn])

        assert outcome["auto_matched"] == 0
        assert len(outcome["suggestions"]) >= 1


@pytest.mark.django_db
class TestScoring:
    def test_supplier_inside_the_bank_label_scores_full(self, context):
        """`LECLERC` inside `CB LECLERC 12/07 123456` — the most common shape."""
        household, _, account = context
        expense = make_expense(household, supplier="Leclerc")
        txn = make_txn(account, label="CB LECLERC 12/07 123456")

        candidate = score_pair(expense, txn, tz=UTC)

        assert candidate is not None
        assert candidate.label_ratio == 1.0

    def test_accents_and_case_do_not_matter(self, context):
        household, _, account = context
        expense = make_expense(household, supplier="Café Crème")
        txn = make_txn(account, label="CB CAFE CREME")

        candidate = score_pair(expense, txn, tz=UTC)

        assert candidate is not None
        assert candidate.label_ratio == 1.0

    def test_a_same_day_exact_match_scores_near_one(self, context):
        household, _, account = context
        expense = make_expense(household, day=date(2026, 7, 14), supplier="Leclerc")
        txn = make_txn(account, booked_on=date(2026, 7, 14), label="CB LECLERC")

        candidate = score_pair(expense, txn, tz=UTC)

        assert candidate.score == pytest.approx(1.0, abs=0.001)

    def test_an_expense_recorded_a_day_late_still_matches(self, context):
        """The other direction of the delay — the window is asymmetric on purpose."""
        household, _, account = context
        expense = make_expense(household, day=date(2026, 7, 15))
        txn = make_txn(account, booked_on=date(2026, 7, 14))

        assert score_pair(expense, txn, tz=UTC) is not None


@pytest.mark.django_db
class TestSuggestionsFor:
    def test_returns_the_best_candidates_sorted(self, context):
        household, _, account = context
        make_expense(household, supplier="Leclerc", day=date(2026, 7, 14))
        make_expense(household, supplier="Autre", day=date(2026, 7, 8))
        txn = make_txn(account, booked_on=date(2026, 7, 14))

        candidates = suggestions_for(transaction=txn)

        assert len(candidates) == 2
        assert candidates[0].score >= candidates[1].score

    def test_is_empty_when_nothing_is_close(self, context):
        _, _, account = context
        txn = make_txn(account)
        assert suggestions_for(transaction=txn) == []


@pytest.mark.django_db
class TestImportRunsTheMatcher:
    def test_an_import_reconciles_what_it_can(self, context):
        from django.core.files.uploadedfile import SimpleUploadedFile

        from banking.services import import_statement_file

        household, user, account = context
        expense = make_expense(household, amount="32.50", day=date(2026, 7, 12))

        body = "Date;Libelle;Montant\n14/07/2026;CB LECLERC;-32,50\n"
        imported = import_statement_file(
            household,
            user,
            account=account,
            uploaded_file=SimpleUploadedFile("r.csv", body.encode(), content_type="text/csv"),
            provider="generic_csv",
            options={
                "date_column": "Date",
                "label_column": "Libelle",
                "amount_column": "Montant",
            },
        )

        assert imported.created_count == 1
        assert imported.auto_matched_count == 1
        expense.refresh_from_db()
        assert expense.reconciled_by == "auto"

    def test_a_large_import_does_not_explode_in_queries(
        self, django_assert_max_num_queries, context
    ):
        """300 lines must not become 300 round trips."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        from banking.services import import_statement_file

        household, user, account = context
        rows = "\n".join(
            f"{(date(2026, 7, 1) + timedelta(days=i % 28)).strftime('%d/%m/%Y')};OP {i};-{i + 1},00"
            for i in range(300)
        )
        body = f"Date;Libelle;Montant\n{rows}\n"

        with django_assert_max_num_queries(30):
            import_statement_file(
                household,
                user,
                account=account,
                uploaded_file=SimpleUploadedFile(
                    "r.csv", body.encode(), content_type="text/csv"
                ),
                provider="generic_csv",
                options={
                    "date_column": "Date",
                    "label_column": "Libelle",
                    "amount_column": "Montant",
                },
            )
