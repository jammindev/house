"""Arbitrary condition evaluation for briefings (lot 4) — the core of the feature.

A briefing may carry a free-text ``condition`` ("s'il pleut aujourd'hui", "si
j'ai une tâche en retard", "si la France joue cette semaine"). Before sending, the
agent evaluates it: ``agent.service.ask`` already orchestrates the whole toolbox
(household RAG, weather, web search), so we just prompt it to *check the facts with
its tools* and end on a machine-parseable verdict, then parse a boolean out of it.

Fail-safe by design: an empty condition always sends; anything we cannot evaluate
(LLM error, unparseable answer) resolves to **do not send**, with a reason — the
cadrage rule "never spam by doubt". The web branch (4.2) needs no extra wiring: it
rides the same ``ask`` pipeline, which offers ``web_search`` when the instance has
it enabled.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from django.utils import translation

from .generation import _recipient_language

logger = logging.getLogger(__name__)

_VERDICT_RE = re.compile(r"VERDICT:\s*(SEND|SKIP)", re.IGNORECASE)
_REASON_RE = re.compile(r"REASON:\s*(.+)", re.IGNORECASE)

_CONDITION_PROMPT = (
    "Decide whether a briefing should be sent RIGHT NOW based on this condition:\n\n"
    '"{condition}"\n\n'
    "Use your tools to check the real facts first — the household's data, today's "
    "weather, and the web if the condition refers to external events. Then reply "
    "with EXACTLY two lines and nothing else:\n"
    "VERDICT: SEND   (if the condition is currently true / the briefing should go out)\n"
    "VERDICT: SKIP   (if it is not)\n"
    "REASON: <one short sentence citing what you found>\n"
    "If you cannot determine it, answer VERDICT: SKIP."
)


@dataclass
class ConditionVerdict:
    """Outcome of evaluating a briefing's condition."""

    send: bool
    reason: str
    evaluated: bool  # False when the briefing has no condition (always sends)


def evaluate_condition(briefing, *, recipient) -> ConditionVerdict:
    """Evaluate ``briefing.condition`` for ``recipient``. Fail-safe = do not send.

    No condition → ``send=True, evaluated=False`` (unconditional briefing).
    """
    condition = (briefing.condition or "").strip()
    if not condition:
        return ConditionVerdict(send=True, reason="", evaluated=False)

    from agent.service import ask
    from agent.llm import LLMError, LLMTimeoutError

    try:
        with translation.override(_recipient_language(recipient, briefing.household)):
            result = ask(
                _CONDITION_PROMPT.format(condition=condition),
                briefing.household,
                user=recipient,
            )
    except (LLMTimeoutError, LLMError):
        logger.warning("briefings.condition: LLM error for briefing=%s", briefing.pk)
        return ConditionVerdict(
            send=False, reason="Condition could not be evaluated.", evaluated=True
        )

    return _parse_verdict(result.answer or "")


def _parse_verdict(answer: str) -> ConditionVerdict:
    """Pull VERDICT/REASON out of the model's answer. Unparseable → do not send."""
    verdict = _VERDICT_RE.search(answer)
    reason_match = _REASON_RE.search(answer)
    reason = reason_match.group(1).strip() if reason_match else ""

    if verdict is None:
        # No clear verdict — fail safe.
        return ConditionVerdict(
            send=False,
            reason=reason or "Condition could not be evaluated.",
            evaluated=True,
        )
    send = verdict.group(1).upper() == "SEND"
    return ConditionVerdict(send=send, reason=reason, evaluated=True)
