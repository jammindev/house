# water/tests/test_serializers.py
"""Serializer-level validation tests for WaterReadingSerializer.

Tests validation rules at the serializer layer directly, without the HTTP stack:
  - negative index rejected
  - index lower than previous reading rejected (monotonicity lower bound)
  - index higher than next reading rejected (monotonicity upper bound)
  - duplicate date rejected
  - valid create succeeds
  - update excludes self from sibling checks (patching own index allowed)
  - cross-household isolation (other household's readings don't constrain)
"""
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from water.models import WaterReading
from water.serializers import WaterReadingSerializer

from .factories import HouseholdFactory, UserFactory, WaterReadingFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_request(household):
    """Minimal mock request with request.household set."""
    request = MagicMock()
    request.household = household
    return request


def _ser(data, household, instance=None, partial=False):
    """Build a WaterReadingSerializer with a fake request context."""
    request = _make_request(household)
    return WaterReadingSerializer(
        instance=instance,
        data=data,
        partial=partial,
        context={"request": request},
    )


# ---------------------------------------------------------------------------
# TestWaterReadingSerializerCreate
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWaterReadingSerializerCreate:
    """Happy-path and validation rules for creating a new reading."""

    def _payload(self, **overrides):
        payload = {"reading_date": "2024-06-15", "index_m3": "150.000"}
        payload.update(overrides)
        return payload

    def test_valid_create_is_valid(self):
        hh = HouseholdFactory()
        ser = _ser(self._payload(), hh)
        assert ser.is_valid(), ser.errors

    def test_negative_index_rejected(self):
        hh = HouseholdFactory()
        ser = _ser(self._payload(index_m3="-1.000"), hh)
        assert not ser.is_valid()
        assert "index_m3" in ser.errors

    def test_zero_index_accepted(self):
        hh = HouseholdFactory()
        ser = _ser(self._payload(index_m3="0.000"), hh)
        assert ser.is_valid(), ser.errors

    def test_index_lower_than_previous_rejected(self):
        hh = HouseholdFactory()
        owner = UserFactory()
        # Previous reading: date Jan 1, index 200
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 1, 1), index_m3=Decimal("200.000"),
            created_by=owner,
        )
        # New reading: date Jan 10, index 100 (lower than previous)
        ser = _ser(
            {"reading_date": "2024-01-10", "index_m3": "100.000"},
            hh,
        )
        assert not ser.is_valid()
        assert "index_m3" in ser.errors

    def test_index_higher_than_next_rejected(self):
        hh = HouseholdFactory()
        owner = UserFactory()
        # Next reading: date Jan 20, index 100
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 1, 20), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        # New reading: date Jan 10, index 200 (higher than next)
        ser = _ser(
            {"reading_date": "2024-01-10", "index_m3": "200.000"},
            hh,
        )
        assert not ser.is_valid()
        assert "index_m3" in ser.errors

    def test_duplicate_date_rejected(self):
        hh = HouseholdFactory()
        owner = UserFactory()
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 3, 15), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        ser = _ser(
            {"reading_date": "2024-03-15", "index_m3": "110.000"},
            hh,
        )
        assert not ser.is_valid()
        assert "reading_date" in ser.errors

    def test_index_equal_to_previous_accepted(self):
        """Same index as previous reading is valid (no consumption edge case)."""
        hh = HouseholdFactory()
        owner = UserFactory()
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 1, 1), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        ser = _ser(
            {"reading_date": "2024-01-15", "index_m3": "100.000"},
            hh,
        )
        assert ser.is_valid(), ser.errors

    def test_index_between_previous_and_next_accepted(self):
        hh = HouseholdFactory()
        owner = UserFactory()
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 1, 1), index_m3=Decimal("100.000"),
            created_by=owner,
        )
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 1, 31), index_m3=Decimal("200.000"),
            created_by=owner,
        )
        ser = _ser(
            {"reading_date": "2024-01-15", "index_m3": "150.000"},
            hh,
        )
        assert ser.is_valid(), ser.errors


# ---------------------------------------------------------------------------
# TestWaterReadingSerializerUpdate
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWaterReadingSerializerUpdate:
    """Update validations — self excluded from sibling checks."""

    def test_update_own_index_without_violating_monotonicity(self):
        """Patching a reading's index should not fail monotonicity against itself."""
        hh = HouseholdFactory()
        owner = UserFactory()
        reading = WaterReadingFactory(
            household=hh, reading_date=date(2024, 6, 10), index_m3=Decimal("150.000"),
            created_by=owner,
        )
        ser = _ser({"index_m3": "155.000"}, hh, instance=reading, partial=True)
        assert ser.is_valid(), ser.errors

    def test_update_index_still_respects_previous_sibling(self):
        """Patching index below a genuinely older reading is still rejected."""
        hh = HouseholdFactory()
        owner = UserFactory()
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 6, 1), index_m3=Decimal("200.000"),
            created_by=owner,
        )
        reading = WaterReadingFactory(
            household=hh, reading_date=date(2024, 6, 10), index_m3=Decimal("210.000"),
            created_by=owner,
        )
        ser = _ser({"index_m3": "150.000"}, hh, instance=reading, partial=True)
        assert not ser.is_valid()
        assert "index_m3" in ser.errors

    def test_update_date_duplicate_rejected(self):
        """Moving a reading to a date already occupied by another is rejected."""
        hh = HouseholdFactory()
        owner = UserFactory()
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 6, 20), index_m3=Decimal("200.000"),
            created_by=owner,
        )
        reading = WaterReadingFactory(
            household=hh, reading_date=date(2024, 6, 10), index_m3=Decimal("150.000"),
            created_by=owner,
        )
        ser = _ser({"reading_date": "2024-06-20"}, hh, instance=reading, partial=True)
        assert not ser.is_valid()
        assert "reading_date" in ser.errors


# ---------------------------------------------------------------------------
# TestWaterReadingSerializerCrossHousehold
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWaterReadingSerializerCrossHousehold:
    """Readings from another household do not constrain a different household's readings."""

    def test_other_household_high_index_does_not_block_lower_index(self):
        """A different household's reading at a later date with a higher index
        must NOT be treated as a 'next' reading that blocks creation."""
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_b = UserFactory()
        # hh_b has a reading at Jan 20 with index 500 — totally unrelated to hh_a
        WaterReadingFactory(
            household=hh_b, reading_date=date(2024, 1, 20), index_m3=Decimal("500.000"),
            created_by=owner_b,
        )
        # hh_a creates a reading at Jan 10 with index 50 — should be valid
        ser = _ser(
            {"reading_date": "2024-01-10", "index_m3": "50.000"},
            hh_a,
        )
        assert ser.is_valid(), ser.errors

    def test_other_household_reading_same_date_does_not_block(self):
        """Duplicate date check is scoped to household only."""
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        owner_b = UserFactory()
        WaterReadingFactory(
            household=hh_b, reading_date=date(2024, 3, 15), index_m3=Decimal("100.000"),
            created_by=owner_b,
        )
        ser = _ser(
            {"reading_date": "2024-03-15", "index_m3": "50.000"},
            hh_a,
        )
        assert ser.is_valid(), ser.errors
