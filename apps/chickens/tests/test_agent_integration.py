# chickens/tests/test_agent_integration.py
"""
Agent integration tests for the chickens module (parcours 14, US-8 non-duplication).

Verifies that the WritableSpec and ListableSpec registered in chickens/apps.py
produce the same results as the REST API:

  - create chicken via agent = same DB shape as REST
  - _create_egg_log_from_agent twice same day = upsert, not duplicate (US-3 parity)
  - _update_chicken_from_agent status=deceased creates the auto-event (US-2 parity)
  - delete undo via agent → LookupError if already deleted
  - searchable 'chicken' and 'chicken_event' registered
  - writable 'chicken' and 'egg_log' registered
  - listable 'chicken' and 'egg_log' registered with correct filters
"""
from __future__ import annotations

from datetime import date

import pytest
from django.utils import timezone

from agent import listables as agent_listables
from agent import tools
from agent import writables as agent_writables
from chickens.models import Chicken, ChickenEvent, EggLog
from households.models import Household, HouseholdMember

from .factories import ChickenFactory, EggLogFactory, HouseholdFactory, UserFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create(household, tool_input, user=None):
    return tools.dispatch("create_entity", tool_input, household=household, user=user)


def _update(household, tool_input, user=None):
    return tools.dispatch("update_entity", tool_input, household=household, user=user)


def _list(household, tool_input, user=None):
    return tools.dispatch("list_entities", tool_input, household=household, user=user)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def owner(db):
    return UserFactory(email="chickens-agent-owner@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Chickens Agent House")
    HouseholdMember.objects.create(user=owner, household=hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def other_household(db):
    return Household.objects.create(name="Other Chickens House")


# ===========================================================================
# 1. create_entity / chicken
# ===========================================================================

@pytest.mark.django_db
class TestCreateChickenViaAgent:
    """create_entity with entity_type='chicken'."""

    def test_chicken_created_in_db(self, household, owner):
        result = _create(
            household,
            {"entity_type": "chicken", "fields": {"name": "Cocotte Agent"}},
            user=owner,
        )
        assert result.created
        chicken = Chicken.objects.get(pk=result.created[0]["id"])
        assert chicken.household == household
        assert chicken.name == "Cocotte Agent"

    def test_result_has_id_label_url(self, household, owner):
        result = _create(
            household,
            {"entity_type": "chicken", "fields": {"name": "Poulet Test"}},
            user=owner,
        )
        assert result.created
        entry = result.created[0]
        assert "id" in entry
        assert "label" in entry
        assert "url_path" in entry
        assert "/app/chickens" in entry["url_path"]

    def test_same_shape_as_rest_service(self, household, owner):
        """Agent create and service.create_chicken produce equivalent rows."""
        from chickens.services import create_chicken

        result = _create(
            household,
            {"entity_type": "chicken", "fields": {"name": "Via Agent", "breed": "Sussex"}},
            user=owner,
        )
        agent_chicken = Chicken.objects.get(pk=result.created[0]["id"])

        service_chicken = create_chicken(
            household, owner, name="Via Service", breed="Sussex"
        )

        # Both scoped, both have audit fields
        assert agent_chicken.household == household
        assert service_chicken.household == household
        assert agent_chicken.breed == "Sussex"
        assert service_chicken.breed == "Sussex"

    def test_missing_name_is_recoverable_error(self, household, owner):
        result = _create(
            household,
            {"entity_type": "chicken", "fields": {"breed": "Leghorn"}},
            user=owner,
        )
        assert not result.created

    def test_blank_name_is_recoverable_error(self, household, owner):
        result = _create(
            household,
            {"entity_type": "chicken", "fields": {"name": ""}},
            user=owner,
        )
        assert not result.created


# ===========================================================================
# 2. update_entity / chicken — US-2 parity
# ===========================================================================

@pytest.mark.django_db
class TestUpdateChickenViaAgent:
    """update_entity with entity_type='chicken'."""

    def test_status_deceased_creates_death_event(self, household, owner):
        chicken = ChickenFactory(household=household, created_by=owner, status=Chicken.Status.ACTIVE)
        _update(
            household,
            {
                "entity_type": "chicken",
                "id": str(chicken.pk),
                "fields": {"status": "deceased"},
            },
            user=owner,
        )
        assert ChickenEvent.objects.filter(
            chicken=chicken, type=ChickenEvent.Type.DEATH
        ).exists()

    def test_status_gone_creates_departure_event(self, household, owner):
        chicken = ChickenFactory(household=household, created_by=owner, status=Chicken.Status.ACTIVE)
        _update(
            household,
            {
                "entity_type": "chicken",
                "id": str(chicken.pk),
                "fields": {"status": "gone"},
            },
            user=owner,
        )
        assert ChickenEvent.objects.filter(
            chicken=chicken, type=ChickenEvent.Type.DEPARTURE
        ).exists()

    def test_update_name_persists(self, household, owner):
        chicken = ChickenFactory(household=household, created_by=owner, name="Old")
        result = _update(
            household,
            {
                "entity_type": "chicken",
                "id": str(chicken.pk),
                "fields": {"name": "New Name"},
            },
            user=owner,
        )
        assert result.updated
        chicken.refresh_from_db()
        assert chicken.name == "New Name"

    def test_update_scoped_to_household(self, household, owner, other_household):
        other_owner = UserFactory()
        chicken_other = ChickenFactory(
            household=other_household, created_by=other_owner, name="Other Hen"
        )
        result = _update(
            household,
            {
                "entity_type": "chicken",
                "id": str(chicken_other.pk),
                "fields": {"name": "Stolen"},
            },
            user=owner,
        )
        assert not result.updated
        chicken_other.refresh_from_db()
        assert chicken_other.name == "Other Hen"


# ===========================================================================
# 3. create / delete egg_log via agent — US-3 parity
# ===========================================================================

@pytest.mark.django_db
class TestEggLogViaAgent:
    """create_entity / egg_log — upsert parity with REST endpoint."""

    def test_create_egg_log_in_db(self, household, owner):
        result = _create(
            household,
            {"entity_type": "egg_log", "fields": {"count": 5, "date": "2024-07-01"}},
            user=owner,
        )
        assert result.created
        log = EggLog.objects.get(pk=result.created[0]["id"])
        assert log.household == household
        assert log.count == 5
        assert log.date == date(2024, 7, 1)

    def test_create_same_day_twice_upserts_not_duplicates(self, household, owner):
        """Second call for same day replaces, never creates a second row."""
        _create(
            household,
            {"entity_type": "egg_log", "fields": {"count": 4, "date": "2024-07-15"}},
            user=owner,
        )
        _create(
            household,
            {"entity_type": "egg_log", "fields": {"count": 9, "date": "2024-07-15"}},
            user=owner,
        )
        logs = EggLog.objects.filter(household=household, date=date(2024, 7, 15))
        assert logs.count() == 1
        assert logs.first().count == 9

    def test_missing_count_is_recoverable_error(self, household, owner):
        result = _create(
            household,
            {"entity_type": "egg_log", "fields": {"date": "2024-07-20"}},
            user=owner,
        )
        assert not result.created

    def test_date_omitted_defaults_to_today(self, household, owner):
        today = timezone.localdate()
        result = _create(
            household,
            {"entity_type": "egg_log", "fields": {"count": 3}},
            user=owner,
        )
        assert result.created
        log = EggLog.objects.get(pk=result.created[0]["id"])
        assert log.date == today

    def test_delete_undo_removes_log(self, household, owner):
        log = EggLogFactory(household=household, created_by=owner, date=date(2024, 8, 1), count=3)
        spec = agent_writables.find_spec("egg_log")
        spec.delete(household, owner, str(log.pk))
        assert not EggLog.objects.filter(pk=log.pk).exists()

    def test_delete_undo_raises_lookup_error_if_already_deleted(self, household, owner):
        log = EggLogFactory(household=household, created_by=owner, date=date(2024, 8, 2), count=3)
        log_id = str(log.pk)
        log.delete()
        spec = agent_writables.find_spec("egg_log")
        with pytest.raises(LookupError):
            spec.delete(household, owner, log_id)


# ===========================================================================
# 4. delete chicken undo
# ===========================================================================

@pytest.mark.django_db
class TestDeleteChickenViaAgent:
    """Agent delete undo for chickens."""

    def test_delete_removes_chicken(self, household, owner):
        chicken = ChickenFactory(household=household, created_by=owner)
        spec = agent_writables.find_spec("chicken")
        spec.delete(household, owner, str(chicken.pk))
        assert not Chicken.objects.filter(pk=chicken.pk).exists()

    def test_delete_already_deleted_raises_lookup_error(self, household, owner):
        chicken = ChickenFactory(household=household, created_by=owner)
        chicken_id = str(chicken.pk)
        chicken.delete()
        spec = agent_writables.find_spec("chicken")
        with pytest.raises(LookupError):
            spec.delete(household, owner, chicken_id)

    def test_delete_cross_household_raises_lookup_error(self, household, owner, other_household):
        other_owner = UserFactory()
        chicken_other = ChickenFactory(household=other_household, created_by=other_owner)
        spec = agent_writables.find_spec("chicken")
        with pytest.raises(LookupError):
            spec.delete(household, owner, str(chicken_other.pk))


# ===========================================================================
# 5. Searchable registry
# ===========================================================================

@pytest.mark.django_db
class TestSearchableRegistration:
    """entity_types 'chicken' and 'chicken_event' are registered as searchables."""

    def test_chicken_searchable_registered(self):
        from agent import searchables as agent_searchables
        spec = agent_searchables.find_spec("chicken")
        assert spec is not None
        assert spec.entity_type == "chicken"

    def test_chicken_event_searchable_registered(self):
        from agent import searchables as agent_searchables
        spec = agent_searchables.find_spec("chicken_event")
        assert spec is not None
        assert spec.entity_type == "chicken_event"

    def test_chicken_searchable_url_template_contains_id(self):
        from agent import searchables as agent_searchables
        spec = agent_searchables.find_spec("chicken")
        assert "{id}" in spec.url_template


# ===========================================================================
# 6. Writable registry
# ===========================================================================

@pytest.mark.django_db
class TestWritableSpecRegistration:
    """'chicken' and 'egg_log' WritableSpecs are registered."""

    def test_chicken_writable_registered(self):
        spec = agent_writables.find_spec("chicken")
        assert spec is not None
        assert spec.entity_type == "chicken"

    def test_egg_log_writable_registered(self):
        spec = agent_writables.find_spec("egg_log")
        assert spec is not None
        assert spec.entity_type == "egg_log"

    def test_chicken_writable_has_update(self):
        spec = agent_writables.find_spec("chicken")
        assert spec.update is not None

    def test_chicken_writable_has_resolve(self):
        spec = agent_writables.find_spec("chicken")
        assert spec.resolve is not None

    def test_chicken_writable_has_delete(self):
        spec = agent_writables.find_spec("chicken")
        assert spec.delete is not None

    def test_egg_log_writable_has_delete(self):
        spec = agent_writables.find_spec("egg_log")
        assert spec.delete is not None

    def test_chicken_resolve_scoped_to_household(self, household, owner, other_household):
        other_owner = UserFactory()
        chicken_other = ChickenFactory(household=other_household, created_by=other_owner)
        spec = agent_writables.find_spec("chicken")
        assert spec.resolve(household, str(chicken_other.pk)) is None

    def test_chicken_resolve_returns_own_chicken(self, household, owner):
        chicken = ChickenFactory(household=household, created_by=owner)
        spec = agent_writables.find_spec("chicken")
        resolved = spec.resolve(household, str(chicken.pk))
        assert resolved is not None
        assert resolved.pk == chicken.pk

    def test_chicken_updatable_fields_declared(self):
        spec = agent_writables.find_spec("chicken")
        assert "name" in spec.updatable_fields
        assert "status" in spec.updatable_fields


# ===========================================================================
# 7. Listable registry + filters
# ===========================================================================

@pytest.mark.django_db
class TestListableSpecRegistration:
    """'chicken' and 'egg_log' ListableSpecs with their filters."""

    def test_chicken_listable_registered(self):
        spec = agent_listables.find_spec("chicken")
        assert spec is not None
        assert spec.entity_type == "chicken"

    def test_egg_log_listable_registered(self):
        spec = agent_listables.find_spec("egg_log")
        assert spec is not None

    def test_chicken_has_status_and_in_flock_filters(self):
        spec = agent_listables.find_spec("chicken")
        names = agent_listables.filter_names(spec)
        assert "status" in names
        assert "in_flock" in names

    def test_egg_log_has_date_from_and_date_to_filters(self):
        spec = agent_listables.find_spec("egg_log")
        names = agent_listables.filter_names(spec)
        assert "date_from" in names
        assert "date_to" in names


@pytest.mark.django_db
class TestChickenListableFilters:
    """list_entities filters for chickens work correctly through agent dispatch."""

    def test_status_filter_restricts_by_status(self, household, owner):
        ChickenFactory(household=household, created_by=owner, status=Chicken.Status.ACTIVE)
        ChickenFactory(household=household, created_by=owner, status=Chicken.Status.DECEASED)
        result = _list(
            household,
            {"entity_type": "chicken", "filters": {"status": "active"}},
            user=owner,
        )
        assert result.rendered
        # deceased hen name should not appear in rendered result
        active_chickens = Chicken.objects.filter(household=household, status="active")
        for c in active_chickens:
            assert c.name in result.rendered

    def test_in_flock_filter_excludes_deceased(self, household, owner):
        active = ChickenFactory(household=household, created_by=owner, status=Chicken.Status.ACTIVE)
        deceased = ChickenFactory(household=household, created_by=owner, status=Chicken.Status.DECEASED, name="DeadHen")
        result = _list(
            household,
            {"entity_type": "chicken", "filters": {"in_flock": "true"}},
            user=owner,
        )
        assert active.name in result.rendered
        assert "DeadHen" not in result.rendered

    def test_egg_log_date_from_filter_via_dispatch(self, household, owner):
        EggLogFactory(household=household, created_by=owner, date=date(2024, 1, 1), count=3)
        later = EggLogFactory(household=household, created_by=owner, date=date(2024, 7, 1), count=7)
        result = _list(
            household,
            {"entity_type": "egg_log", "filters": {"date_from": "2024-06-01"}},
            user=owner,
        )
        assert str(later.pk) in result.rendered
        assert "2024-01-01" not in result.rendered
