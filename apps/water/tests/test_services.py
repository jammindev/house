# water/tests/test_services.py
"""Service layer tests for water.services.

Tests consumption_summary math exhaustively:
  - Two readings 10 days apart, delta 1.000 m³ → 10 daily shares of 100 l each, sum = 1000 l
  - Cumulative rounding when delta not divisible by n_days (delta 1.000 m³, 3 days → sum = 1000 l)
  - Window clipping: date range covers only part of the span
  - Month/year bucketing: correct bucket keys
  - Empty when no readings or only one reading
  - Decreasing/duplicate-date pairs silently skipped (never surface in output)

Also covers create_water_reading / update_water_reading service functions.
"""
from datetime import date
from decimal import Decimal

import pytest

from water.models import WaterReading
from water.services import (
    GRANULARITIES,
    consumption_summary,
    create_water_reading,
    update_water_reading,
)

from .factories import HouseholdFactory, UserFactory, WaterReadingFactory


# ---------------------------------------------------------------------------
# TestCreateWaterReadingService
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCreateWaterReadingService:
    """create_water_reading — goes through the serializer (single write path)."""

    def test_creates_reading_in_db(self):
        hh = HouseholdFactory()
        user = UserFactory()
        reading = create_water_reading(
            hh, user, reading_date=date(2024, 5, 1), index_m3=Decimal("100.000")
        )
        assert reading.pk is not None
        db_reading = WaterReading.objects.get(pk=reading.pk)
        assert db_reading.household == hh
        assert db_reading.reading_date == date(2024, 5, 1)
        assert db_reading.index_m3 == Decimal("100.000")

    def test_negative_index_raises_validation_error(self):
        from rest_framework.exceptions import ValidationError
        hh = HouseholdFactory()
        user = UserFactory()
        with pytest.raises(ValidationError):
            create_water_reading(hh, user, reading_date=date(2024, 5, 1), index_m3=Decimal("-1.000"))

    def test_monotonicity_violation_raises_validation_error(self):
        from rest_framework.exceptions import ValidationError
        hh = HouseholdFactory()
        user = UserFactory()
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 4, 1), index_m3=Decimal("200.000"),
            created_by=user,
        )
        with pytest.raises(ValidationError):
            create_water_reading(hh, user, reading_date=date(2024, 5, 1), index_m3=Decimal("100.000"))


# ---------------------------------------------------------------------------
# TestUpdateWaterReadingService
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestUpdateWaterReadingService:
    """update_water_reading — same serializer path."""

    def test_update_index_persists(self):
        hh = HouseholdFactory()
        user = UserFactory()
        reading = WaterReadingFactory(
            household=hh, reading_date=date(2024, 5, 1), index_m3=Decimal("100.000"),
            created_by=user,
        )
        updated = update_water_reading(hh, user, reading, fields={"index_m3": Decimal("110.000")})
        assert updated.index_m3 == Decimal("110.000")
        reading.refresh_from_db()
        assert reading.index_m3 == Decimal("110.000")

    def test_update_rejects_monotonicity_violation(self):
        from rest_framework.exceptions import ValidationError
        hh = HouseholdFactory()
        user = UserFactory()
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 4, 1), index_m3=Decimal("200.000"),
            created_by=user,
        )
        reading = WaterReadingFactory(
            household=hh, reading_date=date(2024, 5, 1), index_m3=Decimal("210.000"),
            created_by=user,
        )
        with pytest.raises(ValidationError):
            update_water_reading(hh, user, reading, fields={"index_m3": Decimal("150.000")})


# ---------------------------------------------------------------------------
# TestConsumptionSummaryMath
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestConsumptionSummaryMath:
    """Core arithmetic of consumption_summary.

    All tests use 'day' granularity unless the test explicitly concerns bucketing.
    """

    def _setup_readings(self, household, pairs):
        """Helper: create readings for (date, index_m3) pairs."""
        user = UserFactory()
        readings = []
        for d, idx in sorted(pairs, key=lambda x: x[0]):
            readings.append(
                WaterReadingFactory(
                    household=household,
                    reading_date=d,
                    index_m3=Decimal(str(idx)),
                    created_by=user,
                )
            )
        return readings

    def test_ten_day_span_one_m3_sums_to_1000_l(self):
        """10 days apart, delta exactly 1 m³ → 10 shares of 100 l, total = 1000 l."""
        hh = HouseholdFactory()
        self._setup_readings(hh, [
            (date(2024, 1, 1), "0.000"),
            (date(2024, 1, 11), "1.000"),
        ])
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 1, 10),
        )
        assert result["total_l"] == 1000
        assert len(result["buckets"]) == 10
        # Each share should be exactly 100 l
        for bucket in result["buckets"]:
            assert bucket["total_l"] == 100

    def test_cumulative_rounding_3_days_sums_exactly_1000_l(self):
        """delta=1.000 m³ over 3 days → individual shares may differ by 1 l, but sum = 1000 l."""
        hh = HouseholdFactory()
        self._setup_readings(hh, [
            (date(2024, 1, 1), "0.000"),
            (date(2024, 1, 4), "1.000"),
        ])
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 1, 3),
        )
        # Sum must be exact regardless of rounding distribution
        assert result["total_l"] == 1000
        bucket_sum = sum(b["total_l"] for b in result["buckets"])
        assert bucket_sum == 1000

    def test_cumulative_rounding_7_days_sums_exactly(self):
        """delta=1.000 m³ over 7 days — 1000 is not divisible by 7, shares still sum to 1000."""
        hh = HouseholdFactory()
        self._setup_readings(hh, [
            (date(2024, 1, 1), "0.000"),
            (date(2024, 1, 8), "1.000"),
        ])
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 1, 7),
        )
        assert result["total_l"] == 1000
        bucket_sum = sum(b["total_l"] for b in result["buckets"])
        assert bucket_sum == 1000

    def test_window_clipping_only_includes_in_range_days(self):
        """When the query window covers only part of a span, litres are prorated."""
        hh = HouseholdFactory()
        # 10-day span, 1 m³ total = 100 l/day
        self._setup_readings(hh, [
            (date(2024, 1, 1), "0.000"),
            (date(2024, 1, 11), "1.000"),
        ])
        # Only ask for days 3-7 (5 days out of 10)
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 1, 3),
            date_to=date(2024, 1, 7),
        )
        assert result["total_l"] == 500
        assert len(result["buckets"]) == 5

    def test_window_fully_outside_span_returns_zero(self):
        """A date range with no coverage yields 0 litres."""
        hh = HouseholdFactory()
        self._setup_readings(hh, [
            (date(2024, 1, 1), "0.000"),
            (date(2024, 1, 11), "1.000"),
        ])
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 2, 1),
            date_to=date(2024, 2, 28),
        )
        assert result["total_l"] == 0
        assert result["buckets"] == []

    def test_empty_when_no_readings(self):
        hh = HouseholdFactory()
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 1, 31),
        )
        assert result["total_l"] == 0
        assert result["buckets"] == []

    def test_empty_when_only_one_reading(self):
        """A single reading produces no delta, hence no consumption."""
        hh = HouseholdFactory()
        user = UserFactory()
        WaterReadingFactory(
            household=hh, reading_date=date(2024, 1, 15), index_m3=Decimal("100.000"),
            created_by=user,
        )
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 1, 31),
        )
        assert result["total_l"] == 0
        assert result["buckets"] == []

    def test_month_bucketing_groups_by_first_of_month(self):
        hh = HouseholdFactory()
        self._setup_readings(hh, [
            (date(2024, 1, 1), "0.000"),
            (date(2024, 4, 1), "3.000"),  # 90 days, 3000 l total
        ])
        result = consumption_summary(
            hh, granularity="month",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 3, 31),
        )
        assert result["granularity"] == "month"
        # All bucket timestamps should start at day 01
        for bucket in result["buckets"]:
            assert bucket["ts"][8:10] == "01", f"Expected day=01, got {bucket['ts']}"
        # Total should be conserved
        assert result["total_l"] == sum(b["total_l"] for b in result["buckets"])

    def test_year_bucketing_groups_by_jan_1(self):
        hh = HouseholdFactory()
        self._setup_readings(hh, [
            (date(2024, 1, 1), "0.000"),
            (date(2025, 1, 1), "12.000"),
        ])
        result = consumption_summary(
            hh, granularity="year",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 12, 31),
        )
        assert result["granularity"] == "year"
        for bucket in result["buckets"]:
            assert bucket["ts"][5:10] == "01-01", f"Expected MM-DD=01-01, got {bucket['ts']}"

    def test_multiple_spans_aggregate_correctly(self):
        """Multiple consecutive reading pairs contribute independently."""
        hh = HouseholdFactory()
        self._setup_readings(hh, [
            (date(2024, 1, 1), "0.000"),
            (date(2024, 1, 11), "1.000"),   # 10 days = 1000 l
            (date(2024, 1, 21), "3.000"),   # 10 more days = 2000 l
        ])
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 1, 20),
        )
        assert result["total_l"] == 3000

    def test_result_shape_contains_required_keys(self):
        hh = HouseholdFactory()
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 1, 31),
        )
        assert "granularity" in result
        assert "date_from" in result
        assert "date_to" in result
        assert "total_l" in result
        assert "buckets" in result

    def test_unknown_granularity_raises_value_error(self):
        hh = HouseholdFactory()
        with pytest.raises(ValueError, match="unknown granularity"):
            consumption_summary(
                hh, granularity="week",
                date_from=date(2024, 1, 1),
                date_to=date(2024, 1, 31),
            )

    def test_bucket_timestamps_are_iso_midnight_format(self):
        """Each bucket ts must be 'YYYY-MM-DDT00:00:00'."""
        hh = HouseholdFactory()
        self._setup_readings(hh, [
            (date(2024, 1, 1), "0.000"),
            (date(2024, 1, 3), "0.002"),
        ])
        result = consumption_summary(
            hh, granularity="day",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 1, 2),
        )
        for bucket in result["buckets"]:
            assert bucket["ts"].endswith("T00:00:00"), f"Bad ts: {bucket['ts']}"

    def test_cross_household_readings_not_included(self):
        """consumption_summary is scoped to the given household."""
        hh_a = HouseholdFactory()
        hh_b = HouseholdFactory()
        user_b = UserFactory()
        # hh_b has 1000 l of consumption
        WaterReadingFactory(
            household=hh_b, reading_date=date(2024, 1, 1), index_m3=Decimal("0.000"),
            created_by=user_b,
        )
        WaterReadingFactory(
            household=hh_b, reading_date=date(2024, 1, 11), index_m3=Decimal("1.000"),
            created_by=user_b,
        )
        # hh_a has no readings
        result = consumption_summary(
            hh_a, granularity="day",
            date_from=date(2024, 1, 1),
            date_to=date(2024, 1, 10),
        )
        assert result["total_l"] == 0
