# banking/tests/test_expense_marker.py
"""Le marqueur « rapprochée / en attente » d'une dépense — l'autre bout du pont.

Symétrique de ``test_journal_marker.py``. Le journal bancaire dit d'une **ligne**
si elle est ventilée ; ici une **dépense** dit si une ligne de relevé la justifie.
C'est la même question posée depuis l'autre rive, donc la même exigence : le
verdict doit être celui que compte l'onglet Contrôle (``expense_unreconciled``),
sinon le journal des dépenses accuse en rouge ce que le Contrôle ne réclame pas.

Le piège est concret : une dépense antérieure au premier relevé n'a aucune ligne
à laquelle se rattacher et n'en aura jamais. Le détecteur le sait — il borne par
la fenêtre de conformité du foyer. Un client qui lirait `bank_transaction === null`
ne le saurait pas.
"""
from __future__ import annotations

import itertools
from datetime import date, datetime, time, timezone as dt_timezone
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from banking.dedup import compute_dedup_hash
from banking.detectors import EXPENSE_UNRECONCILED
from banking.models import (
    BankAccount,
    BankTransaction,
    ImportStatus,
    StatementImport,
    TransactionDirection,
)
from budget.models import Budget
from households.models import HouseholdMember
from interactions.models import Interaction
from interactions.services import create_bank_expense_interaction

from .factories import BankAccountFactory, HouseholdFactory, HouseholdMemberFactory, UserFactory

EXPENSES_URL = "/api/interactions/interactions/?type=expense"
_counter = itertools.count()


def make_txn(
    account, *, amount, booked_on=date(2026, 3, 10), label="CB LECLERC", internal=False
):
    value = Decimal(amount)
    return BankTransaction.objects.create(
        household=account.household,
        account=account,
        booked_on=booked_on,
        label_raw=label,
        label_norm=label.upper(),
        amount=value,
        is_internal=internal,
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
def ctx(db):
    """Un foyer dont la fenêtre de conformité couvre janvier→mars 2026."""
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


def loose_expense(household, user, *, day=date(2026, 2, 12), amount="42.00", subject="Boulangerie"):
    """Une dépense saisie dans l'app, qu'aucune ligne de relevé ne justifie."""
    return Interaction.objects.create(
        household=household,
        created_by=user,
        subject=subject,
        type="expense",
        occurred_at=datetime.combine(day, time(12, 0), tzinfo=dt_timezone.utc),
        amount=Decimal(amount),
        kind="manual",
    )


def row_for(client, expense):
    body = client.get(EXPENSES_URL).json()
    items = body["results"] if isinstance(body, dict) else body
    return next(r for r in items if r["id"] == str(expense.pk))


@pytest.mark.django_db
class TestTheTwoStatesThatMatter:
    def test_an_expense_no_statement_justifies_says_so(self, ctx):
        household, user, _, _, client = ctx
        expense = loose_expense(household, user)

        row = row_for(client, expense)

        assert row["reconciliation_state"] == "pending"
        assert row["bank_line"] is None

    def test_an_expense_born_of_a_statement_line_names_it(self, ctx):
        """« Rapprochée » sans dire *à quoi* reste une affirmation invérifiable."""
        household, user, account, budget, client = ctx
        txn = make_txn(account, amount="-42.00", label="CB BOULANGERIE MARTIN")
        expense = create_bank_expense_interaction(
            household=household,
            user=user,
            transaction=txn,
            subject="Boulangerie",
            amount=Decimal("42.00"),
            budget_id=budget.id,
        )

        row = row_for(client, expense)

        assert row["reconciliation_state"] == "attested"
        assert row["bank_line"] == {
            "id": str(txn.id),
            "label": "CB BOULANGERIE MARTIN",
            "booked_on": "2026-03-10",
            "account_name": "Courant",
        }

    def test_a_cash_expense_is_attached_but_nobody_reconciled_anything(self, ctx):
        """Née avec sa ligne (lot 4) : rattachée, oui — « rapprochée », non.

        Le mot compte : dire « rapprochée » d'une dépense en liquide suggérerait
        qu'une banque l'a vue passer.
        """
        household, user, _, budget, client = ctx
        cash = BankAccountFactory(
            household=household,
            name="Liquide",
            kind=BankAccount.Kind.CASH,
            opening_balance=Decimal("200.00"),
            opening_balance_date=date(2026, 1, 1),
        )
        txn = make_txn(cash, amount="-20.00", label="Marché")
        expense = create_bank_expense_interaction(
            household=household,
            user=user,
            transaction=txn,
            subject="Marché",
            amount=Decimal("20.00"),
            budget_id=budget.id,
        )

        assert row_for(client, expense)["reconciliation_state"] == "cash"

    def test_a_note_carries_no_marker_at_all(self, ctx):
        """Un reproche de rapprochement sur une note serait un faux reproche."""
        household, user, _, _, client = ctx
        note = Interaction.objects.create(
            household=household,
            created_by=user,
            subject="Le plombier repasse jeudi",
            type="note",
            occurred_at=datetime(2026, 2, 12, 12, 0, tzinfo=dt_timezone.utc),
        )

        body = client.get("/api/interactions/interactions/?type=note").json()
        items = body["results"] if isinstance(body, dict) else body
        row = next(r for r in items if r["id"] == str(note.pk))

        assert row["reconciliation_state"] == ""


@pytest.mark.django_db
class TestOutsideTheWindow:
    """Là où House ne peut rien exiger, elle ne reproche rien — comme le Contrôle."""

    def test_an_expense_older_than_the_first_statement_is_out_of_scope(self, ctx):
        household, user, _, _, client = ctx
        expense = loose_expense(household, user, day=date(2025, 9, 3))

        assert row_for(client, expense)["reconciliation_state"] == "out_of_scope"

    def test_an_expense_after_the_last_import_is_waiting_not_orphaned(self, ctx):
        """Une dépense d'hier est réelle avant l'import du relevé suivant."""
        household, user, _, _, client = ctx
        expense = loose_expense(household, user, day=date(2026, 5, 20))

        assert row_for(client, expense)["reconciliation_state"] == "out_of_scope"

    def test_a_household_without_any_window_never_reads_pending(self, ctx):
        household, user, account, _, client = ctx
        account.opening_balance_date = None
        account.save(update_fields=["opening_balance_date"])
        expense = loose_expense(household, user)

        assert row_for(client, expense)["reconciliation_state"] == "out_of_scope"

    def test_but_being_attached_is_a_fact_not_a_scope(self, ctx):
        """Hors fenêtre House n'exige rien — mais une dépense rattachée l'est."""
        household, user, account, budget, client = ctx
        txn = make_txn(account, amount="-30.00", booked_on=date(2025, 9, 3))
        expense = create_bank_expense_interaction(
            household=household,
            user=user,
            transaction=txn,
            subject="Vieil achat",
            amount=Decimal("30.00"),
            budget_id=budget.id,
        )

        assert row_for(client, expense)["reconciliation_state"] == "attested"


@pytest.mark.django_db
class TestTheMarkerAgreesWithTheControl:
    """Preuve par les nombres : le journal des dépenses et le Contrôle comptent pareil.

    C'est la régression qui compte. La première version de ce badge vivait dans
    le client et lisait `bank_transaction === null` : elle affichait « en attente
    de rapprochement » en rouge sur trois dépenses de 2025 que le Contrôle, lui,
    ne réclamait pas — deux écrans en désaccord sur le même fait.
    """

    def test_same_verdict_expense_by_expense(self, ctx):
        from banking.compliance import summary

        household, user, account, budget, client = ctx
        loose_expense(household, user, subject="Boulangerie")  # en attente
        loose_expense(household, user, subject="Pharmacie")  # en attente
        loose_expense(household, user, day=date(2025, 9, 3), subject="Vieux")  # hors fenêtre
        loose_expense(household, user, day=date(2026, 6, 1), subject="Récent")  # hors fenêtre
        txn = make_txn(account, amount="-60.00")
        create_bank_expense_interaction(
            household=household,
            user=user,
            transaction=txn,
            subject="Courses",
            amount=Decimal("60.00"),
            budget_id=budget.id,
        )

        body = client.get(f"{EXPENSES_URL}&limit=50").json()
        items = body["results"] if isinstance(body, dict) else body
        states = [r["reconciliation_state"] for r in items]
        groups = {g.spec.kind: g.open for g in summary(household)}

        assert states.count("pending") == groups[EXPENSE_UNRECONCILED] == 2
        assert states.count("out_of_scope") == 2
        assert states.count("attested") == 1


@pytest.mark.django_db
class TestItStaysCheap:
    """Le marqueur coûte un nombre **fixe** de requêtes, pas une par dépense.

    On ne borne pas le total de la page : la liste des interactions a un N+1
    antérieur (documents, contacts, structures, équipements — sept requêtes par
    ligne), et une borne globale mesurerait surtout celui-là. Ce qui est vérifié
    ici est ce que ce marqueur ajoute, et la propriété qui compte est qu'il
    n'augmente pas avec le nombre de lignes : sans le ``select_related`` et sans
    le cache de fenêtre, chaque dépense coûtait sa ligne, son compte, et une
    reconstruction complète de la fenêtre de conformité du foyer.
    """

    BANKING_TABLES = ("bank_transactions", "bank_accounts", "bank_statement_imports")

    def _banking_queries(self, captured) -> int:
        return sum(
            1 for q in captured if any(table in q["sql"] for table in self.BANKING_TABLES)
        )

    def test_the_marker_costs_the_same_for_five_expenses_as_for_forty(self, ctx):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        household, user, account, budget, client = ctx

        def fill(count):
            for i in range(count):
                if i % 2:
                    loose_expense(household, user, subject=f"Ad hoc {i}")
                else:
                    txn = make_txn(account, amount=f"-{i + 1}.00")
                    create_bank_expense_interaction(
                        household=household,
                        user=user,
                        transaction=txn,
                        subject=f"Courses {i}",
                        amount=Decimal(i + 1),
                        budget_id=budget.id,
                    )

        fill(5)
        with CaptureQueriesContext(connection) as few:
            client.get(f"{EXPENSES_URL}&limit=100")
        fill(35)
        with CaptureQueriesContext(connection) as many:
            client.get(f"{EXPENSES_URL}&limit=100")

        assert self._banking_queries(few.captured_queries) == self._banking_queries(
            many.captured_queries
        )
        # Trois : la fenêtre du compte (deux agrégats) et la liste des comptes.
        # Les lignes elles-mêmes arrivent jointes à la requête des interactions.
        assert self._banking_queries(many.captured_queries) <= 4


@pytest.mark.django_db
class TestWhichLinesCouldCarryThisExpense:
    """`?fits=` — « quelles opérations ont la place pour cette dépense ? ».

    Le pendant, depuis la dépense, de la file « À ranger » qui part de la ligne.
    Le matcher automatique ne répondra jamais à ça : 90 € face à une ligne de
    150 € est rejeté par `score_pair`, à raison. Mais c'est un cas réel, et le
    seul qui puisse trancher est l'utilisateur — on lui montre donc ce qui a
    matériellement la place, et rien d'autre.
    """

    URL = "/api/banking/transactions/"

    def labels(self, client, amount):
        body = client.get(f"{self.URL}?fits={amount}").json()
        return [r["label_raw"] for r in body["results"]]

    def test_a_line_too_small_is_not_proposed(self, ctx):
        """Proposer un bouton que le serveur refusera est pire que ne rien proposer."""
        _, _, account, _, client = ctx
        make_txn(account, amount="-50.00", label="PETITE")
        make_txn(account, amount="-200.00", label="GRANDE")

        assert self.labels(client, "90.00") == ["GRANDE"]

    def test_a_partly_split_line_offers_only_what_is_left(self, ctx):
        """150 € dont 90 € déjà ventilés : il reste 60 €, pas 150."""
        household, user, account, budget, client = ctx
        txn = make_txn(account, amount="-150.00", label="LEROY MERLIN")
        create_bank_expense_interaction(
            household=household,
            user=user,
            transaction=txn,
            subject="Carrelage",
            amount=Decimal("90.00"),
            budget_id=budget.id,
        )

        assert self.labels(client, "60.00") == ["LEROY MERLIN"]
        assert self.labels(client, "61.00") == []

    def test_an_expense_can_cover_part_of_a_line(self, ctx):
        """Le cas qui motive tout : 90 € sur une ligne de 150 €."""
        _, _, account, _, client = ctx
        make_txn(account, amount="-150.00", label="LEROY MERLIN")

        assert self.labels(client, "90.00") == ["LEROY MERLIN"]

    def test_receipts_and_internal_movements_are_never_proposed(self, ctx):
        """Une recette n'a rien à ventiler ; un retrait est compté ailleurs."""
        _, _, account, _, client = ctx
        make_txn(account, amount="900.00", label="VIR SALAIRE")
        make_txn(account, amount="-300.00", internal=True, label="RETRAIT DAB")
        make_txn(account, amount="-300.00", label="CB VRAIE DEPENSE")

        assert self.labels(client, "50.00") == ["CB VRAIE DEPENSE"]

    def test_a_malformed_amount_is_a_400(self, ctx):
        """Un paramètre illisible est une erreur, jamais un filtre ignoré."""
        _, _, account, _, client = ctx

        assert client.get(f"{self.URL}?fits=beaucoup").status_code == 400
        assert client.get(f"{self.URL}?fits=-10").status_code == 400


@pytest.mark.django_db
class TestTheForgottenExpenseIsOffered:
    """Le doublon vécu en recette : une dépense saisie, oubliée, puis re-créée.

    L'utilisateur avait saisi une dépense sans la relier. Au moment de ventiler la
    ligne il en a créé une **nouvelle**, la ligne est devenue pleine, et l'ancienne
    ne pouvait plus s'y rattacher : le même argent compté deux fois, et un écart
    « dépense non rapprochée » insoluble.

    Le correctif est en amont — montrer l'existant avant d'offrir d'en fabriquer.
    Ces tests tiennent la source de cette liste.
    """

    URL = "/api/interactions/interactions/"

    def subjects(self, client, **params):
        query = "&".join(f"{k}={v}" for k, v in params.items())
        body = client.get(f"{self.URL}?{query}").json()
        items = body["results"] if isinstance(body, dict) else body
        return [row["subject"] for row in items]

    def test_it_lists_expenses_no_line_justifies(self, ctx):
        household, user, account, budget, client = ctx
        loose_expense(household, user, subject="Carrelage oublié")
        txn = make_txn(account, amount="-90.00")
        create_bank_expense_interaction(
            household=household,
            user=user,
            transaction=txn,
            subject="Déjà rapprochée",
            amount=Decimal("90.00"),
            budget_id=budget.id,
        )

        assert self.subjects(client, unreconciled="true") == ["Carrelage oublié"]

    def test_it_ignores_the_conformity_window(self, ctx):
        """Le piège de la première version, et la raison même du doublon.

        Le sélecteur lisait le détecteur `expense_unreconciled`, borné par la
        fenêtre. Une dépense saisie **après** le dernier relevé importé — celle
        qu'on vient de créer, donc celle qu'on risque de re-créer — n'était pas
        proposée. « Qu'est-ce qui existe déjà » n'est pas « qu'est-ce que je dois
        réclamer ».
        """
        household, user, _, _, client = ctx
        loose_expense(household, user, day=date(2026, 6, 1), subject="Saisie hier")

        from banking.compliance import summary
        from banking.detectors import EXPENSE_UNRECONCILED

        flagged = {g.spec.kind: g.open for g in summary(household)}[EXPENSE_UNRECONCILED]

        assert flagged == 0, "hors fenêtre : le contrôle ne la réclame pas, et c'est normal"
        assert self.subjects(client, unreconciled="true") == ["Saisie hier"]

    def test_it_never_offers_more_than_the_line_can_hold(self, ctx):
        household, user, _, _, client = ctx
        loose_expense(household, user, amount="40.00", subject="Tient")
        loose_expense(household, user, amount="300.00", subject="Trop grosse")

        assert self.subjects(client, unreconciled="true", max_amount="60.00") == ["Tient"]

    def test_a_malformed_ceiling_is_a_400(self, ctx):
        _, _, _, _, client = ctx

        assert client.get(f"{self.URL}?max_amount=beaucoup").status_code == 400
