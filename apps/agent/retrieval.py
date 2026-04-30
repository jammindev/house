"""
Naive full-text retrieval over household entities.

Iterates over the registry, runs a `SearchVector` query per model with
`config='simple'` (multi-tenant safe — no stemming), merges hits, and ranks
them globally by the Postgres `SearchRank`. Snippets are produced via
`SearchHeadline`.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.contrib.postgres.search import (
    SearchHeadline,
    SearchQuery,
    SearchRank,
    SearchVector,
)
from django.db.models import F

from .searchables import REGISTRY, SearchableSpec, resolve_label

SNIPPET_MAX_WORDS = 30
SNIPPET_MIN_WORDS = 8

# `simple_unaccent` is created in apps/agent/migrations/0001_initial.py.
# It is `simple` (no stemming, no stopwords) + `unaccent` so that Engie matches
# ENGIE and café matches cafe. Stays multi-tenant safe (no language hardcode).
_SEARCH_CONFIG = "simple_unaccent"


@dataclass
class Hit:
    entity_type: str
    id: Any
    label: str
    snippet: str
    rank: float
    url_path: str


def _spec_url(spec: SearchableSpec, instance) -> str:
    return spec.url_template.format(id=instance.pk)


def _build_query(query: str) -> SearchQuery:
    """Turn a free-form user query into a tsquery suitable for `simple` config.

    We use `search_type='websearch'` so quoted phrases and operators behave
    intuitively, and pass `config='simple'` to keep things multi-tenant safe.
    """
    return SearchQuery(query, config=_SEARCH_CONFIG, search_type="websearch")


def _vector_for_fields(fields: tuple[str, ...]) -> SearchVector:
    """Build a SearchVector that combines all configured fields with equal weight."""
    return SearchVector(*fields, config=_SEARCH_CONFIG)


def _search_one(spec: SearchableSpec, household_id: UUID, query: str, limit: int) -> list[Hit]:
    """Run the search for a single registered model and return hits."""
    if not spec.search_fields:
        return []

    ts_query = _build_query(query)
    vector = _vector_for_fields(spec.search_fields)

    # First headline candidate: the field that produced the strongest match.
    # We compute SearchHeadline per field and pick the longest non-empty one
    # at hit-construction time. This keeps the SQL simple while still giving
    # the agent useful context around the match.
    headlines = {
        f"_snippet_{field}": SearchHeadline(
            field,
            ts_query,
            config=_SEARCH_CONFIG,
            start_sel="<<",
            stop_sel=">>",
            max_words=SNIPPET_MAX_WORDS,
            min_words=SNIPPET_MIN_WORDS,
            short_word=0,
        )
        for field in spec.search_fields
    }

    qs = (
        spec.model.objects.filter(household_id=household_id)
        .annotate(_search_vector=vector)
        .annotate(_rank=SearchRank(F("_search_vector"), ts_query))
        .annotate(**headlines)
        .filter(_search_vector=ts_query)
        .order_by("-_rank")[:limit]
    )

    hits: list[Hit] = []
    for obj in qs:
        snippet = _pick_snippet(obj, spec.search_fields)
        hits.append(
            Hit(
                entity_type=spec.entity_type,
                id=obj.pk,
                label=resolve_label(spec, obj),
                snippet=snippet,
                rank=float(obj._rank or 0.0),
                url_path=_spec_url(spec, obj),
            )
        )
    return hits


def _pick_snippet(obj, fields: tuple[str, ...]) -> str:
    """Pick the longest non-empty headline among annotated candidates."""
    candidates = [getattr(obj, f"_snippet_{field}", "") or "" for field in fields]
    candidates = [c for c in candidates if c.strip()]
    if not candidates:
        return ""
    # Prefer the candidate that actually contains the highlight markers,
    # falling back to the longest one.
    highlighted = [c for c in candidates if "<<" in c and ">>" in c]
    pool = highlighted or candidates
    return max(pool, key=len)


def search(household_id: UUID, query: str, limit: int = 20) -> list[Hit]:
    """Return up to `limit` hits across all registered entities, ranked desc."""
    if not query or not query.strip():
        return []

    all_hits: list[Hit] = []
    for spec in REGISTRY:
        all_hits.extend(_search_one(spec, household_id, query, limit))

    all_hits.sort(key=lambda h: h.rank, reverse=True)
    return all_hits[:limit]
