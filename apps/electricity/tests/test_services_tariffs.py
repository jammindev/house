# electricity/tests/test_services_tariffs.py
"""Service-layer tests for MeterTariff costing and consumption_summary € fields
(parcours 10 — lot 5).

Covers the acceptance criteria from issue #218:
  - Price change mid-period: each day valued at the right tariff
  - HP/HC: each register priced at its own rate
  - No applicable tariff (day before first valid_from) → not valued → None
  - Period entirely before any tariff → energy_cost_eur / total_cost_eur None
  - Subscription prorated to real calendar-month days (28/30/31)
  - Subscription bounded to today (future days not billed)
  - Subscription starts at first valid_from (days before ignored)
  - Tariffs without subscription → subscription_cost_eur None
  - cost_eur per bucket at day and month granularity
"""

import datetime as dt
from calendar import monthrange
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from electricity import services
from electricity.models import (
    ConsumptionRecord,
    ConsumptionSource,
    EnergyRegister,
    MeterTariff,
    MeterTariffType,
)
from electricity.tests.factories import (
    ConsumptionRecordFactory,
    ElectricityMeterFactory,
    HouseholdFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db

PARIS = ZoneInfo("Europe/Paris")
UTC = dt.timezone.utc


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_tariff(household, meter, valid_from, *, price_base=None, price_hp=None, price_hc=None, subscription=None):
    user = UserFactory()
    return MeterTariff.objects.create(
        household=household,
        meter=meter,
        valid_from=valid_from,
        price_base=price_base,
        price_hp=price_hp,
        price_hc=price_hc,
        subscription_eur_month=subscription,
        created_by=user,
        updated_by=user,
    )


def _make_daily_import_records(meter, household, date_from, n_days, energy_wh_per_day, register="base"):
    """Create one import ConsumptionRecord per day (interval 1440 min) starting at date_from."""
    tz = PARIS
    records = []
    for i in range(n_days):
        day = date_from + dt.timedelta(days=i)
        ts = dt.datetime.combine(day, dt.time.min, tzinfo=tz)
        user = UserFactory()
        r = ConsumptionRecord.objects.create(
            household=household,
            meter=meter,
            register=register,
            ts_start=ts,
            interval_minutes=1440,
            energy_wh=energy_wh_per_day,
            source=ConsumptionSource.IMPORT,
            created_by=user,
        )
        records.append(r)
    return records


# ---------------------------------------------------------------------------
# Price change mid-period
# ---------------------------------------------------------------------------


class TestPriceChangeMidPeriod:
    """Tariff A for days 1-5, tariff B for days 6-10 — each day at correct price."""

    def test_energy_cost_split_at_tariff_change(self):
        """10 days at 10 kWh/day: first 5 at price A, next 5 at price B."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        date_from = dt.date(2026, 1, 1)

        price_a = Decimal("0.10000")  # €/kWh
        price_b = Decimal("0.20000")

        _make_tariff(household, meter, dt.date(2026, 1, 1), price_base=price_a)
        _make_tariff(household, meter, dt.date(2026, 1, 6), price_base=price_b)

        energy_per_day = 10_000  # 10 kWh = 10_000 Wh
        _make_daily_import_records(meter, household, date_from, 10, energy_per_day)

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=date_from, date_to=dt.date(2026, 1, 10),
        )

        # 5 days × 10 kWh × 0.10 + 5 days × 10 kWh × 0.20 = 5 + 10 = 15 €
        expected = round(5 * 10 * float(price_a) + 5 * 10 * float(price_b), 2)
        assert summary["energy_cost_eur"] == expected

    def test_each_bucket_has_correct_cost(self):
        """Day granularity — each bucket's cost_eur reflects that day's price."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")

        price_a = Decimal("0.10000")
        price_b = Decimal("0.20000")
        _make_tariff(household, meter, dt.date(2026, 2, 1), price_base=price_a)
        _make_tariff(household, meter, dt.date(2026, 2, 6), price_base=price_b)

        energy_wh = 5_000  # 5 kWh
        _make_daily_import_records(meter, household, dt.date(2026, 2, 1), 10, energy_wh)

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2026, 2, 1), date_to=dt.date(2026, 2, 10),
        )

        buckets = summary["buckets"]
        assert len(buckets) == 10
        expected_a = round(5 * float(price_a), 2)   # 5 kWh × 0.10 = 0.5 €
        expected_b = round(5 * float(price_b), 2)   # 5 kWh × 0.20 = 1.0 €
        for b in buckets[:5]:
            assert b["cost_eur"] == expected_a
        for b in buckets[5:]:
            assert b["cost_eur"] == expected_b

    def test_month_granularity_bucket_cost(self):
        """Month granularity — bucket cost_eur sums all days of the month correctly."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")

        price_jan = Decimal("0.10000")
        price_feb = Decimal("0.20000")
        _make_tariff(household, meter, dt.date(2026, 1, 1), price_base=price_jan)
        _make_tariff(household, meter, dt.date(2026, 2, 1), price_base=price_feb)

        energy_wh = 10_000  # 10 kWh/day
        _make_daily_import_records(meter, household, dt.date(2026, 1, 1), 31, energy_wh)  # Jan
        _make_daily_import_records(meter, household, dt.date(2026, 2, 1), 28, energy_wh)  # Feb

        summary = services.consumption_summary(
            household, meter, granularity="month",
            date_from=dt.date(2026, 1, 1), date_to=dt.date(2026, 2, 28),
        )

        buckets = summary["buckets"]
        assert len(buckets) == 2
        jan_cost = round(31 * 10 * float(price_jan), 2)
        feb_cost = round(28 * 10 * float(price_feb), 2)
        assert buckets[0]["cost_eur"] == jan_cost
        assert buckets[1]["cost_eur"] == feb_cost


# ---------------------------------------------------------------------------
# HP/HC registers — each priced independently
# ---------------------------------------------------------------------------


class TestHpHcCosting:
    """HP and HC energy are each priced at their own rate."""

    def test_hp_hc_energy_cost_sums_both_registers(self):
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.HP_HC, timezone="Europe/Paris")

        price_hp = Decimal("0.25000")
        price_hc = Decimal("0.13000")
        _make_tariff(household, meter, dt.date(2026, 3, 1), price_hp=price_hp, price_hc=price_hc)

        energy_hp = 6_000   # 6 kWh HP
        energy_hc = 4_000   # 4 kWh HC
        day = dt.date(2026, 3, 5)
        ts = dt.datetime.combine(day, dt.time.min, tzinfo=PARIS)
        user = UserFactory()

        ConsumptionRecord.objects.create(
            household=household, meter=meter, register=EnergyRegister.HP,
            ts_start=ts, interval_minutes=1440, energy_wh=energy_hp,
            source=ConsumptionSource.IMPORT, created_by=user,
        )
        ConsumptionRecord.objects.create(
            household=household, meter=meter, register=EnergyRegister.HC,
            ts_start=ts, interval_minutes=1440, energy_wh=energy_hc,
            source=ConsumptionSource.IMPORT, created_by=user,
        )

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=day, date_to=day,
        )

        # 6×0.25 + 4×0.13 = 1.50 + 0.52 = 2.02 €
        expected = round(6 * float(price_hp) + 4 * float(price_hc), 2)
        assert summary["energy_cost_eur"] == expected

    def test_hp_hc_bucket_registers_both_present(self):
        """Bucket registers dict carries both hp and hc keys."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.HP_HC, timezone="Europe/Paris")
        _make_tariff(household, meter, dt.date(2026, 3, 1), price_hp=Decimal("0.25000"), price_hc=Decimal("0.13000"))

        day = dt.date(2026, 3, 5)
        ts = dt.datetime.combine(day, dt.time.min, tzinfo=PARIS)
        user = UserFactory()
        ConsumptionRecord.objects.create(
            household=household, meter=meter, register=EnergyRegister.HP,
            ts_start=ts, interval_minutes=1440, energy_wh=5_000,
            source=ConsumptionSource.IMPORT, created_by=user,
        )
        ConsumptionRecord.objects.create(
            household=household, meter=meter, register=EnergyRegister.HC,
            ts_start=ts, interval_minutes=1440, energy_wh=3_000,
            source=ConsumptionSource.IMPORT, created_by=user,
        )

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=day, date_to=day,
        )
        bucket = summary["buckets"][0]
        assert "hp" in bucket["registers"]
        assert "hc" in bucket["registers"]
        assert bucket["cost_eur"] is not None


# ---------------------------------------------------------------------------
# No applicable tariff — before first valid_from
# ---------------------------------------------------------------------------


class TestNoApplicableTariff:
    """Days before the first valid_from produce no cost."""

    def test_day_before_tariff_starts_has_no_cost(self):
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")

        # Tariff starts Jan 10 — data is from Jan 1
        _make_tariff(household, meter, dt.date(2026, 1, 10), price_base=Decimal("0.20000"))
        _make_daily_import_records(meter, household, dt.date(2026, 1, 1), 5, 10_000)

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2026, 1, 1), date_to=dt.date(2026, 1, 5),
        )

        assert summary["energy_cost_eur"] is None
        assert summary["total_cost_eur"] is None
        for bucket in summary["buckets"]:
            assert bucket["cost_eur"] is None

    def test_period_entirely_before_tariff_all_none(self):
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        _make_tariff(household, meter, dt.date(2026, 6, 1), price_base=Decimal("0.20000"))
        _make_daily_import_records(meter, household, dt.date(2026, 1, 1), 10, 10_000)

        summary = services.consumption_summary(
            household, meter, granularity="month",
            date_from=dt.date(2026, 1, 1), date_to=dt.date(2026, 1, 31),
        )

        assert summary["energy_cost_eur"] is None
        assert summary["total_cost_eur"] is None

    def test_period_without_any_tariff_all_none(self):
        """No tariff at all → everything is None."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        # No tariff created
        _make_daily_import_records(meter, household, dt.date(2026, 3, 1), 5, 10_000)

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2026, 3, 1), date_to=dt.date(2026, 3, 5),
        )

        assert summary["energy_cost_eur"] is None
        assert summary["subscription_cost_eur"] is None
        assert summary["total_cost_eur"] is None

    def test_mixed_period_only_tariffed_days_contribute(self):
        """5 days before tariff start + 5 days after — only the 5 after are costed."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")

        price = Decimal("0.20000")
        _make_tariff(household, meter, dt.date(2026, 4, 6), price_base=price)  # starts Apr 6
        _make_daily_import_records(meter, household, dt.date(2026, 4, 1), 10, 10_000)  # Apr 1–10

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2026, 4, 1), date_to=dt.date(2026, 4, 10),
        )

        # Only days 6-10 should have cost (5 × 10 kWh × 0.20 = 10 €)
        expected = round(5 * 10 * float(price), 2)
        assert summary["energy_cost_eur"] == expected

        # Days 1-5 buckets: cost_eur is None
        buckets_without_cost = [b for b in summary["buckets"] if b["cost_eur"] is None]
        assert len(buckets_without_cost) == 5


# ---------------------------------------------------------------------------
# Subscription prorating
# ---------------------------------------------------------------------------


class TestSubscriptionProrating:
    """Subscription € is prorated to real calendar-month days."""

    def test_31_day_month_prorated_correctly(self):
        """January has 31 days — prorated over full month."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        sub = Decimal("31.00")  # 31 € / month → exactly 1 € / day in January
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=Decimal("0.15000"), subscription=sub)

        summary = services.consumption_summary(
            household, meter, granularity="month",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 31),
        )

        # 31 days × (31 / 31) = 31 €
        assert summary["subscription_cost_eur"] == 31.0

    def test_28_day_month_prorated_correctly(self):
        """February 2025 has 28 days (non-leap year)."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        sub = Decimal("28.00")  # 28 € / month → exactly 1 € / day in February
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=Decimal("0.15000"), subscription=sub)

        summary = services.consumption_summary(
            household, meter, granularity="month",
            date_from=dt.date(2025, 2, 1), date_to=dt.date(2025, 2, 28),
        )

        assert summary["subscription_cost_eur"] == 28.0

    def test_30_day_month_prorated_correctly(self):
        """April has 30 days."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        sub = Decimal("30.00")
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=Decimal("0.15000"), subscription=sub)

        summary = services.consumption_summary(
            household, meter, granularity="month",
            date_from=dt.date(2025, 4, 1), date_to=dt.date(2025, 4, 30),
        )

        assert summary["subscription_cost_eur"] == 30.0

    def test_partial_month_prorated(self):
        """10 days out of 31 in January → 10/31 of the monthly fee."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        sub = Decimal("31.00")
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=Decimal("0.15000"), subscription=sub)

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 10),
        )

        expected = round(float(sub) * 10 / 31, 2)
        assert summary["subscription_cost_eur"] == expected

    def test_subscription_starts_at_first_valid_from(self):
        """Days before the first tariff's valid_from don't accrue subscription."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        sub = Decimal("31.00")
        # Tariff starts Jan 16 — days 1-15 are free
        _make_tariff(household, meter, dt.date(2025, 1, 16), price_base=Decimal("0.15000"), subscription=sub)

        summary = services.consumption_summary(
            household, meter, granularity="month",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 31),
        )

        # Only days 16-31 = 16 days are billed
        expected = round(float(sub) * 16 / 31, 2)
        assert summary["subscription_cost_eur"] == expected

    def test_subscription_bounded_to_today(self):
        """Future days (after today) are not billed for subscription.

        We use today's date as the upper bound and request a range that extends
        far into the future — the subscription must stop at today.
        """
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        sub = Decimal("31.00")
        # Tariff starts in the past so it's applicable
        _make_tariff(household, meter, dt.date(2020, 1, 1), price_base=Decimal("0.15000"), subscription=sub)

        today_local = dt.datetime.now(PARIS).date()
        far_future = today_local + dt.timedelta(days=90)

        summary = services.consumption_summary(
            household, meter, granularity="month",
            date_from=today_local, date_to=far_future,
        )

        # Subscription should only cover today (1 day at most)
        # The exact value depends on which month today falls in
        month_days = monthrange(today_local.year, today_local.month)[1]
        expected_today_share = round(float(sub) / month_days, 2)

        # subscription_cost_eur must be <= 1 full day's share (just today)
        assert summary["subscription_cost_eur"] is not None
        assert summary["subscription_cost_eur"] <= expected_today_share + 0.01  # float tolerance

    def test_tariffs_without_subscription_gives_none(self):
        """subscription_eur_month=None on all tariffs → subscription_cost_eur is None."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=Decimal("0.15000"), subscription=None)
        _make_daily_import_records(meter, household, dt.date(2025, 1, 1), 10, 10_000)

        summary = services.consumption_summary(
            household, meter, granularity="month",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 31),
        )

        assert summary["subscription_cost_eur"] is None

    def test_total_cost_combines_energy_and_subscription(self):
        """total_cost_eur = energy_cost_eur + subscription_cost_eur."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        price = Decimal("0.20000")
        sub = Decimal("10.00")
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=price, subscription=sub)
        _make_daily_import_records(meter, household, dt.date(2025, 1, 1), 10, 10_000)

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 10),
        )

        assert summary["energy_cost_eur"] is not None
        assert summary["subscription_cost_eur"] is not None
        expected_total = round(summary["energy_cost_eur"] + summary["subscription_cost_eur"], 2)
        assert summary["total_cost_eur"] == expected_total

    def test_only_subscription_no_energy_gives_correct_total(self):
        """No consumption records → energy_cost_eur is None, total = subscription only."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        sub = Decimal("10.00")
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=Decimal("0.20000"), subscription=sub)
        # No consumption records

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 10),
        )

        assert summary["energy_cost_eur"] is None
        assert summary["subscription_cost_eur"] is not None
        assert summary["total_cost_eur"] is not None
        assert summary["total_cost_eur"] == summary["subscription_cost_eur"]


# ---------------------------------------------------------------------------
# Euros rounded to 2 decimal places
# ---------------------------------------------------------------------------


class TestCostRounding:
    """€ values in the response are rounded to 2 decimal places (float)."""

    def test_energy_cost_is_float_rounded_to_2dp(self):
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        # price that produces many decimal places: 0.17359 €/kWh × 3.7 kWh
        price = Decimal("0.17359")
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=price)

        ts = dt.datetime.combine(dt.date(2025, 1, 5), dt.time.min, tzinfo=PARIS)
        user = UserFactory()
        ConsumptionRecord.objects.create(
            household=household, meter=meter, register=EnergyRegister.BASE,
            ts_start=ts, interval_minutes=1440, energy_wh=3700,
            source=ConsumptionSource.IMPORT, created_by=user,
        )

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2025, 1, 5), date_to=dt.date(2025, 1, 5),
        )

        cost = summary["energy_cost_eur"]
        assert isinstance(cost, float)
        assert cost == round(cost, 2)

    def test_subscription_cost_is_float_rounded_to_2dp(self):
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        # 9.99 € / 31 days = 0.32225… → rounds to 0.32 × 10 days
        sub = Decimal("9.99")
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=Decimal("0.15000"), subscription=sub)

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 10),
        )

        s = summary["subscription_cost_eur"]
        assert isinstance(s, float)
        assert s == round(s, 2)


# ---------------------------------------------------------------------------
# Total cost semantics — None only when truly nothing is valued
# ---------------------------------------------------------------------------


class TestTotalCostSemantics:
    """total_cost_eur is None if and only if both energy and subscription are None."""

    def test_no_tariff_no_data_all_none(self):
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 5),
        )
        assert summary["energy_cost_eur"] is None
        assert summary["subscription_cost_eur"] is None
        assert summary["total_cost_eur"] is None

    def test_energy_cost_none_but_subscription_set_gives_total(self):
        """When energy is None (no records) but subscription is set, total is non-None."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=Decimal("0.15000"), subscription=Decimal("10.00"))

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 5),
        )

        assert summary["energy_cost_eur"] is None
        assert summary["subscription_cost_eur"] is not None
        assert summary["total_cost_eur"] == summary["subscription_cost_eur"]

    def test_subscription_none_but_energy_set_gives_total(self):
        """When subscription is None but energy is set, total == energy."""
        household = HouseholdFactory()
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE, timezone="Europe/Paris")
        _make_tariff(household, meter, dt.date(2025, 1, 1), price_base=Decimal("0.20000"), subscription=None)
        _make_daily_import_records(meter, household, dt.date(2025, 1, 1), 5, 10_000)

        summary = services.consumption_summary(
            household, meter, granularity="day",
            date_from=dt.date(2025, 1, 1), date_to=dt.date(2025, 1, 5),
        )

        assert summary["energy_cost_eur"] is not None
        assert summary["subscription_cost_eur"] is None
        assert summary["total_cost_eur"] == summary["energy_cost_eur"]
