"""
Recap chapter collectors — one per source module (parcours 27).

Each collector is a pure read that turns its module's data for one closed month
into a ``Chapter`` (a few ``RecapCard``) or ``None`` when there is nothing worth
telling. Collectors are blind to each other, and an exception in one never sinks
the recap (``service.build_stats`` isolates it).

**The contract differs from ``agent.digest.collectors`` — do not copy one over.**
A digest section returns strings **already translated**, which is correct for a
throwaway message composed for a known recipient. A recap is persisted and re-read,
possibly by someone else: a collector here returns **data**, and the language
arrives at render time (``recap.render``). Two rules follow:

- no ``gettext`` in this module — only numbers, ``str(Decimal)``, technical keys and
  proper nouns the user typed themselves;
- **nothing whose visibility varies by reader.** The snapshot is frozen once for the
  household and read by every member, so private data is excluded from the *count*,
  not filtered at display time.

Module imports are lazy inside each collector to keep this module import-safe
regardless of app-loading order.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any


@dataclass
class RecapCard:
    """One screen of the story: a kind plus its language-agnostic payload."""

    kind: str
    data: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        """Flat serialization — ``{"kind": ..., **data}``, as stored in ``stats``."""
        return {"kind": self.kind, **self.data}


@dataclass
class Chapter:
    """A named group of cards, contributed by one source module."""

    key: str
    cards: list[RecapCard] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {"key": self.key, "cards": [card.as_dict() for card in self.cards]}


@dataclass(frozen=True)
class ChapterSpec:
    """Declarative description of one recap chapter."""

    key: str
    """Chapter discriminator, also the user preference key."""

    module: str | None
    """``households.modules`` key gating the chapter. ``None`` = core."""

    collect: Callable[..., Chapter | None]
    """``collect(household, month, *, start, end) -> Chapter | None``.

    ``start``/``end`` are the aware month bounds (end **exclusive**) computed once
    by the service through ``core.timezones`` — a collector must never recompute
    them, so the whole recap agrees on where the month starts and stops."""


def _str(value: Decimal | str | None) -> str:
    """Amounts travel as strings in the snapshot — JSON has no Decimal."""
    if value is None:
        return "0.00"
    return f"{Decimal(str(value)):.2f}"


# --- Money (core: the `money` module is not switchable) ------------------------


def collect_money(household, month: str, *, start: datetime, end: datetime) -> Chapter | None:
    """The money chapter — **reads** the frozen ``BudgetReport``, never resums.

    This is the rule « un compteur ne peut pas avoir deux définitions » applied: the
    monthly budget report already froze these figures, and two independently written
    sums drift by a rounding cent or a timezone bound. A ``Sum("amount")`` anywhere
    in ``apps/recap/`` is a design bug, not a shortcut.
    """
    from budget.report.service import get_or_generate_report

    report = get_or_generate_report(household, month)
    stats = report.stats or {}

    if not stats.get("expense_count"):
        return None  # nothing spent that month — no money chapter at all

    cards = [
        RecapCard(
            "total_spent",
            {
                "value": _str(stats.get("total_spent")),
                "expense_count": int(stats.get("expense_count") or 0),
                "trend_pct": stats.get("trend_pct"),
                "prev": _str(stats.get("prev_total")),
            },
        )
    ]

    # Budget outcome: how many envelopes held, and which gave way. An uncapped
    # category is neither kept nor exceeded — it is counted apart, never as `ok`.
    budgets = [b for b in (stats.get("budgets") or []) if isinstance(b, dict)]
    if budgets:
        over = [b.get("name") for b in budgets if b.get("state") == "over"]
        uncapped = [b for b in budgets if b.get("amount") is None]
        cards.append(
            RecapCard(
                "budget_outcome",
                {
                    "total": len(budgets),
                    "kept": len(budgets) - len(over) - len(uncapped),
                    "over_count": len(over),
                    "over_names": [name for name in over if name][:3],
                    "uncapped_count": len(uncapped),
                },
            )
        )

    top = [t for t in (stats.get("top_expenses") or []) if isinstance(t, dict)]
    if top:
        cards.append(
            RecapCard(
                "biggest_expense",
                {"subject": top[0].get("subject") or "", "value": _str(top[0].get("amount"))},
            )
        )

    return Chapter("money", cards)


# --- Registry -----------------------------------------------------------------

#: Order of the registry **is** the order of the story, and it is frozen with each
#: snapshot. Appending a spec never reorders a month already told.
CHAPTER_SPECS: tuple[ChapterSpec, ...] = (
    ChapterSpec("money", None, collect_money),
)

CHAPTER_KEYS: tuple[str, ...] = tuple(spec.key for spec in CHAPTER_SPECS)


def active_chapter_specs(household) -> list[ChapterSpec]:
    """Chapter specs whose module the household has not disabled (order preserved)."""
    disabled_modules = frozenset(getattr(household, "disabled_modules", None) or [])
    return [
        spec
        for spec in CHAPTER_SPECS
        if spec.module is None or spec.module not in disabled_modules
    ]
