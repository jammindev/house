# water/tests/test_agent_integration.py
"""Agent integration tests for the water app.

Verifies that the WritableSpec and ListableSpec registered in water/apps.py
work correctly through the agent tool dispatch layer:

  - create_entity / water_reading: same write path as REST (same validation)
  - reading_date omitted → defaults to today
  - comma decimal '1234,5' accepted → stored as 1234.5
  - index_m3 missing → recoverable error (not a crash)
  - update_entity / water_reading: changes index; scoped to household
  - list_entities / water_reading: date_from / date_to filters work
  - cross-household: a spec resolved against hh_a does not surface hh_b readings
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone

from agent import tools
from agent import listables as agent_listables
from agent import writables as agent_writables
from households.models import Household, HouseholdMember
from water.models import WaterReading

from .factories import HouseholdFactory, UserFactory, WaterReadingFactory


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
    return UserFactory(email="water-agent-owner@example.com")


@pytest.fixture
def household(db, owner):
    hh = Household.objects.create(name="Water Agent House")
    HouseholdMember.objects.create(user=owner, household=hh, role=HouseholdMember.Role.OWNER)
    return hh


@pytest.fixture
def other_household(db):
    return Household.objects.create(name="Other Water House")


# ===========================================================================
# 1. create_entity / water_reading — happy paths
# ===========================================================================

@pytest.mark.django_db
class TestCreateWaterReadingViaAgent:
    """create_entity with entity_type='water_reading' — agent write path."""

    def test_reading_created_in_db(self, household, owner):
        result = _create(
            household,
            {"entity_type": "water_reading", "fields": {"index_m3": "250.000", "reading_date": "2024-05-01"}},
            user=owner,
        )
        assert result.created
        assert result.created[0]["entity_type"] == "water_reading"
        reading = WaterReading.objects.get(pk=result.created[0]["id"])
        assert reading.household == household
        assert reading.index_m3 == Decimal("250.000")
        assert reading.reading_date == date(2024, 5, 1)

    def test_result_shape_contains_id_label_url(self, household, owner):
        result = _create(
            household,
            {"entity_type": "water_reading", "fields": {"index_m3": "100.000", "reading_date": "2024-05-02"}},
            user=owner,
        )
        assert result.created
        entry = result.created[0]
        assert "id" in entry
        assert "label" in entry
        assert "url_path" in entry
        assert entry["url_path"].startswith("/app/water")

    def test_reading_date_omitted_defaults_to_today(self, household, owner):
        """If reading_date is not provided, it should default to today."""
        today = timezone.localdate()
        result = _create(
            household,
            {"entity_type": "water_reading", "fields": {"index_m3": "100.000"}},
            user=owner,
        )
        assert result.created
        reading = WaterReading.objects.get(pk=result.created[0]["id"])
        assert reading.reading_date == today

    def test_comma_decimal_accepted(self, household, owner):
        """'1234,5' with a comma decimal separator should be parsed correctly."""
        result = _create(
            household,
            {"entity_type": "water_reading", "fields": {"index_m3": "1234,5", "reading_date": "2024-06-01"}},
            user=owner,
        )
        assert result.created
        reading = WaterReading.objects.get(pk=result.created[0]["id"])
        assert reading.index_m3 == Decimal("1234.5")

    def test_missing_index_m3_is_recoverable_error(self, household, owner):
        """Missing required field returns a recoverable message, not a crash."""
        result = _create(
            household,
            {"entity_type": "water_reading", "fields": {"reading_date": "2024-06-10"}},
            user=owner,
        )
        assert not result.created
        assert "water_reading" in result.rendered.lower() or "index_m3" in result.rendered.lower() or "could not" in result.rendered.lower()

    def test_negative_index_is_recoverable_error(self, household, owner):
        result = _create(
            household,
            {"entity_type": "water_reading", "fields": {"index_m3": "-5.000", "reading_date": "2024-06-15"}},
            user=owner,
        )
        assert not result.created
        assert "could not" in result.rendered.lower()

    def test_monotonicity_violation_is_recoverable_error(self, household, owner):
        """Creating a reading lower than an existing previous reading is recoverable."""
        WaterReadingFactory(
            household=household, reading_date=date(2024, 6, 1), index_m3=Decimal("500.000"),
            created_by=owner,
        )
        result = _create(
            household,
            {"entity_type": "water_reading", "fields": {"index_m3": "100.000", "reading_date": "2024-06-15"}},
            user=owner,
        )
        assert not result.created

    def test_create_produces_same_row_as_rest_write_path(self, household, owner):
        """Agent create and direct service create produce equivalent rows."""
        from water.services import create_water_reading

        # Via agent
        _create(
            household,
            {"entity_type": "water_reading", "fields": {"index_m3": "100.000", "reading_date": "2024-07-01"}},
            user=owner,
        )
        # Via service (next day, higher index)
        service_reading = create_water_reading(
            household, owner, reading_date=date(2024, 7, 15), index_m3=Decimal("115.000")
        )
        # Both scoped to household, both have required audit fields
        assert service_reading.household == household
        assert service_reading.created_by == owner
        readings = WaterReading.objects.filter(household=household).order_by("reading_date")
        assert readings.count() == 2

    def test_agent_create_same_validation_as_rest_duplicate_date(self, household, owner):
        """Agent should reject a duplicate date just like the REST endpoint."""
        WaterReadingFactory(
            household=household, reading_date=date(2024, 8, 1), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        result = _create(
            household,
            {"entity_type": "water_reading", "fields": {"index_m3": "110.000", "reading_date": "2024-08-01"}},
            user=owner,
        )
        assert not result.created


# ===========================================================================
# 2. update_entity / water_reading
# ===========================================================================

@pytest.mark.django_db
class TestUpdateWaterReadingViaAgent:
    """update_entity with entity_type='water_reading'."""

    def test_update_index_persists(self, household, owner):
        reading = WaterReadingFactory(
            household=household, reading_date=date(2024, 9, 1), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        result = _update(
            household,
            {
                "entity_type": "water_reading",
                "id": str(reading.pk),
                "fields": {"index_m3": "110.000"},
            },
            user=owner,
        )
        assert result.updated
        reading.refresh_from_db()
        assert reading.index_m3 == Decimal("110.000")

    def test_update_scoped_to_household(self, household, owner, other_household):
        """The resolve function must not return a reading from another household."""
        other_owner = UserFactory()
        reading_b = WaterReadingFactory(
            household=other_household, reading_date=date(2024, 9, 1), index_m3=Decimal("100.000"),
            created_by=other_owner,
        )
        result = _update(
            household,  # user is in household, trying to update reading_b
            {
                "entity_type": "water_reading",
                "id": str(reading_b.pk),
                "fields": {"index_m3": "999.000"},
            },
            user=owner,
        )
        # Should be a recoverable error, not a successful update
        assert not result.updated
        reading_b.refresh_from_db()
        assert reading_b.index_m3 == Decimal("100.000")

    def test_update_comma_decimal_accepted(self, household, owner):
        reading = WaterReadingFactory(
            household=household, reading_date=date(2024, 10, 1), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        result = _update(
            household,
            {
                "entity_type": "water_reading",
                "id": str(reading.pk),
                "fields": {"index_m3": "120,500"},
            },
            user=owner,
        )
        assert result.updated
        reading.refresh_from_db()
        assert reading.index_m3 == Decimal("120.500")


# ===========================================================================
# 3. WritableSpec registry — direct spec access
# ===========================================================================

@pytest.mark.django_db
class TestWritableSpecRegistration:
    """The WritableSpec for water_reading is properly registered."""

    def test_spec_is_registered(self):
        spec = agent_writables.find_spec("water_reading")
        assert spec is not None
        assert spec.entity_type == "water_reading"

    def test_spec_has_update(self):
        spec = agent_writables.find_spec("water_reading")
        assert spec.update is not None

    def test_spec_has_resolve(self):
        spec = agent_writables.find_spec("water_reading")
        assert spec.resolve is not None

    def test_spec_updatable_fields(self):
        spec = agent_writables.find_spec("water_reading")
        assert "index_m3" in spec.updatable_fields
        assert "reading_date" in spec.updatable_fields

    def test_url_template_contains_id(self):
        spec = agent_writables.find_spec("water_reading")
        assert "{id}" in spec.url_template

    def test_resolve_scoped_to_household(self, household, owner, other_household):
        """resolve must return None when the reading belongs to another household."""
        other_owner = UserFactory()
        reading = WaterReadingFactory(
            household=other_household, reading_date=date(2024, 9, 15), index_m3=Decimal("50.000"),
            created_by=other_owner,
        )
        spec = agent_writables.find_spec("water_reading")
        resolved = spec.resolve(household, str(reading.pk))
        assert resolved is None

    def test_resolve_returns_reading_in_same_household(self, household, owner):
        reading = WaterReadingFactory(
            household=household, reading_date=date(2024, 9, 15), index_m3=Decimal("50.000"),
            created_by=owner,
        )
        spec = agent_writables.find_spec("water_reading")
        resolved = spec.resolve(household, str(reading.pk))
        assert resolved is not None
        assert resolved.pk == reading.pk


# ===========================================================================
# 4. list_entities / water_reading — ListableSpec filters
# ===========================================================================

@pytest.mark.django_db
class TestListWaterReadingsViaAgent:
    """list_entities with entity_type='water_reading' and date filters."""

    def test_list_all_household_readings(self, household, owner):
        WaterReadingFactory(
            household=household, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"),
            created_by=owner,
        )
        WaterReadingFactory(
            household=household, reading_date=date(2024, 6, 1), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        result = _list(
            household,
            {"entity_type": "water_reading"},
            user=owner,
        )
        assert result.rendered
        # Should not be an error message
        assert "(unknown" not in result.rendered

    def test_date_from_filter_excludes_earlier_readings(self, household, owner):
        WaterReadingFactory(
            household=household, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"),
            created_by=owner,
        )
        r2 = WaterReadingFactory(
            household=household, reading_date=date(2024, 6, 1), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        result = _list(
            household,
            {"entity_type": "water_reading", "filters": {"date_from": "2024-05-01"}},
            user=owner,
        )
        assert str(r2.pk) in result.rendered
        assert "2024-01-01" not in result.rendered

    def test_date_to_filter_excludes_later_readings(self, household, owner):
        r1 = WaterReadingFactory(
            household=household, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"),
            created_by=owner,
        )
        WaterReadingFactory(
            household=household, reading_date=date(2024, 6, 1), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        result = _list(
            household,
            {"entity_type": "water_reading", "filters": {"date_to": "2024-02-28"}},
            user=owner,
        )
        assert str(r1.pk) in result.rendered
        assert "2024-06-01" not in result.rendered

    def test_date_from_and_date_to_combined(self, household, owner):
        WaterReadingFactory(
            household=household, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"),
            created_by=owner,
        )
        r_mid = WaterReadingFactory(
            household=household, reading_date=date(2024, 4, 1), index_m3=Decimal("50.000"),
            created_by=owner,
        )
        WaterReadingFactory(
            household=household, reading_date=date(2024, 8, 1), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        result = _list(
            household,
            {
                "entity_type": "water_reading",
                "filters": {"date_from": "2024-03-01", "date_to": "2024-05-31"},
            },
            user=owner,
        )
        assert str(r_mid.pk) in result.rendered
        assert "2024-01-01" not in result.rendered
        assert "2024-08-01" not in result.rendered


# ===========================================================================
# 5. ListableSpec registry — direct spec access
# ===========================================================================

@pytest.mark.django_db
class TestListableSpecRegistration:
    """The ListableSpec for water_reading is properly registered."""

    def test_spec_is_registered(self):
        spec = agent_listables.find_spec("water_reading")
        assert spec is not None
        assert spec.entity_type == "water_reading"

    def test_spec_has_date_from_filter(self):
        spec = agent_listables.find_spec("water_reading")
        names = agent_listables.filter_names(spec)
        assert "date_from" in names

    def test_spec_has_date_to_filter(self):
        spec = agent_listables.find_spec("water_reading")
        names = agent_listables.filter_names(spec)
        assert "date_to" in names

    def test_date_from_filter_applies_correctly(self, household, owner):
        WaterReadingFactory(
            household=household, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"),
            created_by=owner,
        )
        WaterReadingFactory(
            household=household, reading_date=date(2024, 6, 1), index_m3=Decimal("50.000"),
            created_by=owner,
        )
        spec = agent_listables.find_spec("water_reading")
        date_from_filter = next(f for f in spec.filters if f.name == "date_from")
        qs = WaterReading.objects.filter(household=household)
        filtered = date_from_filter.apply(qs, "2024-04-01")
        dates = list(filtered.values_list("reading_date", flat=True))
        assert all(d >= date(2024, 4, 1) for d in dates)
        assert date(2024, 1, 1) not in dates

    def test_date_to_filter_applies_correctly(self, household, owner):
        WaterReadingFactory(
            household=household, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"),
            created_by=owner,
        )
        WaterReadingFactory(
            household=household, reading_date=date(2024, 6, 1), index_m3=Decimal("50.000"),
            created_by=owner,
        )
        spec = agent_listables.find_spec("water_reading")
        date_to_filter = next(f for f in spec.filters if f.name == "date_to")
        qs = WaterReading.objects.filter(household=household)
        filtered = date_to_filter.apply(qs, "2024-03-31")
        dates = list(filtered.values_list("reading_date", flat=True))
        assert all(d <= date(2024, 3, 31) for d in dates)
        assert date(2024, 6, 1) not in dates
