"""Enedis load-curve CSV ("courbe de charge" export from the client portal).

Expected shape — metadata header lines, then a ``Horodate;Valeur`` section
where each value is the average power in W over the sampling step (30 min by
default). The timestamp marks the END of the measuring interval (the first
point of a day is 00:30, carrying 00:00→00:30), so ``ts_start = horodate -
step``. Verified against a real export; the parser tolerates a UTF-8 BOM,
blank lines and gap rows (empty value), and fails loudly with a line number
otherwise.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from .base import BaseImporter, ImporterError, ImporterFormatError, NormalizedPoint
from .registry import register

DEFAULT_STEP_MINUTES = 30


def _parse_horodate(raw: str, tz: ZoneInfo, line_no: int) -> datetime:
    value = raw.strip()
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise ImporterError(f"line {line_no}: unreadable timestamp {value!r}")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=tz)
    return parsed


class EnedisCsvImporter(BaseImporter):
    key = "enedis_csv"
    label = "Enedis — courbe de charge (CSV)"

    def detect(self, sample: str) -> bool:
        head = sample.lstrip("\ufeff").lower()
        return "horodate" in head and ";" in head

    def parse(self, text: str, *, tz: ZoneInfo, options: dict | None = None) -> list[NormalizedPoint]:
        lines = text.lstrip("\ufeff").splitlines()

        # locate the Horodate;Valeur header — metadata lines may precede it
        data_start = None
        for i, line in enumerate(lines):
            cells = [c.strip().lower() for c in line.split(";")]
            if cells and cells[0] == "horodate":
                data_start = i + 1
                break
        if data_start is None:
            raise ImporterFormatError("no 'Horodate' header found — not an Enedis load-curve export")

        # first pass: timestamps + raw power values
        rows: list[tuple[int, datetime, float]] = []
        for offset, line in enumerate(lines[data_start:], start=data_start + 1):
            if not line.strip():
                continue
            cells = line.split(";")
            if len(cells) < 2:
                raise ImporterError(f"line {offset}: expected 'Horodate;Valeur', got {line!r}")
            raw_value = cells[1].strip()
            if raw_value == "":
                continue  # measurement gap — skip the point
            ts = _parse_horodate(cells[0], tz, offset)
            try:
                watts = float(raw_value.replace(",", "."))
            except ValueError:
                raise ImporterError(f"line {offset}: unreadable value {raw_value!r}")
            if watts < 0:
                raise ImporterError(f"line {offset}: negative power {raw_value!r}")
            rows.append((offset, ts, watts))

        if not rows:
            return []

        # sampling step: the most common gap between consecutive timestamps
        step = _infer_step_minutes([ts for _, ts, _ in rows])

        points = []
        interval = timedelta(minutes=step)
        for _, ts_end, watts in rows:
            energy_wh = int(round(watts * step / 60))
            points.append(
                NormalizedPoint(
                    ts_start=ts_end - interval,
                    interval_minutes=step,
                    energy_wh=energy_wh,
                    register="base",
                )
            )
        return points


def _infer_step_minutes(timestamps: list[datetime]) -> int:
    if len(timestamps) < 2:
        return DEFAULT_STEP_MINUTES
    gaps: dict[int, int] = {}
    for a, b in zip(timestamps, timestamps[1:]):
        minutes = int((b - a).total_seconds() // 60)
        if minutes > 0:
            gaps[minutes] = gaps.get(minutes, 0) + 1
    if not gaps:
        return DEFAULT_STEP_MINUTES
    return max(gaps, key=gaps.get)


register(EnedisCsvImporter())
