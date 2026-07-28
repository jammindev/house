# banking/tests/test_refund_allocations.py
"""Ventiler une recette — 70 € qui couvrent 40 € de resto et 30 € de courses.

Le cas est venu de la recette : une amie rembourse sa part d'une soirée et d'un
plein de courses en un seul virement. Une FK sur la ligne ne pouvait nommer
qu'**une** enveloppe, donc « 150 € / 400 € » restait faux sur tout remboursement
qui traversait deux catégories.

La ventilation d'une recette est le miroir de celle d'une sortie, et ces tests
tiennent les propriétés qui font que c'est bien un miroir : remplacement complet,
somme bornée par ce que la recette a rapporté, un reste possible — et ce reste est
un **écart arbitrable**, pas un silence.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from banking.dedup import compute_dedup_hash
from banking.models import (
    BankAccount,
    ImportStatus,
    InflowNature,
    RefundAllocation,
    StatementImport,
    TransactionDirection,
)
from banking.models import BankTransaction
from budget.models import Budget
from households.models import Household, HouseholdMember

_counter = itertools.count()


def make_context():
    household = Household.objects.create(name=f"Refund split {next(_counter)}")
    user = User.objects.create_user(email=f"r-{next(_counter)}@example.com", password="pass1234")
    HouseholdMember.objects.create(
        household=household, user=user, role=HouseholdMember.Role.MEMBER
    )
    user.active_household = household
    user.save(update_fields=["active_household"])
    account = BankAccount.objects.create(
        household=household,
        name="Compte courant",
        opening_balance=Decimal("1000.00"),
        opening_balance_date=date(2026, 1, 1),
    )
    StatementImport.objects.create(
        household=household,
        account=account,
        provider="generic_csv",
        status=ImportStatus.COMPLETED,
        period_start=date(2026, 1, 1),
        period_end=date(2026, 12, 31),
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return household, user, account, client


def make_refund(account, amount="70.00", *, nature=InflowNature.REFUND, label="VIR MARIE"):
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=date(2026, 3, 10),
        label_raw=label,
        label_norm=label,
        amount=value,
        direction=TransactionDirection.IN if value > 0 else TransactionDirection.OUT,
        inflow_nature=nature,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=date(2026, 3, 10),
            label_norm=label,
            amount=value,
            currency="EUR",
            discriminant=f"#{next(_counter)}",
        ),
    )


@pytest.fixture
def ctx(db):
    household, user, account, client = make_context()
    return {
        "household": household,
        "user": user,
        "account": account,
        "client": client,
        "food": Budget.objects.create(
            household=household, name="Restaurants", monthly_amount=Decimal("200.00")
        ),
        "groceries": Budget.objects.create(
            household=household, name="Courses", monthly_amount=Decimal("400.00")
        ),
    }


def put(client, txn, lines):
    return client.put(
        f"/api/banking/transactions/{txn.id}/refund-allocations/",
        {"lines": lines},
        format="json",
    )


class TestOneReceiptCreditsSeveralEnvelopes:
    def test_seventy_euros_split_in_forty_and_thirty(self, ctx):
        txn = make_refund(ctx["account"])

        response = put(
            ctx["client"],
            txn,
            [
                {"budget_id": str(ctx["food"].id), "amount": "40.00"},
                {"budget_id": str(ctx["groceries"].id), "amount": "30.00"},
            ],
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["refund_remaining"] == "0.00"
        credited = {
            row["budget_name"]: row["amount"] for row in response.json()["refund_allocations"]
        }
        assert credited == {"Restaurants": "40.00", "Courses": "30.00"}

    def test_each_envelope_gets_its_own_share_back(self, ctx):
        """Le vrai test : l'aperçu doit retirer 40 € au resto, pas 70 €."""
        from budget.aggregations import _refunded_by_budget
        from core.timezones import current_month_range

        txn = make_refund(ctx["account"])
        put(
            ctx["client"],
            txn,
            [
                {"budget_id": str(ctx["food"].id), "amount": "40.00"},
                {"budget_id": str(ctx["groceries"].id), "amount": "30.00"},
            ],
        )
        # La ligne est datée du 10 mars : on interroge ce mois-là.
        start, end, _ = current_month_range(ctx["household"])
        txn.booked_on = start.date()
        txn.save(update_fields=["booked_on"])

        rows = _refunded_by_budget(ctx["household"].id, start, end)

        assert rows[ctx["food"].id] == Decimal("40.00")
        assert rows[ctx["groceries"].id] == Decimal("30.00")

    def test_saving_replaces_the_whole_split(self, ctx):
        """« 40/30 devient 50/20 » en un geste, jamais en deux états."""
        txn = make_refund(ctx["account"])
        put(
            ctx["client"],
            txn,
            [
                {"budget_id": str(ctx["food"].id), "amount": "40.00"},
                {"budget_id": str(ctx["groceries"].id), "amount": "30.00"},
            ],
        )

        put(ctx["client"], txn, [{"budget_id": str(ctx["food"].id), "amount": "50.00"}])

        assert list(txn.refund_allocations.values_list("amount", flat=True)) == [
            Decimal("50.00")
        ]


class TestTheSumCannotExceedWhatCameBack:
    def test_crediting_more_than_the_receipt_is_a_400(self, ctx):
        # Sans cette borne, une enveloppe se verrait recréditer 200 € par un
        # virement de 70 € — un plafond faux, et faux dans le sens rassurant.
        txn = make_refund(ctx["account"])

        response = put(
            ctx["client"],
            txn,
            [
                {"budget_id": str(ctx["food"].id), "amount": "50.00"},
                {"budget_id": str(ctx["groceries"].id), "amount": "40.00"},
            ],
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert txn.refund_allocations.count() == 0

    def test_a_negative_or_zero_share_is_a_400(self, ctx):
        txn = make_refund(ctx["account"])

        response = put(ctx["client"], txn, [{"budget_id": str(ctx["food"].id), "amount": "0"}])

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_missing_budget_is_a_400_naming_the_line(self, ctx):
        txn = make_refund(ctx["account"])

        response = put(ctx["client"], txn, [{"amount": "10.00"}])

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "line 1" in str(response.data["lines"])

    def test_a_group_is_refused(self, ctx):
        """Un groupe est un sous-total : le créditer compterait deux fois."""
        group = Budget.objects.create(household=ctx["household"], name="Maison")
        ctx["food"].parent = group
        ctx["food"].save(update_fields=["parent"])
        txn = make_refund(ctx["account"])

        response = put(ctx["client"], txn, [{"budget_id": str(group.id), "amount": "10.00"}])

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestTheNatureComesFirst:
    def test_a_salary_cannot_credit_an_envelope(self, ctx):
        txn = make_refund(ctx["account"], nature=InflowNature.SALARY, label="VIR SALAIRE")

        response = put(ctx["client"], txn, [{"budget_id": str(ctx["food"].id), "amount": "10.00"}])

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_an_outflow_cannot_credit_an_envelope(self, ctx):
        txn = make_refund(ctx["account"], amount="-70.00", nature="", label="CB LECLERC")

        response = put(ctx["client"], txn, [{"budget_id": str(ctx["food"].id), "amount": "10.00"}])

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestTheRemainderIsAnEcart:
    """Un reste non attribué ne passe pas en silence — c'est le choix retenu.

    Miroir de « sortie partiellement ventilée ». Souvent c'est normal (une amie
    qui arrondit), et c'est précisément ce qu'un **arbitrage** exprime : motif,
    daté, révocable. Ce qui n'est pas acceptable, c'est qu'un remboursement de
    200 € dont 5 € sont attribués passe pour traité.
    """

    def _open(self, household, kind):
        from banking.compliance import summary

        return {g.spec.kind: g.open for g in summary(household)}.get(kind)

    def test_a_partial_split_is_reported(self, ctx):
        from banking.detectors import REFUND_PARTIALLY_ALLOCATED

        txn = make_refund(ctx["account"])
        put(ctx["client"], txn, [{"budget_id": str(ctx["food"].id), "amount": "40.00"}])

        assert self._open(ctx["household"], REFUND_PARTIALLY_ALLOCATED) == 1

    def test_a_full_split_is_clean(self, ctx):
        from banking.detectors import REFUND_PARTIALLY_ALLOCATED, REFUND_WITHOUT_BUDGET

        txn = make_refund(ctx["account"])
        put(
            ctx["client"],
            txn,
            [
                {"budget_id": str(ctx["food"].id), "amount": "40.00"},
                {"budget_id": str(ctx["groceries"].id), "amount": "30.00"},
            ],
        )

        assert self._open(ctx["household"], REFUND_PARTIALLY_ALLOCATED) == 0
        assert self._open(ctx["household"], REFUND_WITHOUT_BUDGET) == 0

    def test_crediting_nobody_is_the_other_ecart(self, ctx):
        """Deux détecteurs distincts, parce que les gestes diffèrent."""
        from banking.detectors import REFUND_PARTIALLY_ALLOCATED, REFUND_WITHOUT_BUDGET

        make_refund(ctx["account"])

        assert self._open(ctx["household"], REFUND_WITHOUT_BUDGET) == 1
        assert self._open(ctx["household"], REFUND_PARTIALLY_ALLOCATED) == 0

    def test_the_arbitration_expires_when_the_remainder_moves(self, ctx):
        """Le fingerprint porte le **reste**, donc attribuer plus le périme.

        C'est la garde anti-péremption du parcours 26 appliquée ici : arbitrer
        « les 30 € qui traînent ne rendent rien », puis en attribuer 20, doit faire
        resurgir l'arbitrage — sinon le motif couvre un écart dont il ne parle plus.
        """
        from banking.detectors import REFUND_PARTIALLY_ALLOCATED
        from banking.services import waive_finding

        txn = make_refund(ctx["account"])
        put(ctx["client"], txn, [{"budget_id": str(ctx["food"].id), "amount": "40.00"}])
        waive_finding(
            household=ctx["household"],
            user=ctx["user"],
            finding_kind=REFUND_PARTIALLY_ALLOCATED,
            object_id=str(txn.id),
            reason="Marie a arrondi",
        )
        assert self._open(ctx["household"], REFUND_PARTIALLY_ALLOCATED) == 0

        put(
            ctx["client"],
            txn,
            [
                {"budget_id": str(ctx["food"].id), "amount": "40.00"},
                {"budget_id": str(ctx["groceries"].id), "amount": "20.00"},
            ],
        )

        from banking.compliance import summary

        groups = {g.spec.kind: g for g in summary(ctx["household"])}
        assert groups[REFUND_PARTIALLY_ALLOCATED].stale == 1


class TestDeletingNeverStrandsACredit:
    def test_deleting_the_budget_removes_its_credits(self, ctx):
        txn = make_refund(ctx["account"])
        put(ctx["client"], txn, [{"budget_id": str(ctx["food"].id), "amount": "40.00"}])

        ctx["food"].delete()

        assert RefundAllocation.objects.filter(transaction=txn).count() == 0
        # La ligne bancaire, elle, survit à tout : c'est le fait.
        assert BankTransaction.objects.filter(pk=txn.pk).exists()
