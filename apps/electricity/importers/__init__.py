"""Consumption file importers — one adapter per provider format.

The write path (upsert, dedup, audit trail) lives in ``electricity.services``;
adapters only turn a source file into normalized points. Register new adapters
in ``registry.py`` — no model or API change needed to support a new country.
"""
from . import enedis_csv, generic_csv  # noqa: F401  (self-registration)
from .base import BaseImporter, ImporterError, ImporterFormatError, NormalizedPoint  # noqa: F401
from .registry import detect_importer, get_importer, importer_choices  # noqa: F401
