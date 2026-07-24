"""
Deterministic, localized rendering of a monthly report snapshot.

Turns the language-agnostic ``stats`` (``report.stats``) into a factual summary
in the active language via ``gettext``. This is the always-available fallback
("bilan factuel non rédigé") and the base text the optional LLM polish rewrites.
Called inside a ``translation.override`` block by the service.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.utils.translation import gettext as _


def _money(value: str) -> str:
    try:
        return f"{Decimal(value):.2f} €"
    except Exception:  # pragma: no cover - defensive
        return f"{value} €"


def render_lines(stats: dict[str, Any]) -> list[str]:
    """Return the report as a list of plain localized lines (no markup)."""
    lines: list[str] = []
    total = _money(stats["total_spent"])
    lines.append(_("Total spent: %(total)s over %(count)d expense(s).") % {
        "total": total, "count": stats.get("expense_count", 0),
    })

    trend_pct = stats.get("trend_pct")
    if trend_pct is not None:
        prev = _money(stats["prev_total"])
        if trend_pct > 0:
            lines.append(_("That's %(pct)s%% more than the previous month (%(prev)s).") % {
                "pct": abs(trend_pct), "prev": prev})
        elif trend_pct < 0:
            lines.append(_("That's %(pct)s%% less than the previous month (%(prev)s).") % {
                "pct": abs(trend_pct), "prev": prev})
        else:
            lines.append(_("Same as the previous month (%(prev)s).") % {"prev": prev})

    glob = stats.get("global")
    if glob:
        status = (
            _("over the global budget") if glob["state"] == "over"
            else _("within the global budget")
        )
        lines.append(_("Global budget: %(spent)s / %(amount)s — %(status)s.") % {
            "spent": _money(glob["spent"]), "amount": _money(glob["amount"]), "status": status})

    for b in stats.get("budgets", []):
        if b["state"] == "over":
            lines.append(_("⚠ %(name)s: %(spent)s / %(amount)s — over budget.") % {
                "name": b["name"], "spent": _money(b["spent"]), "amount": _money(b["amount"])})
        else:
            lines.append(_("%(name)s: %(spent)s / %(amount)s.") % {
                "name": b["name"], "spent": _money(b["spent"]), "amount": _money(b["amount"])})

    unbudgeted = stats.get("unbudgeted", "0.00")
    if Decimal(unbudgeted) > 0:
        lines.append(_("Unbudgeted: %(amount)s.") % {"amount": _money(unbudgeted)})

    rec = stats.get("recurring") or {}
    if rec.get("count"):
        lines.append(_("Recurring bills paid: %(count)d for %(total)s.") % {
            "count": rec["count"], "total": _money(rec["total"])})

    top = stats.get("top_expenses") or []
    if top:
        biggest = top[0]
        lines.append(_("Biggest expense: %(subject)s (%(amount)s).") % {
            "subject": biggest["subject"], "amount": _money(biggest["amount"])})

    return lines


def render_text(stats: dict[str, Any]) -> str:
    """Join the localized lines into a plain-text paragraph block."""
    return "\n".join(render_lines(stats))
