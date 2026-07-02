"""Tests for the searchable entities registry."""
from __future__ import annotations

import pytest

from agent.searchables import (
    REGISTRY,
    SearchableSpec,
    find_spec,
    find_spec_for_instance,
    register,
    reset_registry,
)


EXPECTED_ENTITY_TYPES = {
    "document",
    "interaction",
    "equipment",
    "task",
    "project",
    "zone",
    "stock_item",
    "insurance_contract",
    "contact",
    "structure",
}


@pytest.fixture
def empty_registry():
    """Snapshot/restore the registry so individual tests don't pollute the global state."""
    snapshot = list(REGISTRY)
    reset_registry()
    yield
    reset_registry()
    REGISTRY.extend(snapshot)


def _spec(entity_type: str = "dummy", **overrides) -> SearchableSpec:
    from documents.models import Document

    defaults = dict(
        entity_type=entity_type,
        model=Document,
        search_fields=("name",),
        label_attr="name",
        url_template="/dummy/{id}",
    )
    defaults.update(overrides)
    return SearchableSpec(**defaults)


class TestRegister:
    def test_register_adds_spec(self, empty_registry):
        spec = _spec("dummy")
        register(spec)
        assert spec in REGISTRY
        assert len(REGISTRY) == 1

    def test_double_register_same_entity_type_raises(self, empty_registry):
        register(_spec("dummy"))
        with pytest.raises(ValueError, match="already registered"):
            register(_spec("dummy"))

    def test_distinct_entity_types_coexist(self, empty_registry):
        register(_spec("dummy_a"))
        register(_spec("dummy_b"))
        assert {s.entity_type for s in REGISTRY} == {"dummy_a", "dummy_b"}


class TestFindSpec:
    def test_returns_matching_spec(self, empty_registry):
        spec = _spec("dummy")
        register(spec)
        assert find_spec("dummy") is spec

    def test_returns_none_for_unknown(self, empty_registry):
        assert find_spec("nope") is None


class TestFindSpecForInstance:
    def test_matches_instance_by_model(self, empty_registry, db):
        from documents.models import Document

        spec = _spec("document", model=Document)
        register(spec)
        doc = Document(name="x")
        assert find_spec_for_instance(doc) is spec

    def test_returns_none_for_unregistered_model(self, empty_registry, db):
        from zones.models import Zone

        register(_spec("document"))  # only Document registered
        assert find_spec_for_instance(Zone(name="z")) is None


class TestBootRegistry:
    def test_all_v1_entities_registered(self):
        actual = {spec.entity_type for spec in REGISTRY}
        assert EXPECTED_ENTITY_TYPES.issubset(actual), (
            f"missing: {EXPECTED_ENTITY_TYPES - actual}"
        )

    def test_each_spec_has_search_fields(self):
        for spec in REGISTRY:
            assert spec.search_fields, f"{spec.entity_type} has empty search_fields"

    def test_each_spec_url_template_has_id_placeholder(self):
        for spec in REGISTRY:
            assert "{id}" in spec.url_template, (
                f"{spec.entity_type} url_template missing {{id}}"
            )
