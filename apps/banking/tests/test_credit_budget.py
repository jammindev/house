# banking/tests/test_credit_budget.py
"""Créditer **une** enveloppe depuis un remboursement, sans toucher aux autres.

Pourquoi un second chemin d'écriture existe à côté de ``set_refund_allocations``,
et pourquoi il ne pouvait pas réutiliser celui-là :

``set_refund_allocations`` est un **remplacement complet** — il efface toute la
répartition puis la réécrit. C'est correct pour l'éditeur, qui possède la
répartition entière et l'envoie en bloc. Ça ne l'est pas du tout pour un geste
parti d'**une** dépense, qui ne connaît que son enveloppe : appelé avec sa seule
ligne, il effacerait tout ce que les autres dépenses ont déjà crédité.

C'est exactement le bug « chantier facturé deux fois » de l'éditeur de
ventilation (CLAUDE.md), transposé aux remboursements :
:class:`TestCreditingOneBudgetLeavesTheOthersAlone` est là pour qu'il ne
renaisse pas.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from banking.dedup import compute_dedup_hash
from banking.models import (
    BankTransaction,
    InflowNature,
    RefundAllocation,
    TransactionDirection,
)
from banking.services import credit_budget_from_refund, set_refund_allocations
from budget.models import Budget

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_inflow(account, *, amount, nature=InflowNature.REFUND, label="REMBOURSEMENT"):
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=date(2026, 7, 28),
        label_raw=label,
        label_norm=label,
        amount=value,
        direction=TransactionDirection.IN,
        inflow_nature=nature,
        dedup_hash=compute_dedup_hash(
            account_id=account.id,
            booked_on=date(2026, 7, 28),
            label_norm=label,
            amount=value,
            currency="EUR",
            discriminant=f"#{next(_counter)}",
        ),
    )


@pytest.fixture
def context(db):
    household = HouseholdFactory()
    user = UserFactory()
    account = BankAccountFactory(household=household)
    budgets = {
        name: Budget.objects.create(
            household=household, name=name, monthly_amount=Decimal("400.00")
        )
        for name in ("Courses", "Santé", "Loisirs")
    }
    return household, user, account, budgets


def credited(transaction) -> dict:
    return {
        row.budget.name: row.amount for row in transaction.refund_allocations.select_related("budget")
    }


@pytest.mark.django_db
class TestCreditingOneBudgetLeavesTheOthersAlone:
    """⚠️ La régression qui justifie tout ce module.

    Le geste part d'une dépense : il ne connaît que *son* enveloppe et ignore
    tout de ce que les autres dépenses ont déjà rattaché à la même recette.
    S'il écrasait leur travail, l'argent d'une enveloppe disparaîtrait sans
    qu'aucun écran ne le signale — le plafond redeviendrait faux en silence,
    ce qui est précisément l'orphelin que le parcours 26 supprime.
    """

    def test_an_existing_split_survives_a_new_credit(self, context):
        household, user, account, budgets = context
        refund = make_inflow(account, amount="70.00")
        set_refund_allocations(
            household=household,
            user=user,
            transaction=refund,
            lines=[
                {"budget_id": str(budgets["Courses"].id), "amount": Decimal("40.00")},
                {"budget_id": str(budgets["Santé"].id), "amount": Decimal("30.00")},
            ],
        )

        # 70 € sont déjà répartis : il ne reste rien, donc on libère d'abord
        # Santé pour faire de la place — le point du test est que Courses ne
        # bouge pas, pas la limite de montant (couverte plus bas).
        credit_budget_from_refund(
            household=household,
            user=user,
            transaction=refund,
            budget_id=str(budgets["Santé"].id),
            amount=Decimal("10.00"),
        )
        credit_budget_from_refund(
            household=household,
            user=user,
            transaction=refund,
            budget_id=str(budgets["Loisirs"].id),
            amount=Decimal("20.00"),
        )

        assert credited(refund) == {
            "Courses": Decimal("40.00"),
            "Santé": Decimal("10.00"),
            "Loisirs": Decimal("20.00"),
        }

    def test_the_editor_still_replaces_everything(self, context):
        """Le remplacement complet reste le contrat de l'éditeur — il le possède."""
        household, user, account, budgets = context
        refund = make_inflow(account, amount="70.00")
        credit_budget_from_refund(
            household=household,
            user=user,
            transaction=refund,
            budget_id=str(budgets["Courses"].id),
            amount=Decimal("40.00"),
        )

        set_refund_allocations(
            household=household,
            user=user,
            transaction=refund,
            lines=[{"budget_id": str(budgets["Santé"].id), "amount": Decimal("15.00")}],
        )

        assert credited(refund) == {"Santé": Decimal("15.00")}


@pytest.mark.django_db
class TestTheCreditIsASetNotAnIncrement:
    """Deux fois le même geste doit laisser le même état.

    Sans lien vers la dépense, House ne peut pas distinguer « je reclique sur la
    même dépense » de « une seconde dépense sur la même enveloppe ». Un ``+=``
    ferait donc doubler un remboursement sur un double-clic, et un montant faux
    obtenu par un double-clic est indétectable après coup.
    """

    def test_crediting_twice_does_not_double(self, context):
        household, user, account, budgets = context
        refund = make_inflow(account, amount="70.00")

        for _ in range(2):
            credit_budget_from_refund(
                household=household,
                user=user,
                transaction=refund,
                budget_id=str(budgets["Courses"].id),
                amount=Decimal("19.75"),
            )

        assert credited(refund) == {"Courses": Decimal("19.75")}
        assert RefundAllocation.objects.filter(transaction=refund).count() == 1

    def test_a_zero_amount_removes_the_credit(self, context):
        household, user, account, budgets = context
        refund = make_inflow(account, amount="70.00")
        credit_budget_from_refund(
            household=household,
            user=user,
            transaction=refund,
            budget_id=str(budgets["Courses"].id),
            amount=Decimal("19.75"),
        )

        credit_budget_from_refund(
            household=household,
            user=user,
            transaction=refund,
            budget_id=str(budgets["Courses"].id),
            amount=Decimal("0.00"),
        )

        assert credited(refund) == {}


@pytest.mark.django_db
class TestTheCreditCannotExceedTheReceipt:
    def test_it_refuses_more_than_the_receipt_brought(self, context):
        household, user, account, budgets = context
        refund = make_inflow(account, amount="70.00")

        with pytest.raises(ValidationError):
            credit_budget_from_refund(
                household=household,
                user=user,
                transaction=refund,
                budget_id=str(budgets["Courses"].id),
                amount=Decimal("70.01"),
            )

    def test_the_room_left_by_other_budgets_is_what_bounds_it(self, context):
        """La borne exclut l'enveloppe visée : la remplacer libère sa propre place."""
        household, user, account, budgets = context
        refund = make_inflow(account, amount="70.00")
        set_refund_allocations(
            household=household,
            user=user,
            transaction=refund,
            lines=[{"budget_id": str(budgets["Santé"].id), "amount": Decimal("50.00")}],
        )

        # 20 € de place : accepté.
        credit_budget_from_refund(
            household=household,
            user=user,
            transaction=refund,
            budget_id=str(budgets["Courses"].id),
            amount=Decimal("20.00"),
        )
        assert credited(refund)["Courses"] == Decimal("20.00")

        # Ré-écrire Courses à 20 € reste possible : sa propre part ne se compte
        # pas deux fois contre la recette.
        credit_budget_from_refund(
            household=household,
            user=user,
            transaction=refund,
            budget_id=str(budgets["Courses"].id),
            amount=Decimal("20.00"),
        )
        assert credited(refund)["Courses"] == Decimal("20.00")

        with pytest.raises(ValidationError):
            credit_budget_from_refund(
                household=household,
                user=user,
                transaction=refund,
                budget_id=str(budgets["Courses"].id),
                amount=Decimal("20.01"),
            )


@pytest.mark.django_db
class TestTheNatureOfTheReceipt:
    """Une recette que personne n'a regardée n'est pas un choix de l'utilisateur.

    `inflow_nature == ""` veut dire « personne n'a regardé » ; `salary` ou
    `transfer` veulent dire « quelqu'un a tranché ». Confondre les deux, c'est
    écraser une décision — et un salaire reclassé en remboursement retirerait de
    l'argent à une enveloppe sans qu'un euro soit revenu.
    """

    def test_an_unclassified_receipt_is_classified_as_a_refund(self, context):
        household, user, account, budgets = context
        refund = make_inflow(account, amount="70.00", nature="")

        credit_budget_from_refund(
            household=household,
            user=user,
            transaction=refund,
            budget_id=str(budgets["Courses"].id),
            amount=Decimal("19.75"),
        )

        refund.refresh_from_db()
        assert refund.inflow_nature == InflowNature.REFUND
        assert credited(refund) == {"Courses": Decimal("19.75")}

    @pytest.mark.parametrize("nature", ["salary", "transfer", "other"])
    def test_an_explicit_choice_is_never_overwritten(self, context, nature):
        household, user, account, budgets = context
        receipt = make_inflow(account, amount="70.00", nature=nature)

        with pytest.raises(ValidationError):
            credit_budget_from_refund(
                household=household,
                user=user,
                transaction=receipt,
                budget_id=str(budgets["Courses"].id),
                amount=Decimal("19.75"),
            )

        receipt.refresh_from_db()
        assert receipt.inflow_nature == nature
        assert credited(receipt) == {}


@pytest.mark.django_db
class TestTheHouseholdBoundary:
    def test_a_receipt_of_another_household_is_refused(self, context):
        household, user, _, budgets = context
        outsider = make_inflow(BankAccountFactory(household=HouseholdFactory()), amount="70.00")

        with pytest.raises(ValidationError):
            credit_budget_from_refund(
                household=household,
                user=user,
                transaction=outsider,
                budget_id=str(budgets["Courses"].id),
                amount=Decimal("19.75"),
            )

    def test_a_budget_of_another_household_is_refused(self, context):
        household, user, account, _ = context
        refund = make_inflow(account, amount="70.00")
        foreign = Budget.objects.create(
            household=HouseholdFactory(), name="Voisin", monthly_amount=Decimal("100.00")
        )

        with pytest.raises(ValidationError):
            credit_budget_from_refund(
                household=household,
                user=user,
                transaction=refund,
                budget_id=str(foreign.id),
                amount=Decimal("19.75"),
            )


@pytest.mark.django_db
class TestAnOutflowCannotCreditAnything:
    def test_it_refuses_a_spending_line(self, context):
        household, user, account, budgets = context
        label = "CARTE AMAZON"
        outflow = BankTransaction.objects.create(
            household=household,
            account=account,
            booked_on=date(2026, 7, 14),
            label_raw=label,
            label_norm=label,
            amount=Decimal("-19.75"),
            direction=TransactionDirection.OUT,
            dedup_hash=compute_dedup_hash(
                account_id=account.id,
                booked_on=date(2026, 7, 14),
                label_norm=label,
                amount=Decimal("-19.75"),
                currency="EUR",
                discriminant=f"#{next(_counter)}",
            ),
        )

        with pytest.raises(ValidationError):
            credit_budget_from_refund(
                household=household,
                user=user,
                transaction=outflow,
                budget_id=str(budgets["Courses"].id),
                amount=Decimal("19.75"),
            )
