# banking/tests/test_continuity.py
"""Continuité des relevés (parcours 26, lot 7).

Deux angles morts que rien d'autre ne voit :

- **une période que personne n'a jamais importée.** Le contrôle de chaîne attrape
  les opérations manquantes *à l'intérieur* d'une période importée, par
  l'arithmétique des soldes. Un février jamais déposé, lui, ne laisse aucune trace
  arithmétique — seulement un trou dans le calendrier ;
- **des lignes ignorées là où la recette de dédup ne peut pas être crue.**
  `skipped_count > 0` est normalement la bonne nouvelle (c'est à quoi ressemble un
  ré-import). Ça devient un avertissement **seulement** sur un fichier sans
  référence ni solde, parce que c'est exactement la limite documentée du
  `dedup_hash` : le discriminant retombe sur l'index d'occurrence dans le fichier.
"""
from __future__ import annotations

import itertools
from datetime import date
from decimal import Decimal

import pytest

from banking.compliance import get_detector, open_findings, summary
from banking.dedup import compute_dedup_hash
from banking.detectors import IMPORT_SKIPPED_LINES, STATEMENT_PERIOD_GAP
from banking.models import (
    BankTransaction,
    ImportStatus,
    StatementImport,
    TransactionDirection,
)

from .factories import BankAccountFactory, HouseholdFactory, UserFactory

_counter = itertools.count()


def make_import(account, *, start, end, status=ImportStatus.COMPLETED, skipped=0, filename="r.csv"):
    return StatementImport.objects.create(
        household=account.household,
        account=account,
        provider="generic_csv",
        filename=filename,
        status=status,
        period_start=start,
        period_end=end,
        skipped_count=skipped,
    )


def make_txn(account, *, imported=None, booked_on=date(2026, 1, 5), **extra):
    label = extra.pop("label", "CB TEST")
    value = Decimal(extra.pop("amount", "-10.00"))
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
        source_import=imported,
        **extra,
    )


@pytest.fixture
def ctx(db):
    household = HouseholdFactory()
    account = BankAccountFactory(
        household=household, name="Courant", opening_balance_date=date(2026, 1, 1)
    )
    return household, UserFactory(), account


def group(household, kind):
    return next(g for g in summary(household) if g.spec.kind == kind)


@pytest.mark.django_db
class TestPeriodGap:
    def test_a_missing_month_is_an_ecart(self, ctx):
        household, _, account = ctx
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_import(account, start=date(2026, 3, 1), end=date(2026, 3, 31))

        findings = open_findings(household, get_detector(STATEMENT_PERIOD_GAP))
        assert [f.object_id for f in findings] == [str(account.pk)]
        assert findings[0].detail["gaps"][0]["gap_start"] == "2026-02-01"
        assert findings[0].detail["gaps"][0]["gap_end"] == "2026-02-28"

    def test_contiguous_periods_are_fine(self, ctx):
        household, _, account = ctx
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_import(account, start=date(2026, 2, 1), end=date(2026, 2, 28))

        assert group(household, STATEMENT_PERIOD_GAP).detected == 0

    def test_overlapping_periods_are_fine(self, ctx):
        """Ré-importer un mois est la façon normale de rattraper — seul un trou
        strictement positif est signalé."""
        household, _, account = ctx
        make_import(account, start=date(2026, 1, 1), end=date(2026, 2, 15))
        make_import(account, start=date(2026, 2, 1), end=date(2026, 3, 31))

        assert group(household, STATEMENT_PERIOD_GAP).detected == 0

    def test_a_single_import_cannot_have_a_gap(self, ctx):
        household, _, account = ctx
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        assert group(household, STATEMENT_PERIOD_GAP).detected == 0

    def test_a_failed_import_does_not_bridge_a_gap(self, ctx):
        """Un import échoué n'a rien écrit ; prétendre couvrir sa période serait un
        mensonge."""
        household, _, account = ctx
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_import(
            account, start=date(2026, 2, 1), end=date(2026, 2, 28), status=ImportStatus.FAILED
        )
        make_import(account, start=date(2026, 3, 1), end=date(2026, 3, 31))

        assert group(household, STATEMENT_PERIOD_GAP).detected == 1

    def test_importing_the_hole_resolves_it(self, ctx):
        household, _, account = ctx
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_import(account, start=date(2026, 3, 1), end=date(2026, 3, 31))
        assert group(household, STATEMENT_PERIOD_GAP).detected == 1

        make_import(account, start=date(2026, 2, 1), end=date(2026, 2, 28))

        assert group(household, STATEMENT_PERIOD_GAP).detected == 0

    def test_an_archived_account_is_not_checked(self, ctx):
        household, _, account = ctx
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_import(account, start=date(2026, 3, 1), end=date(2026, 3, 31))
        account.archived = True
        account.save(update_fields=["archived"])

        assert group(household, STATEMENT_PERIOD_GAP).detected == 0

    def test_it_can_be_arbitrated(self, ctx):
        from banking.services import waive_finding

        household, user, account = ctx
        make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_import(account, start=date(2026, 3, 1), end=date(2026, 3, 31))

        waive_finding(
            household=household,
            user=user,
            finding_kind=STATEMENT_PERIOD_GAP,
            object_id=str(account.pk),
            reason="pas d'opération sur la période",
        )

        result = group(household, STATEMENT_PERIOD_GAP)
        assert (result.open, result.waived) == (0, 1)


@pytest.mark.django_db
class TestSkippedLines:
    def test_skipped_lines_on_a_bare_file_is_an_ecart(self, ctx):
        household, _, account = ctx
        imported = make_import(
            account, start=date(2026, 1, 1), end=date(2026, 1, 31), skipped=3
        )
        make_txn(account, imported=imported)

        findings = open_findings(household, get_detector(IMPORT_SKIPPED_LINES))
        assert [f.object_id for f in findings] == [str(imported.pk)]
        assert findings[0].detail["skipped_count"] == 3

    def test_no_skipped_lines_is_not_an_ecart(self, ctx):
        household, _, account = ctx
        imported = make_import(account, start=date(2026, 1, 1), end=date(2026, 1, 31))
        make_txn(account, imported=imported)

        assert group(household, IMPORT_SKIPPED_LINES).detected == 0

    def test_a_file_with_references_is_trusted(self, ctx):
        """Une référence bancaire est un discriminant parfait : `skipped_count` y est
        la bonne nouvelle d'un ré-import, pas un doute."""
        household, _, account = ctx
        imported = make_import(
            account, start=date(2026, 1, 1), end=date(2026, 1, 31), skipped=3
        )
        make_txn(account, imported=imported, external_id="REF123")

        assert group(household, IMPORT_SKIPPED_LINES).detected == 0

    def test_a_file_with_balances_is_trusted(self, ctx):
        """Deux opérations identiques le même jour laissent forcément des soldes
        différents — c'est le truc qui résout le cas difficile."""
        household, _, account = ctx
        imported = make_import(
            account, start=date(2026, 1, 1), end=date(2026, 1, 31), skipped=3
        )
        make_txn(account, imported=imported, balance_after=Decimal("900.00"))

        assert group(household, IMPORT_SKIPPED_LINES).detected == 0

    def test_a_mixed_file_is_trusted(self, ctx):
        """Une seule ligne portant une référence suffit : la colonne existe."""
        household, _, account = ctx
        imported = make_import(
            account, start=date(2026, 1, 1), end=date(2026, 1, 31), skipped=3
        )
        make_txn(account, imported=imported, label="SANS REF")
        make_txn(account, imported=imported, label="AVEC REF", external_id="REF9")

        assert group(household, IMPORT_SKIPPED_LINES).detected == 0

    def test_a_failed_import_is_not_reported(self, ctx):
        household, _, account = ctx
        make_import(
            account,
            start=date(2026, 1, 1),
            end=date(2026, 1, 31),
            skipped=3,
            status=ImportStatus.FAILED,
        )

        assert group(household, IMPORT_SKIPPED_LINES).detected == 0

    def test_it_can_be_arbitrated(self, ctx):
        from banking.services import waive_finding

        household, user, account = ctx
        imported = make_import(
            account, start=date(2026, 1, 1), end=date(2026, 1, 31), skipped=3
        )
        make_txn(account, imported=imported)

        waive_finding(
            household=household,
            user=user,
            finding_kind=IMPORT_SKIPPED_LINES,
            object_id=str(imported.pk),
            reason="doublons confirmés",
        )

        result = group(household, IMPORT_SKIPPED_LINES)
        assert (result.open, result.waived) == (0, 1)
