"""Registry of consumption importers — same philosophy as ``agent.searchables``."""
from __future__ import annotations

from .base import BaseImporter

REGISTRY: dict[str, BaseImporter] = {}


def register(importer: BaseImporter) -> None:
    if importer.key in REGISTRY:
        raise ValueError(f"importer {importer.key!r} is already registered")
    REGISTRY[importer.key] = importer


def get_importer(key: str) -> BaseImporter | None:
    return REGISTRY.get(key)


def importer_choices() -> list[tuple[str, str]]:
    return [(imp.key, imp.label) for imp in REGISTRY.values()]


def detect_importer(sample: str) -> BaseImporter | None:
    """First importer whose ``detect`` recognizes the sample (generic_csv never
    self-detects: it requires explicit user mapping)."""
    for importer in REGISTRY.values():
        if importer.detect(sample):
            return importer
    return None
