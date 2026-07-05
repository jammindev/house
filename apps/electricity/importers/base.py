"""Importer contract: a provider file in, normalized consumption points out."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo


class ImporterError(Exception):
    """Base error for importer failures (message is user-facing)."""


class ImporterFormatError(ImporterError):
    """The file does not match the expected provider format."""


def decode_text(raw: bytes) -> str:
    """Decode a text-based consumption file: UTF-8 (BOM tolerated), latin-1 fallback."""
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


@dataclass(frozen=True)
class NormalizedPoint:
    """One consumption point in pivot shape — what every adapter produces."""

    ts_start: datetime  # timezone-aware, start of the interval
    interval_minutes: int
    energy_wh: int
    register: str = "base"


class BaseImporter(ABC):
    """One provider format — text (CSV) or binary (XLSX). ``parse`` must
    validate the WHOLE file before the caller writes anything — a bad line
    raises ``ImporterError`` with its line number, never a silent partial
    import."""

    key: str
    label: str

    @abstractmethod
    def detect(self, raw: bytes) -> bool:
        """Cheap check on the raw file bytes: is this my format?"""

    @abstractmethod
    def parse(self, raw: bytes, *, tz: ZoneInfo, options: dict | None = None) -> list[NormalizedPoint]:
        """Turn the full file into normalized points.

        ``tz`` is the meter timezone, used to localize naive timestamps.
        ``options`` carries user-provided mapping for configurable formats.
        """

    def sample_lines(self, raw: bytes) -> list[str]:
        """First lines for the import-dialog preview. Text default; binary
        formats override to render rows."""
        return decode_text(raw).lstrip("\ufeff").splitlines()[:10]
