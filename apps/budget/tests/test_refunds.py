# budget/tests/test_refunds.py
"""Un remboursement recrédite l'enveloppe qu'il concerne.

Le cas réel : un article de 40 € rendu à Leroy Merlin, une cotisation bancaire
remboursée. Sans ce mécanisme, « 150 € / 400 € » reste faux pour toujours sur un
achat dont une partie est revenue — et le remboursement, lui, n'apparaît nulle
part dans la liste du budget.

**Un remboursement reste une ligne bancaire**, jamais une dépense négative :
c'est ce qui protège les neuf `Sum("amount")` du journal et `top_expenses`. Ce
qu'il gagne ici, c'est un budget et l'arithmétique qui va avec.
"""
from __future__ import annotations

import itertools
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.db.utils import IntegrityError
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.models import (
    BankAccount,
    BankTransaction,
    InflowNature,
    TransactionDirection,
)
from budget.models import Budget
from households.models import HouseholdMember
from interactions.services import create_manual_expense_interaction

from .factories import HouseholdFactory, HouseholdMemberFactory, UserFactory

OVERVIEW_URL = "/api/budget/budgets/overview/"
_counter = itertools.count()


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def ctx(db):
    household = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    budget = Budget.objects.create(
        household=household, name="Bricolage", monthly_amount=Decimal("400.00")
    )
    account = BankAccount.objects.create(
        household=household, name="Courant", kind=BankAccount.Kind.BANK
    )
    return household, user, budget, account, _client_for(user)


def spend(household, user, budget, amount):
    return create_manual_expense_interaction(
        household=household,
        user=user,
        subject=f"Achat {amount}",
        amount=Decimal(str(amount)),
        occurred_at=timezone.now(),
        budget_id=budget.id if budget else None,
    )


def refund(account, *, amount, budget=None, booked_on=None, nature=InflowNature.REFUND,
           label="AVOIR LEROY MERLIN"):
    value = Decimal(str(amount))
    booked_on = booked_on or timezone.localdate()
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=booked_on,
        label_raw=label,
        label_norm=label,
        amount=value,
        direction=TransactionDirection.IN if value > 0 else TransactionDirection.OUT,
        inflow_nature=nature,
        refund_budget=budget,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=booked_on,
            label_norm=label,
            amount=value,
            currency="EUR",
            discriminant=f"#{next(_counter)}",
        ),
    )


def row_for(client, budget):
    body = client.get(OVERVIEW_URL).json()
    return next(r for r in body["budgets"] if r["id"] == str(budget.id))


@pytest.mark.django_db
class TestTheEnvelopeGetsTheMoneyBack:
    def test_the_ceiling_measures_the_net(self, ctx):
        """150 € dépensés, 40 € rendus : l'enveloppe a consommé 110 €."""
        household, user, budget, account, client = ctx
        spend(household, user, budget, "150.00")
        refund(account, amount="40.00", budget=budget)

        row = row_for(client, budget)

        assert row["net_spent"] == "110.00"
        assert row["refunded"] == "40.00"
        assert row["ratio"] == pytest.approx(110 / 400, abs=1e-4)

    def test_spent_stays_gross(self, ctx):
        """Sept agrégations lisent ``spent`` : le net est un chiffre de plus.

        Le décomposer en attesté / en attente n'aurait plus de sens si ``spent``
        changeait de définition en cours de route.
        """
        household, user, budget, account, client = ctx
        spend(household, user, budget, "150.00")
        refund(account, amount="40.00", budget=budget)

        row = row_for(client, budget)

        assert row["spent"] == "150.00"
        assert Decimal(row["spent_attested"]) + Decimal(row["spent_pending"]) == Decimal("150.00")
        assert Decimal(row["spent"]) - Decimal(row["refunded"]) == Decimal(row["net_spent"])

    def test_a_refund_can_pull_a_budget_back_under_its_ceiling(self, ctx):
        household, user, budget, account, client = ctx
        spend(household, user, budget, "420.00")
        assert row_for(client, budget)["state"] == "over"

        # 420 − 120 = 300, soit 75 % : sous le seuil d'alerte (80 %).
        refund(account, amount="120.00", budget=budget)

        assert row_for(client, budget)["state"] == "ok"

    def test_a_refund_credited_to_nobody_changes_nothing(self, ctx):
        """Une recette sans budget ne retire rien à personne — elle est un écart."""
        household, user, budget, account, client = ctx
        spend(household, user, budget, "150.00")
        refund(account, amount="40.00", budget=None)

        row = row_for(client, budget)

        assert row["refunded"] == "0.00"
        assert row["net_spent"] == "150.00"

    def test_only_refunds_count(self, ctx):
        """Un salaire ne recrédite aucune enveloppe, même sur le même compte."""
        household, user, budget, account, client = ctx
        spend(household, user, budget, "150.00")
        refund(account, amount="2100.00", budget=None,
               nature=InflowNature.SALARY, label="VIR SALAIRE")

        assert row_for(client, budget)["net_spent"] == "150.00"

    def test_the_totals_carry_it_too(self, ctx):
        household, user, budget, account, client = ctx
        spend(household, user, budget, "150.00")
        refund(account, amount="40.00", budget=budget)

        body = client.get(OVERVIEW_URL).json()

        assert body["total_spent"] == "150.00"
        assert body["total_refunded"] == "40.00"
        assert body["total_net_spent"] == "110.00"


@pytest.mark.django_db
class TestWhichMonthARefundBelongsTo:
    """Le mois du remboursement, jamais celui de l'achat.

    Imputer rétroactivement réécrirait un bilan mensuel déjà figé, que le rendu
    et le digest relisent. Le prix à payer est un mois net négatif quand le
    remboursement arrive après — et c'est un fait, pas un bug.
    """

    def test_a_refund_from_last_month_does_not_touch_this_month(self, ctx):
        household, user, budget, account, client = ctx
        spend(household, user, budget, "150.00")
        first_of_month = timezone.localdate().replace(day=1)
        refund(
            account,
            amount="40.00",
            budget=budget,
            booked_on=first_of_month - timedelta(days=1),
        )

        row = row_for(client, budget)

        assert row["refunded"] == "0.00"
        assert row["net_spent"] == "150.00"

    def test_a_month_can_end_up_net_negative(self, ctx):
        """Se faire rembourser sans rien dépenser est un fait affichable."""
        household, user, budget, account, client = ctx
        refund(account, amount="40.00", budget=budget)

        row = row_for(client, budget)

        assert row["spent"] == "0.00"
        assert row["net_spent"] == "-40.00"
        # Un net négatif ne « dépasse » rien : l'état reste sain.
        assert row["state"] == "ok"


@pytest.mark.django_db
class TestWhatTheApiRefuses:
    """Un budget posé au mauvais endroit crédite une enveloppe depuis un salaire."""

    def _qualify(self, client, txn, payload):
        return client.patch(
            f"/api/banking/transactions/{txn.id}/qualify/", payload, format="json"
        )

    def test_a_budget_on_a_salary_is_refused(self, ctx):
        household, user, budget, account, client = ctx
        txn = refund(account, amount="2100.00", nature=InflowNature.SALARY, label="VIR SALAIRE")

        response = self._qualify(client, txn, {"refund_budget_id": str(budget.id)})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_budget_on_an_outflow_is_refused(self, ctx):
        household, user, budget, account, client = ctx
        txn = refund(account, amount="-80.00", nature="", label="CB LECLERC")

        response = self._qualify(client, txn, {"refund_budget_id": str(budget.id)})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_budget_from_another_household_is_refused(self, ctx):
        household, user, budget, account, client = ctx
        other = Budget.objects.create(
            household=HouseholdFactory(), name="Ailleurs", monthly_amount=Decimal("100.00")
        )
        txn = refund(account, amount="40.00")

        response = self._qualify(client, txn, {"refund_budget_id": str(other.id)})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_the_global_budget_is_refused(self, ctx):
        """Il plafonne l'ensemble : le créditer compterait deux fois."""
        household, user, budget, account, client = ctx
        overall = Budget.objects.create(
            household=household, name="Global", monthly_amount=Decimal("2000.00"), is_global=True
        )
        txn = refund(account, amount="40.00")

        response = self._qualify(client, txn, {"refund_budget_id": str(overall.id)})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_setting_a_budget_works_on_a_refund(self, ctx):
        household, user, budget, account, client = ctx
        txn = refund(account, amount="40.00")

        response = self._qualify(client, txn, {"refund_budget_id": str(budget.id)})

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["refund_budget_name"] == "Bricolage"
        txn.refresh_from_db()
        assert txn.refund_budget_id == budget.id

    def test_reclassing_a_refund_as_a_salary_drops_the_budget(self, ctx):
        """Sinon l'enveloppe reste créditée par une ligne qui ne rembourse plus rien."""
        household, user, budget, account, client = ctx
        txn = refund(account, amount="40.00", budget=budget)

        response = self._qualify(client, txn, {"inflow_nature": "salary"})

        assert response.status_code == status.HTTP_200_OK
        txn.refresh_from_db()
        assert txn.refund_budget_id is None

    def test_clearing_the_budget_is_allowed(self, ctx):
        household, user, budget, account, client = ctx
        txn = refund(account, amount="40.00", budget=budget)

        response = self._qualify(client, txn, {"refund_budget_id": None})

        assert response.status_code == status.HTTP_200_OK
        txn.refresh_from_db()
        assert txn.refund_budget_id is None


@pytest.mark.django_db
class TestTheDatabaseHoldsTheInvariant:
    def test_a_budget_without_the_refund_nature_is_rejected(self, ctx):
        """La vue refuse déjà ; la base doit refuser aussi.

        C'est le genre d'invariant qui ne survit à un futur chemin d'écriture que
        si la base le tient.
        """
        household, user, budget, account, _ = ctx

        with pytest.raises(IntegrityError):
            refund(account, amount="2100.00", budget=budget, nature=InflowNature.SALARY)


@pytest.mark.django_db
class TestTheDetectorSeesTheSilence:
    """Ajouter un mécanisme à l'argent, c'est ajouter son détecteur."""

    def _open_count(self, household):
        from banking.compliance import summary
        from banking.detectors import REFUND_WITHOUT_BUDGET

        return {g.spec.kind: g.open for g in summary(household)}.get(REFUND_WITHOUT_BUDGET)

    def _window(self, account):
        from banking.models import ImportStatus, StatementImport

        account.opening_balance = Decimal("1000.00")
        account.opening_balance_date = date(2026, 1, 1)
        account.save(update_fields=["opening_balance", "opening_balance_date"])
        StatementImport.objects.create(
            household=account.household,
            account=account,
            provider="generic_csv",
            status=ImportStatus.COMPLETED,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 12, 31),
        )

    def test_a_refund_crediting_nobody_is_reported(self, ctx):
        household, user, budget, account, client = ctx
        self._window(account)
        refund(account, amount="40.00", budget=None, booked_on=date(2026, 3, 10))

        assert self._open_count(household) == 1

    def test_naming_the_budget_resolves_it(self, ctx):
        household, user, budget, account, client = ctx
        self._window(account)
        txn = refund(account, amount="40.00", budget=None, booked_on=date(2026, 3, 10))

        txn.refund_budget = budget
        txn.save(update_fields=["refund_budget"])

        assert self._open_count(household) == 0

    def test_a_salary_is_not_its_business(self, ctx):
        household, user, budget, account, client = ctx
        self._window(account)
        refund(
            account,
            amount="2100.00",
            nature=InflowNature.SALARY,
            label="VIR SALAIRE",
            booked_on=date(2026, 3, 10),
        )

        assert self._open_count(household) == 0


@pytest.mark.django_db
class TestTheMonthlyReportAgreesWithThePanel:
    """Le bilan recalcule son propre « dépensé » — il doit dire la même chose.

    Sans les remboursements il annoncerait « dépassé » sur un budget que
    l'aperçu affiche « ok », le même mois. C'est la règle « un compteur ne peut
    pas avoir deux définitions », appliquée au rendu figé.
    """

    def test_the_report_nets_out_a_refund(self, ctx):
        from budget.report.stats import compute_month_stats

        household, user, budget, account, client = ctx
        spend(household, user, budget, "420.00")
        refund(account, amount="120.00", budget=budget)

        month = timezone.localdate().strftime("%Y-%m")
        stats = compute_month_stats(household=household, month=month)
        row = next(r for r in stats["budgets"] if r["name"] == "Bricolage")

        assert row["spent"] == "420.00"
        assert row["refunded"] == "120.00"
        assert row["net_spent"] == "300.00"
        assert row["state"] == "ok"
        assert stats["total_net_spent"] == "300.00"

    def test_it_reads_the_same_state_as_the_overview(self, ctx):
        from budget.report.stats import compute_month_stats

        household, user, budget, account, client = ctx
        spend(household, user, budget, "420.00")
        refund(account, amount="120.00", budget=budget)

        month = timezone.localdate().strftime("%Y-%m")
        report_row = next(
            r for r in compute_month_stats(household=household, month=month)["budgets"]
            if r["name"] == "Bricolage"
        )
        panel_row = row_for(client, budget)

        assert report_row["state"] == panel_row["state"]
        assert report_row["net_spent"] == panel_row["net_spent"]
