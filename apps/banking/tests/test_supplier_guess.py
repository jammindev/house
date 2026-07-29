# banking/tests/test_supplier_guess.py
"""Le fournisseur d'une ligne de relevé — dérivé, puis écrit par la ventilation.

Deux moitiés d'un même défaut. Ventiler une ligne obligeait à retaper le marchand
à la main, alors que la ligne le porte déjà dans `label_raw` ; et la dépense créée
sortait avec `supplier=""`, donc la colonne requêtée (chips de filtre,
`by_supplier`, le rapprochement par sous-chaîne) restait vide pour la source de
dépenses la plus volumineuse de l'app.

`guess_supplier` reste une **valeur de départ**, jamais une vérité — même contrat
que `guess_internal` et `guess_inflow_nature` juste au-dessus dans `rules.py`. Elle
ne décide rien : elle remplit un champ que l'utilisateur voit et corrige avant
d'enregistrer.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.models import BankTransaction, TransactionDirection
from banking.rules import guess_supplier
from banking.services import set_allocations
from households.models import HouseholdMember

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, label, amount="-150.00", booked_on=date(2026, 7, 12)):
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


class TestTheLabelAlreadyNamesTheMerchant:
    """Ce que House peut calculer, House ne le demande pas."""

    @pytest.mark.parametrize(
        "label,expected",
        [
            ("CB LEROY MERLIN 12/07", "Leroy Merlin"),
            ("PAIEMENT CB CARREFOUR MARKET", "Carrefour Market"),
            ("ACHAT CB DECATHLON 123456", "Decathlon"),
            ("PRLV SEPA ORANGE FRANCE", "Orange France"),
            ("VIR SEPA GARAGE DUPONT", "Garage Dupont"),
            ("FACTURE CARTE BANCAIRE AMAZON EU", "Amazon EU"),
        ],
    )
    def test_it_strips_the_payment_plumbing(self, label, expected):
        assert guess_supplier(label) == expected

    def test_it_keeps_short_acronyms_as_they_are_written(self):
        # « Edf » n'existe pas. Un nom de trois ou quatre lettres est presque
        # toujours un sigle, et le retitrer donne un mot que personne n'écrit.
        assert guess_supplier("PRLV EDF") == "EDF"
        assert guess_supplier("CB SNCF CONNECT") == "SNCF Connect"

    @pytest.mark.parametrize(
        "label",
        [
            "",
            "CB 12/07 123456",  # que de la plomberie et des références
            "RETRAIT DAB 12/07",  # un retrait n'a pas de marchand
            "VIREMENT INTERNE",  # de l'argent qui change de poche
            "X",
        ],
    )
    def test_it_says_nothing_rather_than_inventing(self, label):
        # Le pendant de `guess_inflow_nature` qui renvoie "" : vide veut dire
        # « personne n'a regardé », et c'est à l'utilisateur de trancher. Un
        # « Retrait Dab » proposé comme fournisseur serait une saisie fausse
        # présentée comme un service.
        assert guess_supplier(label) == ""


@pytest.fixture
def context(db):
    household = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    account = BankAccountFactory(household=household)
    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults["HTTP_X_HOUSEHOLD_ID"] = str(household.id)
    return {"household": household, "user": user, "account": account, "client": client}


class TestTheSplitWritesTheSupplier:
    """Une dépense née d'un relevé remplit la colonne comme les autres.

    Sans ça la ventilation — première source de dépenses de l'app — produisait des
    entrées invisibles au filtre fournisseur et au `by_supplier`, et le
    rapprochement automatique perdait son meilleur indice : `matching` compare le
    `supplier` en sous-chaîne du libellé bancaire.
    """

    def test_each_line_carries_its_own_supplier(self, context):
        txn = make_txn(context["account"], label="CB LEROY MERLIN 12/07")

        created = set_allocations(
            household=context["household"],
            user=context["user"],
            transaction=txn,
            lines=[
                {"amount": "90.00", "subject": "Peinture", "supplier": "Leroy Merlin"},
                {"amount": "60.00", "subject": "Visserie", "supplier": "Leroy Merlin"},
            ],
        )

        assert [i.supplier for i in created] == ["Leroy Merlin", "Leroy Merlin"]

    def test_an_omitted_supplier_stays_empty_rather_than_being_guessed(self, context):
        # Le serveur ne devine pas à la place du client : la dérivation est
        # proposée dans le dialog, où elle est visible et corrigeable. Deviner
        # ici l'écrirait sans que personne l'ait lue.
        txn = make_txn(context["account"], label="CB LEROY MERLIN 12/07")

        created = set_allocations(
            household=context["household"],
            user=context["user"],
            transaction=txn,
            lines=[{"amount": "150.00", "subject": "Peinture"}],
        )

        assert created[0].supplier == ""

    def test_the_api_round_trips_it(self, context):
        txn = make_txn(context["account"], label="CB DECATHLON")

        response = context["client"].put(
            f"/api/banking/transactions/{txn.id}/allocations/",
            {"lines": [{"amount": "150.00", "subject": "Chaussures", "supplier": "Decathlon"}]},
            format="json",
        )

        assert response.status_code == 200
        assert [a["supplier"] for a in response.data["allocations"]] == ["Decathlon"]

    def test_the_line_offers_its_guess_to_the_client(self, context):
        # Servi par le serializer, pas recalculé côté client : les motifs de
        # libellés bancaires vivent dans `banking.rules`, et une deuxième
        # implémentation en TypeScript dériverait de celle-ci sans qu'on le voie.
        txn = make_txn(context["account"], label="CB LEROY MERLIN 12/07")

        response = context["client"].get(f"/api/banking/transactions/{txn.id}/allocations/")

        assert response.status_code == 200
        assert response.data["transaction"]["supplier_guess"] == "Leroy Merlin"
