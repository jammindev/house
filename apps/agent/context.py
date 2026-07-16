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


@dataclass
class ContextItem:
    """One entity currently visible in the conversation's context, for the UI.

    Mirrors exactly what ``ask`` injects: the anchor, its linked items, and each
    pinned entity (+ its linked items). ``origin`` tells the frontend which chips
    are user-removable (``pinned``) versus structural (``anchor`` / ``related``).
    ``available`` is False for a pinned pointer whose row no longer resolves — the
    chip is still shown so the user can drop the dangling pin.
    """

    entity_type: str
    object_id: str
    label: str
    url: str
    origin: str  # 'anchor' | 'related' | 'pinned'
    available: bool = True


def describe_conversation_context(conversation, household) -> list[ContextItem]:
    """Resolve a conversation's full injected context into display items.

    Single source of truth for the "what I know" panel: it walks the exact same
    roots ``ask`` injects — the anchor first, then each pinned entity — and reuses
    ``build_entity_context`` so a chip appears iff the model actually receives that
    item. Items are deduped by ``(entity_type, id)`` (first origin wins, anchor >
    pinned > related). A pinned pointer that no longer resolves is surfaced as an
    ``available=False`` chip so the dangling pin remains removable.
    """
    roots: list[tuple[str, str, str]] = []
    if conversation.has_context:
        roots.append(
            ("anchor", conversation.context_entity_type, conversation.context_object_id)
        )
    for entry in conversation.pinned_contexts or []:
        entity_type = (entry or {}).get("entity_type") or ""
        object_id = str((entry or {}).get("object_id") or "")
        if entity_type and object_id:
            roots.append(("pinned", entity_type, object_id))

    items: list[ContextItem] = []
    seen: set[tuple[str, str]] = set()
    for origin, entity_type, object_id in roots:
        ctx = build_entity_context(entity_type, object_id, household)
        if ctx is None:
            # Unresolved anchor is silent (structural); a dangling pin stays
            # visible so the user can remove it.
            if origin == "pinned":
                key = (entity_type, object_id)
                if key not in seen:
                    seen.add(key)
                    items.append(
                        ContextItem(
                            entity_type=entity_type,
                            object_id=object_id,
                            label=f"{entity_type}:{object_id}",
                            url="",
                            origin="pinned",
                            available=False,
                        )
                    )
            continue
        for index, hit in enumerate(ctx.hits):
            key = (hit.entity_type, str(hit.id))
            if key in seen:
                continue
            seen.add(key)
            items.append(
                ContextItem(
                    entity_type=hit.entity_type,
                    object_id=str(hit.id),
                    label=hit.label,
                    url=hit.url_path,
                    # The root hit carries the origin; its linked items are 'related'.
                    origin=origin if index == 0 else "related",
                )
            )
    return items


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
