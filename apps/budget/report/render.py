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

from core.money import format_money

#: Alias — la définition (et le pourquoi du formatage localisé) vit dans
#: ``core.money``. Un ``f"{Decimal:.2f} €"`` local écrivait « 1240.50 € » à un
#: lecteur français, dans le même écran qu'un `formatAmount` disant « 1 240,50 € ».
_money = format_money


def _percent(value) -> str:
    """La tendance, dans la convention du lecteur : « 13,8 » et non « 13.8 ».

    Même défaut que ``_money``, sur la même phrase — le corriger à moitié
    laisserait « 1 240,50 € » et « 13.8% » côte à côte. Reste local : c'est le
    seul pourcentage que le serveur écrive en toutes lettres. L'espace avant le
    ``%`` appartient à la langue, donc au ``msgstr``, pas à ce helper.
    """
    from django.utils import formats

    try:
        return formats.number_format(round(float(value), 1), decimal_pos=1)
    except (TypeError, ValueError):  # pragma: no cover - défensif
        return str(value)


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
                "pct": _percent(abs(trend_pct)), "prev": prev})
        elif trend_pct < 0:
            lines.append(_("That's %(pct)s%% less than the previous month (%(prev)s).") % {
                "pct": _percent(abs(trend_pct)), "prev": prev})
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
        # Sans plafond, « 340 € / 0 € » serait un faux dépassement : la catégorie
        # ne promet rien, on rapporte donc ce qu'elle a coûté, sans verdict.
        if b.get("amount") is None:
            lines.append(_("%(name)s: %(spent)s.") % {
                "name": b["name"], "spent": _money(b["spent"])})
        elif b["state"] == "over":
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
