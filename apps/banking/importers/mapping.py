"""Column mapping — shared by every tabular statement adapter.

CSV and XLSX differ only in how they produce a header row and data rows; the
mapping, validation and row→transaction logic is identical, so it lives here
once. An adapter's job is reduced to "give me a header and rows".
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .base import ImporterError, NormalizedTransaction
from .parsing import parse_amount, parse_date

# Rows scanned when looking for the header row, so a bank's preamble (logo,
# account holder, period…) doesn't have to be counted by hand.
HEADER_SCAN_LIMIT = 30


@dataclass(frozen=True)
class Mapping:
    """User-supplied column mapping, validated once before any row is read."""

    date_column: str
    label_column: str
    amount_column: str = ""
    debit_column: str = ""
    credit_column: str = ""
    balance_column: str = ""
    reference_column: str = ""
    value_date_column: str = ""
    date_format: str = ""
    decimal_separator: str = ""
    currency: str = "EUR"
    #: Some banks export outflows as positive numbers; flip the whole file.
    invert_sign: bool = False

    @property
    def uses_debit_credit(self) -> bool:
        return bool(self.debit_column or self.credit_column)

    @property
    def required_columns(self) -> list[str]:
        columns = [self.date_column, self.label_column]
        if self.uses_debit_credit:
            columns += [c for c in (self.debit_column, self.credit_column) if c]
        else:
            columns.append(self.amount_column)
        return columns

    @property
    def optional_columns(self) -> list[str]:
        return [
            c
            for c in (self.balance_column, self.reference_column, self.value_date_column)
            if c
        ]


def build_mapping(options: dict | None) -> Mapping:
    """Validate the options **before** the file is read.

    Failing here means the user mis-mapped their columns; failing later means the
    file is bad. Keeping the two apart is what makes the error messages useful.
    """
    options = options or {}
    mapping = Mapping(
        date_column=str(options.get("date_column") or "").strip(),
        label_column=str(options.get("label_column") or "").strip(),
        amount_column=str(options.get("amount_column") or "").strip(),
        debit_column=str(options.get("debit_column") or "").strip(),
        credit_column=str(options.get("credit_column") or "").strip(),
        balance_column=str(options.get("balance_column") or "").strip(),
        reference_column=str(options.get("reference_column") or "").strip(),
        value_date_column=str(options.get("value_date_column") or "").strip(),
        date_format=str(options.get("date_format") or "").strip(),
        decimal_separator=str(options.get("decimal_separator") or "").strip(),
        currency=(str(options.get("currency") or "EUR").strip().upper() or "EUR"),
        invert_sign=bool(options.get("invert_sign")),
    )

    if not mapping.date_column or not mapping.label_column:
        raise ImporterError("date_column and label_column are required")
    if not mapping.amount_column and not mapping.uses_debit_credit:
        raise ImporterError("amount_column, or debit_column + credit_column, is required")
    if mapping.amount_column and mapping.uses_debit_credit:
        raise ImporterError("choose either amount_column or debit_column/credit_column, not both")
    if mapping.uses_debit_credit and not (mapping.debit_column and mapping.credit_column):
        raise ImporterError("debit_column and credit_column must both be provided")
    if mapping.decimal_separator and mapping.decimal_separator not in (",", "."):
        raise ImporterError("decimal_separator must be ',' or '.'")
    if len(mapping.currency) != 3 or not mapping.currency.isalpha():
        raise ImporterError("currency must be a 3-letter code")

    return mapping


def find_header_row(rows: list[list], mapping: Mapping, *, skip_rows: int | None = None) -> int:
    """Index of the header row.

    Explicit ``skip_rows`` wins. Otherwise we scan for the first row containing
    every required column name — that tolerates the preamble blocks banks like to
    put above their tables, without asking the user to count lines.

    When no row matches, we do **not** fail here: we return the widest row of the
    scan window, which is the header in every export shape seen so far. The
    mis-mapped column is then reported by ``rows_to_transactions``, which can name
    the offending column *and* list the ones actually available — by far the most
    common user error deserves the most useful message, not the vaguest.
    """
    if skip_rows is not None:
        if skip_rows < 0 or skip_rows >= len(rows):
            raise ImporterError(f"skip_rows={skip_rows} is out of range for this file")
        return skip_rows

    window = rows[:HEADER_SCAN_LIMIT]
    if not window:
        raise ImporterError("empty file")

    required = set(mapping.required_columns)
    for index, row in enumerate(window):
        cells = {str(cell or "").strip() for cell in row}
        if required.issubset(cells):
            return index

    return max(range(len(window)), key=lambda i: len([c for c in window[i] if str(c or "").strip()]))


def _cell(row: dict, column: str) -> str:
    return str(row.get(column, "") or "").strip()


def _signed_amount(row: dict, mapping: Mapping, line_no: int) -> Decimal:
    """Signed amount for a row, from either a single column or debit/credit."""
    if not mapping.uses_debit_credit:
        raw = _cell(row, mapping.amount_column)
        if not raw:
            raise ImporterError(f"line {line_no}: empty amount")
        return parse_amount(raw, decimal_separator=mapping.decimal_separator or None)

    debit = _cell(row, mapping.debit_column)
    credit = _cell(row, mapping.credit_column)
    if debit and credit:
        raise ImporterError(f"line {line_no}: both debit and credit are filled")
    if not debit and not credit:
        raise ImporterError(f"line {line_no}: neither debit nor credit is filled")

    separator = mapping.decimal_separator or None
    if debit:
        # A debit column holds the magnitude of an outflow: force it negative,
        # whether or not the bank already wrote the minus sign.
        return -abs(parse_amount(debit, decimal_separator=separator))
    return abs(parse_amount(credit, decimal_separator=separator))


def rows_to_transactions(
    header: list[str],
    data_rows: list[list],
    mapping: Mapping,
    *,
    first_line_no: int = 2,
) -> list[NormalizedTransaction]:
    """Turn tabular rows into normalized transactions, validating everything.

    Raises on the first unreadable line (with its number) so the caller can write
    nothing at all — a partially imported statement is worse than none.
    """
    columns = [str(c or "").strip() for c in header]
    missing = [c for c in mapping.required_columns if c not in columns]
    if missing:
        raise ImporterError(
            f"column(s) {', '.join(missing)} not found (columns: {', '.join(columns)})"
        )
    unknown = [c for c in mapping.optional_columns if c not in columns]
    if unknown:
        raise ImporterError(
            f"optional column(s) {', '.join(unknown)} not found (columns: {', '.join(columns)})"
        )

    transactions: list[NormalizedTransaction] = []
    for offset, raw_row in enumerate(data_rows):
        line_no = first_line_no + offset

        if not any(str(cell or "").strip() for cell in raw_row):
            continue  # blank separator line

        row = {columns[i]: raw_row[i] for i in range(min(len(columns), len(raw_row)))}
        try:
            transactions.append(_row_to_transaction(row, mapping, line_no))
        except ImporterError as exc:
            # Every failure must name its line: that number is what lets the user
            # find the offending row in a 300-line export.
            message = str(exc)
            if message.startswith("line "):
                raise
            raise ImporterError(f"line {line_no}: {message}") from exc

    if not transactions:
        raise ImporterError("no transaction found in this file")

    return transactions


def _row_to_transaction(row: dict, mapping: Mapping, line_no: int) -> NormalizedTransaction:
    raw_date = row.get(mapping.date_column)
    if not str(raw_date or "").strip():
        raise ImporterError("empty date")
    booked_on = parse_date(raw_date, fmt=mapping.date_format or None)

    amount = _signed_amount(row, mapping, line_no)
    if mapping.invert_sign:
        amount = -amount
    if amount == 0:
        raise ImporterError("amount is zero")

    value_on = None
    if mapping.value_date_column and _cell(row, mapping.value_date_column):
        value_on = parse_date(
            row.get(mapping.value_date_column), fmt=mapping.date_format or None
        )

    balance_after = None
    if mapping.balance_column and _cell(row, mapping.balance_column):
        balance_after = parse_amount(
            row.get(mapping.balance_column),
            decimal_separator=mapping.decimal_separator or None,
        )

    return NormalizedTransaction(
        booked_on=booked_on,
        label_raw=_cell(row, mapping.label_column)[:500],
        amount=amount,
        currency=mapping.currency,
        value_on=value_on,
        balance_after=balance_after,
        external_id=_cell(row, mapping.reference_column)[:64] if mapping.reference_column else "",
    )
