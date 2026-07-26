# banking/tests/test_api_compliance.py
"""
REST API tests for the conformity control (/api/banking/compliance/, /waivers/).

Coverage per section:
  1. TestComplianceSummary  — the badge endpoint: counts, scoping, isolation
  2. TestComplianceGroup    — one group's findings, pagination, audited list
  3. TestWaiverCreate       — motive required, non-waivable refused, re-arbitration
  4. TestWaiverRevoke       — the écart comes back
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.detectors import (
    ACCOUNT_NO_OPENING_BALANCE,
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
from banking.services import set_allocations
from budget.models import Budget
from households.models import HouseholdMember

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

SUMMARY_URL = "/api/banking/compliance/"
WAIVERS_URL = "/api/banking/waivers/"

_counter = itertools.count()


def _make_member(household, role=HouseholdMember.Role.MEMBER):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=role)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _results(response) -> list:
    body = response.json()
    return body["results"] if isinstance(body, dict) else body


def make_txn(account, *, amount="-120.00", booked_on=date(2026, 3, 10), label="CB LECLERC"):
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
def household_with_window(db):
    household = HouseholdFactory()
    user = _make_member(household)
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
    return household, user, account


def _group(body, kind):
    return next(g for g in body["groups"] if g["kind"] == kind)


@pytest.mark.django_db
class TestComplianceSummary:
    def test_requires_authentication(self):
        assert APIClient().get(SUMMARY_URL).status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_lists_every_registered_detector(self, household_with_window):
        _, user, _ = household_with_window
        body = _client_for(user).get(SUMMARY_URL).json()

        kinds = {g["kind"] for g in body["groups"]}
        assert TRANSACTION_UNALLOCATED in kinds
        assert ACCOUNT_NO_OPENING_BALANCE in kinds

    def test_counts_the_open_ecarts(self, household_with_window):
        _, user, account = household_with_window
        make_txn(account, label="CB A")
        make_txn(account, label="CB B")

        body = _client_for(user).get(SUMMARY_URL).json()
        assert _group(body, TRANSACTION_UNALLOCATED)["open"] == 2
        assert body["open_total"] >= 2

    def test_exposes_the_blocking_prerequisite_and_its_dependents(self, household_with_window):
        """The UI needs to explain *why* a control does not cover everything yet —
        one action instead of nine hundred."""
        _, user, _ = household_with_window
        body = _client_for(user).get(SUMMARY_URL).json()

        assert _group(body, ACCOUNT_NO_OPENING_BALANCE)["severity"] == "blocker"
        assert _group(body, ACCOUNT_NO_OPENING_BALANCE)["waivable"] is False
        assert _group(body, TRANSACTION_UNALLOCATED)["blocked_by"] == ACCOUNT_NO_OPENING_BALANCE

    def test_another_household_is_never_counted(self, household_with_window):
        _, user, _ = household_with_window
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

        body = _client_for(user).get(SUMMARY_URL).json()
        assert _group(body, TRANSACTION_UNALLOCATED)["open"] == 0


@pytest.mark.django_db
class TestComplianceGroup:
    def test_returns_the_findings_of_one_group(self, household_with_window):
        _, user, account = household_with_window
        txn = make_txn(account)

        body = _client_for(user).get(f"{SUMMARY_URL}{TRANSACTION_UNALLOCATED}/").json()
        assert [f["object_id"] for f in body["results"]] == [str(txn.pk)]
        assert body["results"][0]["detail"]["remaining"] == "120.00"
        assert body["open"] == 1

    def test_unknown_check_is_a_400(self, household_with_window):
        _, user, _ = household_with_window
        response = _client_for(user).get(f"{SUMMARY_URL}not_a_check/")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_paginates(self, household_with_window):
        _, user, account = household_with_window
        for index in range(5):
            make_txn(account, label=f"CB {index}")

        body = _client_for(user).get(
            f"{SUMMARY_URL}{TRANSACTION_UNALLOCATED}/?limit=2&offset=0"
        ).json()
        assert len(body["results"]) == 2
        assert body["detected"] == 5

    def test_rejects_a_malformed_limit(self, household_with_window):
        """A silently ignored filter makes the user believe they are seeing
        everything — the same rule as ``_parse_date_param``."""
        _, user, _ = household_with_window
        response = _client_for(user).get(f"{SUMMARY_URL}{TRANSACTION_UNALLOCATED}/?limit=beaucoup")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_waived_true_returns_the_audit_list(self, household_with_window):
        household, user, account = household_with_window
        txn = make_txn(account)
        client = _client_for(user)
        client.post(
            WAIVERS_URL,
            {
                "finding_kind": TRANSACTION_UNALLOCATED,
                "object_id": str(txn.pk),
                "reason": "frais bancaires",
            },
            format="json",
        )

        open_body = client.get(f"{SUMMARY_URL}{TRANSACTION_UNALLOCATED}/").json()
        assert open_body["results"] == []
        assert open_body["waived"] == 1

        audit = client.get(f"{SUMMARY_URL}{TRANSACTION_UNALLOCATED}/?waived=true").json()
        assert [f["object_id"] for f in audit["results"]] == [str(txn.pk)]
        assert audit["results"][0]["waiver_reason"] == "frais bancaires"


@pytest.mark.django_db
class TestWaiverCreate:
    def test_creates_an_arbitration(self, household_with_window):
        household, user, account = household_with_window
        txn = make_txn(account)

        response = _client_for(user).post(
            WAIVERS_URL,
            {
                "finding_kind": TRANSACTION_UNALLOCATED,
                "object_id": str(txn.pk),
                "reason": "ne concerne pas le foyer",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["reason"] == "ne concerne pas le foyer"
        assert body["fingerprint"]
        waiver = ComplianceWaiver.objects.get(pk=body["id"])
        assert waiver.household == household
        assert waiver.created_by == user

    def test_a_blank_motive_is_a_400(self, household_with_window):
        _, user, account = household_with_window
        txn = make_txn(account)

        response = _client_for(user).post(
            WAIVERS_URL,
            {"finding_kind": TRANSACTION_UNALLOCATED, "object_id": str(txn.pk), "reason": "  "},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "reason" in response.json()

    def test_a_non_waivable_check_is_a_400(self, household_with_window):
        _, user, account = household_with_window
        account.opening_balance_date = None
        account.save(update_fields=["opening_balance_date"])

        response = _client_for(user).post(
            WAIVERS_URL,
            {
                "finding_kind": ACCOUNT_NO_OPENING_BALANCE,
                "object_id": str(account.pk),
                "reason": "plus tard",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_arbitrating_a_resolved_ecart_is_a_400(self, household_with_window):
        household, user, account = household_with_window
        txn = make_txn(account)
        budget = Budget.objects.create(household=household, name="Courses", monthly_amount=400)
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "120.00", "subject": "Courses", "budget_id": str(budget.id)}],
        )

        response = _client_for(user).post(
            WAIVERS_URL,
            {
                "finding_kind": TRANSACTION_UNALLOCATED,
                "object_id": str(txn.pk),
                "reason": "motif valable",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_re_arbitrating_updates_instead_of_stacking(self, household_with_window):
        household, user, account = household_with_window
        txn = make_txn(account)
        client = _client_for(user)
        payload = {
            "finding_kind": TRANSACTION_UNALLOCATED,
            "object_id": str(txn.pk),
            "reason": "premier motif",
        }
        client.post(WAIVERS_URL, payload, format="json")
        client.post(WAIVERS_URL, {**payload, "reason": "motif corrigé"}, format="json")

        assert ComplianceWaiver.objects.filter(household=household).count() == 1
        assert ComplianceWaiver.objects.get().reason == "motif corrigé"

    def test_patch_is_not_allowed(self, household_with_window):
        """Editing the motive alone would leave a stale fingerprint behind — a
        waiver that looks current but arbitrates a situation that has moved."""
        household, user, account = household_with_window
        txn = make_txn(account)
        client = _client_for(user)
        created = client.post(
            WAIVERS_URL,
            {
                "finding_kind": TRANSACTION_UNALLOCATED,
                "object_id": str(txn.pk),
                "reason": "motif",
            },
            format="json",
        ).json()

        response = client.patch(
            f"{WAIVERS_URL}{created['id']}/", {"reason": "autre"}, format="json"
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_cannot_arbitrate_another_household_ecart(self, household_with_window):
        _, user, _ = household_with_window
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
        foreign = make_txn(other_account)

        response = _client_for(user).post(
            WAIVERS_URL,
            {
                "finding_kind": TRANSACTION_UNALLOCATED,
                "object_id": str(foreign.pk),
                "reason": "motif",
            },
            format="json",
        )
        # The detector is household-scoped, so the écart simply does not exist here.
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not ComplianceWaiver.objects.exists()


@pytest.mark.django_db
class TestWaiverRevoke:
    def test_revoking_brings_the_ecart_back(self, household_with_window):
        household, user, account = household_with_window
        txn = make_txn(account)
        client = _client_for(user)
        created = client.post(
            WAIVERS_URL,
            {
                "finding_kind": TRANSACTION_UNALLOCATED,
                "object_id": str(txn.pk),
                "reason": "motif",
            },
            format="json",
        ).json()

        response = client.delete(f"{WAIVERS_URL}{created['id']}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT

        body = client.get(f"{SUMMARY_URL}{TRANSACTION_UNALLOCATED}/").json()
        assert [f["object_id"] for f in body["results"]] == [str(txn.pk)]
        assert body["waived"] == 0

    def test_lists_the_household_waivers(self, household_with_window):
        household, user, account = household_with_window
        txn = make_txn(account)
        client = _client_for(user)
        client.post(
            WAIVERS_URL,
            {
                "finding_kind": TRANSACTION_UNALLOCATED,
                "object_id": str(txn.pk),
                "reason": "motif",
            },
            format="json",
        )

        rows = _results(client.get(WAIVERS_URL))
        assert [r["finding_kind"] for r in rows] == [TRANSACTION_UNALLOCATED]

    def test_cannot_revoke_another_household_waiver(self, household_with_window):
        household, user, account = household_with_window
        txn = make_txn(account)
        outsider = _make_member(HouseholdFactory())
        created = _client_for(user).post(
            WAIVERS_URL,
            {
                "finding_kind": TRANSACTION_UNALLOCATED,
                "object_id": str(txn.pk),
                "reason": "motif",
            },
            format="json",
        ).json()

        response = _client_for(outsider).delete(f"{WAIVERS_URL}{created['id']}/")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert ComplianceWaiver.objects.filter(pk=created["id"]).exists()
