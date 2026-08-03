"""
``PingSpec`` entry point for the monthly budget report.

Registered from ``budget.apps.ready``. Reuses the pings machinery (opt-in, local
send time, idempotent tick, timezone + language, Telegram delivery). Fires on the
day the month actually closes — the 5th business day of the next one, so the last
receipts of the month are in (``core.month_close``): it ensures that month's report
exists (generated once, household-level) and returns its prose in the recipient's
language; every other day it returns ``None`` so the tick skips silently.
"""
from __future__ import annotations

import html
from datetime import date

from django.utils.translation import gettext as _

from core.month_close import closing_date, last_closed_month

from .service import get_or_generate_report, render_report


def build_monthly_report_message(household, user, *, today: date) -> str | None:
    """Build the monthly report push text (or ``None`` on any other day / empty).

    The month is derived from ``today`` and the guard asks the derived month when
    *it* closes: the day and the report it announces cannot drift apart. The check
    comes before ``get_or_generate_report`` — the tick runs every day, and a silent
    day must not freeze a month early.
    """
    month = last_closed_month(household, today=today)
    if today != closing_date(month):
        return None

    report = get_or_generate_report(household, month)
    if not (report.stats or {}).get("expense_count"):
        return None  # nothing spent last month — no point pinging

    header = _("Your budget report for %(month)s:") % {"month": month}
    body = render_report(report)  # active language set by the ping machinery
    return f"<b>{html.escape(header)}</b>\n\n{html.escape(body)}"
