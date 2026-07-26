# banking/tests/test_compliance.py
"""The conformity guarantee — parcours 26, lot 1.

Every detector gets two tests: one that **creates** the écart and one that proves
it **disappears once resolved**. A detector that only ever fires is as useless as
one that never does — it would make zero unreachable, and the whole point of the
control is that zero is reachable.

Then the arbitration mechanism, whose three properties are the reason it is not
just a « hide » button:

- a waiver removes the écart from the open list and shows up in the audited one;
- revoking brings the écart back **identical**;
- a waiver **expires** when what it arbitrated moves — without that, arbitrating
  « the rest of this line does not interest me » and then re-splitting the line
  would leave money covered by a motive describing nothing. The flag would become
  the best hiding place in the app.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from banking import compliance
from banking.compliance import get_detector, open_findings, summary, waived_findings
from banking.dedup import compute_dedup_hash
from banking.detectors import (
    ACCOUNT_CHAIN_BROKEN,
    ACCOUNT_NO_OPENING_BALANCE,
    EXPENSE_UNRECONCILED,
    TRANSACTION_PARTIAL,
    TRANSACTION_UNALLOCATED,
)
from banking.models import (
    BankTransaction,
    ComplianceWaiver,
    ImportStatus,
    StatementImport,
    TransactionDirection,
)
from banking.services import revoke_waiver, set_allocations, waive_finding
from budget.models import Budget
from interactions.models import Interaction

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount="-120.00", booked_on=date(2026, 3, 10), label="CB LECLERC", **extra):
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


def make_expense(household, user, *, amount="42.00", occurred_on=date(2026, 3, 10), **extra):
    return Interaction.objects.create(
        household=household,
        created_by=user,
        subject="Achat divers",
        type="expense",
        occurred_at=timezone.make_aware(
            timezone.datetime(occurred_on.year, occurred_on.month, occurred_on.day, 12, 0)
        ),
        amount=Decimal(amount),
        kind="manual",
        **extra,
    )


@pytest.fixture
def ctx(db):
    """A household whose single account has a window covering March 2026."""
    household = HouseholdFactory()
    user = UserFactory()
    account = BankAccountFactory(
        household=household,
        name="Courant",
        opening_balance=Decimal("1000.00"),
        opening_balance_date=date(2026, 1, 1),
    )
    StatementImport.objects.create(
        household=household,
        account=account,
        provider="generic_csv",
        status=ImportStatus.COMPLETED,
        period_start=date(2026, 1, 1),
        period_end=date(2026, 3, 31),
    )
    budget = Budget.objects.create(household=household, name="Courses", monthly_amount=400)
    return household, user, account, budget


def group(household, kind):
    return next(g for g in summary(household) if g.spec.kind == kind)


# --- Detector: an outflow nobody accounted for --------------------------------


@pytest.mark.django_db
class TestUnallocatedTransaction:
    def test_an_unallocated_outflow_is_an_ecart(self, ctx):
        household, _, account, _ = ctx
        txn = make_txn(account)

        findings = open_findings(household, get_detector(TRANSACTION_UNALLOCATED))
        assert [f.object_id for f in findings] == [str(txn.pk)]
        assert findings[0].detail["remaining"] == "120.00"

    def test_it_disappears_once_fully_allocated(self, ctx):
        household, user, account, budget = ctx
        txn = make_txn(account)

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "120.00", "subject": "Courses", "budget_id": str(budget.id)}],
        )

        assert group(household, TRANSACTION_UNALLOCATED).detected == 0

    def test_an_inflow_is_not_an_ecart_here(self, ctx):
        """A receipt is not spending. Its own detector lands in lot 5."""
        household, _, account, _ = ctx
        make_txn(account, amount="2100.00", label="VIREMENT SALAIRE")
        assert group(household, TRANSACTION_UNALLOCATED).detected == 0

    def test_an_internal_movement_is_not_an_ecart(self, ctx):
        """The money is counted once, later, when the cash it fed is spent."""
        household, _, account, _ = ctx
        make_txn(account, label="RETRAIT DAB", is_internal=True)
        assert group(household, TRANSACTION_UNALLOCATED).detected == 0

    def test_a_line_predating_the_opening_balance_is_not_an_ecart(self, ctx):
        """Statements imported for context, before the household started tracking:
        history, not a backlog.

        Only the *lower* bound can ever exclude a bank line — the upper bound is
        derived from the lines themselves (see ``coverage._latest_known_date``), so
        a line always sits inside its own window's end. Which is the right reading:
        holding the line means holding the statement, so it has to be accounted
        for. The upper bound bites on expenses, not on lines."""
        household, _, account, _ = ctx
        make_txn(account, booked_on=date(2025, 11, 4), label="VIEIL ACHAT")
        assert group(household, TRANSACTION_UNALLOCATED).detected == 0

    def test_nothing_is_asserted_without_an_opening_balance(self, ctx):
        """Not « conforme »: not evaluable. The prerequisite detector does the
        talking, and one action then makes the rest meaningful."""
        household, _, account, _ = ctx
        make_txn(account)
        account.opening_balance_date = None
        account.save(update_fields=["opening_balance_date"])

        assert group(household, TRANSACTION_UNALLOCATED).detected == 0
        assert group(household, ACCOUNT_NO_OPENING_BALANCE).detected == 1


# --- Detector: an outflow only partly accounted for ---------------------------


@pytest.mark.django_db
class TestPartiallyAllocatedTransaction:
    def test_a_partial_split_is_an_ecart_carrying_its_remainder(self, ctx):
        household, user, account, budget = ctx
        txn = make_txn(account, amount="-150.00")

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "90.00", "subject": "Salle de bain", "budget_id": str(budget.id)}],
        )

        findings = open_findings(household, get_detector(TRANSACTION_PARTIAL))
        assert [f.object_id for f in findings] == [str(txn.pk)]
        assert findings[0].detail["remaining"] == "60.00"
        # And it is no longer counted as "not allocated at all".
        assert group(household, TRANSACTION_UNALLOCATED).detected == 0

    def test_it_disappears_once_completed(self, ctx):
        household, user, account, budget = ctx
        txn = make_txn(account, amount="-150.00")

        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[
                {"amount": "90.00", "subject": "Salle de bain", "budget_id": str(budget.id)},
                {"amount": "60.00", "subject": "Divers", "budget_id": str(budget.id)},
            ],
        )

        assert group(household, TRANSACTION_PARTIAL).detected == 0
        assert group(household, TRANSACTION_UNALLOCATED).detected == 0


# --- Detector: an expense the bank never saw ---------------------------------


@pytest.mark.django_db
class TestUnreconciledExpense:
    def test_an_expense_with_no_bank_line_is_an_ecart(self, ctx):
        household, user, _, _ = ctx
        expense = make_expense(household, user)

        findings = open_findings(household, get_detector(EXPENSE_UNRECONCILED))
        assert [f.object_id for f in findings] == [str(expense.pk)]

    def test_it_disappears_once_reconciled(self, ctx):
        household, user, account, _ = ctx
        expense = make_expense(household, user, amount="120.00")
        txn = make_txn(account)

        expense.bank_transaction = txn
        expense.save(update_fields=["bank_transaction"])

        assert group(household, EXPENSE_UNRECONCILED).detected == 0

    def test_an_expense_predating_the_horizon_is_never_an_ecart(self, ctx):
        """THE reason the horizon exists: these can never be fixed, so flagging
        them would only teach the user to ignore the control."""
        household, user, _, _ = ctx
        make_expense(household, user, occurred_on=date(2024, 5, 3))
        assert group(household, EXPENSE_UNRECONCILED).detected == 0

    def test_an_expense_after_the_last_statement_is_never_an_ecart(self, ctx):
        household, user, _, _ = ctx
        make_expense(household, user, occurred_on=date(2026, 7, 24))
        assert group(household, EXPENSE_UNRECONCILED).detected == 0

    def test_a_note_is_not_an_expense(self, ctx):
        household, user, _, _ = ctx
        Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Pensé à rappeler le plombier",
            type="note",
            occurred_at=timezone.now(),
        )
        assert group(household, EXPENSE_UNRECONCILED).detected == 0


# --- Detector: the blocking prerequisite -------------------------------------


@pytest.mark.django_db
class TestAccountWithoutOpeningBalance:
    def test_it_is_reported_as_a_blocker(self, ctx):
        household, _, account, _ = ctx
        account.opening_balance_date = None
        account.save(update_fields=["opening_balance_date"])

        result = group(household, ACCOUNT_NO_OPENING_BALANCE)
        assert result.detected == 1
        assert result.spec.severity == compliance.BLOCKER

    def test_it_disappears_once_the_date_is_filled(self, ctx):
        household, _, _, _ = ctx
        assert group(household, ACCOUNT_NO_OPENING_BALANCE).detected == 0

    def test_it_cannot_be_arbitrated(self, ctx):
        """« Aucun flag légitime » from the catalogue, enforced as a 400 rather
        than left as a comment: a prerequisite is fixed, never waived."""
        household, user, account, _ = ctx
        account.opening_balance_date = None
        account.save(update_fields=["opening_balance_date"])

        with pytest.raises(ValidationError) as excinfo:
            waive_finding(
                household=household,
                user=user,
                finding_kind=ACCOUNT_NO_OPENING_BALANCE,
                object_id=str(account.pk),
                reason="pas envie",
            )
        assert "finding_kind" in excinfo.value.detail


# --- Detector: statements that do not chain ----------------------------------


@pytest.mark.django_db
class TestChainBroken:
    def test_a_hole_in_the_balance_chain_is_an_ecart(self, ctx):
        household, _, account, _ = ctx
        make_txn(
            account,
            booked_on=date(2026, 3, 1),
            amount="-100.00",
            balance_after=Decimal("900.00"),
        )
        # 900 - 50 = 850, but the bank printed 700: 150 € of operations missing.
        make_txn(
            account,
            booked_on=date(2026, 3, 5),
            amount="-50.00",
            balance_after=Decimal("700.00"),
        )

        findings = open_findings(household, get_detector(ACCOUNT_CHAIN_BROKEN))
        assert [f.object_id for f in findings] == [str(account.pk)]
        assert findings[0].detail["missing_amount"] == "-150.00"

    def test_a_chain_that_closes_is_not_an_ecart(self, ctx):
        household, _, account, _ = ctx
        make_txn(
            account, booked_on=date(2026, 3, 1), amount="-100.00", balance_after=Decimal("900.00")
        )
        make_txn(
            account, booked_on=date(2026, 3, 5), amount="-50.00", balance_after=Decimal("850.00")
        )
        assert group(household, ACCOUNT_CHAIN_BROKEN).detected == 0

    def test_a_file_without_balances_cannot_be_checked_and_is_not_flagged(self, ctx):
        """The real Crédit Agricole export has no balance column. Inventing a gap
        would be worse than admitting we cannot verify."""
        household, _, account, _ = ctx
        make_txn(account, booked_on=date(2026, 3, 1))
        make_txn(account, booked_on=date(2026, 3, 5))
        assert group(household, ACCOUNT_CHAIN_BROKEN).detected == 0


# --- The arbitration mechanism ----------------------------------------------


@pytest.mark.django_db
class TestWaiver:
    def test_a_waiver_moves_the_ecart_to_the_audited_list(self, ctx):
        household, user, account, _ = ctx
        txn = make_txn(account)

        waive_finding(
            household=household,
            user=user,
            finding_kind=TRANSACTION_UNALLOCATED,
            object_id=str(txn.pk),
            reason="Frais bancaires, ne concerne aucun budget",
        )

        spec = get_detector(TRANSACTION_UNALLOCATED)
        assert open_findings(household, spec) == []
        audited = waived_findings(household, spec)
        assert [f.object_id for f in audited] == [str(txn.pk)]
        assert audited[0].waiver_reason == "Frais bancaires, ne concerne aucun budget"

    def test_revoking_brings_the_ecart_back_identical(self, ctx):
        household, user, account, _ = ctx
        txn = make_txn(account)
        spec = get_detector(TRANSACTION_UNALLOCATED)
        before = open_findings(household, spec)

        waiver = waive_finding(
            household=household,
            user=user,
            finding_kind=TRANSACTION_UNALLOCATED,
            object_id=str(txn.pk),
            reason="à revoir",
        )
        revoke_waiver(waiver=waiver)

        after = open_findings(household, spec)
        assert [f.object_id for f in after] == [f.object_id for f in before]
        assert [f.fingerprint for f in after] == [f.fingerprint for f in before]

    def test_a_waiver_expires_when_what_it_arbitrated_moves(self, ctx):
        """The whole reason ``fingerprint`` exists.

        Arbitrating « the rest of this 150 € line does not interest me » and then
        splitting 90 € of it must NOT leave the remaining 60 € silently covered by
        a motive that no longer describes anything.
        """
        household, user, account, budget = ctx
        txn = make_txn(account, amount="-150.00")
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "10.00", "subject": "Un truc", "budget_id": str(budget.id)}],
        )
        spec = get_detector(TRANSACTION_PARTIAL)

        waive_finding(
            household=household,
            user=user,
            finding_kind=TRANSACTION_PARTIAL,
            object_id=str(txn.pk),
            reason="le reste ne m'intéresse pas",
        )
        assert open_findings(household, spec) == []

        # The user changes their mind about the split: 10 € becomes 90 €.
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "90.00", "subject": "Salle de bain", "budget_id": str(budget.id)}],
        )

        reopened = open_findings(household, spec)
        assert [f.object_id for f in reopened] == [str(txn.pk)]
        assert reopened[0].is_stale is True
        # The original motive is kept visible — the user re-arbitrates in context.
        assert reopened[0].waiver_reason == "le reste ne m'intéresse pas"
        assert waived_findings(household, spec) == []

    def test_re_arbitrating_refreshes_the_fingerprint_without_stacking_rows(self, ctx):
        household, user, account, budget = ctx
        txn = make_txn(account, amount="-150.00")
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "10.00", "subject": "Un truc", "budget_id": str(budget.id)}],
        )
        waive_finding(
            household=household,
            user=user,
            finding_kind=TRANSACTION_PARTIAL,
            object_id=str(txn.pk),
            reason="premier motif",
        )
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "90.00", "subject": "Salle de bain", "budget_id": str(budget.id)}],
        )

        waive_finding(
            household=household,
            user=user,
            finding_kind=TRANSACTION_PARTIAL,
            object_id=str(txn.pk),
            reason="motif à jour",
        )

        assert ComplianceWaiver.objects.filter(household=household).count() == 1
        spec = get_detector(TRANSACTION_PARTIAL)
        assert open_findings(household, spec) == []
        assert waived_findings(household, spec)[0].waiver_reason == "motif à jour"

    def test_a_waiver_without_a_motive_is_refused(self, ctx):
        household, user, account, _ = ctx
        txn = make_txn(account)

        with pytest.raises(ValidationError) as excinfo:
            waive_finding(
                household=household,
                user=user,
                finding_kind=TRANSACTION_UNALLOCATED,
                object_id=str(txn.pk),
                reason="   ",
            )
        assert "reason" in excinfo.value.detail

    def test_arbitrating_a_non_existent_ecart_is_refused(self, ctx):
        """Otherwise a waiver could be planted in advance to silence a future
        problem — an écart that would never even be seen once."""
        household, user, account, budget = ctx
        txn = make_txn(account)
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "120.00", "subject": "Courses", "budget_id": str(budget.id)}],
        )

        with pytest.raises(ValidationError) as excinfo:
            waive_finding(
                household=household,
                user=user,
                finding_kind=TRANSACTION_UNALLOCATED,
                object_id=str(txn.pk),
                reason="motif valable",
            )
        assert "object_id" in excinfo.value.detail

    def test_an_unknown_check_is_refused(self, ctx):
        household, user, _, _ = ctx
        with pytest.raises(ValidationError):
            waive_finding(
                household=household,
                user=user,
                finding_kind="nope",
                object_id="x",
                reason="motif",
            )

    def test_a_dormant_waiver_neither_hides_nor_counts(self, ctx):
        """Resolving an arbitrated écart must not leave a phantom in the audited
        list: the waiver covers nothing right now, so it is listed nowhere."""
        household, user, account, budget = ctx
        txn = make_txn(account)
        waive_finding(
            household=household,
            user=user,
            finding_kind=TRANSACTION_UNALLOCATED,
            object_id=str(txn.pk),
            reason="frais bancaires",
        )
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "120.00", "subject": "Courses", "budget_id": str(budget.id)}],
        )

        result = group(household, TRANSACTION_UNALLOCATED)
        assert (result.detected, result.open, result.waived) == (0, 0, 0)


# --- The accounting identity -------------------------------------------------


@pytest.mark.django_db
class TestSummaryTotals:
    def test_open_plus_waived_equals_detected(self, ctx):
        """Criterion 7 of the lot. If this drifts, the control lies about how much
        is left — and a control that lies is worse than none."""
        household, user, account, budget = ctx
        for index in range(5):
            make_txn(account, label=f"CB ACHAT {index}")
        partial = make_txn(account, amount="-150.00", label="CB LEROY MERLIN")
        set_allocations(
            household=household,
            user=user,
            transaction=partial,
            lines=[{"amount": "90.00", "subject": "Salle de bain", "budget_id": str(budget.id)}],
        )
        make_expense(household, user)

        waive_finding(
            household=household,
            user=user,
            finding_kind=TRANSACTION_UNALLOCATED,
            object_id=str(BankTransaction.objects.get(label_raw="CB ACHAT 0").pk),
            reason="ne concerne pas le foyer",
        )

        results = summary(household)
        for result in results:
            assert result.open + result.waived == result.detected, result.spec.kind

        by_kind = {r.spec.kind: r for r in results}
        assert by_kind[TRANSACTION_UNALLOCATED].detected == 5
        assert by_kind[TRANSACTION_UNALLOCATED].waived == 1
        assert by_kind[TRANSACTION_UNALLOCATED].open == 4
        assert by_kind[TRANSACTION_PARTIAL].open == 1
        assert by_kind[EXPENSE_UNRECONCILED].open == 1

    def test_stale_waivers_count_as_open_not_as_waived(self, ctx):
        household, user, account, budget = ctx
        txn = make_txn(account, amount="-150.00")
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "10.00", "subject": "Un truc", "budget_id": str(budget.id)}],
        )
        waive_finding(
            household=household,
            user=user,
            finding_kind=TRANSACTION_PARTIAL,
            object_id=str(txn.pk),
            reason="le reste ne m'intéresse pas",
        )
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "90.00", "subject": "Salle de bain", "budget_id": str(budget.id)}],
        )

        result = group(household, TRANSACTION_PARTIAL)
        assert (result.detected, result.open, result.waived, result.stale) == (1, 1, 0, 1)

    def test_another_household_is_never_counted(self, ctx):
        household, _, _, _ = ctx
        other = HouseholdFactory()
        other_account = BankAccountFactory(
            household=other, opening_balance_date=date(2026, 1, 1)
        )
        StatementImport.objects.create(
            household=other,
            account=other_account,
            provider="generic_csv",
            status=ImportStatus.COMPLETED,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 3, 31),
        )
        make_txn(other_account)

        assert group(household, TRANSACTION_UNALLOCATED).detected == 0
        assert group(other, TRANSACTION_UNALLOCATED).detected == 1

    def test_summary_stays_within_a_bounded_query_budget(
        self, ctx, django_assert_max_num_queries
    ):
        """The badge is read on every navigation. It must cost a handful of indexed
        counts, not a scan per écart — hence ``count`` being separate from
        ``findings``. Volume must not move this number."""
        household, user, account, budget = ctx
        for index in range(60):
            make_txn(account, label=f"CB ACHAT {index}")
        for index in range(20):
            make_expense(household, user, amount="12.00")

        with django_assert_max_num_queries(30):
            summary(household)


@pytest.mark.django_db
class TestPagination:
    def test_a_page_of_open_ecarts_is_full_despite_waivers(self, ctx):
        """Excluding the waived ones *before* the LIMIT: a page of 3 holds 3 open
        écarts, not 3-minus-the-arbitrated-ones."""
        household, user, account, _ = ctx
        txns = [make_txn(account, label=f"CB ACHAT {i}") for i in range(6)]
        for txn in txns[:2]:
            waive_finding(
                household=household,
                user=user,
                finding_kind=TRANSACTION_UNALLOCATED,
                object_id=str(txn.pk),
                reason="hors foyer",
            )

        spec = get_detector(TRANSACTION_UNALLOCATED)
        page = open_findings(household, spec, limit=3, offset=0)
        assert len(page) == 3
        waived_ids = {str(t.pk) for t in txns[:2]}
        assert not waived_ids & {f.object_id for f in page}
