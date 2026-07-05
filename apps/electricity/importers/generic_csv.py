"""Generic CSV importer — the international safety net.

No provider assumption: the user maps the columns themselves. Options:

- ``timestamp_column`` (header name, required)
- ``value_column`` (header name, required)
- ``unit``: ``wh`` | ``kwh`` | ``w_avg`` (required)
- ``interval_minutes`` (required, > 0)
- ``delimiter`` (optional, sniffed among ``;`` ``,`` and tab otherwise)
- ``register``: ``base`` | ``hp`` | ``hc`` (optional, default ``base``)
- ``timestamp_position``: ``start`` (default) | ``end`` of the interval
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from .base import BaseImporter, ImporterError, NormalizedPoint, decode_text
from .registry import register

UNITS = ("wh", "kwh", "w_avg")


def _to_wh(value: float, unit: str, interval_minutes: int) -> int:
    if unit == "wh":
        return int(round(value))
    if unit == "kwh":
        return int(round(value * 1000))
    return int(round(value * interval_minutes / 60))  # w_avg


class GenericCsvImporter(BaseImporter):
    key = "generic_csv"
    label = "CSV générique (mapping manuel)"

    def detect(self, raw: bytes) -> bool:
        return False  # never auto-detected — requires explicit user mapping

    def parse(self, raw: bytes, *, tz: ZoneInfo, options: dict | None = None) -> list[NormalizedPoint]:
        options = options or {}
        ts_col = options.get("timestamp_column")
        value_col = options.get("value_column")
        unit = options.get("unit")
        register_name = options.get("register", "base")
        position = options.get("timestamp_position", "start")
        try:
            interval = int(options.get("interval_minutes"))
        except (TypeError, ValueError):
            raise ImporterError("interval_minutes is required and must be an integer")

        if not ts_col or not value_col:
            raise ImporterError("timestamp_column and value_column are required")
        if unit not in UNITS:
            raise ImporterError(f"unit must be one of {', '.join(UNITS)}")
        if interval <= 0:
            raise ImporterError("interval_minutes must be > 0")
        if register_name not in ("base", "hp", "hc"):
            raise ImporterError("register must be one of base, hp, hc")
        if position not in ("start", "end"):
            raise ImporterError("timestamp_position must be 'start' or 'end'")

        body = decode_text(raw).lstrip("\ufeff")
        delimiter = options.get("delimiter") or _sniff_delimiter(body)
        reader = csv.DictReader(io.StringIO(body), delimiter=delimiter)
        if reader.fieldnames is None:
            raise ImporterError("empty file")
        fieldnames = [f.strip() for f in reader.fieldnames]
        for required in (ts_col, value_col):
            if required not in fieldnames:
                raise ImporterError(f"column {required!r} not found (columns: {', '.join(fieldnames)})")

        points = []
        shift = timedelta(minutes=interval) if position == "end" else timedelta(0)
        for line_no, row in enumerate(reader, start=2):
            row = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            raw_ts, raw_value = row.get(ts_col, ""), row.get(value_col, "")
            if not raw_ts and not raw_value:
                continue  # blank line
            if raw_value == "":
                continue  # measurement gap
            try:
                ts = datetime.fromisoformat(raw_ts)
            except ValueError:
                raise ImporterError(f"line {line_no}: unreadable timestamp {raw_ts!r}")
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=tz)
            try:
                value = float(raw_value.replace(",", "."))
            except ValueError:
                raise ImporterError(f"line {line_no}: unreadable value {raw_value!r}")
            if value < 0:
                raise ImporterError(f"line {line_no}: negative value {raw_value!r}")
            points.append(
                NormalizedPoint(
                    ts_start=ts - shift,
                    interval_minutes=interval,
                    energy_wh=_to_wh(value, unit, interval),
                    register=register_name,
                )
            )
        return points


def _sniff_delimiter(body: str) -> str:
    first_line = body.splitlines()[0] if body.splitlines() else ""
    for candidate in (";", ",", "\t"):
        if candidate in first_line:
            return candidate
    return ";"


register(GenericCsvImporter())
