# banking/tests/test_cash_gap.py
"""Les deux trous restants de l'argent liquide.

**Le retrait partiellement versé** — 100 € retirés, 60 € déclarés entrés dans la
caisse. Rien n'est faux arithmétiquement : le solde bancaire est juste, le solde
espèces est juste, et 40 € n'appartiennent à rien. La ligne de retrait est
`is_internal` **en entier**, donc son reste est exclu des dépenses par la règle des
mouvements internes, et aucune ligne espèces ne le réclame. C'était le dernier
orphelin silencieux du modèle, et le plus discret : ses deux voisins ne peuvent pas
le voir (il *a* une contrepartie, elle est juste trop petite ; et sous-déclarer les
espèces fait paraître la caisse plus riche, jamais négative).

**La rentrée d'espèces** — l'autre moitié de l'histoire. Jusqu'ici les espèces ne
pouvaient entrer qu'en miroir d'un retrait bancaire : un billet donné à un repas de
famille, un vélo vendu, une part payée en pièces n'avaient aucune représentation.
Le seul conseil possible était de gonfler le solde d'ouverture — réécrire
l'histoire pour enregistrer un fait daté.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from banking.balances import compute_balance
from banking.compliance import summary
from banking.dedup import compute_dedup_hash
from banking.detectors import (
    ACCOUNT_CASH_NEGATIVE,
    CASH_MIRROR_PARTIAL,
    INFLOW_UNCLASSIFIED,
    INTERNAL_WITHOUT_COUNTERPART,
    REFUND_WITHOUT_BUDGET,
)
from banking.models import (
    BankAccount,
    BankTransaction,
    ImportStatus,
    InflowNature,
    StatementImport,
    TransactionDirection,
)
from banking.services import (
    adjust_cash_mirror,
    record_cash_deposit,
    record_cash_withdrawal,
    waive_finding,
)
from budget.models import Budget

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount, booked_on=date(2026, 2, 10), label="RETRAIT DAB", **extra):
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


@pytest.fixture
def ctx(db):
    household = HouseholdFactory()
    user = UserFactory()
    bank = BankAccountFactory(
        household=household, name="Courant", opening_balance_date=date(2026, 1, 1)
    )
    cash = BankAccountFactory(
        household=household,
        name="Espèces",
        kind=BankAccount.Kind.CASH,
        bank_label="",
        opening_balance=Decimal("0.00"),
        opening_balance_date=date(2026, 1, 1),
    )
    for account in (bank, cash):
        StatementImport.objects.create(
            household=household,
            account=account,
            provider="generic_csv",
            status=ImportStatus.COMPLETED,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 3, 31),
        )
    return {"household": household, "user": user, "bank": bank, "cash": cash}


def open_count(household, kind):
    return {g.spec.kind: g.open for g in summary(household)}.get(kind)


# --- Le retrait partiellement versé ------------------------------------------


class TestTheUnpouredRemainderIsSeen:
    def test_sixty_of_a_hundred_leaves_forty_reported(self, ctx):
        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        record_cash_withdrawal(
            user=ctx["user"],
            transaction=withdrawal,
            cash_account=ctx["cash"],
            amount=Decimal("60.00"),
        )

        assert open_count(ctx["household"], CASH_MIRROR_PARTIAL) == 1

    def test_a_full_pour_is_clean(self, ctx):
        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        record_cash_withdrawal(
            user=ctx["user"], transaction=withdrawal, cash_account=ctx["cash"]
        )

        assert open_count(ctx["household"], CASH_MIRROR_PARTIAL) == 0

    def test_the_finding_names_what_is_missing(self, ctx):
        from banking.compliance import get_detector, open_findings

        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        record_cash_withdrawal(
            user=ctx["user"],
            transaction=withdrawal,
            cash_account=ctx["cash"],
            amount=Decimal("60.00"),
        )

        (finding,) = open_findings(ctx["household"], get_detector(CASH_MIRROR_PARTIAL))
        assert finding.detail["outflow"] == "100.00"
        assert finding.detail["mirrored"] == "60.00"
        assert finding.detail["missing"] == "40.00"

    def test_neither_neighbour_could_have_caught_it(self, ctx):
        """Les deux détecteurs voisins sont aveugles à ce cas, chacun pour sa raison.

        `internal_without_counterpart` voit une contrepartie et se taît ; le solde
        espèces sous-déclaré est *plus riche*, donc `account_cash_negative` n'a rien
        à dire. Sans un détecteur propre, personne ne parle.
        """
        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        record_cash_withdrawal(
            user=ctx["user"],
            transaction=withdrawal,
            cash_account=ctx["cash"],
            amount=Decimal("60.00"),
        )

        assert open_count(ctx["household"], INTERNAL_WITHOUT_COUNTERPART) == 0
        assert open_count(ctx["household"], ACCOUNT_CASH_NEGATIVE) == 0

    def test_an_over_poured_mirror_is_not_this_ecart(self, ctx):
        """Verser plus que le retrait est refusé à l'écriture, pas signalé après."""
        withdrawal = make_txn(ctx["bank"], amount="-100.00")

        with pytest.raises(ValidationError):
            record_cash_withdrawal(
                user=ctx["user"],
                transaction=withdrawal,
                cash_account=ctx["cash"],
                amount=Decimal("140.00"),
            )


class TestCompletingThePour:
    def test_raising_the_mirror_closes_the_ecart(self, ctx):
        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        mirror = record_cash_withdrawal(
            user=ctx["user"],
            transaction=withdrawal,
            cash_account=ctx["cash"],
            amount=Decimal("60.00"),
        )

        adjust_cash_mirror(
            user=ctx["user"], transaction=withdrawal, amount=Decimal("100.00")
        )

        mirror.refresh_from_db()
        assert mirror.amount == Decimal("100.00")
        assert open_count(ctx["household"], CASH_MIRROR_PARTIAL) == 0

    def test_the_cash_balance_follows(self, ctx):
        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        record_cash_withdrawal(
            user=ctx["user"],
            transaction=withdrawal,
            cash_account=ctx["cash"],
            amount=Decimal("60.00"),
        )

        adjust_cash_mirror(
            user=ctx["user"], transaction=withdrawal, amount=Decimal("100.00")
        )

        assert compute_balance(account=ctx["cash"]).amount == Decimal("100.00")

    def test_the_dedup_hash_is_recomputed(self, ctx):
        """Sinon la ligne revendique une identité qu'elle n'a plus — et un
        ré-import pourrait déposer une **seconde** ligne pour le même argent."""
        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        mirror = record_cash_withdrawal(
            user=ctx["user"],
            transaction=withdrawal,
            cash_account=ctx["cash"],
            amount=Decimal("60.00"),
        )
        before = mirror.dedup_hash

        adjust_cash_mirror(
            user=ctx["user"], transaction=withdrawal, amount=Decimal("100.00")
        )

        mirror.refresh_from_db()
        assert mirror.dedup_hash != before

    def test_it_cannot_exceed_the_withdrawal(self, ctx):
        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        record_cash_withdrawal(
            user=ctx["user"],
            transaction=withdrawal,
            cash_account=ctx["cash"],
            amount=Decimal("60.00"),
        )

        with pytest.raises(ValidationError):
            adjust_cash_mirror(
                user=ctx["user"], transaction=withdrawal, amount=Decimal("120.00")
            )

    def test_an_imported_counterpart_is_never_rewritten(self, ctx):
        """Le montant d'une ligne importée est un fait du relevé.

        Même règle que `unlink_counterpart`, qui ne détruit que la jambe qu'on a
        générée : ici on ne réécrit que celle-là non plus.
        """
        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        other_bank = BankAccountFactory(
            household=ctx["household"], name="Livret", opening_balance_date=date(2026, 1, 1)
        )
        real = make_txn(other_bank, amount="60.00", label="VIR RECU")
        withdrawal.transfer_counterpart = real
        withdrawal.is_internal = True
        withdrawal.save(update_fields=["transfer_counterpart", "is_internal"])

        with pytest.raises(ValidationError):
            adjust_cash_mirror(
                user=ctx["user"], transaction=withdrawal, amount=Decimal("100.00")
            )

    def test_the_arbitration_expires_when_the_remainder_moves(self, ctx):
        """40 € arbitrés « restés dans ma poche », puis 20 € déclarés : l'écart
        resurgit, parce que le motif ne parle plus de la même somme."""
        withdrawal = make_txn(ctx["bank"], amount="-100.00")
        record_cash_withdrawal(
            user=ctx["user"],
            transaction=withdrawal,
            cash_account=ctx["cash"],
            amount=Decimal("60.00"),
        )
        waive_finding(
            household=ctx["household"],
            user=ctx["user"],
            finding_kind=CASH_MIRROR_PARTIAL,
            object_id=str(withdrawal.id),
            reason="40 € restés dans ma poche",
        )
        assert open_count(ctx["household"], CASH_MIRROR_PARTIAL) == 0

        adjust_cash_mirror(
            user=ctx["user"], transaction=withdrawal, amount=Decimal("80.00")
        )

        groups = {g.spec.kind: g for g in summary(ctx["household"])}
        assert groups[CASH_MIRROR_PARTIAL].stale == 1


# --- La rentrée d'espèces ----------------------------------------------------


class TestCashCanComeFromOutside:
    def test_a_gift_in_notes_becomes_a_cash_line(self, ctx):
        row = record_cash_deposit(
            household=ctx["household"],
            user=ctx["user"],
            account=ctx["cash"],
            booked_on=date(2026, 2, 14),
            label="Cadeau anniversaire",
            amount=Decimal("50.00"),
            inflow_nature=InflowNature.OTHER,
        )

        assert row.amount == Decimal("50.00")
        assert row.direction == TransactionDirection.IN
        assert compute_balance(account=ctx["cash"]).amount == Decimal("50.00")

    def test_it_is_born_classified(self, ctx):
        """Sinon la rentrée atterrit dans « À ranger » : l'app fabriquerait son
        propre travail, exactement ce que la dépense en espèces évite déjà."""
        record_cash_deposit(
            household=ctx["household"],
            user=ctx["user"],
            account=ctx["cash"],
            booked_on=date(2026, 2, 14),
            label="Vélo vendu",
            amount=Decimal("120.00"),
            inflow_nature=InflowNature.OTHER,
        )

        assert open_count(ctx["household"], INFLOW_UNCLASSIFIED) == 0

    def test_a_nature_is_required(self, ctx):
        with pytest.raises(ValidationError):
            record_cash_deposit(
                household=ctx["household"],
                user=ctx["user"],
                account=ctx["cash"],
                booked_on=date(2026, 2, 14),
                label="Billet trouvé",
                amount=Decimal("20.00"),
                inflow_nature="",
            )

    def test_transfer_is_refused(self, ctx):
        """Un mouvement interne promet une contrepartie que rien ne fournira —
        l'écart `internal_without_counterpart`, fabriqué par le geste censé
        combler un trou. Les espèces issues d'un retrait ont déjà leur chemin."""
        with pytest.raises(ValidationError):
            record_cash_deposit(
                household=ctx["household"],
                user=ctx["user"],
                account=ctx["cash"],
                booked_on=date(2026, 2, 14),
                label="Retrait",
                amount=Decimal("100.00"),
                inflow_nature=InflowNature.TRANSFER,
            )

    def test_a_bank_account_is_refused(self, ctx):
        """Une rentrée sur un compte bancaire s'importe, elle ne se saisit pas."""
        with pytest.raises(ValidationError):
            record_cash_deposit(
                household=ctx["household"],
                user=ctx["user"],
                account=ctx["bank"],
                booked_on=date(2026, 2, 14),
                label="Virement reçu",
                amount=Decimal("100.00"),
                inflow_nature=InflowNature.OTHER,
            )

    def test_a_cash_refund_credits_its_envelope_at_once(self, ctx):
        """Ma copine me rend 30 € en liquide sur les courses : l'enveloppe est
        recréditée dans le même geste, sans laisser `refund_without_budget`."""
        groceries = Budget.objects.create(
            household=ctx["household"], name="Courses", monthly_amount=Decimal("400.00")
        )

        row = record_cash_deposit(
            household=ctx["household"],
            user=ctx["user"],
            account=ctx["cash"],
            booked_on=date(2026, 2, 14),
            label="Part de Marie",
            amount=Decimal("30.00"),
            inflow_nature=InflowNature.REFUND,
            refund_lines=[{"budget_id": str(groceries.id), "amount": "30.00"}],
        )

        assert row.refund_allocations.count() == 1
        assert open_count(ctx["household"], REFUND_WITHOUT_BUDGET) == 0

    def test_a_deposit_is_never_a_duplicate_of_itself(self, ctx):
        """Deux billets de 20 € le même jour sont deux rentrées, et seul
        l'utilisateur sait si c'est une erreur."""
        for _ in range(2):
            record_cash_deposit(
                household=ctx["household"],
                user=ctx["user"],
                account=ctx["cash"],
                booked_on=date(2026, 2, 14),
                label="Billet",
                amount=Decimal("20.00"),
                inflow_nature=InflowNature.OTHER,
            )

        assert BankTransaction.objects.filter(account=ctx["cash"]).count() == 2
        assert compute_balance(account=ctx["cash"]).amount == Decimal("40.00")
