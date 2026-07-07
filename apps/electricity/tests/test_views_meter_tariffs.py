# electricity/tests/test_views_meter_tariffs.py
"""API view tests for MeterTariffViewSet (parcours 10 — lot 5).

Covers all five mandatory categories for every endpoint:
  1. Happy-path with DB-state verification
  2. Permission checks (owner / member / anonymous)
  3. Cross-household isolation (critical — data must never leak)
  4. Validation / 400 errors
  5. ?meter= filter
"""

import datetime as dt
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from electricity.models import MeterTariff, MeterTariffType
from electricity.tests.factories import (
    ElectricityMeterFactory,
    HouseholdFactory,
    HouseholdMemberFactory,
    UserFactory,
)
from households.models import HouseholdMember

# ---------------------------------------------------------------------------
# Shared helpers — mirrors the pattern from test_views_consumption.py
# ---------------------------------------------------------------------------


def _make_owner(household):
    """Create an owner-member of household, active_household set."""
    user = UserFactory()
    HouseholdMemberFactory(household=household, user=user, role=HouseholdMember.Role.OWNER)
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user


def _make_member(household):
    """Create a read-only member of household, active_household set."""
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
# MeterTariffViewSet — List
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMeterTariffList:
    """GET /api/electricity/meter-tariffs/ — filtering, isolation, permissions."""

    @staticmethod
    def _list_url():
        return reverse("electricity-meter-tariff-list")

    def _create_tariff(self, household, meter=None, **kwargs):
        if meter is None:
            meter = ElectricityMeterFactory(household=household)
        return MeterTariff.objects.create(
            household=household,
            meter=meter,
            valid_from=kwargs.pop("valid_from", dt.date(2025, 1, 1)),
            price_base=kwargs.pop("price_base", Decimal("0.15000")),
            created_by=UserFactory(),
            updated_by=UserFactory(),
            **kwargs,
        )

    def test_owner_can_list_tariffs(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._create_tariff(hh)
        response = _client_for(owner).get(self._list_url())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_member_can_list_tariffs(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        self._create_tariff(hh)
        response = _client_for(member).get(self._list_url())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self._list_url())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_tariffs_not_visible(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_tariff = self._create_tariff(other_hh)
        response = _client_for(owner).get(self._list_url())
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert str(other_tariff.id) not in ids

    def test_filter_by_meter(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter_a = ElectricityMeterFactory(household=hh)
        meter_b = ElectricityMeterFactory(household=hh)
        self._create_tariff(hh, meter=meter_a, valid_from=dt.date(2025, 1, 1))
        self._create_tariff(hh, meter=meter_b, valid_from=dt.date(2025, 1, 1))
        response = _client_for(owner).get(self._list_url(), {"meter": str(meter_a.id)})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert str(response.data[0]["meter"]) == str(meter_a.id)

    def test_ordering_is_newest_first(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh)
        self._create_tariff(hh, meter=meter, valid_from=dt.date(2024, 1, 1))
        self._create_tariff(hh, meter=meter, valid_from=dt.date(2025, 6, 1))
        self._create_tariff(hh, meter=meter, valid_from=dt.date(2023, 1, 1))
        response = _client_for(owner).get(self._list_url(), {"meter": str(meter.id)})
        assert response.status_code == status.HTTP_200_OK
        dates = [r["valid_from"] for r in response.data]
        assert dates == sorted(dates, reverse=True)


# ---------------------------------------------------------------------------
# MeterTariffViewSet — Create
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMeterTariffCreate:
    """POST /api/electricity/meter-tariffs/ — happy path, permissions, validation."""

    @staticmethod
    def _list_url():
        return reverse("electricity-meter-tariff-list")

    def _create_tariff(self, household, meter=None, **kwargs):
        if meter is None:
            meter = ElectricityMeterFactory(household=household)
        return MeterTariff.objects.create(
            household=household,
            meter=meter,
            valid_from=kwargs.pop("valid_from", dt.date(2025, 1, 1)),
            price_base=kwargs.pop("price_base", Decimal("0.15000")),
            created_by=UserFactory(),
            updated_by=UserFactory(),
            **kwargs,
        )

    def _tariff_payload(self, meter, **overrides):
        payload = {
            "meter": str(meter.id),
            "valid_from": "2025-01-01",
            "price_base": "0.20000",
            "price_hp": None,
            "price_hc": None,
            "subscription_eur_month": "10.00",
        }
        payload.update(overrides)
        return payload

    def test_owner_can_create_base_tariff(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = self._tariff_payload(meter)
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["price_base"] == "0.20000"
        assert response.data["valid_from"] == "2025-01-01"
        # DB state
        db = MeterTariff.objects.get(id=response.data["id"])
        assert db.price_base == Decimal("0.20000")
        assert db.meter == meter
        assert db.household == hh

    def test_owner_can_create_hp_hc_tariff(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.HP_HC)
        payload = {
            "meter": str(meter.id),
            "valid_from": "2025-03-01",
            "price_base": None,
            "price_hp": "0.22000",
            "price_hc": "0.15000",
            "subscription_eur_month": "12.00",
        }
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        # DB state
        db = MeterTariff.objects.get(id=response.data["id"])
        assert db.price_hp == Decimal("0.22000")
        assert db.price_hc == Decimal("0.15000")
        assert db.price_base is None

    def test_household_auto_assigned(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = self._tariff_payload(meter)
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert str(response.data["household"]) == str(hh.id)

    def test_member_cannot_create(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = self._tariff_payload(meter)
        response = _client_for(member).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_cannot_create(self):
        hh = HouseholdFactory()
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = self._tariff_payload(meter)
        response = _anon_client().post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_meter_rejected(self):
        """Cannot attach a tariff to a meter from another household."""
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        foreign_meter = ElectricityMeterFactory(household=other_hh, tariff_type=MeterTariffType.BASE)
        payload = self._tariff_payload(foreign_meter)
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "meter" in response.data

    def test_base_meter_with_price_hp_rejected(self):
        """meter.tariff_type=base + price_hp set → 400."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = {
            "meter": str(meter.id),
            "valid_from": "2025-01-01",
            "price_base": "0.20000",
            "price_hp": "0.25000",
            "price_hc": None,
        }
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "price_hp" in response.data

    def test_base_meter_with_price_hc_rejected(self):
        """meter.tariff_type=base + price_hc set → 400."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = {
            "meter": str(meter.id),
            "valid_from": "2025-01-01",
            "price_base": "0.20000",
            "price_hp": None,
            "price_hc": "0.15000",
        }
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "price_hp" in response.data

    def test_hp_hc_meter_without_price_hc_rejected(self):
        """HP/HC meter without price_hc → 400."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.HP_HC)
        payload = {
            "meter": str(meter.id),
            "valid_from": "2025-01-01",
            "price_base": None,
            "price_hp": "0.22000",
            "price_hc": None,
        }
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "price_hp" in response.data

    def test_hp_hc_meter_without_price_hp_rejected(self):
        """HP/HC meter without price_hp → 400."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.HP_HC)
        payload = {
            "meter": str(meter.id),
            "valid_from": "2025-01-01",
            "price_base": None,
            "price_hp": None,
            "price_hc": "0.15000",
        }
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "price_hp" in response.data

    def test_hp_hc_meter_with_price_base_rejected(self):
        """HP/HC meter cannot have price_base → 400."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.HP_HC)
        payload = {
            "meter": str(meter.id),
            "valid_from": "2025-01-01",
            "price_base": "0.18000",
            "price_hp": "0.22000",
            "price_hc": "0.15000",
        }
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "price_base" in response.data

    def test_negative_price_base_rejected(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = {
            "meter": str(meter.id),
            "valid_from": "2025-01-01",
            "price_base": "-0.10000",
        }
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "price_base" in response.data

    def test_negative_subscription_rejected(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        payload = {
            "meter": str(meter.id),
            "valid_from": "2025-01-01",
            "price_base": "0.20000",
            "subscription_eur_month": "-5.00",
        }
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "subscription_eur_month" in response.data

    def test_duplicate_valid_from_same_meter_rejected(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        # Create the first tariff directly in DB
        self._create_tariff(hh, meter=meter, valid_from=dt.date(2025, 1, 1))
        # Attempt to create another with the same date
        payload = self._tariff_payload(meter, valid_from="2025-01-01")
        response = _client_for(owner).post(self._list_url(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        # The duplicate is caught by either the custom serializer check (→ valid_from key)
        # or the DRF UniqueTogetherValidator (→ non_field_errors) — both are acceptable.
        assert "valid_from" in response.data or "non_field_errors" in response.data


# ---------------------------------------------------------------------------
# MeterTariffViewSet — Retrieve
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMeterTariffRetrieve:
    """GET /api/electricity/meter-tariffs/{id}/ — permissions, isolation."""

    @staticmethod
    def _detail_url(tariff_id):
        return reverse("electricity-meter-tariff-detail", args=[tariff_id])

    def _create_tariff(self, household, meter=None, **kwargs):
        if meter is None:
            meter = ElectricityMeterFactory(household=household)
        return MeterTariff.objects.create(
            household=household,
            meter=meter,
            valid_from=kwargs.pop("valid_from", dt.date(2025, 1, 1)),
            price_base=kwargs.pop("price_base", Decimal("0.15000")),
            created_by=UserFactory(),
            updated_by=UserFactory(),
            **kwargs,
        )

    def test_owner_can_retrieve(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        tariff = self._create_tariff(hh)
        response = _client_for(owner).get(self._detail_url(tariff.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(tariff.id)

    def test_member_can_retrieve(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        tariff = self._create_tariff(hh)
        response = _client_for(member).get(self._detail_url(tariff.id))
        assert response.status_code == status.HTTP_200_OK

    def test_anonymous_gets_401(self):
        hh = HouseholdFactory()
        tariff = self._create_tariff(hh)
        response = _anon_client().get(self._detail_url(tariff.id))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_tariff_returns_404(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_tariff = self._create_tariff(other_hh)
        response = _client_for(owner).get(self._detail_url(other_tariff.id))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# MeterTariffViewSet — Update (PATCH)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMeterTariffUpdate:
    """PATCH /api/electricity/meter-tariffs/{id}/ — happy path, permissions, validation."""

    @staticmethod
    def _detail_url(tariff_id):
        return reverse("electricity-meter-tariff-detail", args=[tariff_id])

    def _create_tariff(self, household, meter=None, **kwargs):
        if meter is None:
            meter = ElectricityMeterFactory(household=household)
        return MeterTariff.objects.create(
            household=household,
            meter=meter,
            valid_from=kwargs.pop("valid_from", dt.date(2025, 1, 1)),
            price_base=kwargs.pop("price_base", Decimal("0.15000")),
            created_by=UserFactory(),
            updated_by=UserFactory(),
            **kwargs,
        )

    def test_owner_can_patch_price(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        tariff = self._create_tariff(hh)
        response = _client_for(owner).patch(
            self._detail_url(tariff.id), {"price_base": "0.22000"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        db = MeterTariff.objects.get(id=tariff.id)
        assert db.price_base == Decimal("0.22000")

    def test_owner_can_patch_subscription(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        tariff = self._create_tariff(hh)
        response = _client_for(owner).patch(
            self._detail_url(tariff.id), {"subscription_eur_month": "15.50"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        db = MeterTariff.objects.get(id=tariff.id)
        assert db.subscription_eur_month == Decimal("15.50")

    def test_member_cannot_patch(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        tariff = self._create_tariff(hh)
        response = _client_for(member).patch(
            self._detail_url(tariff.id), {"price_base": "0.22000"}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_cannot_patch(self):
        hh = HouseholdFactory()
        tariff = self._create_tariff(hh)
        response = _anon_client().patch(
            self._detail_url(tariff.id), {"price_base": "0.22000"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_patch_returns_404(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_tariff = self._create_tariff(other_hh)
        response = _client_for(owner).patch(
            self._detail_url(other_tariff.id), {"price_base": "0.22000"}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_patch_negative_price_rejected(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        tariff = self._create_tariff(hh)
        response = _client_for(owner).patch(
            self._detail_url(tariff.id), {"price_base": "-0.01000"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "price_base" in response.data

    def test_patch_duplicate_valid_from_rejected(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, tariff_type=MeterTariffType.BASE)
        self._create_tariff(hh, meter=meter, valid_from=dt.date(2025, 6, 1))
        tariff = self._create_tariff(hh, meter=meter, valid_from=dt.date(2025, 1, 1))
        # Try to move tariff's valid_from to an already-occupied date
        response = _client_for(owner).patch(
            self._detail_url(tariff.id), {"valid_from": "2025-06-01"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        # Duplicate caught by custom serializer check (→ valid_from) or UniqueTogetherValidator (→ non_field_errors)
        assert "valid_from" in response.data or "non_field_errors" in response.data


# ---------------------------------------------------------------------------
# MeterTariffViewSet — Delete
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMeterTariffDelete:
    """DELETE /api/electricity/meter-tariffs/{id}/ — happy path, permissions, isolation."""

    @staticmethod
    def _detail_url(tariff_id):
        return reverse("electricity-meter-tariff-detail", args=[tariff_id])

    def _create_tariff(self, household, meter=None, **kwargs):
        if meter is None:
            meter = ElectricityMeterFactory(household=household)
        return MeterTariff.objects.create(
            household=household,
            meter=meter,
            valid_from=kwargs.pop("valid_from", dt.date(2025, 1, 1)),
            price_base=kwargs.pop("price_base", Decimal("0.15000")),
            created_by=UserFactory(),
            updated_by=UserFactory(),
            **kwargs,
        )

    def test_owner_can_delete(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        tariff = self._create_tariff(hh)
        tariff_id = tariff.id
        response = _client_for(owner).delete(self._detail_url(tariff_id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not MeterTariff.objects.filter(id=tariff_id).exists()

    def test_member_cannot_delete(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        tariff = self._create_tariff(hh)
        response = _client_for(member).delete(self._detail_url(tariff.id))
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert MeterTariff.objects.filter(id=tariff.id).exists()

    def test_anonymous_cannot_delete(self):
        hh = HouseholdFactory()
        tariff = self._create_tariff(hh)
        response = _anon_client().delete(self._detail_url(tariff.id))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_delete_returns_404(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_tariff = self._create_tariff(other_hh)
        response = _client_for(owner).delete(self._detail_url(other_tariff.id))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert MeterTariff.objects.filter(id=other_tariff.id).exists()
