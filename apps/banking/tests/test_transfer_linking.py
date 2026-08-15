# banking/tests/test_transfer_linking.py
"""Lier les deux jambes d'un virement entre deux comptes.

Le module savait **délier** un virement qu'il ne savait pas **lier** :
``record_cash_withdrawal`` fabrique l'autre jambe, mais uniquement sur un compte
espèces, et ``unlink_counterpart`` défait un lien. Rien ne pouvait en créer un
entre deux lignes qui existent déjà — le cas ordinaire dès qu'un foyer importe
plus d'un compte.

Conséquence, trouvée en construisant les données de démonstration : un virement
vers un livret restait ``internal_without_counterpart`` pour toujours. Une erreur
au Contrôle, tous les mois, que seul un arbitrage pouvait taire — et qui
revenait périmée au virement suivant. Le détecteur avait raison ; il n'y avait
simplement aucun moyen de lui obéir.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from banking.compliance import get_detector, open_findings, summary
from banking.dedup import compute_dedup_hash
from banking.detectors import INTERNAL_WITHOUT_COUNTERPART
from banking.models import (
    BankTransaction,
    ImportStatus,
    StatementImport,
    TransactionDirection,
)
from banking.services import link_counterpart, unlink_counterpart

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount, booked_on=date(2026, 3, 10), label="VIREMENT INTERNE", **extra):
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


def _account(household, name):
    account = BankAccountFactory(
        household=household, name=name, opening_balance_date=date(2026, 1, 1)
    )
    StatementImport.objects.create(
        household=household,
        account=account,
        provider="generic_csv",
        status=ImportStatus.COMPLETED,
        period_start=date(2026, 1, 1),
        period_end=date(2026, 3, 31),
    )
    return account


@pytest.fixture
def ctx(db):
    household = HouseholdFactory()
    return {
        "household": household,
        "user": UserFactory(),
        "current": _account(household, "Compte courant"),
        "savings": _account(household, "Livret A"),
    }


def group(household, kind):
    return next(g for g in summary(household) if g.spec.kind == kind)


@pytest.mark.django_db
class TestASavingsTransferCanBeResolved:
    """Le cas qui n'avait pas d'issue : deux lignes importées, un seul mouvement."""

    def test_the_transfer_is_an_ecart_until_it_is_linked(self, ctx):
        out = make_txn(ctx["current"], amount="-400.00", is_internal=True)

        findings = open_findings(ctx["household"], get_detector(INTERNAL_WITHOUT_COUNTERPART))
        assert [f.object_id for f in findings] == [str(out.pk)]

    def test_linking_the_two_legs_silences_the_detector(self, ctx):
        out = make_txn(ctx["current"], amount="-400.00", is_internal=True)
        into = make_txn(ctx["savings"], amount="400.00", is_internal=True)
        assert group(ctx["household"], INTERNAL_WITHOUT_COUNTERPART).detected == 2

        link_counterpart(user=ctx["user"], transaction=out, counterpart=into)

        assert group(ctx["household"], INTERNAL_WITHOUT_COUNTERPART).detected == 0

    def test_both_legs_point_at_each_other(self, ctx):
        """Soit l'une soit l'autre doit permettre de retrouver sa jumelle."""
        out = make_txn(ctx["current"], amount="-400.00")
        into = make_txn(ctx["savings"], amount="400.00")

        link_counterpart(user=ctx["user"], transaction=out, counterpart=into)

        out.refresh_from_db()
        into.refresh_from_db()
        assert out.transfer_counterpart_id == into.pk
        assert into.transfer_counterpart_id == out.pk

    def test_linking_declares_both_legs_internal(self, ctx):
        """De l'argent qui change de poche n'est pas une dépense.

        Sans ce marquage, les 400 € virés au livret seraient comptés comme dépensés
        — et de nouveau au moment où cette épargne servirait vraiment.
        """
        out = make_txn(ctx["current"], amount="-400.00")
        into = make_txn(ctx["savings"], amount="400.00")

        link_counterpart(user=ctx["user"], transaction=out, counterpart=into)

        out.refresh_from_db()
        into.refresh_from_db()
        assert out.is_internal is True
        assert into.is_internal is True

    def test_a_gap_between_the_two_dates_is_accepted(self, ctx):
        """Un virement est débité et crédité des jours différents.

        House ne peut pas savoir quel délai est légitime pour quelle banque : c'est
        une attestation de l'utilisateur, pas une arithmétique vérifiable. Refuser
        rendrait le geste impossible dans le cas le plus courant.
        """
        out = make_txn(ctx["current"], amount="-400.00", booked_on=date(2026, 3, 10))
        into = make_txn(ctx["savings"], amount="400.00", booked_on=date(2026, 3, 14))

        link_counterpart(user=ctx["user"], transaction=out, counterpart=into)

        out.refresh_from_db()
        assert out.transfer_counterpart_id == into.pk


@pytest.mark.django_db
class TestWhatHouseCanRefuteItRefuses:
    """Seulement ce qui ne *peut pas* être un seul mouvement."""

    def test_two_lines_of_the_same_account(self, ctx):
        out = make_txn(ctx["current"], amount="-400.00")
        into = make_txn(ctx["current"], amount="400.00")

        with pytest.raises(ValidationError):
            link_counterpart(user=ctx["user"], transaction=out, counterpart=into)

    def test_amounts_that_are_not_exact_opposites(self, ctx):
        out = make_txn(ctx["current"], amount="-400.00")
        into = make_txn(ctx["savings"], amount="399.00")

        with pytest.raises(ValidationError):
            link_counterpart(user=ctx["user"], transaction=out, counterpart=into)

    def test_an_operation_cannot_be_its_own_counterpart(self, ctx):
        out = make_txn(ctx["current"], amount="-400.00")

        with pytest.raises(ValidationError):
            link_counterpart(user=ctx["user"], transaction=out, counterpart=out)

    def test_a_leg_that_is_already_taken(self, ctx):
        """Voler une jambe laisserait son ancienne partenaire orpheline — soit
        exactement l'état que ce module existe pour supprimer."""
        out = make_txn(ctx["current"], amount="-400.00")
        into = make_txn(ctx["savings"], amount="400.00")
        link_counterpart(user=ctx["user"], transaction=out, counterpart=into)

        other = make_txn(ctx["current"], amount="-400.00")
        into.refresh_from_db()
        with pytest.raises(ValidationError):
            link_counterpart(user=ctx["user"], transaction=other, counterpart=into)

    def test_an_operation_from_another_household(self, ctx):
        """Sans cette garde, un client rattacherait une opération qu'il ne voit pas."""
        stranger = HouseholdFactory()
        theirs = make_txn(_account(stranger, "Compte d'un autre"), amount="400.00")
        out = make_txn(ctx["current"], amount="-400.00")

        with pytest.raises(ValidationError):
            link_counterpart(user=ctx["user"], transaction=out, counterpart=theirs)


@pytest.mark.django_db
class TestUnlinkingKeepsBothImportedLines:
    """``unlink_counterpart`` ne supprime que la jambe qu'il a fabriquée.

    Entre deux comptes bancaires, aucune des deux ne l'a été : délier doit donc
    rendre les deux lignes à leur état d'avant, et n'en détruire aucune. Détruire
    une ligne importée reviendrait à effacer un relevé.
    """

    def test_neither_leg_is_deleted(self, ctx):
        out = make_txn(ctx["current"], amount="-400.00")
        into = make_txn(ctx["savings"], amount="400.00")
        link_counterpart(user=ctx["user"], transaction=out, counterpart=into)

        unlink_counterpart(user=ctx["user"], transaction=out)

        assert BankTransaction.objects.filter(pk=out.pk).exists()
        assert BankTransaction.objects.filter(pk=into.pk).exists()

    def test_both_legs_are_released(self, ctx):
        out = make_txn(ctx["current"], amount="-400.00")
        into = make_txn(ctx["savings"], amount="400.00")
        link_counterpart(user=ctx["user"], transaction=out, counterpart=into)

        unlink_counterpart(user=ctx["user"], transaction=out)

        out.refresh_from_db()
        into.refresh_from_db()
        assert out.transfer_counterpart_id is None
        assert into.transfer_counterpart_id is None
        assert out.is_internal is False
        assert into.is_internal is False
