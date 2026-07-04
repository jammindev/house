# electricity/tests/test_views_imports.py
"""API view tests for ConsumptionImportViewSet (parcours 10 — import layer).

Covers:
  - POST /api/electricity/consumption/imports/  (create — always 201)
  - GET  /api/electricity/consumption/imports/  (list history)
  - POST /api/electricity/consumption/imports/preview/ (preview endpoint)

For each endpoint the five mandatory categories are covered:
  1. Happy path with DB-state verification
  2. DB state verification after every mutation
  3. Permission checks (owner / member / anonymous)
  4. Cross-household isolation
  5. Validation errors → 400

Authentication: force_authenticate + active_household via middleware, identical
to test_views_consumption.py.
"""

import json
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from electricity.models import (
    ConsumptionImport,
    ConsumptionRecord,
    ImportStatus,
)
from electricity.tests.factories import (
    ElectricityMeterFactory,
    HouseholdFactory,
    HouseholdMemberFactory,
    UserFactory,
)
from households.models import HouseholdMember

# ---------------------------------------------------------------------------
# Shared helpers (same pattern as test_views_consumption.py)
# ---------------------------------------------------------------------------

FIXTURE = Path(__file__).parent / "fixtures" / "enedis_courbe_de_charge.csv"

IMPORTS_LIST_URL = staticmethod(lambda: reverse("electricity-consumption-import-list"))
IMPORTS_PREVIEW_URL = staticmethod(lambda: reverse("electricity-consumption-import-preview"))


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


def _enedis_file(name="enedis.csv") -> SimpleUploadedFile:
    """Return a SimpleUploadedFile wrapping the real Enedis fixture."""
    content = FIXTURE.read_bytes()
    return SimpleUploadedFile(name, content, content_type="text/csv")


def _invalid_file(name="bad.csv") -> SimpleUploadedFile:
    """Return a file with unrecognizable content (fails all importers)."""
    return SimpleUploadedFile(name, b"hello world\njust garbage\n", content_type="text/csv")


def _unreadable_enedis_file(name="broken.csv") -> SimpleUploadedFile:
    """Return a file that looks like Enedis CSV but has an unparseable row."""
    content = b"Horodate;Valeur\n2026-06-01T00:30:00+02:00;420\nnot-a-date;100\n"
    return SimpleUploadedFile(name, content, content_type="text/csv")


def _generic_csv_file(name="generic.csv") -> SimpleUploadedFile:
    content = b"time,cons\n2026-06-01T00:00:00,1.5\n2026-06-01T00:15:00,2.0\n"
    return SimpleUploadedFile(name, content, content_type="text/csv")


def _generic_csv_options() -> str:
    return json.dumps({
        "timestamp_column": "time",
        "value_column": "cons",
        "unit": "kwh",
        "interval_minutes": 15,
    })


# ---------------------------------------------------------------------------
# TestConsumptionImportCreate — happy path + idempotence + DB state
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestConsumptionImportCreate:
    """POST /api/electricity/consumption/imports/ — 201 always, status on object."""

    def _create_import(self, household, meter, **kwargs):
        return ConsumptionImport.objects.create(
            household=household,
            meter=meter,
            provider="enedis_csv",
            filename="test.csv",
            status=ImportStatus.COMPLETED,
            created_by=UserFactory(),
            updated_by=UserFactory(),
            **kwargs,
        )

    def _import_payload(self, meter_id, file=None, **overrides):
        if file is None:
            file = _enedis_file()
        payload = {"meter": str(meter_id), "file": file}
        payload.update(overrides)
        return payload

    def test_owner_enedis_import_returns_201_completed(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="Europe/Paris")
        payload = self._import_payload(meter.id)
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == ImportStatus.COMPLETED
        assert response.data["provider"] == "enedis_csv"

    def test_enedis_import_db_state_created_count_and_records(self):
        """After first import: 5 records in DB, created_count=5, skipped_count=0."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="Europe/Paris")
        payload = self._import_payload(meter.id)
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["created_count"] == 5
        assert response.data["skipped_count"] == 0
        # Verify DB state
        imported = ConsumptionImport.objects.get(id=response.data["id"])
        assert imported.status == ImportStatus.COMPLETED
        assert imported.created_count == 5
        assert imported.skipped_count == 0
        assert ConsumptionRecord.objects.filter(meter=meter).count() == 5

    def test_reimport_same_file_returns_201_with_idempotence(self):
        """Re-POSTing the same file: 201, created_count=0, skipped_count=5, still 5 records."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="Europe/Paris")
        # First import
        _client_for(owner).post(
            IMPORTS_LIST_URL(),
            self._import_payload(meter.id),
            format="multipart",
        )
        # Second import of the identical file
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(),
            self._import_payload(meter.id),
            format="multipart",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == ImportStatus.COMPLETED
        assert response.data["created_count"] == 0
        assert response.data["skipped_count"] == 5
        # Records must not be duplicated
        assert ConsumptionRecord.objects.filter(meter=meter).count() == 5

    def test_invalid_file_returns_201_with_status_failed(self):
        """Unknown format → 201 with status=failed, error non-empty, 0 records."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="Europe/Paris")
        payload = {"meter": str(meter.id), "file": _invalid_file()}
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == ImportStatus.FAILED
        assert response.data["error"]  # non-empty
        assert ConsumptionRecord.objects.filter(meter=meter).count() == 0

    def test_invalid_file_db_state_no_records(self):
        """Broken Enedis CSV (parse error) → 201 failed, DB has 0 ConsumptionRecords."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="Europe/Paris")
        payload = {"meter": str(meter.id), "file": _unreadable_enedis_file()}
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == ImportStatus.FAILED
        assert response.data["error"]
        assert ConsumptionRecord.objects.filter(meter=meter).count() == 0

    def test_generic_csv_with_provider_and_options_returns_201_completed(self):
        """Explicit provider=generic_csv + valid options JSON string → 201 completed."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="Europe/Paris")
        payload = {
            "meter": str(meter.id),
            "file": _generic_csv_file(),
            "provider": "generic_csv",
            "options": _generic_csv_options(),
        }
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == ImportStatus.COMPLETED
        assert response.data["provider"] == "generic_csv"
        assert response.data["created_count"] == 2
        # Verify DB
        imported = ConsumptionImport.objects.get(id=response.data["id"])
        assert imported.status == ImportStatus.COMPLETED
        assert ConsumptionRecord.objects.filter(meter=meter).count() == 2


# ---------------------------------------------------------------------------
# TestConsumptionImportValidation — 400 responses for bad input
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestConsumptionImportValidation:
    """POST validation errors that must return 400 (not 201)."""

    def test_missing_file_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh)
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), {"meter": str(meter.id)}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "file" in response.data

    def test_missing_meter_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), {"file": _enedis_file()}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "meter" in response.data

    def test_meter_from_other_household_returns_400(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_meter = ElectricityMeterFactory(household=other_hh)
        payload = {"meter": str(other_meter.id), "file": _enedis_file()}
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "meter" in response.data

    def test_unknown_provider_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh)
        payload = {
            "meter": str(meter.id),
            "file": _enedis_file(),
            "provider": "nonexistent_provider_xyz",
        }
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "provider" in response.data

    def test_invalid_json_options_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh)
        payload = {
            "meter": str(meter.id),
            "file": _enedis_file(),
            "options": "{not valid json at all",
        }
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "options" in response.data


# ---------------------------------------------------------------------------
# TestConsumptionImportPermissions — owner/member/anon, cross-household
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestConsumptionImportPermissions:
    """Permission matrix: owner write, member read-only, anon 401."""

    def test_owner_can_post_import(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh, timezone="Europe/Paris")
        payload = {"meter": str(meter.id), "file": _enedis_file()}
        response = _client_for(owner).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_member_cannot_post_import_returns_403(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        meter = ElectricityMeterFactory(household=hh)
        payload = {"meter": str(meter.id), "file": _enedis_file()}
        response = _client_for(member).post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_post_returns_401(self):
        hh = HouseholdFactory()
        meter = ElectricityMeterFactory(household=hh)
        payload = {"meter": str(meter.id), "file": _enedis_file()}
        response = _anon_client().post(
            IMPORTS_LIST_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_can_get_import_list_returns_200(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        response = _client_for(member).get(IMPORTS_LIST_URL())
        assert response.status_code == status.HTTP_200_OK

    def test_anonymous_get_returns_401(self):
        response = _anon_client().get(IMPORTS_LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# TestConsumptionImportList — GET list history + cross-household isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestConsumptionImportList:
    """GET /api/electricity/consumption/imports/ — history listing and isolation."""

    def _create_import(self, household, meter, **kwargs):
        user = UserFactory()
        return ConsumptionImport.objects.create(
            household=household,
            meter=meter,
            provider="enedis_csv",
            filename="test.csv",
            status=ImportStatus.COMPLETED,
            created_by=user,
            updated_by=user,
            **kwargs,
        )

    def test_owner_can_list_own_imports(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh)
        self._create_import(hh, meter)
        response = _client_for(owner).get(IMPORTS_LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_cross_household_imports_not_visible(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_meter = ElectricityMeterFactory(household=other_hh)
        other_import = self._create_import(other_hh, other_meter)
        response = _client_for(owner).get(IMPORTS_LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert str(other_import.id) not in ids

    def test_member_sees_household_imports(self):
        hh = HouseholdFactory()
        member = _make_member(hh)
        meter = ElectricityMeterFactory(household=hh)
        self._create_import(hh, meter)
        response = _client_for(member).get(IMPORTS_LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1


# ---------------------------------------------------------------------------
# TestConsumptionImportDeletePutNotAllowed — 405 for disallowed methods
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestConsumptionImportDeletePutNotAllowed:
    """DELETE and PUT are not exposed on this viewset (http_method_names restriction)."""

    def _create_import(self, household, meter):
        user = UserFactory()
        return ConsumptionImport.objects.create(
            household=household,
            meter=meter,
            provider="enedis_csv",
            filename="test.csv",
            status=ImportStatus.COMPLETED,
            created_by=user,
            updated_by=user,
        )

    def test_delete_returns_405(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh)
        imp = self._create_import(hh, meter)
        url = reverse("electricity-consumption-import-detail", args=[imp.id])
        response = _client_for(owner).delete(url)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_put_returns_405(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        meter = ElectricityMeterFactory(household=hh)
        imp = self._create_import(hh, meter)
        url = reverse("electricity-consumption-import-detail", args=[imp.id])
        response = _client_for(owner).put(url, {"provider": "enedis_csv"}, format="json")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


# ---------------------------------------------------------------------------
# TestConsumptionImportPreview — POST .../preview/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestConsumptionImportPreview:
    """POST /api/electricity/consumption/imports/preview/ — preview endpoint."""

    def test_enedis_file_detected_as_enedis_csv(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = {"file": _enedis_file()}
        response = _client_for(owner).post(
            IMPORTS_PREVIEW_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["detected_provider"] == "enedis_csv"
        assert response.data["sample_lines"]  # non-empty list
        assert "columns" in response.data

    def test_unknown_file_detected_provider_is_none(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = {"file": _invalid_file()}
        response = _client_for(owner).post(
            IMPORTS_PREVIEW_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["detected_provider"] is None

    def test_preview_missing_file_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        response = _client_for(owner).post(IMPORTS_PREVIEW_URL(), {}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "file" in response.data

    def test_member_cannot_preview_returns_403(self):
        """Preview is a POST — IsElectricityOwnerWriteMemberRead blocks members on write."""
        hh = HouseholdFactory()
        member = _make_member(hh)
        payload = {"file": _enedis_file()}
        response = _client_for(member).post(
            IMPORTS_PREVIEW_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_preview_returns_401(self):
        payload = {"file": _enedis_file()}
        response = _anon_client().post(IMPORTS_PREVIEW_URL(), payload, format="multipart")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_preview_returns_sample_lines_and_columns(self):
        """Response shape: detected_provider, sample_lines list, columns list."""
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        payload = {"file": _enedis_file()}
        response = _client_for(owner).post(
            IMPORTS_PREVIEW_URL(), payload, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data["sample_lines"], list)
        assert len(response.data["sample_lines"]) > 0
        assert isinstance(response.data["columns"], list)
        assert len(response.data["columns"]) > 0
