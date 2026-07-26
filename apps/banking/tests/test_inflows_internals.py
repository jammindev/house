# banking/tests/test_inflows_internals.py
"""Recettes et mouvements internes (parcours 26, lot 5).

Deux familles d'orphelins que le parcours 25 avait laissées ouvertes, et qui sont
les plus silencieuses de toutes :

- une **recette non classée**. Un crédit de 2 100 € peut être un salaire, le
  remboursement de quelque chose déjà compté comme dépense, ou le retour du propre
  virement du foyer. Les trois disent des choses complètement différentes sur
  l'argent réellement disponible ;
- un **mouvement interne sans contrepartie**. Un mouvement interne est exclu des
  dépenses *sur la promesse* que l'argent réapparaît ailleurs. Contrepartie
  manquante = promesse rompue = quelques centaines d'euros sortis du monde suivi
  sans que rien ne les explique.

Et les heuristiques de `rules.py`, qui doivent rester des **valeurs de départ** :
une devinette appliquée comme vérité sur `is_internal` fait disparaître une vraie
dépense des totaux, en silence.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest

from banking.compliance import get_detector, open_findings, summary
from banking.dedup import compute_dedup_hash
from banking.detectors import INFLOW_UNCLASSIFIED, INTERNAL_WITHOUT_COUNTERPART
from banking.models import (
    BankAccount,
    BankTransaction,
    ImportStatus,
    InflowNature,
    StatementImport,
    TransactionDirection,
)
from banking.rules import guess_inflow_nature, guess_internal
from banking.services import create_manual_transaction, record_cash_withdrawal

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_txn(account, *, amount, booked_on=date(2026, 3, 10), label="VIREMENT", **extra):
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
    account = BankAccountFactory(
        household=household, name="Courant", opening_balance_date=date(2026, 1, 1)
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


def group(household, kind):
    return next(g for g in summary(household) if g.spec.kind == kind)


# --- Les heuristiques ---------------------------------------------------------


class TestGuessInternal:
    def test_recognises_an_atm_withdrawal(self):
        assert guess_internal("RETRAIT DAB 12 RUE X", amount=Decimal("-60.00")) is True

    def test_recognises_an_internal_transfer(self):
        assert guess_internal("VIREMENT INTERNE", amount=Decimal("-500.00")) is True

    def test_returns_false_on_anything_unrecognised(self):
        """Le défaut sûr. Un mouvement interne non flaggé remonte comme sortie non
        affectée — donc l'utilisateur en est informé ; une vraie dépense flaggée à
        tort disparaîtrait des totaux sans un mot."""
        assert guess_internal("CB LECLERC", amount=Decimal("-42.00")) is False

    def test_outflow_patterns_do_not_apply_to_an_inflow(self):
        """« RETRAIT DAB » en crédit n'existe pas ; l'appliquer quand même serait
        deviner au hasard."""
        assert guess_internal("RETRAIT DAB", amount=Decimal("60.00")) is False

    def test_matching_is_case_insensitive(self):
        assert guess_internal("retrait dab", amount=Decimal("-60.00")) is True


class TestGuessInflowNature:
    @pytest.mark.parametrize(
        "label,expected",
        [
            ("VIREMENT SALAIRE MARS", "salary"),
            ("PAIE FEVRIER", "salary"),
            ("REMBOURSEMENT MUTUELLE", "refund"),
            ("VIREMENT INTERNE", "transfer"),
        ],
    )
    def test_recognises_the_common_cases(self, label, expected):
        assert guess_inflow_nature(label) == expected

    def test_returns_empty_rather_than_other_when_unrecognised(self):
        """``other`` est un **choix** de l'utilisateur (« cette recette n'a pas de
        catégorie qui compte ») ; vide veut dire « personne n'a regardé ». Confondre
        les deux rendrait le détecteur aveugle."""
        assert guess_inflow_nature("VIR M DUPONT") == ""


# --- Détecteur : recette non classée ------------------------------------------


@pytest.mark.django_db
class TestUnclassifiedInflow:
    def test_an_unclassified_receipt_is_an_ecart(self, ctx):
        household, _, account = ctx
        txn = make_txn(account, amount="2100.00", label="VIR M DUPONT")

        findings = open_findings(household, get_detector(INFLOW_UNCLASSIFIED))
        assert [f.object_id for f in findings] == [str(txn.pk)]

    def test_it_disappears_once_classified(self, ctx):
        household, _, account = ctx
        txn = make_txn(account, amount="2100.00", label="VIR M DUPONT")

        txn.inflow_nature = InflowNature.SALARY
        txn.save(update_fields=["inflow_nature"])

        assert group(household, INFLOW_UNCLASSIFIED).detected == 0

    def test_other_counts_as_classified(self, ctx):
        """C'est une décision de l'utilisateur, pas une absence de décision."""
        household, _, account = ctx
        txn = make_txn(account, amount="30.00", label="VIR X")
        txn.inflow_nature = InflowNature.OTHER
        txn.save(update_fields=["inflow_nature"])

        assert group(household, INFLOW_UNCLASSIFIED).detected == 0

    def test_an_outflow_is_never_this_ecart(self, ctx):
        household, _, account = ctx
        make_txn(account, amount="-42.00", label="CB LECLERC")
        assert group(household, INFLOW_UNCLASSIFIED).detected == 0

    def test_an_internal_movement_is_excluded(self, ctx):
        """Un virement dit déjà ce qu'il est ; son propre détecteur vérifie qu'il a
        une contrepartie."""
        household, _, account = ctx
        make_txn(account, amount="500.00", label="VIREMENT INTERNE", is_internal=True)
        assert group(household, INFLOW_UNCLASSIFIED).detected == 0

    def test_a_receipt_outside_the_window_is_not_an_ecart(self, ctx):
        household, _, account = ctx
        make_txn(account, amount="2100.00", booked_on=date(2025, 6, 1), label="VIR ANCIEN")
        assert group(household, INFLOW_UNCLASSIFIED).detected == 0


# --- Détecteur : mouvement interne sans contrepartie --------------------------


@pytest.mark.django_db
class TestInternalWithoutCounterpart:
    def test_an_internal_movement_alone_is_an_ecart(self, ctx):
        household, _, account = ctx
        txn = make_txn(account, amount="-60.00", label="RETRAIT DAB", is_internal=True)

        findings = open_findings(household, get_detector(INTERNAL_WITHOUT_COUNTERPART))
        assert [f.object_id for f in findings] == [str(txn.pk)]

    def test_declaring_the_counterpart_resolves_it(self, ctx):
        household, user, account = ctx
        cash = BankAccountFactory(
            household=household,
            name="Espèces",
            kind=BankAccount.Kind.CASH,
            bank_label="",
            opening_balance_date=date(2026, 1, 1),
        )
        txn = make_txn(account, amount="-60.00", label="RETRAIT DAB", is_internal=True)
        assert group(household, INTERNAL_WITHOUT_COUNTERPART).detected == 1

        record_cash_withdrawal(user=user, transaction=txn, cash_account=cash)

        assert group(household, INTERNAL_WITHOUT_COUNTERPART).detected == 0

    def test_a_non_internal_line_is_not_this_ecart(self, ctx):
        household, _, account = ctx
        make_txn(account, amount="-60.00", label="CB LECLERC")
        assert group(household, INTERNAL_WITHOUT_COUNTERPART).detected == 0

    def test_unflagging_the_line_also_resolves_it(self, ctx):
        """L'autre issue légitime : ce n'était pas un mouvement interne."""
        household, _, account = ctx
        txn = make_txn(account, amount="-60.00", label="RETRAIT DAB", is_internal=True)
        txn.is_internal = False
        txn.save(update_fields=["is_internal"])

        assert group(household, INTERNAL_WITHOUT_COUNTERPART).detected == 0

    def test_an_internal_movement_is_not_an_unallocated_outflow(self, ctx):
        """Les deux détecteurs ne doivent pas compter la même ligne deux fois."""
        from banking.detectors import TRANSACTION_UNALLOCATED

        household, _, account = ctx
        make_txn(account, amount="-60.00", label="RETRAIT DAB", is_internal=True)

        assert group(household, TRANSACTION_UNALLOCATED).detected == 0
        assert group(household, INTERNAL_WITHOUT_COUNTERPART).detected == 1


# --- Le taux de couverture ----------------------------------------------------


@pytest.mark.django_db
class TestCoverageRatio:
    def test_nothing_spent_is_full_coverage(self, ctx):
        """Rien sorti = rien à expliquer. Renvoyer 0 serait un reproche adressé à
        tort."""
        from banking.aggregations import compute_account_flow

        household, _, _ = ctx
        flow = compute_account_flow(household=household)
        assert flow["coverage_ratio"] == 1.0
        assert flow["unallocated_outflow"] == "0.00"

    def test_an_unallocated_outflow_lowers_it(self, ctx):
        from banking.aggregations import compute_account_flow

        household, _, account = ctx
        make_txn(account, amount="-100.00", label="CB A")

        flow = compute_account_flow(household=household)
        assert flow["unallocated_outflow"] == "100.00"
        assert flow["coverage_ratio"] == 0.0

    def test_allocating_half_gives_half_coverage(self, ctx):
        from banking.aggregations import compute_account_flow
        from banking.services import set_allocations

        household, user, account = ctx
        txn = make_txn(account, amount="-100.00", label="CB A")
        set_allocations(
            household=household,
            user=user,
            transaction=txn,
            lines=[{"amount": "50.00", "subject": "Moitié"}],
        )

        flow = compute_account_flow(household=household)
        assert flow["unallocated_outflow"] == "50.00"
        assert flow["coverage_ratio"] == 0.5

    def test_internal_movements_are_out_of_the_ratio(self, ctx):
        """Ils ne sont pas des dépenses : les compter ferait un ratio impossible à
        atteindre."""
        from banking.aggregations import compute_account_flow

        household, _, account = ctx
        make_txn(account, amount="-60.00", label="RETRAIT DAB", is_internal=True)

        flow = compute_account_flow(household=household)
        assert flow["coverage_ratio"] == 1.0
        assert flow["internal_count"] == 1


# --- L'import applique les heuristiques comme valeurs de départ ---------------


@pytest.mark.django_db
class TestManualLinesGetNoGuess:
    def test_a_manual_line_is_not_guessed_internal(self, ctx):
        """La saisie manuelle passe par un autre service : elle dit ce qu'elle est,
        il n'y a rien à deviner."""
        household, user, account = ctx
        txn = create_manual_transaction(
            household=household,
            user=user,
            account=account,
            booked_on=date(2026, 3, 10),
            label="RETRAIT DAB",
            amount=Decimal("-60.00"),
        )
        assert txn.is_internal is False
        assert txn.inflow_nature == ""
