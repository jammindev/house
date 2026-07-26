"""Generic CSV statement importer — the adapter that makes the app bank-agnostic.

No bank assumption whatsoever: the user maps their own columns once, and the
mapping is remembered on the account. Options (see ``mapping.build_mapping``):

- ``date_column``, ``label_column`` (required)
- ``amount_column`` **or** ``debit_column`` + ``credit_column`` (required)
- ``balance_column``, ``reference_column``, ``value_date_column`` (optional but
  worth mapping — the balance is the best dedup discriminant there is)
- ``date_format``, ``decimal_separator``, ``currency``, ``invert_sign``
- ``delimiter`` (sniffed among ``;`` ``,`` and tab otherwise)
- ``skip_rows`` (header row index; auto-detected otherwise)
"""
from __future__ import annotations

import csv
import io

from .base import BaseStatementImporter, ImporterError, NormalizedTransaction, decode_text
from .mapping import build_mapping, find_header_row, rows_to_transactions
from .registry import register


def _sniff_delimiter(body: str) -> str:
    first_lines = body.splitlines()[:20]
    scores = {candidate: sum(line.count(candidate) for line in first_lines) for candidate in (";", ",", "\t")}
    best = max(scores, key=lambda c: scores[c])
    return best if scores[best] else ";"


def _read_rows(raw: bytes, options: dict | None) -> list[list[str]]:
    options = options or {}
    body = decode_text(raw).lstrip("﻿")
    if not body.strip():
        raise ImporterError("empty file")
    delimiter = str(options.get("delimiter") or "") or _sniff_delimiter(body)
    return [row for row in csv.reader(io.StringIO(body), delimiter=delimiter)]


class GenericStatementCsvImporter(BaseStatementImporter):
    key = "generic_csv"
    label = "CSV générique (mapping manuel)"

    def detect(self, raw: bytes) -> bool:
        # Never auto-detected: a CSV says nothing about which column is the
        # amount. Requires an explicit user mapping.
        return False

    def parse(self, raw: bytes, *, options: dict | None = None) -> list[NormalizedTransaction]:
        mapping = build_mapping(options)
        rows = _read_rows(raw, options)

        skip_rows = (options or {}).get("skip_rows")
        header_index = find_header_row(
            rows, mapping, skip_rows=int(skip_rows) if skip_rows is not None else None
        )
        return rows_to_transactions(
            rows[header_index],
            rows[header_index + 1 :],
            mapping,
            # +2: 1-based line numbers, and the header itself.
            first_line_no=header_index + 2,
        )

    def columns(self, raw: bytes, *, options: dict | None = None) -> list[str]:
        """Header candidates for the mapping form.

        The mapping isn't known yet at preview time, so the header row can't be
        found by its column names: we return the widest of the first rows, which
        is the header in every export shape seen so far.
        """
        rows = _read_rows(raw, options)
        if not rows:
            return []
        candidate = max(rows[: len(rows) if len(rows) < 30 else 30], key=len)
        return [str(cell or "").strip() for cell in candidate if str(cell or "").strip()]


register(GenericStatementCsvImporter())
