"""
User-memory service — single source of truth for agent memory writes.

The agent's ``manage_memory`` tool AND the ``/api/agent/memories/`` viewset both
go through these functions, so validation (via ``AgentMemorySerializer``), the
per-user cap and the (household, user) scoping live in one place.

Memories are durable facts about the USER ("prefers gardening on weekends"),
never household data (that lives in its own models and always wins on conflict).
They are injected into the system prompt of every turn when the user's
``agent_memory_enabled`` flag is on; see ``prompts.build_system_prompt``.
"""
from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError

from .models import AgentMemory

# Hard cap per (household, user). When a save goes over, the least recently
# touched memories are dropped silently — the prompt block stays bounded and
# stale facts age out instead of erroring.
MEMORY_LIMIT = 50


def memory_enabled(user) -> bool:
    """True when automatic capture + injection is on for this user."""
    return bool(getattr(user, "agent_memory_enabled", False))


def user_memories(household, user) -> list[AgentMemory]:
    """The user's memories in this household, most recently touched first."""
    if user is None or getattr(user, "pk", None) is None:
        return []
    return list(
        AgentMemory.objects.filter(household=household, created_by=user)[:MEMORY_LIMIT]
    )


def resolve_memory(household, user, memory_id) -> AgentMemory | None:
    """Look up one memory by id, scoped to (household, user). None if not theirs."""
    if not memory_id:
        return None
    try:
        return AgentMemory.objects.get(pk=memory_id, household=household, created_by=user)
    except (AgentMemory.DoesNotExist, ValueError, DjangoValidationError):
        # DjangoValidationError is raised (not ValueError) when an invalid UUID
        # is passed to a UUIDField pk lookup via get_prep_value in Django 4.2+.
        return None


def save_memory(household, user, content: str) -> AgentMemory:
    """Create a memory for (household, user), enforcing validation and the cap."""
    memory = AgentMemory.objects.create(
        household=household, created_by=user, content=_validated_content(content)
    )
    _trim_over_limit(household, user)
    return memory


def update_memory(memory: AgentMemory, content: str, *, user=None) -> AgentMemory:
    """Replace a memory's content — the edited version is what the agent sees."""
    memory.content = _validated_content(content)
    if user is not None:
        memory.updated_by = user
    memory.save(update_fields=["content", "updated_by", "updated_at"])
    return memory


def forget_memory(memory: AgentMemory) -> None:
    memory.delete()


def clear_memories(household, user) -> int:
    """Delete ALL memories of (household, user). Returns the number removed."""
    deleted, _ = AgentMemory.objects.filter(household=household, created_by=user).delete()
    return deleted


def _validated_content(content: str) -> str:
    from .serializers import AgentMemorySerializer

    serializer = AgentMemorySerializer(data={"content": content})
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data["content"]


def _trim_over_limit(household, user) -> None:
    overflow = AgentMemory.objects.filter(household=household, created_by=user)[
        MEMORY_LIMIT:
    ].values_list("pk", flat=True)
    if overflow:
        AgentMemory.objects.filter(pk__in=list(overflow)).delete()
