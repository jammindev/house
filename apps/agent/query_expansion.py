"""
Query expansion: turn a natural-language question into search terms.

The retrieval layer is a naive lexical full-text search (`config='simple'`, no
stemming, no stopwords). Fed a raw question like "trouve-moi la facture de la
pompe à chaleur", it treats *every* token as mandatory (websearch AND) — filler
included ("trouve", "moi", "la", "de") — so it almost always returns nothing.

This module inserts a cheap LLM pass **before** retrieval that rewrites the
question into a short list of search keywords + synonyms/abbreviations
("pompe à chaleur", "PAC", "Daikin", "facture"). Retrieval then runs on those
terms instead of the raw sentence.

Design rules:
- **Best-effort**: any failure (LLM error, timeout, empty/garbage output)
  degrades gracefully to the original question — expansion never makes retrieval
  worse than it is today.
- The cleaned original question is **always** kept as a fallback term.
- Logged under its own feature name (`agent_query_expansion`) so the extra call
  stays visible in ``AIUsageLog`` separately from the answer call.
"""
from __future__ import annotations

import json
import logging
import re
from uuid import UUID

from .llm import LLMClient

logger = logging.getLogger(__name__)

FEATURE_NAME = "agent_query_expansion"

# Keep the expansion cheap: a handful of terms is plenty for lexical retrieval,
# and the response is a short comma-separated list.
MAX_TERMS = 8
MIN_TERM_LEN = 2
EXPANSION_MAX_TOKENS = 128

EXPANSION_SYSTEM_PROMPT = """You turn a household member's natural-language \
question into search keywords for a lexical (keyword) full-text search engine.

Return ONLY a comma-separated list of search terms. No sentences, no \
explanation, no labels, no quotes.

Rules:
- Drop filler and stopwords (trouve-moi, peux-tu, est-ce que, la, de, my, the, \
please, …). Keep only meaningful nouns, proper names, brands, places, dates, \
amounts.
- Add obvious synonyms and common abbreviations that could appear in the stored \
data. Examples: "pompe à chaleur" → also "PAC"; "assurance habitation" → also \
"MRH"; "voiture" → also "auto". Keep additions short.
- Keep proper nouns and brand names as-is (Engie, Daikin, …).
- Answer in the same language as the question, but you may add well-known \
abbreviations from any language.
- Output 3 to 8 terms. Prefer single words or short two-word phrases.
"""


def expand(
    question: str,
    *,
    client: LLMClient,
    household_id: UUID | str,
    user_id: int | None = None,
) -> list[str]:
    """Return search terms for ``question``.

    The result always contains the cleaned original question as a fallback,
    followed by the LLM-extracted keywords/synonyms (deduped, order preserved).
    Any failure degrades to ``[original]`` — the caller can always run retrieval.
    """
    original = (question or "").strip()
    terms: list[str] = [original] if original else []

    if not original:
        return terms

    try:
        response = client.complete(
            system=EXPANSION_SYSTEM_PROMPT,
            user=original,
            feature=FEATURE_NAME,
            household_id=household_id,
            user_id=user_id,
            max_tokens=EXPANSION_MAX_TOKENS,
            metadata={"stage": "query_expansion"},
        )
    except Exception as exc:  # noqa: BLE001 — expansion is best-effort by design
        logger.warning("query_expansion: LLM call failed, using raw question: %s", exc)
        return _dedupe(terms)

    return _dedupe(terms + _parse_terms(response.text))


def _parse_terms(raw: str) -> list[str]:
    """Parse the model output into a clean list of terms.

    Accepts a comma-separated list (the requested format), a newline list, or a
    JSON array — models drift, so we stay lenient.
    """
    text = (raw or "").strip()
    if not text:
        return []

    # A model may wrap the list in a JSON array despite the instructions.
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        data = None
    if isinstance(data, list):
        return _clean([str(item) for item in data])

    return _clean(re.split(r"[,\n;]+", text))


def _clean(parts: list[str]) -> list[str]:
    """Strip bullets/quotes/whitespace, drop tiny tokens, cap at ``MAX_TERMS``."""
    out: list[str] = []
    for part in parts:
        term = part.strip().strip("-•*\"'`").strip()
        if len(term) < MIN_TERM_LEN:
            continue
        out.append(term)
        if len(out) >= MAX_TERMS:
            break
    return out


def _dedupe(terms: list[str]) -> list[str]:
    """Case-insensitive dedupe, preserving first-seen order."""
    seen: set[str] = set()
    out: list[str] = []
    for term in terms:
        key = term.casefold()
        if not term or key in seen:
            continue
        seen.add(key)
        out.append(term)
    return out
