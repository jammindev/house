"""Tests for the agent write registry (agent.writables) + the task WritableSpec."""
from __future__ import annotations

import pytest

from agent import writables
from agent.writables import (
    REGISTRY,
    WritableSpec,
    as_created_dict,
    find_spec,
    register,
    reset_registry,
    resolve_label,
    resolve_url,
    supported_entity_types,
)


@pytest.fixture
def fresh_registry():
    """Snapshot/restore the global registry so a test can't pollute others."""
    snapshot = dict(REGISTRY)
    reset_registry()
    yield
    reset_registry()
    REGISTRY.update(snapshot)


def _spec(entity_type="thing"):
    return WritableSpec(
        entity_type=entity_type,
        create=lambda household, user, fields, *, anchor=None: None,
        label_attr="subject",
        url_template="/app/things/{id}",
    )


class TestRegistry:
    def test_register_and_find(self, fresh_registry):
        spec = _spec()
        register(spec)
        assert find_spec("thing") is spec
        assert find_spec("nope") is None

    def test_double_register_raises(self, fresh_registry):
        register(_spec())
        with pytest.raises(ValueError, match="already registered"):
            register(_spec())

    def test_supported_entity_types_sorted(self, fresh_registry):
        register(_spec("zeta"))
        register(_spec("alpha"))
        assert supported_entity_types() == ["alpha", "zeta"]


class TestBootRegistry:
    def test_task_registered_at_boot(self):
        assert "task" in REGISTRY


class TestResolvers:
    def test_label_url_and_created_dict(self, fresh_registry):
        class FakeTask:
            pk = "abc"
            subject = "Purger la VMC"

        register(_spec("task"))
        spec = find_spec("task")
        obj = FakeTask()
        assert resolve_label(spec, obj) == "Purger la VMC"
        assert resolve_url(spec, obj) == "/app/things/abc"
        assert as_created_dict(spec, obj) == {
            "entity_type": "task",
            "id": "abc",
            "label": "Purger la VMC",
            "url_path": "/app/things/abc",
        }

    def test_label_callable(self, fresh_registry):
        spec = WritableSpec(
            entity_type="x",
            create=lambda *a, **k: None,
            label_attr=lambda obj: f"#{obj.pk}",
            url_template="/x/{id}",
        )
        register(spec)

        class O:
            pk = 7

        assert resolve_label(spec, O()) == "#7"
