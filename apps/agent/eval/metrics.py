"""Retrieval quality metrics (parcours 21 lot 4) — pure, network-free.

Ids are opaque strings (``"entity_type:id"``) so lexical, semantic and hybrid
runs are comparable and a golden set can pin the exact expected entities.
"""
from __future__ import annotations

from collections.abc import Iterable


def recall_at_k(retrieved: list[str], relevant: Iterable[str], k: int) -> float:
    """Fraction of the relevant ids found in the top-``k`` retrieved ids.

    Returns 0.0 when there are no relevant ids (an empty golden entry can't be
    "recalled") — the caller decides whether to skip such entries.
    """
    relevant_set = set(relevant)
    if not relevant_set:
        return 0.0
    top = set(retrieved[:k])
    return len(top & relevant_set) / len(relevant_set)


def reciprocal_rank(retrieved: list[str], relevant: Iterable[str]) -> float:
    """Reciprocal rank of the first relevant id (0.0 if none present)."""
    relevant_set = set(relevant)
    for index, rid in enumerate(retrieved):
        if rid in relevant_set:
            return 1.0 / (index + 1)
    return 0.0


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def evaluate(
    runs: list[tuple[list[str], Iterable[str]]], k: int
) -> dict[str, float]:
    """Aggregate recall@k and MRR over ``(retrieved, relevant)`` pairs.

    Skips entries with no relevant ids (nothing to score against).
    """
    recalls: list[float] = []
    rrs: list[float] = []
    for retrieved, relevant in runs:
        relevant_set = set(relevant)
        if not relevant_set:
            continue
        recalls.append(recall_at_k(retrieved, relevant_set, k))
        rrs.append(reciprocal_rank(retrieved, relevant_set))
    return {
        "queries": len(recalls),
        "recall_at_k": mean(recalls),
        "mrr": mean(rrs),
    }
