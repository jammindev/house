"""Registry of statement importers — same philosophy as ``agent.searchables``."""
from __future__ import annotations

from .base import BaseStatementImporter

REGISTRY: dict[str, BaseStatementImporter] = {}


def register(importer: BaseStatementImporter) -> None:
    if importer.key in REGISTRY:
        raise ValueError(f"importer {importer.key!r} is already registered")
    REGISTRY[importer.key] = importer


def get_importer(key: str) -> BaseStatementImporter | None:
    return REGISTRY.get(key)


def importer_choices() -> list[tuple[str, str]]:
    return [(imp.key, imp.label) for imp in REGISTRY.values()]


def detect_importer(raw: bytes) -> BaseStatementImporter | None:
    """First importer whose ``detect`` recognizes the file.

    The generic adapters never self-detect on content alone: CSV and XLSX say
    nothing about which column holds the amount. ``generic_xlsx`` does claim the
    ZIP magic (an XLSX can only be read one way), but ``generic_csv`` always
    requires an explicit user mapping.
    """
    for importer in REGISTRY.values():
        if importer.detect(raw):
            return importer
    return None
