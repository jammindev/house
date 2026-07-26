# banking/tests/test_parsing.py
"""Value parsing — amounts, dates, labels.

No DB here: this is pure logic, and it is where a bug puts a wrong amount in the
household's accounts. Every case below comes from a shape real bank exports use.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

import pytest

from banking.importers.base import ImporterError
from banking.importers.parsing import normalize_label, parse_amount, parse_date


class TestParseAmount:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("12.50", "12.50"),
            ("12,50", "12.50"),
            ("-32,50", "-32.50"),
            ("+32,50", "32.50"),
            ("1 234,56", "1234.56"),          # plain space
            ("1 234,56", "1234.56"),      # NBSP — the usual French export
            ("1 234,56", "1234.56"),      # narrow NBSP
            ("1.234,56", "1234.56"),           # European thousands
            ("1,234.56", "1234.56"),           # anglo thousands
            ("(1 234,56)", "-1234.56"),        # accounting parentheses
            ("32,50-", "-32.50"),              # trailing minus
            ("1 234,56 €", "1234.56"),
            ("EUR 89,90", "89.90"),
            ("  12,00  ", "12.00"),
        ],
    )
    def test_real_world_shapes(self, raw, expected):
        assert parse_amount(raw) == Decimal(expected)

    def test_accepts_native_numeric_cells(self):
        """XLSX gives real numbers — no string mangling needed."""
        assert parse_amount(-32.5) == Decimal("-32.5")
        assert parse_amount(Decimal("89.90")) == Decimal("89.90")

    def test_explicit_separator_removes_the_ambiguity(self):
        """`1,500` is 1.5 in France and 1500 in the US — the mapping decides."""
        assert parse_amount("1,500", decimal_separator=",") == Decimal("1.500")
        assert parse_amount("1,500", decimal_separator=".") == Decimal("1500")

    def test_defaults_to_comma_as_decimal(self):
        """Documented default, right for the European exports this targets."""
        assert parse_amount("1,500") == Decimal("1.500")

    @pytest.mark.parametrize("raw", ["", "   ", "abc", "12,3,4,5x"])
    def test_rejects_unreadable(self, raw):
        with pytest.raises(ImporterError):
            parse_amount(raw)


class TestParseDate:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("12/07/2026", date(2026, 7, 12)),
            ("12-07-2026", date(2026, 7, 12)),
            ("12.07.2026", date(2026, 7, 12)),
            ("2026-07-12", date(2026, 7, 12)),
            ("2026/07/12", date(2026, 7, 12)),
        ],
    )
    def test_common_formats(self, raw, expected):
        assert parse_date(raw) == expected

    def test_accepts_native_date_cells(self):
        assert parse_date(datetime(2026, 7, 12, 14, 30)) == date(2026, 7, 12)
        assert parse_date(date(2026, 7, 12)) == date(2026, 7, 12)

    def test_explicit_format_disambiguates_day_and_month(self):
        """`01/02/2026` is 1 Feb in France and 2 Jan in the US."""
        assert parse_date("01/02/2026", fmt="%d/%m/%Y") == date(2026, 2, 1)
        assert parse_date("01/02/2026", fmt="%m/%d/%Y") == date(2026, 1, 2)

    @pytest.mark.parametrize("raw", ["", "   ", "not a date", "32/13/2026"])
    def test_rejects_unreadable(self, raw):
        with pytest.raises(ImporterError):
            parse_date(raw)


class TestNormalizeLabel:
    def test_strips_diacritics_and_uppercases(self):
        assert normalize_label("Café Crème") == "CAFE CREME"

    def test_collapses_whitespace(self):
        assert normalize_label("  CB   LECLERC  ") == "CB LECLERC"

    def test_keeps_digits_and_slashes(self):
        """The card reference is often the only discriminant between two lines."""
        assert normalize_label("CB LECLERC 12/07 123456") == "CB LECLERC 12/07 123456"

    def test_drops_other_punctuation(self):
        assert normalize_label("VIR. SEPA - M. DUPONT (loyer)") == "VIR SEPA M DUPONT LOYER"

    def test_handles_empty(self):
        assert normalize_label("") == ""
        assert normalize_label(None) == ""
