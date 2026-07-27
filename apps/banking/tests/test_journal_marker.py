# banking/tests/test_journal_marker.py
"""Le marqueur « traitée / partiellement / pas du tout » du journal bancaire.

Un journal qui n'affiche que des libellés et des montants oblige à ouvrir chaque
ligne pour savoir s'il reste quelque chose à en dire. Le marqueur répond à ça —
mais il ne vaut que s'il dit **exactement** ce que compte l'onglet Contrôle : une
ligne verte ici et un écart là-bas, et plus personne ne croit ni l'un ni l'autre.
D'où la classe de régression du bas de fichier, qui compare les deux lectures.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.detectors import TRANSACTION_PARTIAL, TRANSACTION_UNALLOCATED
from banking.models import BankTransaction, ImportStatus, StatementImport, TransactionDirection
from budget.models import Budget
from households.models import HouseholdMember
from interactions.services import create_bank_expense_interaction

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

LIST_URL = "/api/banking/transactions/"
TX_URL = "/api/banking/transactions/"
_counter = itertools.count()


def make_txn(account, *, amount, booked_on=date(2026, 3, 10), internal=False, label="CB LECLERC"):
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=booked_on,
        label_raw=label,
        label_norm=label.upper(),
        amount=value,
        direction=TransactionDirection.OUT if value < 0 else TransactionDirection.IN,
        is_internal=internal,
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
    """Un foyer dont le compte a une fenêtre de conformité sur janvier→mars 2026."""
    household = HouseholdFactory()
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
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
    client = APIClient()
    client.force_authenticate(user=user)
    return household, user, account, budget, client


def allocate(household, user, txn, budget, amount):
    return create_bank_expense_interaction(
        household=household,
        user=user,
        transaction=txn,
        subject="Courses",
        amount=Decimal(amount),
        budget_id=budget.id,
    )


def row_for(client, txn):
    body = client.get(f"{LIST_URL}?account={txn.account_id}").json()
    return next(r for r in body["results"] if r["id"] == str(txn.pk))


@pytest.mark.django_db
class TestTheThreeStates:
    def test_an_untouched_outflow_says_so(self, ctx):
        household, _, account, _, client = ctx
        txn = make_txn(account, amount="-120.00")

        row = row_for(client, txn)

        assert row["allocation_state"] == "unallocated"
        assert row["allocated_amount"] == "0.00"
        assert row["remaining_amount"] == "120.00"

    def test_a_half_sorted_line_carries_what_is_left(self, ctx):
        """C'est le reste qui est l'information utile, pas le pourcentage fait."""
        household, user, account, budget, client = ctx
        txn = make_txn(account, amount="-150.00")
        allocate(household, user, txn, budget, "90.00")

        row = row_for(client, txn)

        assert row["allocation_state"] == "partial"
        assert row["allocated_amount"] == "90.00"
        assert row["remaining_amount"] == "60.00"

    def test_a_fully_split_line_is_done(self, ctx):
        household, user, account, budget, client = ctx
        txn = make_txn(account, amount="-150.00")
        allocate(household, user, txn, budget, "90.00")
        allocate(household, user, txn, budget, "60.00")

        row = row_for(client, txn)

        assert row["allocation_state"] == "allocated"
        assert row["remaining_amount"] == "0.00"


@pytest.mark.django_db
class TestWhatCarriesNoMarkerAtAll:
    """Un marqueur sur une ligne qui n'a rien à ventiler est un faux reproche."""

    def test_an_inflow_has_no_state(self, ctx):
        _, _, account, _, client = ctx
        txn = make_txn(account, amount="2100.00", label="VIR SALAIRE")

        row = row_for(client, txn)

        assert row["allocation_state"] == ""
        assert row["remaining_amount"] == "0.00"

    def test_an_internal_movement_has_no_state(self, ctx):
        """L'argent est compté une fois, quand le liquide qu'il alimente est dépensé."""
        _, _, account, _, client = ctx
        txn = make_txn(account, amount="-100.00", internal=True, label="RETRAIT DAB")

        assert row_for(client, txn)["allocation_state"] == ""

    def test_a_line_with_a_cash_counterpart_has_no_state(self, ctx):
        _, _, account, _, client = ctx
        withdrawal = make_txn(account, amount="-100.00", label="RETRAIT DAB")
        mirror = make_txn(account, amount="100.00", label="ALIM ESPECES")
        withdrawal.transfer_counterpart = mirror
        withdrawal.is_internal = True
        withdrawal.save(update_fields=["transfer_counterpart", "is_internal"])

        assert row_for(client, withdrawal)["allocation_state"] == ""


@pytest.mark.django_db
class TestOutsideTheWindow:
    """Un zéro a deux sens, et le marqueur doit les distinguer comme le contrôle.

    Une ligne antérieure au solde d'ouverture ne peut pas être exigée : la
    badger « non ventilée » fabriquerait une tâche que l'utilisateur ne peut pas
    résoudre — exactement le bruit que la fenêtre de conformité existe pour éviter.
    """

    def test_a_line_before_the_opening_date_is_out_of_scope_not_untreated(self, ctx):
        _, _, account, _, client = ctx
        txn = make_txn(account, amount="-80.00", booked_on=date(2025, 11, 4))

        assert row_for(client, txn)["allocation_state"] == "out_of_scope"

    def test_an_account_without_a_window_never_reads_untreated(self, ctx):
        _, _, account, _, client = ctx
        account.opening_balance_date = None
        account.save(update_fields=["opening_balance_date"])
        txn = make_txn(account, amount="-80.00")

        assert row_for(client, txn)["allocation_state"] == "out_of_scope"

    def test_but_being_done_is_a_fact_not_a_scope(self, ctx):
        """Hors fenêtre, House n'exige rien — mais une ligne ventilée l'est."""
        household, user, account, budget, client = ctx
        txn = make_txn(account, amount="-80.00", booked_on=date(2025, 11, 4))
        allocate(household, user, txn, budget, "80.00")

        assert row_for(client, txn)["allocation_state"] == "allocated"


@pytest.mark.django_db
class TestTheMarkerAgreesWithTheControl:
    """Le journal et l'onglet Contrôle lisent la même fonction — preuve par les nombres."""

    def test_same_verdict_line_by_line(self, ctx):
        from banking.compliance import summary

        household, user, account, budget, client = ctx
        make_txn(account, amount="-10.00")  # rien
        make_txn(account, amount="-20.00")  # rien
        partial = make_txn(account, amount="-100.00")
        allocate(household, user, partial, budget, "40.00")
        full = make_txn(account, amount="-30.00")
        allocate(household, user, full, budget, "30.00")
        make_txn(account, amount="-50.00", booked_on=date(2025, 11, 4))  # hors fenêtre
        make_txn(account, amount="900.00", label="VIR SALAIRE")  # recette

        rows = client.get(LIST_URL).json()["results"]
        states = [r["allocation_state"] for r in rows]
        groups = {g.spec.kind: g.open for g in summary(household)}

        assert states.count("unallocated") == groups[TRANSACTION_UNALLOCATED] == 2
        assert states.count("partial") == groups[TRANSACTION_PARTIAL] == 1
        assert states.count("allocated") == 1
        assert states.count("out_of_scope") == 1
        assert states.count("") == 1


@pytest.mark.django_db
class TestItStaysCheapAndFresh:
    def test_the_page_does_not_query_once_per_line(self, ctx, django_assert_max_num_queries):
        """Le marqueur est une annotation, jamais une boucle : 50 lignes/page."""
        household, user, account, budget, client = ctx
        for i in range(25):
            txn = make_txn(account, amount=f"-{i + 1}.00")
            if i % 2:
                allocate(household, user, txn, budget, "1.00")

        # Cinq en réalité (session, user, count, page, fenêtre du compte) ; la
        # marge laisse passer une requête de plomberie, jamais une par ligne.
        with django_assert_max_num_queries(8):
            client.get(LIST_URL)

    def test_writing_a_split_returns_the_new_state_not_the_old_one(self, ctx):
        """``refresh_from_db`` ne rafraîchit pas une annotation — la réponse mentait."""
        _, _, account, budget, client = ctx
        txn = make_txn(account, amount="-150.00")

        body = client.put(
            f"{TX_URL}{txn.id}/allocations/",
            {"lines": [{"amount": "150.00", "budget": str(budget.id), "subject": "Courses"}]},
            format="json",
        ).json()

        assert body["transaction"]["allocation_state"] == "allocated"
        assert body["transaction"]["remaining_amount"] == "0.00"


@pytest.mark.django_db
class TestTheToSortOutFilter:
    """`?allocation=todo` — le compagnon du marqueur.

    Le marqueur dit ligne par ligne ce qu'il reste à faire ; sans filtre, sur un
    relevé de 160 lignes, il énonce un reproche qu'on ne peut pas suivre. Le
    filtre passe par la **même** fonction que les compteurs du Contrôle
    (``detectors.pending_outflows``) : une liste dont le nombre contredirait le
    badge ferait perdre leur crédit aux deux.
    """

    def test_it_keeps_exactly_the_unallocated_and_the_partial(self, ctx):
        household, user, account, budget, client = ctx
        untouched = make_txn(account, amount="-120.00", label="CB LECLERC")
        partial = make_txn(account, amount="-150.00", label="CB LEROY MERLIN")
        allocate(household, user, partial, budget, "90.00")
        done = make_txn(account, amount="-40.00", label="CB BOULANGERIE")
        allocate(household, user, done, budget, "40.00")

        body = client.get(f"{LIST_URL}?allocation=todo").json()

        assert {r["id"] for r in body["results"]} == {str(untouched.pk), str(partial.pk)}

    def test_a_receipt_is_never_to_sort_out(self, ctx):
        """Une recette n'est pas une dépense à ranger — elle a son propre écart."""
        _, _, account, _, client = ctx
        make_txn(account, amount="2100.00", label="VIR SALAIRE")

        body = client.get(f"{LIST_URL}?allocation=todo").json()

        assert body["results"] == []

    def test_an_internal_movement_is_never_to_sort_out(self, ctx):
        """L'argent qui change de poche est compté plus tard, quand il est dépensé."""
        _, _, account, _, client = ctx
        make_txn(account, amount="-60.00", label="RETRAIT DAB", internal=True)

        body = client.get(f"{LIST_URL}?allocation=todo").json()

        assert body["results"] == []

    def test_the_filter_count_equals_the_control_count(self, ctx):
        """Le test qui porte la garantie : la file et le badge, nombre pour nombre."""
        from banking.compliance import get_detector, group_result

        household, user, account, budget, client = ctx
        for index in range(4):
            make_txn(account, amount="-30.00", label=f"CB ACHAT {index}")
        partial = make_txn(account, amount="-80.00", label="CB BRICO")
        allocate(household, user, partial, budget, "20.00")

        listed = client.get(f"{LIST_URL}?allocation=todo").json()["count"]
        counted = (
            group_result(household, get_detector(TRANSACTION_UNALLOCATED)).detected
            + group_result(household, get_detector(TRANSACTION_PARTIAL)).detected
        )

        assert listed == counted == 5

    def test_without_the_filter_nothing_is_hidden(self, ctx):
        """Le filtre est un choix, jamais un défaut : le journal reste entier."""
        _, _, account, _, client = ctx
        make_txn(account, amount="-120.00")
        make_txn(account, amount="2100.00", label="VIR SALAIRE")

        assert client.get(LIST_URL).json()["count"] == 2
