# banking/tests/test_importer_generic_csv.py
"""The generic CSV adapter — what makes the app bank-agnostic.

Each test encodes a shape a real French bank export uses. No DB: the adapter's
only job is file bytes in, normalized transactions out.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from banking.importers import get_importer
from banking.importers.base import ImporterError

IMPORTER = get_importer("generic_csv")

SIGNED_MAPPING = {
    "date_column": "Date",
    "label_column": "Libelle",
    "amount_column": "Montant",
}

CSV_SIGNED = """Date;Libelle;Montant;Solde
12/07/2026;CB LECLERC;-32,50;1 234,56
14/07/2026;VIR SALAIRE;2 100,00;3 334,56
"""

CSV_DEBIT_CREDIT = """Date;Libelle;Debit;Credit
12/07/2026;CB LECLERC;32,50;
14/07/2026;VIR SALAIRE;;2100,00
"""

CSV_WITH_PREAMBLE = """Releve de compte
Titulaire : M. DUPONT
Compte : ****1234
Periode : 01/07/2026 - 31/07/2026

Edite le 01/08/2026
Date;Libelle;Montant
12/07/2026;CB LECLERC;-32,50
"""


def parse(body: str, mapping: dict | None = None, **options):
    return IMPORTER.parse(body.encode("utf-8"), options={**(mapping or SIGNED_MAPPING), **options})


class TestSignedAmountColumn:
    def test_parses_signs_and_spaces(self):
        rows = parse(CSV_SIGNED)
        assert len(rows) == 2
        assert rows[0].booked_on == date(2026, 7, 12)
        assert rows[0].label_raw == "CB LECLERC"
        assert rows[0].amount == Decimal("-32.50")
        assert rows[1].amount == Decimal("2100.00")

    def test_balance_column_is_picked_up(self):
        """The running balance is the best dedup discriminant — map it."""
        rows = parse(CSV_SIGNED, balance_column="Solde")
        assert rows[0].balance_after == Decimal("1234.56")

    def test_balance_is_none_when_not_mapped(self):
        assert parse(CSV_SIGNED)[0].balance_after is None

    def test_invert_sign_flips_the_whole_file(self):
        rows = parse(CSV_SIGNED, invert_sign=True)
        assert rows[0].amount == Decimal("32.50")
        assert rows[1].amount == Decimal("-2100.00")


class TestDebitCreditColumns:
    def test_debit_becomes_negative_credit_positive(self):
        rows = parse(
            CSV_DEBIT_CREDIT,
            {
                "date_column": "Date",
                "label_column": "Libelle",
                "debit_column": "Debit",
                "credit_column": "Credit",
            },
        )
        assert rows[0].amount == Decimal("-32.50")
        assert rows[1].amount == Decimal("2100.00")

    def test_rejects_a_row_with_both_filled(self):
        body = "Date;Libelle;Debit;Credit\n12/07/2026;X;10,00;20,00\n"
        with pytest.raises(ImporterError, match="line 2"):
            parse(
                body,
                {
                    "date_column": "Date",
                    "label_column": "Libelle",
                    "debit_column": "Debit",
                    "credit_column": "Credit",
                },
            )

    def test_rejects_a_row_with_neither_filled(self):
        body = "Date;Libelle;Debit;Credit\n12/07/2026;X;;\n"
        with pytest.raises(ImporterError, match="line 2"):
            parse(
                body,
                {
                    "date_column": "Date",
                    "label_column": "Libelle",
                    "debit_column": "Debit",
                    "credit_column": "Credit",
                },
            )


class TestFileShapes:
    def test_preamble_before_the_header_is_tolerated(self):
        """Banks put a logo/holder/period block above the table."""
        rows = parse(CSV_WITH_PREAMBLE)
        assert len(rows) == 1
        assert rows[0].amount == Decimal("-32.50")

    def test_explicit_skip_rows_wins(self):
        rows = parse(CSV_WITH_PREAMBLE, skip_rows=6)
        assert len(rows) == 1

    def test_comma_delimiter_is_sniffed(self):
        rows = parse("Date,Libelle,Montant\n12/07/2026,CB LECLERC,-32.50\n")
        assert rows[0].amount == Decimal("-32.50")

    def test_tab_delimiter_is_sniffed(self):
        rows = parse("Date\tLibelle\tMontant\n12/07/2026\tCB LECLERC\t-32,50\n")
        assert rows[0].amount == Decimal("-32.50")

    def test_utf8_bom_is_stripped(self):
        raw = "﻿Date;Libelle;Montant\n12/07/2026;CAFÉ;-3,50\n".encode("utf-8")
        rows = IMPORTER.parse(raw, options=SIGNED_MAPPING)
        assert rows[0].label_raw == "CAFÉ"

    def test_latin1_is_decoded(self):
        raw = "Date;Libelle;Montant\n12/07/2026;CAFÉ;-3,50\n".encode("latin-1")
        rows = IMPORTER.parse(raw, options=SIGNED_MAPPING)
        assert rows[0].label_raw == "CAFÉ"

    def test_blank_lines_are_skipped(self):
        rows = parse("Date;Libelle;Montant\n12/07/2026;X;-1,00\n\n\n13/07/2026;Y;-2,00\n")
        assert len(rows) == 2


class TestValidation:
    def test_never_self_detects(self):
        """A CSV says nothing about which column is the amount."""
        assert IMPORTER.detect(CSV_SIGNED.encode("utf-8")) is False

    def test_requires_a_mapping(self):
        with pytest.raises(ImporterError, match="required"):
            IMPORTER.parse(CSV_SIGNED.encode("utf-8"), options={})

    def test_rejects_both_amount_and_debit_credit(self):
        with pytest.raises(ImporterError, match="not both"):
            parse(CSV_SIGNED, debit_column="Debit", credit_column="Credit")

    def test_unknown_column_names_the_available_ones(self):
        with pytest.raises(ImporterError, match="Montant"):
            parse(CSV_SIGNED, {"date_column": "Date", "label_column": "Libelle", "amount_column": "Nope"})

    def test_unreadable_line_reports_its_number(self):
        body = "Date;Libelle;Montant\n12/07/2026;OK;-1,00\n13/07/2026;BAD;abc\n"
        with pytest.raises(ImporterError, match="line 3"):
            parse(body)

    def test_zero_amount_is_rejected(self):
        with pytest.raises(ImporterError, match="line 2"):
            parse("Date;Libelle;Montant\n12/07/2026;X;0,00\n")

    def test_empty_file(self):
        with pytest.raises(ImporterError):
            parse("")

    def test_header_only_file(self):
        with pytest.raises(ImporterError, match="no transaction"):
            parse("Date;Libelle;Montant\n")


class TestColumnsPreview:
    def test_lists_header_names_for_the_mapping_form(self):
        assert IMPORTER.columns(CSV_SIGNED.encode("utf-8")) == [
            "Date",
            "Libelle",
            "Montant",
            "Solde",
        ]

    def test_finds_the_header_under_a_preamble(self):
        assert IMPORTER.columns(CSV_WITH_PREAMBLE.encode("utf-8")) == [
            "Date",
            "Libelle",
            "Montant",
        ]
