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
