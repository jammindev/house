"""Statement file importers — one adapter per file format, never per bank.

The write path (deduplication, idempotence, audit trail) lives in
``banking.services``; adapters only turn a source file into normalized
transactions. Supporting a new bank means filling the mapping form once, not
shipping code — which is the whole point, since a household typically deals with
two or three banks that all export something slightly different.

Register new adapters in ``registry.py``; no model or API change is needed.
"""
from . import generic_csv, generic_xlsx  # noqa: F401  (self-registration)
from .base import (  # noqa: F401
    BaseStatementImporter,
    ImporterError,
    ImporterFormatError,
    NormalizedTransaction,
    decode_text,
)
from .parsing import normalize_label, parse_amount, parse_date  # noqa: F401
from .registry import detect_importer, get_importer, importer_choices  # noqa: F401
