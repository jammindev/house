"""Shared value parsing for statement adapters — amounts, dates, labels.

Kept out of the adapters because every bank export mangles the same three things
differently, and a bug here is a wrong amount in the household's accounts.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from .base import ImporterError

# Space variants seen in real exports: plain, NBSP, narrow NBSP, thin space.
_SPACES = "     "
# Currency symbols/codes an export may glue to the amount.
_CURRENCY_NOISE = re.compile(r"[€$£]|\b(EUR|USD|GBP|CHF)\b", re.IGNORECASE)

_DATE_FORMATS = (
    "%d/%m/%Y",
    "%d/%m/%y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%m/%d/%Y",
    "%d %m %Y",
)


def parse_amount(text, *, decimal_separator: str | None = None) -> Decimal:
    """Parse a monetary cell into a signed ``Decimal``.

    Handles the real-world zoo: ``1 234,56`` (with any space variant),
    ``1.234,56``, ``1,234.56``, a leading or trailing ``-``, accounting
    parentheses ``(1 234,56)`` meaning negative, and glued currency symbols.

    **Separator inference.** When both ``.`` and ``,`` appear, the *last* one is
    the decimal separator — unambiguous. When only one appears it is ambiguous
    (``1,500`` is 1.5 in France and 1500 in the US); we treat it as the decimal
    separator, which is right for the European exports this targets. Pass
    ``decimal_separator`` explicitly to remove the guess entirely — that is what
    the mapping form is for.
    """
    if isinstance(text, (int, float, Decimal)):
        return Decimal(str(text))

    raw = str(text or "").strip()
    if not raw:
        raise ImporterError("empty amount")

    cleaned = _CURRENCY_NOISE.sub("", raw)
    for space in _SPACES:
        cleaned = cleaned.replace(space, "")

    negative = False
    if cleaned.startswith("(") and cleaned.endswith(")"):
        negative = True
        cleaned = cleaned[1:-1]
    if cleaned.endswith("-"):  # trailing minus (some German/Swiss exports)
        negative = True
        cleaned = cleaned[:-1]
    if cleaned.startswith("-"):
        negative = True
        cleaned = cleaned[1:]
    elif cleaned.startswith("+"):
        cleaned = cleaned[1:]

    if not cleaned:
        raise ImporterError(f"unreadable amount {raw!r}")

    if decimal_separator in (",", "."):
        thousands = "." if decimal_separator == "," else ","
        cleaned = cleaned.replace(thousands, "").replace(decimal_separator, ".")
    elif "." in cleaned and "," in cleaned:
        # The rightmost separator is the decimal one; the other groups thousands.
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    else:
        cleaned = cleaned.replace(",", ".")

    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        raise ImporterError(f"unreadable amount {raw!r}")

    return -value if negative else value


def parse_date(value, *, fmt: str | None = None) -> date:
    """Parse a date cell. Accepts real date/datetime cells (XLSX) and strings."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value or "").strip()
    if not text:
        raise ImporterError("empty date")

    formats = (fmt,) if fmt else _DATE_FORMATS
    for candidate in formats:
        try:
            return datetime.strptime(text, candidate).date()
        except ValueError:
            continue

    if not fmt:
        try:
            return datetime.fromisoformat(text).date()
        except ValueError:
            pass

    raise ImporterError(f"unreadable date {text!r}")


def normalize_label(raw: str) -> str:
    """Normalize a statement label for hashing and fuzzy matching.

    NFKD decomposition drops diacritics, the result is upper-cased and its
    whitespace collapsed. Punctuation goes **except digits and ``/``**: the card
    reference inside ``CB LECLERC 12/07 123456`` is often the only thing telling
    two otherwise identical lines apart, so stripping digits would defeat the
    deduplication it feeds.
    """
    text = unicodedata.normalize("NFKD", str(raw or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.upper()
    text = re.sub(r"[^A-Z0-9/\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()
