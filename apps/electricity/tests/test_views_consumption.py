# electricity/tests/test_views_consumption.py
"""API view tests for the consumption sub-domain (parcours 10 — lot 1).

Covers:
  - ElectricityMeterViewSet  (/api/electricity/meters/)
  - MeterReadingViewSet      (/api/electricity/meter-readings/)
  - ConsumptionSummaryView   (/api/electricity/consumption/summary/)

For each endpoint the five mandatory categories are covered:
  1. Happy-path with DB-state verification
  2. Permission checks (owner / member / anonymous)
  3. Cross-household isolation
  4. Validation / 400 errors

Authentication pattern follows the rest of the module: force_authenticate +
active_household set on the user so the ActiveHouseholdMiddleware resolves
request.household correctly.
"""

import datetime as dt
import uuid
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from electricity.models import (
    ConsumptionRecord,
    ConsumptionSource,
    ElectricityMeter,
    EnergyRegister,
    MeterReading,
    MeterTariffType,
)
from electricity.tests.factories import (
    ConsumptionRecordFactory,
    ElectricityMeterFactory,
    HouseholdFactory,
    HouseholdMemberFactory,
    MeterReadingFactory,
    UserFactory,
    ZoneFactory,
)
from households.models import HouseholdMember

# ---------------------------------------------------------------------------
# Shared helpers (mirrors test_views.py pattern exactly)
# ---------------------------------------------------------------------------

PARIS = ZoneInfo("Europe/Paris")


def _make_owner(household):
    """Create a user who is the owner of household, with active_household set."""
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _make_member(household):
    """Create a read-only member of household."""
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.MEMBER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _anon_client() -> APIClient:
    return APIClient()


# ---------------------------------------------------------------------------
# ElectricityMeterViewSet — list / create
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestElectricityMeterList:
    """GET /api/electricity/meters/ — filtering, isolation, permissions."""

    LIST_URL = staticmethod(lambda: reverse("electricity-meter-list"))

    def _create_meter(self, household, **kwargs):
        return ElectricityMeterFactory(household=household, **kwargs)

    def _meter_payload(self, **overrides):
        payload = {
            "name": "Compteur principal",
            "tariff_type": "base",
            "timezone": "Europe/Paris",
        }
        payload.update(overrides)
        return payload

    def test_owner_can_list_meters(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_meter(hh)
        response = _client_for(owner).get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_member_can_list_meters(self):
        hh = HouseholdFactory()
        self._create_meter(hh)
        member = _make_member(hh)
        response = _client_for(member).get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_meter_not_visible(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_meter = self._create_meter(other_hh)
        response = _client_for(owner).get(self.LIST_URL())
        ids = [r["id"] for r in response.data]
        assert str(other_meter.id) not in ids

    def test_filter_is_active_true(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        active = self._create_meter(hh, is_active=True)
        inactive = self._create_meter(hh, is_active=False)
        response = _client_for(owner).get(self.LIST_URL(), {"is_active": "true"})
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert str(active.id) in ids
        assert str(inactive.id) not in ids

    def test_filter_is_active_false(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        active = self._create_meter(hh, is_active=True)
        inactive = self._create_meter(hh, is_active=False)
        response = _client_for(owner).get(self.LIST_URL(), {"is_active": "false"})
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert str(inactive.id) in ids
        assert str(active.id) not in ids


@pytest.mark.django_db
class TestElectricityMeterCreate:
    """POST /api/electricity/meters/ — happy path + validation."""

    LIST_URL = staticmethod(lambda: reverse("electricity-meter-list"))

    def _create_meter(self, household, **kwargs):
        return ElectricityMeterFactory(household=household, **kwargs)

    def _meter_payload(self, **overrides):
        payload = {
            "name": "Compteur principal",
            "tariff_type": "base",
            "timezone": "Europe/Paris",
        }
        payload.update(overrides)
        return payload

    def test_owner_creates_meter_returns_201_and_db_state(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = self._meter_payload()
        response = _client_for(owner).post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Compteur principal"
        meter = ElectricityMeter.objects.get(id=response.data["id"])
        assert meter.household_id == hh.id
        assert meter.tariff_type == MeterTariffType.BASE

    def test_household_auto_assigned_from_context(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(self.LIST_URL(), self._meter_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        meter = ElectricityMeter.objects.get(id=response.data["id"])
        assert meter.household_id == hh.id

    def test_member_cannot_create_meter(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        response = _client_for(member).post(self.LIST_URL(), self._meter_payload(), format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_cannot_create_meter(self):
        response = _anon_client().post(self.LIST_URL(), self._meter_payload(), format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_timezone_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = self._meter_payload(timezone="Not/AReal/Timezone")
        response = _client_for(owner).post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "timezone" in response.data

    def test_zone_from_other_household_returns_400(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        foreign_zone = ZoneFactory(household=other_hh)
        payload = self._meter_payload(zone=str(foreign_zone.id))
        response = _client_for(owner).post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone" in response.data

    def test_zone_same_household_accepted(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        payload = self._meter_payload(zone=str(zone.id))
        response = _client_for(owner).post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        meter = ElectricityMeter.objects.get(id=response.data["id"])
        assert meter.zone_id == zone.id

    def test_name_required_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = self._meter_payload()
        del payload["name"]
        response = _client_for(owner).post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data


@pytest.mark.django_db
class TestElectricityMeterDetail:
    """GET/PATCH/DELETE /api/electricity/meters/<id>/."""

    DETAIL_URL = staticmethod(lambda pk: reverse("electricity-meter-detail", args=[pk]))

    def _create_meter(self, household, **kwargs):
        return ElectricityMeterFactory(household=household, **kwargs)

    def test_owner_can_retrieve_meter(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = self._create_meter(hh)
        response = _client_for(owner).get(self.DETAIL_URL(meter.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(meter.id)

    def test_member_can_retrieve_meter(self):
        hh = HouseholdFactory()
        meter = self._create_meter(hh)
        member = _make_member(hh)
        response = _client_for(member).get(self.DETAIL_URL(meter.id))
        assert response.status_code == status.HTTP_200_OK

    def test_owner_can_patch_meter(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = self._create_meter(hh)
        response = _client_for(owner).patch(
            self.DETAIL_URL(meter.id), {"name": "Updated name"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        meter.refresh_from_db()
        assert meter.name == "Updated name"

    def test_member_cannot_patch_meter(self):
        hh = HouseholdFactory()
        meter = self._create_meter(hh)
        member = _make_member(hh)
        response = _client_for(member).patch(
            self.DETAIL_URL(meter.id), {"name": "Hacked"}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_owner_can_delete_meter(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = self._create_meter(hh)
        response = _client_for(owner).delete(self.DETAIL_URL(meter.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ElectricityMeter.objects.filter(id=meter.id).exists()

    def test_member_cannot_delete_meter(self):
        hh = HouseholdFactory()
        meter = self._create_meter(hh)
        member = _make_member(hh)
        response = _client_for(member).delete(self.DETAIL_URL(meter.id))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_cross_household_detail_returns_404(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_meter = self._create_meter(other_hh)
        response = _client_for(owner).get(self.DETAIL_URL(other_meter.id))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# MeterReadingViewSet
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMeterReadingList:
    """GET /api/electricity/meter-readings/ — isolation, filter, permissions."""

    LIST_URL = staticmethod(lambda: reverse("electricity-meter-reading-list"))

    def _create_reading(self, household, meter=None, **kwargs):
        if meter is None:
            meter = ElectricityMeterFactory(household=household)
        return MeterReadingFactory(meter=meter, household=household, **kwargs)

    def test_owner_can_list_readings(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_reading(hh)
        response = _client_for(owner).get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_member_can_list_readings(self):
        hh = HouseholdFactory()
        self._create_reading(hh)
        member = _make_member(hh)
        response = _client_for(member).get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_readings_not_visible(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_reading = self._create_reading(other_hh)
        response = _client_for(owner).get(self.LIST_URL())
        ids = [r["id"] for r in response.data]
        assert str(other_reading.id) not in ids

    def test_filter_by_meter(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter1 = ElectricityMeterFactory(household=hh)
        meter2 = ElectricityMeterFactory(household=hh)
        r1 = MeterReadingFactory(meter=meter1, household=hh, index_kwh=Decimal("100"))
        MeterReadingFactory(
            meter=meter2,
            household=hh,
            index_kwh=Decimal("200"),
            reading_at=dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc),
        )
        response = _client_for(owner).get(self.LIST_URL(), {"meter": str(meter1.id)})
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert str(r1.id) in ids
        for item in response.data:
            # meter field is serialized as a UUID string
            assert str(item["meter"]) == str(meter1.id)


@pytest.mark.django_db
class TestMeterReadingCreate:
    """POST /api/electricity/meter-readings/ — happy path, DB side-effects, validation."""

    LIST_URL = staticmethod(lambda: reverse("electricity-meter-reading-list"))

    def _create_reading(self, household, meter=None, **kwargs):
        if meter is None:
            meter = ElectricityMeterFactory(household=household)
        return MeterReadingFactory(meter=meter, household=household, **kwargs)

    def _reading_payload(self, meter_id, **overrides):
        payload = {
            "meter": str(meter_id),
            "register": "base",
            "reading_at": "2026-06-01T00:00:00Z",
            "index_kwh": "1000.000",
        }
        payload.update(overrides)
        return payload

    def test_owner_creates_reading_returns_201_and_db_state(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = self._reading_payload(meter.id)
        response = _client_for(owner).post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["index_kwh"] == "1000.000"
        reading = MeterReading.objects.get(id=response.data["id"])
        assert reading.household_id == hh.id
        assert reading.meter_id == meter.id
        assert reading.register == EnergyRegister.BASE

    def test_consumption_records_generated_after_two_readings(self):
        """After a second reading, consumption records (source=reading) must exist."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        # First reading
        _client_for(owner).post(
            self.LIST_URL(),
            self._reading_payload(meter.id, reading_at="2026-06-01T00:00:00Z", index_kwh="1000.000"),
            format="json",
        )
        # Second reading
        response = _client_for(owner).post(
            self.LIST_URL(),
            self._reading_payload(meter.id, reading_at="2026-06-02T00:00:00Z", index_kwh="1100.000"),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        records = ConsumptionRecord.objects.filter(meter=meter, source=ConsumptionSource.READING)
        assert records.exists()
        assert sum(r.energy_wh for r in records) == 100_000

    def test_member_cannot_create_reading(self):
        hh = HouseholdFactory()
        meter = ElectricityMeterFactory(household=hh)
        member = _make_member(hh)
        payload = self._reading_payload(meter.id)
        response = _client_for(member).post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_cannot_create_reading(self):
        hh = HouseholdFactory()
        meter = ElectricityMeterFactory(household=hh)
        payload = self._reading_payload(meter.id)
        response = _anon_client().post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_decreasing_index_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        _client_for(owner).post(
            self.LIST_URL(),
            self._reading_payload(meter.id, reading_at="2026-06-01T00:00:00Z", index_kwh="1000.000"),
            format="json",
        )
        response = _client_for(owner).post(
            self.LIST_URL(),
            self._reading_payload(meter.id, reading_at="2026-06-02T00:00:00Z", index_kwh="900.000"),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "index_kwh" in response.data

    def test_register_hp_on_base_meter_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        # BASE tariff meter only allows 'base' register
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = self._reading_payload(meter.id, register="hp")
        response = _client_for(owner).post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "register" in response.data

    def test_meter_from_other_household_returns_400(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_meter = ElectricityMeterFactory(household=other_hh)
        payload = self._reading_payload(other_meter.id)
        response = _client_for(owner).post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "meter" in response.data

    def test_duplicate_reading_at_same_register_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        # Create first reading
        _client_for(owner).post(
            self.LIST_URL(),
            self._reading_payload(meter.id, reading_at="2026-06-01T00:00:00Z", index_kwh="1000.000"),
            format="json",
        )
        # Duplicate timestamp — the serializer catches it with a reading_at error;
        # if the serializer check were absent the DB UniqueConstraint would surface
        # as non_field_errors — both mean the same semantic rejection, so we assert
        # status 400 and that either field key appears (serializer path) or that
        # the error message mentions uniqueness (DB path).
        response = _client_for(owner).post(
            self.LIST_URL(),
            self._reading_payload(meter.id, reading_at="2026-06-01T00:00:00Z", index_kwh="1010.000"),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        # Serializer raises under 'reading_at'; DB unique fallback under 'non_field_errors'
        assert "reading_at" in response.data or "non_field_errors" in response.data


@pytest.mark.django_db
class TestMeterReadingUpdate:
    """PATCH/PUT /api/electricity/meter-readings/<id>/ — mutations regenerate estimates."""

    LIST_URL = staticmethod(lambda: reverse("electricity-meter-reading-list"))
    DETAIL_URL = staticmethod(lambda pk: reverse("electricity-meter-reading-detail", args=[pk]))

    def _post_reading(self, client, meter_id, reading_at, index_kwh, register="base"):
        payload = {
            "meter": str(meter_id),
            "register": register,
            "reading_at": reading_at,
            "index_kwh": index_kwh,
        }
        response = client.post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED, response.data
        return response.data

    def _create_two_readings_via_api(self, household):
        """Create two readings through the API so rebuild_reading_records runs."""
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE)
        owner = _make_owner(household)
        client = _client_for(owner)
        r1 = self._post_reading(client, meter.id, "2026-06-01T00:00:00Z", "1000.000")
        r2 = self._post_reading(client, meter.id, "2026-06-02T00:00:00Z", "1100.000")
        return meter, owner, r1, r2

    def test_owner_patch_reading_updates_db(self):
        hh = HouseholdFactory()
        meter, owner, r1, r2 = self._create_two_readings_via_api(hh)
        response = _client_for(owner).patch(
            self.DETAIL_URL(r2["id"]),
            {"index_kwh": "1150.000"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        reading = MeterReading.objects.get(id=r2["id"])
        assert reading.index_kwh == Decimal("1150.000")

    def test_update_reading_regenerates_consumption_records(self):
        hh = HouseholdFactory()
        meter, owner, r1, r2 = self._create_two_readings_via_api(hh)
        # Baseline: two readings 24h apart with 100 kWh delta → 100_000 Wh
        old_total = sum(
            r.energy_wh
            for r in ConsumptionRecord.objects.filter(meter=meter, source=ConsumptionSource.READING)
        )
        assert old_total == 100_000  # 100 kWh baseline

        _client_for(owner).patch(
            self.DETAIL_URL(r2["id"]),
            {"index_kwh": "1200.000"},
            format="json",
        )
        new_total = sum(
            r.energy_wh
            for r in ConsumptionRecord.objects.filter(meter=meter, source=ConsumptionSource.READING)
        )
        assert new_total == 200_000  # delta now 200 kWh

    def test_member_cannot_patch_reading(self):
        hh = HouseholdFactory()
        meter, owner, r1, r2 = self._create_two_readings_via_api(hh)
        member = _make_member(hh)
        response = _client_for(member).patch(
            self.DETAIL_URL(r2["id"]), {"index_kwh": "9999.000"}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestMeterReadingDelete:
    """DELETE /api/electricity/meter-readings/<id>/ — deletion regenerates estimates."""

    LIST_URL = staticmethod(lambda: reverse("electricity-meter-reading-list"))
    DETAIL_URL = staticmethod(lambda pk: reverse("electricity-meter-reading-detail", args=[pk]))

    def _post_reading(self, client, meter_id, reading_at, index_kwh, register="base"):
        payload = {
            "meter": str(meter_id),
            "register": register,
            "reading_at": reading_at,
            "index_kwh": index_kwh,
        }
        response = client.post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED, response.data
        return response.data

    def _create_two_readings_via_api(self, household):
        """Create two readings through the API so rebuild_reading_records runs."""
        meter = ElectricityMeterFactory(household=household, tariff_type=MeterTariffType.BASE)
        owner = _make_owner(household)
        client = _client_for(owner)
        r1 = self._post_reading(client, meter.id, "2026-06-01T00:00:00Z", "1000.000")
        r2 = self._post_reading(client, meter.id, "2026-06-02T00:00:00Z", "1100.000")
        return meter, owner, r1, r2

    def test_owner_deletes_reading_returns_204(self):
        hh = HouseholdFactory()
        meter, owner, r1, r2 = self._create_two_readings_via_api(hh)
        response = _client_for(owner).delete(self.DETAIL_URL(r2["id"]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not MeterReading.objects.filter(id=r2["id"]).exists()

    def test_delete_reading_removes_consumption_records(self):
        hh = HouseholdFactory()
        meter, owner, r1, r2 = self._create_two_readings_via_api(hh)
        # Records exist after two readings (delta = 100 kWh → 100_000 Wh)
        assert ConsumptionRecord.objects.filter(meter=meter, source=ConsumptionSource.READING).exists()
        # Delete the second reading — only one reading remains, no delta → no records
        _client_for(owner).delete(self.DETAIL_URL(r2["id"]))
        assert not ConsumptionRecord.objects.filter(meter=meter, source=ConsumptionSource.READING).exists()

    def test_member_cannot_delete_reading(self):
        hh = HouseholdFactory()
        meter, owner, r1, r2 = self._create_two_readings_via_api(hh)
        member = _make_member(hh)
        response = _client_for(member).delete(self.DETAIL_URL(r2["id"]))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_cross_household_reading_delete_returns_404(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_meter = ElectricityMeterFactory(household=other_hh)
        other_reading = MeterReadingFactory(meter=other_meter, household=other_hh, index_kwh=Decimal("500"))
        response = _client_for(owner).delete(self.DETAIL_URL(other_reading.id))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# ConsumptionSummaryView
# ---------------------------------------------------------------------------


def _dt_utc(year, month, day, hour=0, minute=0) -> dt.datetime:
    return dt.datetime(year, month, day, hour, minute, tzinfo=dt.timezone.utc)


SUMMARY_URL = lambda: reverse("electricity-consumption-summary")  # noqa: E731


@pytest.mark.django_db
class TestConsumptionSummaryGranularities:
    """GET /api/electricity/consumption/summary/ — 4 granularities, DB-created records."""

    def _make_import_records(self, meter, ts_start, count=4, interval=30, energy_wh=500):
        """Create ``count`` import records back-to-back, each ``interval`` minutes."""
        records = []
        for i in range(count):
            ts = ts_start + dt.timedelta(minutes=i * interval)
            records.append(
                ConsumptionRecordFactory(
                    meter=meter,
                    household=meter.household,
                    register=EnergyRegister.BASE,
                    ts_start=ts,
                    interval_minutes=interval,
                    energy_wh=energy_wh,
                    source=ConsumptionSource.IMPORT,
                )
            )
        return records

    def _summary(self, client, meter, granularity, date_from, date_to):
        return client.get(
            SUMMARY_URL(),
            {
                "meter": str(meter.id),
                "granularity": granularity,
                "date_from": date_from,
                "date_to": date_to,
            },
        )

    def test_hourly_granularity_returns_buckets(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="UTC", tariff_type=MeterTariffType.BASE)
        # 4 records of 30 min, 500 Wh each, all inside 2026-06-01 00:00–01:00
        self._make_import_records(meter, _dt_utc(2026, 6, 1, 0, 0), count=2, interval=30, energy_wh=500)
        response = self._summary(_client_for(owner), meter, "hour", "2026-06-01", "2026-06-01")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["granularity"] == "hour"
        assert response.data["total_wh"] == 1000
        assert len(response.data["buckets"]) == 1
        assert response.data["buckets"][0]["total_wh"] == 1000

    def test_daily_granularity_returns_buckets(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="UTC", tariff_type=MeterTariffType.BASE)
        # 2 records on June 1, 2 records on June 2
        self._make_import_records(meter, _dt_utc(2026, 6, 1, 0, 0), count=2, interval=30, energy_wh=500)
        self._make_import_records(meter, _dt_utc(2026, 6, 2, 0, 0), count=2, interval=30, energy_wh=300)
        response = self._summary(_client_for(owner), meter, "day", "2026-06-01", "2026-06-02")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["granularity"] == "day"
        assert len(response.data["buckets"]) == 2
        assert response.data["total_wh"] == 2 * 500 + 2 * 300

    def test_monthly_granularity_returns_buckets(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="UTC", tariff_type=MeterTariffType.BASE)
        # Records in June and July
        self._make_import_records(meter, _dt_utc(2026, 6, 15, 0, 0), count=2, interval=30, energy_wh=1000)
        self._make_import_records(meter, _dt_utc(2026, 7, 15, 0, 0), count=2, interval=30, energy_wh=800)
        response = self._summary(_client_for(owner), meter, "month", "2026-06-01", "2026-07-31")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["buckets"]) == 2
        assert response.data["total_wh"] == 2 * 1000 + 2 * 800

    def test_yearly_granularity_returns_buckets(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="UTC", tariff_type=MeterTariffType.BASE)
        # Records in 2025 and 2026
        self._make_import_records(meter, _dt_utc(2025, 6, 1, 0, 0), count=2, interval=30, energy_wh=700)
        self._make_import_records(meter, _dt_utc(2026, 6, 1, 0, 0), count=2, interval=30, energy_wh=900)
        response = self._summary(_client_for(owner), meter, "year", "2025-01-01", "2026-12-31")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["buckets"]) == 2
        assert response.data["total_wh"] == 2 * 700 + 2 * 900

    def test_hourly_view_excludes_coarse_records(self):
        """A 1440-min (daily) record must NOT appear in the hour view (honesty rule)."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="UTC", tariff_type=MeterTariffType.BASE)
        # One 1440-minute record — coarse, should be excluded from hour view
        ConsumptionRecordFactory(
            meter=meter,
            household=hh,
            register=EnergyRegister.BASE,
            ts_start=_dt_utc(2026, 6, 1, 0, 0),
            interval_minutes=1440,
            energy_wh=50_000,
            source=ConsumptionSource.READING,
        )
        response = self._summary(_client_for(owner), meter, "hour", "2026-06-01", "2026-06-01")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_wh"] == 0
        assert response.data["buckets"] == []

    def test_daily_view_includes_1440_min_records(self):
        """A 1440-min record MUST appear in the day/month/year views."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="UTC", tariff_type=MeterTariffType.BASE)
        ConsumptionRecordFactory(
            meter=meter,
            household=hh,
            register=EnergyRegister.BASE,
            ts_start=_dt_utc(2026, 6, 1, 0, 0),
            interval_minutes=1440,
            energy_wh=50_000,
            source=ConsumptionSource.READING,
        )
        response = self._summary(_client_for(owner), meter, "day", "2026-06-01", "2026-06-01")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_wh"] == 50_000

    def test_monthly_view_includes_1440_min_records(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="UTC", tariff_type=MeterTariffType.BASE)
        ConsumptionRecordFactory(
            meter=meter,
            household=hh,
            register=EnergyRegister.BASE,
            ts_start=_dt_utc(2026, 6, 1, 0, 0),
            interval_minutes=1440,
            energy_wh=50_000,
            source=ConsumptionSource.READING,
        )
        response = self._summary(_client_for(owner), meter, "month", "2026-06-01", "2026-06-30")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_wh"] == 50_000

    def test_yearly_view_includes_1440_min_records(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="UTC", tariff_type=MeterTariffType.BASE)
        ConsumptionRecordFactory(
            meter=meter,
            household=hh,
            register=EnergyRegister.BASE,
            ts_start=_dt_utc(2026, 6, 1, 0, 0),
            interval_minutes=1440,
            energy_wh=50_000,
            source=ConsumptionSource.READING,
        )
        response = self._summary(_client_for(owner), meter, "year", "2026-01-01", "2026-12-31")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_wh"] == 50_000

    def test_estimated_wh_reflects_reading_source_only(self):
        """estimated_wh must equal only the source=reading share; imports are 0."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="UTC", tariff_type=MeterTariffType.BASE)
        # import record: should not count toward estimated_wh
        ConsumptionRecordFactory(
            meter=meter, household=hh, register=EnergyRegister.BASE,
            ts_start=_dt_utc(2026, 6, 1, 0, 0), interval_minutes=30,
            energy_wh=1000, source=ConsumptionSource.IMPORT,
        )
        # reading record: should count toward estimated_wh
        ConsumptionRecordFactory(
            meter=meter, household=hh, register=EnergyRegister.BASE,
            ts_start=_dt_utc(2026, 6, 1, 0, 30), interval_minutes=30,
            energy_wh=500, source=ConsumptionSource.READING,
        )
        response = self._summary(_client_for(owner), meter, "hour", "2026-06-01", "2026-06-01")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_wh"] == 1500
        assert response.data["estimated_wh"] == 500
        bucket = response.data["buckets"][0]
        assert bucket["estimated_wh"] == 500

    def test_hp_hc_registers_pivoted_in_buckets(self):
        """HP/HC meters: each bucket must carry both registers separately."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(
            household=hh, timezone="UTC", tariff_type=MeterTariffType.HP_HC
        )
        ConsumptionRecordFactory(
            meter=meter, household=hh, register=EnergyRegister.HP,
            ts_start=_dt_utc(2026, 6, 1, 10, 0), interval_minutes=30,
            energy_wh=800, source=ConsumptionSource.IMPORT,
        )
        ConsumptionRecordFactory(
            meter=meter, household=hh, register=EnergyRegister.HC,
            ts_start=_dt_utc(2026, 6, 1, 2, 0), interval_minutes=30,
            energy_wh=400, source=ConsumptionSource.IMPORT,
        )
        response = self._summary(_client_for(owner), meter, "day", "2026-06-01", "2026-06-01")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_wh"] == 1200
        bucket = response.data["buckets"][0]
        assert bucket["registers"].get("hp") == 800
        assert bucket["registers"].get("hc") == 400


@pytest.mark.django_db
class TestConsumptionSummaryPermissions:
    """GET /api/electricity/consumption/summary/ — permission & isolation."""

    def _base_params(self, meter):
        return {
            "meter": str(meter.id),
            "granularity": "day",
            "date_from": "2026-06-01",
            "date_to": "2026-06-30",
        }

    def test_owner_can_access_summary(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh)
        response = _client_for(owner).get(SUMMARY_URL(), self._base_params(meter))
        assert response.status_code == status.HTTP_200_OK

    def test_member_can_access_summary(self):
        hh = HouseholdFactory()
        meter = ElectricityMeterFactory(household=hh)
        member = _make_member(hh)
        response = _client_for(member).get(SUMMARY_URL(), self._base_params(meter))
        assert response.status_code == status.HTTP_200_OK

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        meter = ElectricityMeterFactory(household=hh)
        response = _anon_client().get(SUMMARY_URL(), self._base_params(meter))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_meter_returns_404(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_meter = ElectricityMeterFactory(household=other_hh)
        response = _client_for(owner).get(SUMMARY_URL(), self._base_params(other_meter))
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestConsumptionSummaryValidation:
    """GET /api/electricity/consumption/summary/ — 400 for bad parameters."""

    def _call(self, client, **params):
        return client.get(SUMMARY_URL(), params)

    def _owner_client_and_meter(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh)
        return _client_for(owner), meter

    def test_missing_meter_returns_400(self):
        client, _ = self._owner_client_and_meter()
        response = self._call(
            client, granularity="day", date_from="2026-06-01", date_to="2026-06-30"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "meter" in response.data

    def test_unknown_meter_returns_404(self):
        client, _ = self._owner_client_and_meter()
        response = self._call(
            client,
            meter=str(uuid.uuid4()),
            granularity="day",
            date_from="2026-06-01",
            date_to="2026-06-30",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_invalid_granularity_returns_400(self):
        client, meter = self._owner_client_and_meter()
        response = self._call(
            client,
            meter=str(meter.id),
            granularity="decade",
            date_from="2026-06-01",
            date_to="2026-06-30",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "granularity" in response.data

    def test_missing_date_from_returns_400(self):
        client, meter = self._owner_client_and_meter()
        response = self._call(
            client, meter=str(meter.id), granularity="day", date_to="2026-06-30"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_date_to_returns_400(self):
        client, meter = self._owner_client_and_meter()
        response = self._call(
            client, meter=str(meter.id), granularity="day", date_from="2026-06-01"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_date_to_before_date_from_returns_400(self):
        client, meter = self._owner_client_and_meter()
        response = self._call(
            client,
            meter=str(meter.id),
            granularity="day",
            date_from="2026-06-30",
            date_to="2026-06-01",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "date_to" in response.data

    def test_invalid_date_format_returns_400(self):
        client, meter = self._owner_client_and_meter()
        response = self._call(
            client,
            meter=str(meter.id),
            granularity="day",
            date_from="not-a-date",
            date_to="2026-06-30",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_valid_request_returns_200_with_expected_shape(self):
        client, meter = self._owner_client_and_meter()
        response = self._call(
            client,
            meter=str(meter.id),
            granularity="day",
            date_from="2026-06-01",
            date_to="2026-06-30",
        )
        assert response.status_code == status.HTTP_200_OK
        assert "buckets" in response.data
        assert "total_wh" in response.data
        assert "estimated_wh" in response.data
        assert response.data["meter"] == str(meter.id)
        assert response.data["granularity"] == "day"
