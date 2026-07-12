"""Module gating of the agent registries (parcours 15).

A household that disabled an optional module must not see its entities through
the agent: retrieval skips the module's searchable specs, and the generic
tools (get/list/create/update) refuse its entity types with a recoverable
message. Everything below runs with a real Postgres search and zero LLM.
"""
from __future__ import annotations

import pytest

from agent.modules import disabled_modules_for, spec_disabled
from agent.retrieval import search
from agent.tools import (
    _create_entity_handler,
    _list_entities_handler,
    resolve_entity,
)

DISABLED_MSG = "module is disabled for this household"


@pytest.fixture
def owner(db):
    from accounts.tests.factories import UserFactory

    return UserFactory(email="gating-owner@example.com")


@pytest.fixture
def household(db, owner):
    from households.models import Household, HouseholdMember

    h = Household.objects.create(name="Gating House")
    HouseholdMember.objects.create(user=owner, household=h, role=HouseholdMember.Role.OWNER)
    return h


@pytest.fixture
def chicken(household):
    from chickens.models import Chicken

    return Chicken.objects.create(household=household, name="Roussette la poule")


def _disable(household, *modules):
    household.disabled_modules = list(modules)
    household.save(update_fields=["disabled_modules"])


@pytest.mark.django_db
class TestHelpers:
    def test_disabled_modules_for_empty_by_default(self, household):
        assert disabled_modules_for(household.id) == frozenset()

    def test_disabled_modules_for_reflects_field(self, household):
        _disable(household, "chickens", "stock")
        assert disabled_modules_for(household.id) == frozenset({"chickens", "stock"})

    def test_spec_disabled_only_for_matching_module(self):
        from agent.searchables import find_spec

        chicken_spec = find_spec("chicken")
        task_spec = find_spec("task")
        disabled = frozenset({"chickens"})
        assert spec_disabled(chicken_spec, disabled) is True
        assert spec_disabled(task_spec, disabled) is False  # core, module=None


@pytest.mark.django_db
class TestRetrievalGating:
    def test_hit_when_module_enabled(self, household, chicken):
        hits = search(household.id, "Roussette")
        assert any(h.entity_type == "chicken" for h in hits)

    def test_no_hit_when_module_disabled(self, household, chicken):
        _disable(household, "chickens")
        hits = search(household.id, "Roussette")
        assert not any(h.entity_type == "chicken" for h in hits)

    def test_other_modules_unaffected(self, household, owner, chicken):
        from documents.models import Document

        Document.objects.create(
            household=household,
            created_by=owner,
            file_path="documents/x.pdf",
            name="Facture Roussette",
            mime_type="application/pdf",
            type="document",
        )
        _disable(household, "chickens")
        hits = search(household.id, "Roussette")
        assert any(h.entity_type == "document" for h in hits)
        assert not any(h.entity_type == "chicken" for h in hits)


@pytest.mark.django_db
class TestToolsGating:
    def test_resolve_entity_refuses_disabled_module(self, household, chicken):
        _disable(household, "chickens")
        resolved, error = resolve_entity("chicken", str(chicken.pk), household)
        assert resolved is None
        assert DISABLED_MSG in error.rendered

    def test_resolve_entity_works_when_enabled(self, household, chicken):
        resolved, error = resolve_entity("chicken", str(chicken.pk), household)
        assert error is None
        _spec, obj = resolved
        assert obj == chicken

    def test_list_entities_refuses_disabled_module(self, household, chicken):
        _disable(household, "chickens")
        result = _list_entities_handler(
            household=household, tool_input={"entity_type": "chicken"}
        )
        assert DISABLED_MSG in result.rendered

    def test_list_entities_works_when_enabled(self, household, chicken):
        result = _list_entities_handler(
            household=household, tool_input={"entity_type": "chicken"}
        )
        assert "Roussette" in result.rendered

    def test_create_entity_refuses_disabled_module(self, household, owner):
        from chickens.models import EggLog

        _disable(household, "chickens")
        result = _create_entity_handler(
            household=household,
            user=owner,
            tool_input={"entity_type": "egg_log", "fields": {"count": 4}},
        )
        assert DISABLED_MSG in result.rendered
        assert not EggLog.objects.filter(household=household).exists()

    def test_create_entity_works_when_enabled(self, household, owner):
        from chickens.models import EggLog

        result = _create_entity_handler(
            household=household,
            user=owner,
            tool_input={"entity_type": "egg_log", "fields": {"count": 4}},
        )
        assert DISABLED_MSG not in result.rendered
        assert EggLog.objects.filter(household=household).count() == 1
