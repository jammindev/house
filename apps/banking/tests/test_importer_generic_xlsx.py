# banking/tests/test_importer_generic_xlsx.py
"""The generic XLSX adapter.

Same mapping contract as the CSV one — only row production differs. The point of
these tests is that openpyxl hands us **real** date and numeric cells, so the
string-mangling guesswork is bypassed entirely.
"""
from __future__ import annotations

import io
from datetime import date, datetime
from decimal import Decimal

import openpyxl
import pytest

from banking.importers import get_importer
from banking.importers.base import ImporterError

IMPORTER = get_importer("generic_xlsx")

MAPPING = {
    "date_column": "Date",
    "label_column": "Libelle",
    "amount_column": "Montant",
}


def build_xlsx(rows: list[list], sheet_title: str = "Operations") -> bytes:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = sheet_title
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


class TestGenericXlsx:
    def test_detects_the_zip_magic(self):
        """Unlike CSV, an XLSX can only be read one way — claiming it is safe."""
        raw = build_xlsx([["Date", "Libelle", "Montant"]])
        assert IMPORTER.detect(raw) is True
        assert IMPORTER.detect(b"Date;Libelle;Montant\n") is False

    def test_native_date_and_number_cells(self):
        raw = build_xlsx(
            [
                ["Date", "Libelle", "Montant"],
                [datetime(2026, 7, 12), "CB LECLERC", -32.5],
                [datetime(2026, 7, 14), "VIR SALAIRE", 2100],
            ]
        )
        rows = IMPORTER.parse(raw, options=MAPPING)
        assert len(rows) == 2
        assert rows[0].booked_on == date(2026, 7, 12)
        assert rows[0].amount == Decimal("-32.5")
        assert rows[1].amount == Decimal("2100")

    def test_string_cells_still_work(self):
        raw = build_xlsx(
            [["Date", "Libelle", "Montant"], ["12/07/2026", "CB LECLERC", "-32,50"]]
        )
        rows = IMPORTER.parse(raw, options=MAPPING)
        assert rows[0].booked_on == date(2026, 7, 12)
        assert rows[0].amount == Decimal("-32.50")

    def test_preamble_is_tolerated(self):
        raw = build_xlsx(
            [
                ["Releve de compte"],
                ["Titulaire : M. DUPONT"],
                [],
                ["Date", "Libelle", "Montant"],
                [datetime(2026, 7, 12), "CB LECLERC", -32.5],
            ]
        )
        rows = IMPORTER.parse(raw, options=MAPPING)
        assert len(rows) == 1

    def test_named_sheet_can_be_selected(self):
        raw = build_xlsx(
            [["Date", "Libelle", "Montant"], [datetime(2026, 7, 12), "X", -1]],
            sheet_title="Export",
        )
        rows = IMPORTER.parse(raw, options={**MAPPING, "sheet": "Export"})
        assert len(rows) == 1

    def test_unknown_sheet_is_reported_with_the_available_ones(self):
        raw = build_xlsx([["Date", "Libelle", "Montant"]], sheet_title="Export")
        with pytest.raises(ImporterError, match="Export"):
            IMPORTER.parse(raw, options={**MAPPING, "sheet": "Nope"})

    def test_corrupt_file_is_rejected_cleanly(self):
        with pytest.raises(ImporterError):
            IMPORTER.parse(b"PK\x03\x04 not really a zip", options=MAPPING)

    def test_columns_preview(self):
        raw = build_xlsx([["Date", "Libelle", "Montant", "Solde"]])
        assert IMPORTER.columns(raw) == ["Date", "Libelle", "Montant", "Solde"]

    def test_sample_lines_render_rows(self):
        raw = build_xlsx(
            [["Date", "Libelle", "Montant"], [datetime(2026, 7, 12), "CB LECLERC", -32.5]]
        )
        lines = IMPORTER.sample_lines(raw)
        assert "Date | Libelle | Montant" == lines[0]
        assert "CB LECLERC" in lines[1]
