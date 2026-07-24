"""
``PingSpec`` entry point for the monthly budget report.

Registered from ``budget.apps.ready``. Reuses the pings machinery (opt-in, local
send time, idempotent tick, timezone + language, Telegram delivery). Fires only
on the 1st of the month: it ensures the previous month's report exists (generated
once, household-level) and returns its prose in the recipient's language; every
other day it returns ``None`` so the tick skips silently.
"""
from __future__ import annotations

import html
from datetime import date

from django.utils.translation import gettext as _

from .service import get_or_generate_report, last_closed_month, render_report


def build_monthly_report_message(household, user, *, today: date) -> str | None:
    """Build the monthly report push text (or ``None`` when not the 1st / empty)."""
    if today.day != 1:
        return None

    month = last_closed_month(household)
    report = get_or_generate_report(household, month)
    if not (report.stats or {}).get("expense_count"):
        return None  # nothing spent last month — no point pinging

    header = _("Your budget report for %(month)s:") % {"month": month}
    body = render_report(report)  # active language set by the ping machinery
    return f"<b>{html.escape(header)}</b>\n\n{html.escape(body)}"
