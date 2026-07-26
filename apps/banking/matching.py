"""Fuzzy reconciliation: pairing a statement line with an expense already typed in.

The problem this exists for: the user buys pellets on the 12th and records it in
House the same day; the `CB LECLERC` line lands on the statement on the 14th.
Two traces of one fact. Fail to pair them and the household counts twice; demand
the statement before recording and the immediate gesture that makes the app worth
using dies.

**This lot decides whether the system survives.** Two banks are ~160 lines a
month; if each one needs a click, the user drops off in two months.

Full rationale: ``docs/fiches/IMPORT_ET_RAPPROCHEMENT.md`` §3.3.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from difflib import SequenceMatcher
from zoneinfo import ZoneInfo

from django.conf import settings

from .importers.parsing import normalize_label
from .models import BankTransaction
from .queries import transactions as transactions_qs

# Weights sum to 1. The amount dominates because it is the only near-certain
# signal; the label is worth least because bank labels are noisy.
WEIGHT_AMOUNT = 0.50
WEIGHT_DATE = 0.30
WEIGHT_LABEL = 0.20


def _setting(name: str, default):
    return getattr(settings, name, default)


@dataclass(frozen=True)
class MatchCandidate:
    """One possible pairing, with the evidence behind its score."""

    interaction_id: str
    transaction_id: str
    score: float
    amount_delta: Decimal
    day_gap: int
    label_ratio: float

    @property
    def is_exact_amount(self) -> bool:
        return self.amount_delta == 0


def _household_tz(household) -> ZoneInfo:
    try:
        return ZoneInfo(getattr(household, "timezone", "") or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def _occurred_date(interaction, tz: ZoneInfo) -> date:
    """The expense's date as the household experienced it, not as UTC stored it."""
    return interaction.occurred_at.astimezone(tz).date()


def score_pair(interaction, transaction, *, tz: ZoneInfo) -> MatchCandidate | None:
    """Score one pairing, or return ``None`` when it is out of the window."""
    target = transaction.outflow
    amount = interaction.amount or Decimal("0.00")
    if amount <= 0 or target <= 0:
        return None

    tolerance = max(Decimal("0.05"), target * Decimal("0.005"))
    delta = abs(target - amount)
    if delta > tolerance:
        return None

    before = int(_setting("BANKING_MATCH_WINDOW_BEFORE_DAYS", 7))
    after = int(_setting("BANKING_MATCH_WINDOW_AFTER_DAYS", 3))
    gap = (transaction.booked_on - _occurred_date(interaction, tz)).days
    # A card is debited *after* the purchase, but users sometimes record a day
    # late — hence an asymmetric window rather than a symmetric one.
    if gap > before or gap < -after:
        return None

    amount_score = WEIGHT_AMOUNT * (1 - float(delta / tolerance))
    span = max(before, after) or 1
    date_score = WEIGHT_DATE * max(0.0, 1 - abs(gap) / span)

    ratio = _label_ratio(interaction, transaction)
    label_score = WEIGHT_LABEL * ratio

    return MatchCandidate(
        interaction_id=str(interaction.pk),
        transaction_id=str(transaction.pk),
        score=round(amount_score + date_score + label_score, 4),
        amount_delta=delta,
        day_gap=gap,
        label_ratio=round(ratio, 4),
    )


def _label_ratio(interaction, transaction) -> float:
    """Similarity between what the user typed and what the bank printed.

    Forced to 1.0 when the supplier is a substring of the bank label — the
    ``LECLERC`` inside ``CB LECLERC 12/07 123456`` case, which is by far the most
    common and which a plain sequence ratio scores poorly because of all the
    surrounding noise.
    """
    needle = normalize_label(interaction.supplier or "") or normalize_label(
        interaction.subject or ""
    )
    haystack = transaction.label_norm or normalize_label(transaction.label_raw)
    if not needle or not haystack:
        return 0.0
    if needle in haystack or haystack in needle:
        return 1.0
    return SequenceMatcher(None, needle, haystack).ratio()


def _candidate_expenses(*, household, transactions, tz):
    """Unreconciled expenses that could plausibly match any of ``transactions``.

    One query for the whole batch rather than one per line: an import of 300
    rows must not become 300 round trips. The partial index
    ``idx_int_unreconciled_amount`` is what makes this cheap.
    """
    from interactions.queries import expenses

    if not transactions:
        return []

    before = int(_setting("BANKING_MATCH_WINDOW_BEFORE_DAYS", 7))
    after = int(_setting("BANKING_MATCH_WINDOW_AFTER_DAYS", 3))
    dates = [t.booked_on for t in transactions]
    # gap = booked_on - occurred_date, allowed in [-after, +before]. So the
    # expense date runs from (booked_on - before) to (booked_on + after) — not
    # the other way round.
    start = min(dates) - timedelta(days=before)
    end = max(dates) + timedelta(days=after)

    qs = expenses(household_id=household.id).filter(
        bank_transaction__isnull=True,
        amount__isnull=False,
        occurred_at__date__gte=start,
        occurred_at__date__lte=end,
    )
    return list(qs)


def find_candidates(*, household, transactions, tz=None) -> list[MatchCandidate]:
    """Every plausible pairing, unsorted."""
    tz = tz or _household_tz(household)
    allocatable = [
        t
        for t in transactions
        if t.amount < 0 and not t.is_internal and t.transfer_counterpart_id is None
    ]
    expenses_pool = _candidate_expenses(
        household=household, transactions=allocatable, tz=tz
    )

    candidates: list[MatchCandidate] = []
    for transaction in allocatable:
        for interaction in expenses_pool:
            candidate = score_pair(interaction, transaction, tz=tz)
            if candidate is not None:
                candidates.append(candidate)
    return candidates


def auto_reconcile(
    *,
    household,
    user,
    transactions=None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    """Link what is certain, propose the rest.

    **Auto-match requires a strictly equal amount**, on top of the score and
    uniqueness thresholds. A five-cent match is probably right, but it would
    break the allocation invariant and leave residues nobody can explain across
    hundreds of lines. A gap becomes a suggestion, settled by one human click.

    Assignment is a **stable greedy pass**, never an argmax per line: two 20 €
    purchases facing two 20 € statement lines would otherwise cross-assign or
    double-assign. Pairs are sorted by score (then by the smallest day gap) and
    kept only while both sides are still free.

    Idempotent: everything already reconciled is out of the candidate pool, so a
    second run changes nothing.
    """
    from .services import link_interaction

    if transactions is None:
        qs = transactions_qs(household_id=household.id).filter(
            interactions__isnull=True, is_internal=False, amount__lt=0
        )
        if date_from:
            qs = qs.filter(booked_on__gte=date_from)
        if date_to:
            qs = qs.filter(booked_on__lte=date_to)
        transactions = list(qs.distinct())

    tz = _household_tz(household)
    candidates = find_candidates(household=household, transactions=transactions, tz=tz)

    auto_threshold = float(_setting("BANKING_MATCH_AUTO_THRESHOLD", 0.85))
    suggest_threshold = float(_setting("BANKING_MATCH_SUGGEST_THRESHOLD", 0.55))

    best_by_transaction: dict[str, list[MatchCandidate]] = {}
    for candidate in candidates:
        best_by_transaction.setdefault(candidate.transaction_id, []).append(candidate)

    eligible = [
        c
        for c in candidates
        if c.score >= auto_threshold
        and c.is_exact_amount
        and _is_unambiguous(c, best_by_transaction[c.transaction_id])
    ]
    eligible.sort(key=lambda c: (-c.score, abs(c.day_gap)))

    by_id = {str(t.pk): t for t in transactions}
    taken_transactions: set[str] = set()
    taken_interactions: set[str] = set()
    matched = 0

    from interactions.models import Interaction

    for candidate in eligible:
        if candidate.transaction_id in taken_transactions:
            continue
        if candidate.interaction_id in taken_interactions:
            continue

        transaction = by_id.get(candidate.transaction_id) or BankTransaction.objects.get(
            pk=candidate.transaction_id
        )
        interaction = Interaction.objects.get(pk=candidate.interaction_id)
        link_interaction(
            user=user, transaction=transaction, interaction=interaction, by="auto"
        )

        taken_transactions.add(candidate.transaction_id)
        taken_interactions.add(candidate.interaction_id)
        matched += 1

    suggestions = [
        c
        for c in candidates
        if c.score >= suggest_threshold
        and c.transaction_id not in taken_transactions
        and c.interaction_id not in taken_interactions
    ]

    return {"auto_matched": matched, "suggestions": suggestions}


def _is_unambiguous(candidate: MatchCandidate, siblings: list[MatchCandidate]) -> bool:
    """True when picking this candidate cannot be the wrong call.

    A clear winner is safe. A near-tie is a question for the user — *unless* the
    rival is **interchangeable** (same score, same amount gap), in which case
    either choice produces identical books and refusing would only create busy
    work. Two identical 20 € purchases facing two identical 20 € lines is the
    everyday case, and it must reconcile itself.
    """
    others = [c for c in siblings if c.interaction_id != candidate.interaction_id]
    if not others:
        return True

    best_other = max(others, key=lambda c: c.score)
    if candidate.score - best_other.score > 0.15:
        return True

    return (
        best_other.score == candidate.score
        and best_other.amount_delta == candidate.amount_delta
    )


def suggestions_for(*, transaction, tz=None, limit: int = 5) -> list[MatchCandidate]:
    """Best candidates for one line, for the manual reconciliation dialog."""
    household = transaction.household
    candidates = find_candidates(
        household=household, transactions=[transaction], tz=tz
    )
    candidates.sort(key=lambda c: (-c.score, abs(c.day_gap)))
    return candidates[:limit]


def serialize_candidate(candidate: MatchCandidate) -> dict:
    return {
        "interaction_id": candidate.interaction_id,
        "transaction_id": candidate.transaction_id,
        "score": candidate.score,
        "amount_delta": str(candidate.amount_delta),
        "day_gap": candidate.day_gap,
        "label_ratio": candidate.label_ratio,
    }
