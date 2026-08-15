# banking/tests/test_api_transfer_linking.py
"""L'API du virement entre deux comptes : proposer, puis lier.

Le service est testé à part (``test_transfer_linking.py``). Ce qui se joue ici est
ce que seule la couche HTTP peut trahir : le **bornage au foyer** d'un id qui
vient du client, un id malformé qui doit répondre 400 et non 500, et le fait que
la liste des candidats et le refus du POST parlent d'une seule voix — proposer un
candidat que l'enregistrement rejette est pire que n'en proposer aucun.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.models import BankTransaction, TransactionDirection
from households.models import HouseholdMember

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount, booked_on=date(2026, 7, 12), label="VIREMENT INTERNE"):
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


def _member(household):
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def candidates_url(pk):
    return f"/api/banking/transactions/{pk}/transfer-candidates/"


def link_url(pk):
    return f"/api/banking/transactions/{pk}/link-transfer/"


@pytest.fixture
def context(db):
    household = HouseholdFactory()
    user = _member(household)
    client = APIClient()
    client.force_authenticate(user=user)
    return {
        "household": household,
        "user": user,
        "client": client,
        "current": BankAccountFactory(household=household, name="Compte courant"),
        "savings": BankAccountFactory(household=household, name="Livret A"),
    }


@pytest.mark.django_db
class TestTheCandidatesAgreeWithWhatCanBeLinked:
    def test_the_opposite_leg_on_another_account_is_offered(self, context):
        out = make_txn(context["current"], amount="-400.00")
        into = make_txn(context["savings"], amount="400.00")

        response = context["client"].get(candidates_url(out.pk))

        assert response.status_code == status.HTTP_200_OK
        assert [row["id"] for row in response.json()] == [str(into.pk)]

    def test_a_line_of_the_same_account_is_never_offered(self, context):
        out = make_txn(context["current"], amount="-400.00")
        make_txn(context["current"], amount="400.00")

        response = context["client"].get(candidates_url(out.pk))

        assert response.json() == []

    def test_an_amount_that_is_not_the_exact_opposite_is_never_offered(self, context):
        out = make_txn(context["current"], amount="-400.00")
        make_txn(context["savings"], amount="399.00")

        assert context["client"].get(candidates_url(out.pk)).json() == []

    def test_a_leg_already_taken_is_never_offered(self, context):
        out = make_txn(context["current"], amount="-400.00")
        into = make_txn(context["savings"], amount="400.00")
        context["client"].post(link_url(out.pk), {"counterpart_id": str(into.pk)}, format="json")

        other = make_txn(context["current"], amount="-400.00")

        assert context["client"].get(candidates_url(other.pk)).json() == []

    def test_the_closest_date_comes_first(self, context):
        """L'écart de dates ordonne, il ne filtre pas : un virement lent reste
        proposé, simplement plus bas."""
        out = make_txn(context["current"], amount="-400.00", booked_on=date(2026, 7, 12))
        far = make_txn(context["savings"], amount="400.00", booked_on=date(2026, 8, 30))
        near = make_txn(context["savings"], amount="400.00", booked_on=date(2026, 7, 14))

        rows = context["client"].get(candidates_url(out.pk)).json()

        assert [row["id"] for row in rows] == [str(near.pk), str(far.pk)]

    def test_another_households_line_is_never_offered(self, context):
        stranger = HouseholdFactory()
        make_txn(BankAccountFactory(household=stranger), amount="400.00")
        out = make_txn(context["current"], amount="-400.00")

        assert context["client"].get(candidates_url(out.pk)).json() == []


@pytest.mark.django_db
class TestLinking:
    def test_linking_returns_the_updated_operation(self, context):
        out = make_txn(context["current"], amount="-400.00")
        into = make_txn(context["savings"], amount="400.00")

        response = context["client"].post(
            link_url(out.pk), {"counterpart_id": str(into.pk)}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        out.refresh_from_db()
        assert out.transfer_counterpart_id == into.pk
        assert out.is_internal is True

    def test_a_line_of_another_household_is_refused(self, context):
        """Sans ce bornage, un client rattache une opération qu'il ne peut pas voir."""
        stranger = HouseholdFactory()
        theirs = make_txn(BankAccountFactory(household=stranger), amount="400.00")
        out = make_txn(context["current"], amount="-400.00")

        response = context["client"].post(
            link_url(out.pk), {"counterpart_id": str(theirs.pk)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        out.refresh_from_db()
        assert out.transfer_counterpart_id is None

    def test_a_malformed_id_is_a_400_not_a_500(self, context):
        """Une faute de frappe est une erreur client. Le champ UUID lève de
        lui-même : sans filet, la vue rendait un 500 sur une simple saisie."""
        out = make_txn(context["current"], amount="-400.00")

        response = context["client"].post(
            link_url(out.pk), {"counterpart_id": "pas-un-uuid"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_missing_id_is_a_400(self, context):
        out = make_txn(context["current"], amount="-400.00")

        response = context["client"].post(link_url(out.pk), {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_mismatched_amounts_are_refused(self, context):
        out = make_txn(context["current"], amount="-400.00")
        into = make_txn(context["savings"], amount="399.00")

        response = context["client"].post(
            link_url(out.pk), {"counterpart_id": str(into.pk)}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
