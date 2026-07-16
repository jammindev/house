"""
Entity-anchored context for the agent.

A conversation can be *anchored* to a household entity (a project, a zone, an
equipment…). When it is, we pre-inject that entity's full context into the
conversation so the agent already knows it — no `search_household` round-trip
needed for facts about the anchor itself.

``build_entity_context(entity_type, object_id, household)`` is the generic
builder. It reuses the exact same machinery the ``get_entity`` / ``get_related``
tools use (``searchables`` registry, ``retrieval.hit_from_instance``,
``prompts.render_context_block``), so:

- the anchor entity is rendered with its full content (like ``get_entity``);
- every item linked to it via ``spec.related`` is rendered as its own citable
  Hit (like ``get_related``);
- the resulting ``hits`` are seeded into the orchestrator's citation pool so the
  model can cite the anchor and its neighbours honestly.

Generic by construction: any entity registered in ``agent.searchables`` (with an
optional ``related`` callable) can anchor a conversation, with zero change here.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from . import retrieval, searchables
from .prompts import render_context_block
from .retrieval import Hit
from .tools import (
    RELATED_CHAR_BUDGET_PER_HIT,
    RELATED_CONTENT_TOP_N,
    RELATED_MAX_ITEMS,
    RELATED_TOTAL_CHAR_BUDGET,
    resolve_entity,
)

logger = logging.getLogger(__name__)


@dataclass
class EntityContext:
    """The pre-injected context of an anchored entity.

    ``label`` is the anchor's human-readable name (for the preamble heading).
    ``rendered`` is the citable context block (anchor + related items) fed into
    the conversation. ``hits`` seeds the orchestrator's citation pool.
    """

    label: str
    rendered: str
    hits: list[Hit] = field(default_factory=list)


def build_entity_context(
    entity_type: str,
    object_id: str,
    household,
) -> EntityContext | None:
    """Build the pre-injected context for one anchor entity, or None.

    Returns ``None`` when the anchor can't be resolved (unknown type, malformed
    id, or the row no longer exists — an orphaned anchor). The caller then runs
    the agent without a pre-injected context, exactly like an unanchored chat.
    """
    resolved, _error = resolve_entity(entity_type, object_id, household)
    if resolved is None:
        logger.info(
            "agent.context: unresolved anchor %s:%s for household %s",
            entity_type,
            object_id,
            getattr(household, "id", None),
        )
        return None
    spec, obj = resolved

    # Anchor first (full content), then everything linked to it — each item as
    # its own citable Hit, mirroring get_entity + get_related.
    hits: list[Hit] = [retrieval.hit_from_instance(spec, obj)]
    hits.extend(_related_hits(spec, obj, household))

    rendered = render_context_block(
        hits,
        content_top_n=RELATED_CONTENT_TOP_N,
        char_budget_per_hit=RELATED_CHAR_BUDGET_PER_HIT,
        total_char_budget=RELATED_TOTAL_CHAR_BUDGET,
    )
    return EntityContext(
        label=searchables.resolve_label(spec, obj),
        rendered=rendered,
        hits=hits,
    )


def _related_hits(spec, obj, household) -> list[Hit]:
    """Turn the anchor's related instances into citable hits (scoped, bounded).

    Same walk and guards as ``tools._get_related_handler``: cap the count, skip
    unregistered types, and never surface an item from another household. Linked
    documents are included automatically via ``gather_related``.
    """
    from .related import gather_related

    hits: list[Hit] = []
    for rel in gather_related(spec, obj)[:RELATED_MAX_ITEMS]:
        rel_spec = searchables.find_spec_for_instance(rel)
        if rel_spec is None:
            continue
        if getattr(rel, "household_id", household.id) != household.id:
            continue
        hits.append(retrieval.hit_from_instance(rel_spec, rel))
    return hits
