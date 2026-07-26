"""Importer contract: a bank export in, normalized transactions out.

Decalqued from ``apps/electricity/importers/base.py`` — same philosophy, same
guarantees. One adapter per **file format**, never per bank: the generic CSV/XLSX
adapters let the user map their own columns, and that mapping is remembered on
the account (``BankAccount.import_options``), so the N-th bank costs a mapping
form, not a pull request.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from decimal import Decimal


class ImporterError(Exception):
    """Base error for importer failures (message is user-facing)."""


class ImporterFormatError(ImporterError):
    """The file does not match the expected format."""


def decode_text(raw: bytes) -> str:
    """Decode a text-based statement: UTF-8 (BOM tolerated), latin-1 fallback."""
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


@dataclass(frozen=True)
class NormalizedTransaction:
    """One statement line in pivot shape — what every adapter produces.

    ``amount`` is **signed**: negative is money leaving the account. That sign is
    the single source of truth for ``BankTransaction.direction``.

    ``balance_after`` matters far beyond display: when the bank exports a running
    balance, it is the best deduplication discriminant there is (two identical
    operations on the same day necessarily have different running balances) and
    it powers the balance-chain check of lot 4. Always map it when available.
    """

    booked_on: date
    label_raw: str
    amount: Decimal
    currency: str = "EUR"
    value_on: date | None = None
    balance_after: Decimal | None = None
    external_id: str = ""
    #: 1-based row position in the source file. Carried through to
    #: ``BankTransaction.line_no``: two operations booked the same day must keep
    #: the statement's own order for the balance chain check to make sense.
    line_no: int = 0


class BaseStatementImporter(ABC):
    """One statement file format.

    ``parse`` must validate the WHOLE file before the caller writes anything — a
    bad line raises ``ImporterError`` carrying its line number, never a silent
    partial import. That contract is what lets the service turn a parse failure
    into a clean "failed" trace with zero rows written.
    """

    key: str
    label: str

    @abstractmethod
    def detect(self, raw: bytes) -> bool:
        """Cheap check on the raw bytes: is this my format?"""

    @abstractmethod
    def parse(self, raw: bytes, *, options: dict | None = None) -> list[NormalizedTransaction]:
        """Turn the full file into normalized transactions.

        ``options`` carries the user-provided column mapping for configurable
        formats (see ``generic_csv``).
        """

    def columns(self, raw: bytes, *, options: dict | None = None) -> list[str]:
        """Column names found in the file, to populate the mapping form."""
        return []

    def sample_lines(self, raw: bytes) -> list[str]:
        """First lines, for the import-dialog preview.

        Text default; binary formats override to render rows.
        """
        return decode_text(raw).lstrip("﻿").splitlines()[:10]
