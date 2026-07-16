"""
Conversation plumbing shared by every channel (web API views, Telegram bot).

The two moves around ``service.ask`` when a conversation is involved:
``ask_inputs`` builds the bounded history + anchor from prior turns, and
``persist_turns`` writes the question/answer pair atomically. Extracted from
``views.py`` unchanged so non-HTTP channels reuse the exact same semantics
(history limit, auto-title, ``last_message_at`` sync) instead of re-deriving
them.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .models import AgentMessage

CONVERSATION_HISTORY_LIMIT = 20
AUTO_TITLE_MAX_LEN = 60

# Cap on user-pinned contexts per conversation. Each pin expands into its full
# context (item + linked items) at ask-time, so this bounds the system-prompt
# budget — not a business rule, a guardrail.
MAX_PINNED_CONTEXTS = 10


def citations_to_json(citations) -> list[dict]:
    return [
        {
            "entity_type": c.entity_type,
            "id": str(c.id),
            "label": c.label,
            "snippet": c.snippet,
            "url_path": c.url_path,
        }
        for c in citations
    ]


def derive_title(question: str) -> str:
    return " ".join((question or "").split())[:AUTO_TITLE_MAX_LEN]


def ask_inputs(conversation) -> tuple[list[dict], tuple[str, str] | None]:
    """History (bounded, oldest first) + anchor of a conversation, for service.ask*."""
    prior = list(conversation.messages.all())[-CONVERSATION_HISTORY_LIMIT:]
    history = [{"role": m.role, "content": m.content} for m in prior]
    context_entity = (
        (conversation.context_entity_type, conversation.context_object_id)
        if conversation.has_context
        else None
    )
    return history, context_entity


def pinned_entities(conversation) -> list[tuple[str, str]]:
    """The conversation's pinned contexts as ``(entity_type, object_id)`` tuples.

    Passed to ``service.ask(pinned_entities=…)`` so each is pre-injected alongside
    the anchor. Kept separate from ``ask_inputs`` so existing 2-tuple callers
    (Telegram, tests) stay unchanged.
    """
    result: list[tuple[str, str]] = []
    for entry in conversation.pinned_contexts or []:
        entity_type = (entry or {}).get("entity_type") or ""
        object_id = str((entry or {}).get("object_id") or "")
        if entity_type and object_id:
            result.append((entity_type, object_id))
    return result


def pin_context(conversation, entity_type: str, object_id: str) -> bool:
    """Add a pinned context (idempotent). Returns True if added, False if already present.

    Raises ``ValueError`` when the cap is reached. Persists on change only.
    """
    object_id = str(object_id)
    existing = list(conversation.pinned_contexts or [])
    for entry in existing:
        if (entry or {}).get("entity_type") == entity_type and str(
            (entry or {}).get("object_id") or ""
        ) == object_id:
            return False
    if len(existing) >= MAX_PINNED_CONTEXTS:
        raise ValueError(
            f"A conversation can pin at most {MAX_PINNED_CONTEXTS} contexts."
        )
    existing.append({"entity_type": entity_type, "object_id": object_id})
    conversation.pinned_contexts = existing
    conversation.save(update_fields=["pinned_contexts", "updated_at"])
    return True


def unpin_context(conversation, entity_type: str, object_id: str) -> bool:
    """Remove a pinned context. Returns True if removed, False if it wasn't pinned."""
    object_id = str(object_id)
    existing = list(conversation.pinned_contexts or [])
    filtered = [
        entry
        for entry in existing
        if not (
            (entry or {}).get("entity_type") == entity_type
            and str((entry or {}).get("object_id") or "") == object_id
        )
    ]
    if len(filtered) == len(existing):
        return False
    conversation.pinned_contexts = filtered
    conversation.save(update_fields=["pinned_contexts", "updated_at"])
    return True


def persist_turns(conversation, question: str, user, result) -> AgentMessage:
    """Persist both turns atomically — a failed call leaves the conversation untouched."""
    with transaction.atomic():
        AgentMessage.objects.create(
            conversation=conversation,
            role=AgentMessage.Role.USER,
            content=question,
            created_by=user,
        )
        agent_msg = AgentMessage.objects.create(
            conversation=conversation,
            role=AgentMessage.Role.AGENT,
            content=result.answer,
            citations=citations_to_json(result.citations),
            metadata=result.metadata,
        )
        conversation.last_message_at = timezone.now()
        if not conversation.title:
            conversation.title = derive_title(question)
        conversation.save(update_fields=["last_message_at", "title", "updated_at"])
    return agent_msg
