"""Tests for the agent user-memory feature.

Covers four areas:
1. Service (agent.memory) — save/update/forget/clear, scoping, cap trim, ordering.
2. Tool (manage_memory via tools.dispatch) — events, DB side-effects, error paths.
3. Prompt injection (prompts.build_system_prompt + service.ask with stub) — memory_mode
   variants, memory block content, memory_events metadata.
4. API (AgentMemoryViewSet) — list/create/patch/delete/clear, isolation, permissions.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from agent import memory as memory_service
from agent import tools
from agent.llm import LLMRunResponse, ToolCall
from agent.memory import MEMORY_LIMIT
from agent.models import AgentMemory
from agent.prompts import build_system_prompt
from households.models import Household, HouseholdMember


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _make_household(name: str = "Test House") -> Household:
    return Household.objects.create(name=name)


def _add_member(user, household, role=HouseholdMember.Role.OWNER):
    HouseholdMember.objects.create(user=user, household=household, role=role)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# Stub LLM client (mirrors test_service.py pattern)
# ---------------------------------------------------------------------------


def _run_text(text: str) -> LLMRunResponse:
    return LLMRunResponse(
        assistant_blocks=[{"type": "text", "text": text}],
        tool_calls=[],
        text=text,
        stop_reason="end_turn",
        input_tokens=5,
        output_tokens=7,
        duration_ms=3,
        model="stub-model",
    )


def _run_manage_memory(action: str, *, call_id: str = "toolu_m", **kwargs) -> LLMRunResponse:
    """A tool-use turn requesting manage_memory."""
    tool_input = {"action": action, **kwargs}
    call = ToolCall(id=call_id, name=tools.MANAGE_MEMORY, input=tool_input)
    return LLMRunResponse(
        assistant_blocks=[
            {"type": "tool_use", "id": call_id, "name": tools.MANAGE_MEMORY, "input": tool_input}
        ],
        tool_calls=[call],
        text="",
        stop_reason="tool_use",
        input_tokens=4,
        output_tokens=2,
        duration_ms=2,
        model="stub-model",
    )


@dataclass
class _ToolUseClient:
    script: list[LLMRunResponse] = field(default_factory=list)
    run_calls: list[dict[str, Any]] = field(default_factory=list)
    provider: str = "stub"

    def run(self, **kwargs) -> LLMRunResponse:
        self.run_calls.append(kwargs)
        idx = min(len(self.run_calls) - 1, len(self.script) - 1)
        return self.script[idx]

    def complete(self, **kwargs):
        from agent.llm import LLMResponse

        return LLMResponse(text="", input_tokens=1, output_tokens=1, duration_ms=1, model="stub")


# ===========================================================================
# 1. Service tests
# ===========================================================================


@pytest.mark.django_db
class TestMemoryServiceSave:
    """memory_service.save_memory creates a record and validates content."""

    def test_save_creates_memory_in_db(self, household, owner):
        mem = memory_service.save_memory(household, owner, "Prefers coffee in the morning")
        assert AgentMemory.objects.filter(pk=mem.pk).exists()
        db_mem = AgentMemory.objects.get(pk=mem.pk)
        assert db_mem.content == "Prefers coffee in the morning"
        assert db_mem.household == household
        assert db_mem.created_by == owner

    def test_save_returns_memory_instance(self, household, owner):
        mem = memory_service.save_memory(household, owner, "Vegetarian")
        assert isinstance(mem, AgentMemory)
        assert mem.content == "Vegetarian"

    def test_save_empty_content_raises(self, household, owner):
        from rest_framework.exceptions import ValidationError

        with pytest.raises(ValidationError):
            memory_service.save_memory(household, owner, "")

    def test_save_content_too_long_raises(self, household, owner):
        from rest_framework.exceptions import ValidationError

        with pytest.raises(ValidationError):
            memory_service.save_memory(household, owner, "x" * 501)

    def test_save_trims_whitespace_in_content(self, household, owner):
        mem = memory_service.save_memory(household, owner, "  likes tea  ")
        assert mem.content == "likes tea"


@pytest.mark.django_db
class TestMemoryServiceUpdate:
    """memory_service.update_memory replaces content in-place."""

    def test_update_replaces_content_in_db(self, household, owner):
        mem = memory_service.save_memory(household, owner, "Original")
        updated = memory_service.update_memory(mem, "Updated")
        mem.refresh_from_db()
        assert mem.content == "Updated"
        assert updated.pk == mem.pk

    def test_update_empty_content_raises(self, household, owner):
        from rest_framework.exceptions import ValidationError

        mem = memory_service.save_memory(household, owner, "Original")
        with pytest.raises(ValidationError):
            memory_service.update_memory(mem, "")

    def test_update_touches_updated_at(self, household, owner):
        import time

        mem = memory_service.save_memory(household, owner, "Before")
        before_ts = mem.updated_at
        time.sleep(0.01)
        memory_service.update_memory(mem, "After")
        mem.refresh_from_db()
        assert mem.updated_at >= before_ts


@pytest.mark.django_db
class TestMemoryServiceForget:
    """memory_service.forget_memory deletes the record."""

    def test_forget_removes_from_db(self, household, owner):
        mem = memory_service.save_memory(household, owner, "Durable fact")
        pk = mem.pk
        memory_service.forget_memory(mem)
        assert not AgentMemory.objects.filter(pk=pk).exists()


@pytest.mark.django_db
class TestMemoryServiceClear:
    """memory_service.clear_memories deletes all memories of (household, user)."""

    def test_clear_deletes_all_user_memories_and_returns_count(self, household, owner):
        for i in range(3):
            memory_service.save_memory(household, owner, f"Fact {i}")
        deleted = memory_service.clear_memories(household, owner)
        assert deleted == 3
        assert AgentMemory.objects.filter(household=household, created_by=owner).count() == 0

    def test_clear_does_not_touch_other_user_memories(self, household, owner):
        other = UserFactory(email="other-clear@example.com")
        _add_member(other, household, role=HouseholdMember.Role.MEMBER)
        memory_service.save_memory(household, owner, "Owner fact")
        memory_service.save_memory(household, other, "Other fact")
        memory_service.clear_memories(household, owner)
        assert AgentMemory.objects.filter(household=household, created_by=other).count() == 1

    def test_clear_returns_zero_when_nothing_to_delete(self, household, owner):
        assert memory_service.clear_memories(household, owner) == 0


@pytest.mark.django_db
class TestMemoryServiceUserMemories:
    """user_memories returns the right records in the right order."""

    def test_returns_memories_for_the_given_household_and_user(self, household, owner):
        memory_service.save_memory(household, owner, "Fact A")
        memory_service.save_memory(household, owner, "Fact B")
        mems = memory_service.user_memories(household, owner)
        assert len(mems) == 2
        contents = {m.content for m in mems}
        assert contents == {"Fact A", "Fact B"}

    def test_returns_most_recently_updated_first(self, household, owner):
        import time

        m1 = memory_service.save_memory(household, owner, "First")
        time.sleep(0.01)
        m2 = memory_service.save_memory(household, owner, "Second")
        mems = memory_service.user_memories(household, owner)
        # Most recently touched first (ordering = ["-updated_at"])
        assert mems[0].pk == m2.pk
        assert mems[1].pk == m1.pk

    def test_does_not_return_other_users_memories(self, household, owner):
        other = UserFactory(email="other-mem@example.com")
        _add_member(other, household, role=HouseholdMember.Role.MEMBER)
        memory_service.save_memory(household, other, "Other user fact")
        mems = memory_service.user_memories(household, owner)
        assert mems == []

    def test_does_not_return_other_household_memories(self, household, owner):
        other_hh = _make_household("Other House")
        _add_member(owner, other_hh)
        memory_service.save_memory(other_hh, owner, "Other household fact")
        mems = memory_service.user_memories(household, owner)
        assert mems == []

    def test_returns_empty_list_for_none_user(self, household):
        assert memory_service.user_memories(household, None) == []

    def test_returns_empty_list_for_user_without_pk(self, household):
        user = UserFactory.build()  # not saved → no pk
        assert memory_service.user_memories(household, user) == []


@pytest.mark.django_db
class TestMemoryServiceResolve:
    """resolve_memory returns None when the memory doesn't belong to the caller."""

    def test_resolves_own_memory(self, household, owner):
        mem = memory_service.save_memory(household, owner, "My fact")
        found = memory_service.resolve_memory(household, owner, str(mem.pk))
        assert found is not None
        assert found.pk == mem.pk

    def test_returns_none_for_other_users_memory(self, household, owner):
        other = UserFactory(email="resolve-other@example.com")
        _add_member(other, household, role=HouseholdMember.Role.MEMBER)
        mem = memory_service.save_memory(household, other, "Other fact")
        assert memory_service.resolve_memory(household, owner, str(mem.pk)) is None

    def test_returns_none_for_other_household_memory(self, household, owner):
        other_hh = _make_household("Other House Resolve")
        _add_member(owner, other_hh)
        mem = memory_service.save_memory(other_hh, owner, "Other HH fact")
        assert memory_service.resolve_memory(household, owner, str(mem.pk)) is None

    def test_returns_none_for_invalid_uuid(self, household, owner):
        assert memory_service.resolve_memory(household, owner, "not-a-uuid") is None

    def test_returns_none_for_empty_memory_id(self, household, owner):
        assert memory_service.resolve_memory(household, owner, "") is None


@pytest.mark.django_db
class TestMemoryServiceCapTrim:
    """Saving more than MEMORY_LIMIT memories trims the oldest."""

    def test_save_over_limit_trims_oldest(self, household, owner):
        # Save MEMORY_LIMIT + 2 memories
        mems = []
        for i in range(MEMORY_LIMIT + 2):
            m = memory_service.save_memory(household, owner, f"Fact {i}")
            mems.append(m)
        total = AgentMemory.objects.filter(household=household, created_by=owner).count()
        assert total == MEMORY_LIMIT

    def test_most_recently_updated_are_kept(self, household, owner):
        # Fill to the limit, then add one more
        first_pk = None
        for i in range(MEMORY_LIMIT):
            m = memory_service.save_memory(household, owner, f"Fact {i}")
            if i == 0:
                first_pk = m.pk  # oldest
        # Adding one more should drop the oldest
        memory_service.save_memory(household, owner, "Brand new fact")
        assert not AgentMemory.objects.filter(pk=first_pk).exists()


# ===========================================================================
# 2. Tool tests (manage_memory via dispatch)
# ===========================================================================


@pytest.mark.django_db
class TestManageMemoryToolRegistration:
    """manage_memory is registered at boot."""

    def test_manage_memory_registered(self):
        assert tools.MANAGE_MEMORY in tools.REGISTRY

    def test_schema_requires_action(self):
        schema = tools.REGISTRY[tools.MANAGE_MEMORY].to_schema()
        assert "action" in schema["input_schema"]["required"]


@pytest.mark.django_db
class TestManageMemoryToolSave:
    """manage_memory action='save' creates a memory and returns a saved event."""

    def test_save_creates_memory_in_db(self, household, owner):
        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "save", "content": "Is vegetarian"},
            household=household,
            user=owner,
        )
        assert AgentMemory.objects.filter(household=household, created_by=owner).count() == 1
        mem = AgentMemory.objects.get(household=household, created_by=owner)
        assert mem.content == "Is vegetarian"
        assert len(result.memories) == 1
        event = result.memories[0]
        assert event["action"] == "saved"
        assert event["id"] == str(mem.pk)
        assert event["content"] == "Is vegetarian"

    def test_save_without_content_returns_error_no_event(self, household, owner):
        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "save", "content": ""},
            household=household,
            user=owner,
        )
        assert "save needs a content" in result.rendered
        assert result.memories == []
        assert AgentMemory.objects.filter(household=household, created_by=owner).count() == 0

    def test_save_without_content_key_returns_error(self, household, owner):
        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "save"},
            household=household,
            user=owner,
        )
        assert "save needs a content" in result.rendered
        assert result.memories == []


@pytest.mark.django_db
class TestManageMemoryToolUpdate:
    """manage_memory action='update' replaces content and returns an updated event."""

    def test_update_replaces_content_in_db(self, household, owner):
        mem = memory_service.save_memory(household, owner, "Old content")
        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "update", "memory_id": str(mem.pk), "content": "New content"},
            household=household,
            user=owner,
        )
        mem.refresh_from_db()
        assert mem.content == "New content"
        assert len(result.memories) == 1
        event = result.memories[0]
        assert event["action"] == "updated"
        assert event["id"] == str(mem.pk)
        assert event["content"] == "New content"
        assert event["previous"] == "Old content"

    def test_update_unknown_memory_id_returns_error_no_event(self, household, owner):
        import uuid

        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "update", "memory_id": str(uuid.uuid4()), "content": "new"},
            household=household,
            user=owner,
        )
        assert "no such memory_id" in result.rendered
        assert result.memories == []

    def test_update_without_content_returns_error(self, household, owner):
        mem = memory_service.save_memory(household, owner, "Fact")
        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "update", "memory_id": str(mem.pk), "content": ""},
            household=household,
            user=owner,
        )
        assert "update needs a content" in result.rendered
        assert result.memories == []


@pytest.mark.django_db
class TestManageMemoryToolForget:
    """manage_memory action='forget' deletes the memory and returns a forgotten event."""

    def test_forget_deletes_memory_from_db(self, household, owner):
        mem = memory_service.save_memory(household, owner, "Forgotten fact")
        pk = mem.pk
        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "forget", "memory_id": str(pk)},
            household=household,
            user=owner,
        )
        assert not AgentMemory.objects.filter(pk=pk).exists()
        assert len(result.memories) == 1
        event = result.memories[0]
        assert event["action"] == "forgotten"
        assert event["id"] == str(pk)
        assert event["content"] == "Forgotten fact"

    def test_forget_unknown_memory_id_returns_error_no_event(self, household, owner):
        import uuid

        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "forget", "memory_id": str(uuid.uuid4())},
            household=household,
            user=owner,
        )
        assert "no such memory_id" in result.rendered
        assert result.memories == []


@pytest.mark.django_db
class TestManageMemoryToolEdgeCases:
    """Edge cases: user=None, unknown action, memories field on ToolResult."""

    def test_user_none_returns_unavailable_message(self, household):
        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "save", "content": "fact"},
            household=household,
            user=None,
        )
        assert "memory is unavailable on this call" in result.rendered
        assert result.memories == []

    def test_unknown_action_returns_error(self, household, owner):
        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "teleport"},
            household=household,
            user=owner,
        )
        assert "unknown action" in result.rendered
        assert result.memories == []

    def test_tool_result_memories_is_empty_by_default_for_non_memory_tools(
        self, household, owner
    ):
        """ToolResult.memories defaults to [] for non-memory tools."""
        result = tools.dispatch(
            tools.SEARCH_HOUSEHOLD,
            {"query": ""},
            household=household,
            user=owner,
        )
        assert result.memories == []

    def test_forget_does_not_touch_other_users_memory(self, household, owner):
        other = UserFactory(email="other-forget-tool@example.com")
        _add_member(other, household, role=HouseholdMember.Role.MEMBER)
        mem = memory_service.save_memory(household, other, "Other fact")
        result = tools.dispatch(
            tools.MANAGE_MEMORY,
            {"action": "forget", "memory_id": str(mem.pk)},
            household=household,
            user=owner,  # different user
        )
        # Not found for this user → error, and the memory still exists
        assert "no such memory_id" in result.rendered
        assert AgentMemory.objects.filter(pk=mem.pk).exists()


# ===========================================================================
# 3. Prompt injection tests
# ===========================================================================


@pytest.mark.django_db
class TestBuildSystemPromptMemoryMode:
    """build_system_prompt injects memory content correctly per mode."""

    def test_auto_mode_with_memories_includes_content_and_id(self, household, owner):
        mem = memory_service.save_memory(household, owner, "Is vegetarian")
        prompt = build_system_prompt(memory_mode="auto", memories=[mem])
        assert "Is vegetarian" in prompt
        assert f"memory_id={mem.pk}" in prompt

    def test_auto_mode_without_memories_still_has_memory_tool_addendum(self):
        prompt = build_system_prompt(memory_mode="auto", memories=[])
        assert "manage_memory" in prompt
        assert "Automatic capture is ON" in prompt
        # No memory block injected when list is empty
        assert "USER MEMORY" not in prompt

    def test_manual_mode_has_memory_tool_but_no_memory_block(self):
        prompt = build_system_prompt(memory_mode="manual")
        assert "manage_memory" in prompt
        assert "Automatic capture is OFF" in prompt
        assert "USER MEMORY" not in prompt

    def test_none_mode_does_not_mention_memory_tool(self):
        prompt = build_system_prompt(memory_mode=None)
        assert "manage_memory" not in prompt
        assert "USER MEMORY" not in prompt

    def test_multiple_memories_all_appear_in_prompt(self, household, owner):
        m1 = memory_service.save_memory(household, owner, "Vegetarian")
        m2 = memory_service.save_memory(household, owner, "Likes hiking")
        prompt = build_system_prompt(memory_mode="auto", memories=[m1, m2])
        assert "Vegetarian" in prompt
        assert "Likes hiking" in prompt
        assert f"memory_id={m1.pk}" in prompt
        assert f"memory_id={m2.pk}" in prompt

    def test_auto_mode_with_anchored_includes_both_addenda(self, household, owner):
        mem = memory_service.save_memory(household, owner, "Night owl")
        prompt = build_system_prompt(anchored=True, memory_mode="auto", memories=[mem])
        assert "CURRENT ITEM CONTEXT" in prompt
        assert "manage_memory" in prompt
        assert "Night owl" in prompt


@pytest.mark.django_db
class TestServiceAskMemoryInjection:
    """service.ask passes the correct system prompt and accumulates memory_events."""

    @pytest.fixture
    def with_api_key(self, settings):
        settings.ANTHROPIC_API_KEY = "sk-test-fake"
        return settings

    def test_user_with_memory_enabled_gets_auto_mode_in_system(
        self, with_api_key, household, owner
    ):
        mem = memory_service.save_memory(household, owner, "Dislikes mornings")
        stub = _ToolUseClient(script=[_run_text("Bonjour !")])
        from agent import service

        service.ask("bonjour", household, user=owner, client=stub)
        system = stub.run_calls[0]["system"]
        assert "Dislikes mornings" in system
        assert f"memory_id={mem.pk}" in system
        assert "Automatic capture is ON" in system

    def test_user_with_memory_disabled_gets_manual_mode_in_system(
        self, with_api_key, household, owner
    ):
        owner.agent_memory_enabled = False
        owner.save(update_fields=["agent_memory_enabled"])
        stub = _ToolUseClient(script=[_run_text("ok")])
        from agent import service

        service.ask("bonjour", household, user=owner, client=stub)
        system = stub.run_calls[0]["system"]
        assert "manage_memory" in system
        assert "Automatic capture is OFF" in system
        # No memory block (nothing injected in manual mode)
        assert "USER MEMORY" not in system

    def test_no_user_system_prompt_omits_memory_entirely(
        self, with_api_key, household
    ):
        stub = _ToolUseClient(script=[_run_text("ok")])
        from agent import service

        service.ask("bonjour", household, user=None, client=stub)
        system = stub.run_calls[0]["system"]
        assert "manage_memory" not in system

    def test_save_via_stub_emits_memory_event_in_metadata(
        self, with_api_key, household, owner
    ):
        stub = _ToolUseClient(
            script=[
                _run_manage_memory("save", content="Prefers evenings"),
                _run_text("Noted!"),
            ]
        )
        from agent import service

        result = service.ask("remember I prefer evenings", household, user=owner, client=stub)
        assert len(result.metadata["memory_events"]) == 1
        event = result.metadata["memory_events"][0]
        assert event["action"] == "saved"
        assert event["content"] == "Prefers evenings"
        # DB state verified
        assert AgentMemory.objects.filter(
            household=household, created_by=owner, content="Prefers evenings"
        ).exists()

    def test_no_memory_tool_call_leaves_memory_events_empty(
        self, with_api_key, household, owner
    ):
        stub = _ToolUseClient(script=[_run_text("Bonjour !")])
        from agent import service

        result = service.ask("bonjour", household, user=owner, client=stub)
        assert result.metadata["memory_events"] == []

    def test_forget_via_stub_emits_forgotten_event(
        self, with_api_key, household, owner
    ):
        mem = memory_service.save_memory(household, owner, "Old fact")
        stub = _ToolUseClient(
            script=[
                _run_manage_memory("forget", memory_id=str(mem.pk)),
                _run_text("Done, forgotten."),
            ]
        )
        from agent import service

        result = service.ask("forget that", household, user=owner, client=stub)
        assert len(result.metadata["memory_events"]) == 1
        assert result.metadata["memory_events"][0]["action"] == "forgotten"
        # Verify DB deletion
        assert not AgentMemory.objects.filter(pk=mem.pk).exists()


# ===========================================================================
# 4. API tests (AgentMemoryViewSet)
# ===========================================================================

# URL helpers
MEMORIES_LIST_URL = "/api/agent/memories/"


def _memory_detail_url(pk) -> str:
    return reverse("agent-memory-detail", args=[pk])


def _memory_clear_url() -> str:
    return "/api/agent/memories/clear/"


@pytest.mark.django_db
class TestMemoryApiList:
    """GET /api/agent/memories/ — returns only current user's memories in active household."""

    def _create_memory(self, household, user, content="A fact"):
        return memory_service.save_memory(household, user, content)

    def test_owner_can_list_own_memories(self, household, owner):
        self._create_memory(household, owner, "Fact 1")
        self._create_memory(household, owner, "Fact 2")
        resp = _client_for(owner).get(MEMORIES_LIST_URL)
        assert resp.status_code == status.HTTP_200_OK
        contents = {item["content"] for item in resp.data}
        assert "Fact 1" in contents
        assert "Fact 2" in contents

    def test_anonymous_gets_401(self):
        resp = APIClient().get(MEMORIES_LIST_URL)
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_other_users_memories_not_visible(self, household, owner):
        other = UserFactory(email="other-list@example.com")
        _add_member(other, household, role=HouseholdMember.Role.MEMBER)
        self._create_memory(household, owner, "Owner fact")
        self._create_memory(household, other, "Other fact")
        resp = _client_for(owner).get(MEMORIES_LIST_URL)
        assert resp.status_code == status.HTTP_200_OK
        contents = {item["content"] for item in resp.data}
        assert "Owner fact" in contents
        assert "Other fact" not in contents

    def test_memories_from_other_household_not_visible(self, household, owner):
        other_hh = _make_household("Cross-Household House")
        # Add owner to the other household WITHOUT changing their active_household,
        # so the API still resolves to `household`.
        HouseholdMember.objects.create(
            user=owner, household=other_hh, role=HouseholdMember.Role.MEMBER
        )
        self._create_memory(other_hh, owner, "Other HH fact")
        self._create_memory(household, owner, "My HH fact")
        resp = _client_for(owner).get(MEMORIES_LIST_URL)
        assert resp.status_code == status.HTTP_200_OK
        contents = {item["content"] for item in resp.data}
        assert "My HH fact" in contents
        assert "Other HH fact" not in contents

    def test_response_includes_expected_fields(self, household, owner):
        self._create_memory(household, owner, "A fact")
        resp = _client_for(owner).get(MEMORIES_LIST_URL)
        assert resp.status_code == status.HTTP_200_OK
        item = resp.data[0]
        assert "id" in item
        assert "content" in item
        assert "created_at" in item
        assert "updated_at" in item


@pytest.mark.django_db
class TestMemoryApiCreate:
    """POST /api/agent/memories/ — creates a memory, enforces validation."""

    def test_owner_can_create_memory(self, household, owner):
        payload = {"content": "Prefers mornings"}
        resp = _client_for(owner).post(MEMORIES_LIST_URL, payload, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["content"] == "Prefers mornings"
        # DB state
        mem = AgentMemory.objects.get(id=resp.data["id"])
        assert mem.content == "Prefers mornings"
        assert mem.household == household
        assert mem.created_by == owner

    def test_anonymous_gets_401(self):
        resp = APIClient().post(MEMORIES_LIST_URL, {"content": "x"}, format="json")
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_empty_content_returns_400(self, household, owner):
        resp = _client_for(owner).post(MEMORIES_LIST_URL, {"content": ""}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "content" in resp.data

    def test_too_long_content_returns_400(self, household, owner):
        resp = _client_for(owner).post(
            MEMORIES_LIST_URL, {"content": "x" * 501}, format="json"
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "content" in resp.data

    def test_missing_content_returns_400(self, household, owner):
        resp = _client_for(owner).post(MEMORIES_LIST_URL, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "content" in resp.data


@pytest.mark.django_db
class TestMemoryApiPatch:
    """PATCH /api/agent/memories/{id}/ — edits content."""

    def _create_memory(self, household, user, content="Original"):
        return memory_service.save_memory(household, user, content)

    def test_owner_can_patch_own_memory(self, household, owner):
        mem = self._create_memory(household, owner)
        url = _memory_detail_url(mem.pk)
        resp = _client_for(owner).patch(url, {"content": "Updated"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["content"] == "Updated"
        # DB state
        mem.refresh_from_db()
        assert mem.content == "Updated"

    def test_anonymous_gets_401(self, household, owner):
        mem = self._create_memory(household, owner)
        url = _memory_detail_url(mem.pk)
        resp = APIClient().patch(url, {"content": "x"}, format="json")
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_other_user_gets_404(self, household, owner):
        other = UserFactory(email="other-patch@example.com")
        _add_member(other, household, role=HouseholdMember.Role.MEMBER)
        mem = self._create_memory(household, owner)
        url = _memory_detail_url(mem.pk)
        resp = _client_for(other).patch(url, {"content": "Steal"}, format="json")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_cross_household_user_gets_404(self, household, owner):
        other_hh = _make_household("Patch Cross HH")
        intruder = UserFactory(email="intruder-patch@example.com")
        _add_member(intruder, other_hh, role=HouseholdMember.Role.OWNER)
        mem = self._create_memory(household, owner)
        url = _memory_detail_url(mem.pk)
        resp = _client_for(intruder).patch(url, {"content": "Steal"}, format="json")
        assert resp.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_empty_content_returns_400(self, household, owner):
        mem = self._create_memory(household, owner)
        url = _memory_detail_url(mem.pk)
        resp = _client_for(owner).patch(url, {"content": ""}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "content" in resp.data


@pytest.mark.django_db
class TestMemoryApiDelete:
    """DELETE /api/agent/memories/{id}/ — removes one memory."""

    def _create_memory(self, household, user, content="To delete"):
        return memory_service.save_memory(household, user, content)

    def test_owner_can_delete_own_memory(self, household, owner):
        mem = self._create_memory(household, owner)
        url = _memory_detail_url(mem.pk)
        resp = _client_for(owner).delete(url)
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not AgentMemory.objects.filter(pk=mem.pk).exists()

    def test_anonymous_gets_401(self, household, owner):
        mem = self._create_memory(household, owner)
        url = _memory_detail_url(mem.pk)
        resp = APIClient().delete(url)
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_other_user_gets_404(self, household, owner):
        other = UserFactory(email="other-delete@example.com")
        _add_member(other, household, role=HouseholdMember.Role.MEMBER)
        mem = self._create_memory(household, owner)
        url = _memory_detail_url(mem.pk)
        resp = _client_for(other).delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        # Memory still exists
        assert AgentMemory.objects.filter(pk=mem.pk).exists()

    def test_cross_household_user_gets_403_or_404(self, household, owner):
        other_hh = _make_household("Delete Cross HH")
        intruder = UserFactory(email="intruder-delete@example.com")
        _add_member(intruder, other_hh, role=HouseholdMember.Role.OWNER)
        mem = self._create_memory(household, owner)
        url = _memory_detail_url(mem.pk)
        resp = _client_for(intruder).delete(url)
        assert resp.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
        # Memory not deleted
        assert AgentMemory.objects.filter(pk=mem.pk).exists()


@pytest.mark.django_db
class TestMemoryApiClear:
    """DELETE /api/agent/memories/clear/ — deletes all memories of the current user."""

    def _create_memory(self, household, user, content="x"):
        return memory_service.save_memory(household, user, content)

    def test_clear_deletes_all_own_memories_and_returns_count(self, household, owner):
        for i in range(3):
            self._create_memory(household, owner, f"Fact {i}")
        resp = _client_for(owner).delete(_memory_clear_url())
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["deleted"] == 3
        assert AgentMemory.objects.filter(household=household, created_by=owner).count() == 0

    def test_clear_does_not_touch_other_users_memories(self, household, owner):
        other = UserFactory(email="other-clear-api@example.com")
        _add_member(other, household, role=HouseholdMember.Role.MEMBER)
        self._create_memory(household, owner, "Owner")
        self._create_memory(household, other, "Other")
        _client_for(owner).delete(_memory_clear_url())
        assert AgentMemory.objects.filter(household=household, created_by=other).count() == 1

    def test_clear_with_no_memories_returns_zero(self, household, owner):
        resp = _client_for(owner).delete(_memory_clear_url())
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["deleted"] == 0

    def test_anonymous_gets_401(self):
        resp = APIClient().delete(_memory_clear_url())
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


# ===========================================================================
# Fixtures
# ===========================================================================


@pytest.fixture
def owner(db, household):
    user = UserFactory(email="memory-owner@example.com")
    return _add_member(user, household)


@pytest.fixture
def household(db):
    return _make_household("Memory Test House")
