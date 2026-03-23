# electricity/tests/test_views.py
"""API view tests for the electricity app.

The ActiveHouseholdMiddleware resolves request.household from user.active_household_id.
Each test sets up ownership via HouseholdMember and activates the household on the user
by setting user.active_household = household before force_authenticate.
"""

import uuid

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from electricity.models import (
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    MaintenanceEvent,
    PlanChangeLog,
    ProtectiveDevice,
    UsagePoint,
)
from electricity.tests.factories import (
    CircuitUsagePointLinkFactory,
    ElectricCircuitFactory,
    ElectricityBoardFactory,
    HouseholdFactory,
    HouseholdMemberFactory,
    MaintenanceEventFactory,
    ProtectiveDeviceFactory,
    UserFactory,
    UsagePointFactory,
    ZoneFactory,
)
from households.models import HouseholdMember


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_owner(household):
    """Create a user who is an owner of household, with active_household set."""
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
# ElectricityBoardViewSet
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestElectricityBoardViewSet:
    """CRUD + permission tests for /api/electricity/boards/."""

    LIST_URL = staticmethod(lambda: reverse("electricity-board-list"))
    DETAIL_URL = staticmethod(lambda pk: reverse("electricity-board-detail", args=[pk]))

    def _board_payload(self, zone_id, **overrides):
        payload = {
            "zone": str(zone_id),
            "name": "Tableau principal",
            "supply_type": "single_phase",
            "is_active": True,
        }
        payload.update(overrides)
        return payload

    def test_list_returns_only_household_boards(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        ElectricityBoardFactory(household=hh)
        ElectricityBoardFactory()  # other household — must not appear
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert all(
            ElectricityBoard.objects.get(id=i).household_id == hh.id for i in ids
        )

    def test_create_board_with_zone_returns_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._board_payload(zone.id),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        board = ElectricityBoard.objects.get(id=response.data["id"])
        assert board.household_id == hh.id
        assert board.zone_id == zone.id

    def test_create_board_without_zone_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        payload = {"name": "No zone board", "supply_type": "single_phase", "is_active": True}
        response = client.post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone" in response.data

    def test_create_second_active_root_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        ElectricityBoardFactory(household=hh, zone=zone, is_active=True, parent=None)
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._board_payload(zone.id),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "is_active" in response.data

    def test_create_sub_board_when_root_exists_returns_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        root = ElectricityBoardFactory(household=hh, zone=zone, is_active=True, parent=None)
        client = _client_for(owner)
        payload = self._board_payload(zone.id, parent=str(root.id))
        response = client.post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        sub = ElectricityBoard.objects.get(id=response.data["id"])
        assert sub.parent_id == root.id

    def test_patch_board_returns_200(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh)
        client = _client_for(owner)
        response = client.patch(
            self.DETAIL_URL(board.id),
            {"name": "Updated name"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        board.refresh_from_db()
        assert board.name == "Updated name"

    def test_delete_board_returns_204(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh)
        # detach devices so there's no protection
        client = _client_for(owner)
        response = client.delete(self.DETAIL_URL(board.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ElectricityBoard.objects.filter(id=board.id).exists()

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_board_not_in_list(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_board = ElectricityBoardFactory(household=other_hh)
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert str(other_board.id) not in ids

    def test_member_can_read_boards(self):
        hh = HouseholdFactory()
        ElectricityBoardFactory(household=hh)
        member = _make_member(hh)
        response = _client_for(member).get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK

    def test_member_cannot_create_board(self):
        hh = HouseholdFactory()
        zone = ZoneFactory(household=hh)
        member = _make_member(hh)
        response = _client_for(member).post(
            self.LIST_URL(), self._board_payload(zone.id), format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_member_cannot_delete_board(self):
        hh = HouseholdFactory()
        board = ElectricityBoardFactory(household=hh)
        member = _make_member(hh)
        response = _client_for(member).delete(self.DETAIL_URL(board.id))
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# ProtectiveDeviceViewSet
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProtectiveDeviceViewSet:
    """CRUD + permission + filter tests for /api/electricity/protective-devices/."""

    LIST_URL = staticmethod(lambda: reverse("electricity-protective-device-list"))
    DETAIL_URL = staticmethod(
        lambda pk: reverse("electricity-protective-device-detail", args=[pk])
    )

    def _breaker_payload(self, board_id, **overrides):
        payload = {
            "board": str(board_id),
            "label": f"D-{uuid.uuid4().hex[:4]}",
            "device_type": "breaker",
            "rating_amps": 20,
            "curve_type": "c",
        }
        payload.update(overrides)
        return payload

    def test_list_returns_only_household_devices(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh)
        ProtectiveDeviceFactory(board=board, household=hh)
        ProtectiveDeviceFactory()  # other household
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        for item in response.data:
            pd = ProtectiveDevice.objects.get(id=item["id"])
            assert pd.household_id == hh.id

    def test_create_breaker_returns_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh, supply_type="single_phase")
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._breaker_payload(board.id),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        pd = ProtectiveDevice.objects.get(id=response.data["id"])
        assert pd.household_id == hh.id
        assert pd.device_type == "breaker"

    def test_create_rcd_without_label_returns_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh, supply_type="single_phase")
        client = _client_for(owner)
        payload = {
            "board": str(board.id),
            "label": None,
            "device_type": "rcd",
            "sensitivity_ma": 30,
            "type_code": "a",
        }
        response = client.post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        pd = ProtectiveDevice.objects.get(id=response.data["id"])
        assert pd.label is None

    def test_single_phase_board_with_phase_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh, supply_type="single_phase")
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._breaker_payload(board.id, phase="L1"),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "phase" in response.data

    def test_three_phase_board_breaker_without_phase_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh, supply_type="three_phase")
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._breaker_payload(board.id, phase=None),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "phase" in response.data

    def test_delete_with_active_circuits_returns_409(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        circuit = ElectricCircuitFactory(household=hh)
        pd = circuit.protective_device
        client = _client_for(owner)
        response = client.delete(self.DETAIL_URL(pd.id))
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_device_not_visible(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_pd = ProtectiveDeviceFactory(household=other_hh)
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        ids = [r["id"] for r in response.data]
        assert str(other_pd.id) not in ids

    def test_member_can_read_devices(self):
        hh = HouseholdFactory()
        board = ElectricityBoardFactory(household=hh)
        ProtectiveDeviceFactory(board=board, household=hh)
        member = _make_member(hh)
        response = _client_for(member).get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK

    def test_member_cannot_create_device(self):
        hh = HouseholdFactory()
        board = ElectricityBoardFactory(household=hh, supply_type="single_phase")
        member = _make_member(hh)
        response = _client_for(member).post(
            self.LIST_URL(), self._breaker_payload(board.id), format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# ElectricCircuitViewSet
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestElectricCircuitViewSet:
    """CRUD + filters + permission tests for /api/electricity/circuits/."""

    LIST_URL = staticmethod(lambda: reverse("electricity-circuit-list"))
    DETAIL_URL = staticmethod(lambda pk: reverse("electricity-circuit-detail", args=[pk]))

    def _circuit_payload(self, board_id, pd_id, **overrides):
        payload = {
            "board": str(board_id),
            "protective_device": str(pd_id),
            "label": f"CIR-{uuid.uuid4().hex[:4]}",
            "name": "Test circuit",
            "is_active": True,
        }
        payload.update(overrides)
        return payload

    def test_filter_by_protective_device(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh, supply_type="single_phase")
        user_obj = UserFactory()
        pd1 = ProtectiveDeviceFactory(board=board, household=hh, label="D-F1")
        pd2 = ProtectiveDeviceFactory(board=board, household=hh, label="D-F2")
        c1 = ElectricCircuit.objects.create(
            household=hh, board=board, protective_device=pd1,
            label="CIR-F1", name="Circuit F1",
            created_by=user_obj, updated_by=user_obj,
        )
        ElectricCircuit.objects.create(
            household=hh, board=board, protective_device=pd2,
            label="CIR-F2", name="Circuit F2",
            created_by=user_obj, updated_by=user_obj,
        )
        client = _client_for(owner)
        response = client.get(self.LIST_URL(), {"protective_device": str(pd1.id)})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(c1.id)

    def test_filter_by_is_active_true(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh)
        pd = ProtectiveDeviceFactory(board=board, household=hh)
        user_obj = UserFactory()
        active = ElectricCircuit.objects.create(
            household=hh, board=board, protective_device=pd,
            label="CIR-ACT", name="Active", is_active=True,
            created_by=user_obj, updated_by=user_obj,
        )
        pd2 = ProtectiveDeviceFactory(board=board, household=hh)
        inactive = ElectricCircuit.objects.create(
            household=hh, board=board, protective_device=pd2,
            label="CIR-INACT", name="Inactive", is_active=False,
            created_by=user_obj, updated_by=user_obj,
        )
        client = _client_for(owner)
        response = client.get(self.LIST_URL(), {"is_active": "true"})
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert str(active.id) in ids
        assert str(inactive.id) not in ids

    def test_create_circuit_with_breaker_returns_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh, supply_type="single_phase")
        pd = ProtectiveDeviceFactory(board=board, household=hh, device_type="breaker")
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._circuit_payload(board.id, pd.id),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        circuit = ElectricCircuit.objects.get(id=response.data["id"])
        assert circuit.household_id == hh.id

    def test_create_circuit_with_rcd_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        board = ElectricityBoardFactory(household=hh, supply_type="single_phase")
        user_obj = UserFactory()
        rcd = ProtectiveDevice.objects.create(
            household=hh, board=board, label=None, device_type="rcd",
            created_by=user_obj, updated_by=user_obj,
        )
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._circuit_payload(board.id, rcd.id),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "protective_device" in response.data

    def test_delete_circuit_with_active_links_returns_409(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        circuit = ElectricCircuitFactory(household=hh)
        CircuitUsagePointLinkFactory(circuit=circuit, household=hh, is_active=True)
        client = _client_for(owner)
        response = client.delete(self.DETAIL_URL(circuit.id))
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_delete_circuit_without_links_returns_204(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        circuit = ElectricCircuitFactory(household=hh)
        client = _client_for(owner)
        response = client.delete(self.DETAIL_URL(circuit.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ElectricCircuit.objects.filter(id=circuit.id).exists()

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_circuit_not_visible(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_circuit = ElectricCircuitFactory()
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        ids = [r["id"] for r in response.data]
        assert str(other_circuit.id) not in ids


# ---------------------------------------------------------------------------
# UsagePointViewSet
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestUsagePointViewSet:
    """CRUD + filter + permission tests for /api/electricity/usage-points/."""

    LIST_URL = staticmethod(lambda: reverse("electricity-usage-point-list"))
    DETAIL_URL = staticmethod(lambda pk: reverse("electricity-usage-point-detail", args=[pk]))

    def _up_payload(self, zone_id, **overrides):
        payload = {
            "label": f"UP-{uuid.uuid4().hex[:4]}",
            "name": "Test point",
            "kind": "socket",
            "zone": str(zone_id),
        }
        payload.update(overrides)
        return payload

    def test_filter_by_kind_socket(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        user_obj = UserFactory()
        socket = UsagePoint.objects.create(
            household=hh, zone=zone, label="UP-S", name="Socket",
            kind="socket", created_by=user_obj, updated_by=user_obj,
        )
        UsagePoint.objects.create(
            household=hh, zone=zone, label="UP-L", name="Light",
            kind="light", created_by=user_obj, updated_by=user_obj,
        )
        client = _client_for(owner)
        response = client.get(self.LIST_URL(), {"kind": "socket"})
        assert response.status_code == status.HTTP_200_OK
        assert all(r["kind"] == "socket" for r in response.data)
        ids = [r["id"] for r in response.data]
        assert str(socket.id) in ids

    def test_create_with_zone_returns_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._up_payload(zone.id),
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        up = UsagePoint.objects.get(id=response.data["id"])
        assert up.household_id == hh.id
        assert up.zone_id == zone.id

    def test_create_without_zone_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        payload = {"label": "UP-NZONE", "name": "No zone", "kind": "socket"}
        response = client.post(self.LIST_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zone" in response.data

    def test_delete_with_active_link_returns_409(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        up = UsagePointFactory(household=hh)
        circuit = ElectricCircuitFactory(household=hh)
        CircuitUsagePointLinkFactory(circuit=circuit, usage_point=up, household=hh, is_active=True)
        client = _client_for(owner)
        response = client.delete(self.DETAIL_URL(up.id))
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_delete_without_link_returns_204(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        up = UsagePointFactory(household=hh)
        client = _client_for(owner)
        response = client.delete(self.DETAIL_URL(up.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not UsagePoint.objects.filter(id=up.id).exists()

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_usage_point_not_visible(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_up = UsagePointFactory()
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        ids = [r["id"] for r in response.data]
        assert str(other_up.id) not in ids


# ---------------------------------------------------------------------------
# UsagePointViewSet — bulk_create action
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestUsagePointBulkCreate:
    """Tests for the POST /api/electricity/usage-points/bulk-create/ action."""

    BULK_CREATE_URL = staticmethod(lambda: reverse("electricity-usage-point-bulk-create"))

    def _up_payload(self, zone_id, **overrides):
        payload = {
            "label": "UP-BULK",
            "name": "Bulk point",
            "kind": "socket",
            "zone": str(zone_id),
        }
        payload.update(overrides)
        return payload

    def test_bulk_create_quantity_1_creates_single_usage_point_with_exact_label(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        client = _client_for(owner)
        payload = self._up_payload(zone.id, label="LAMP", quantity=1)
        response = client.post(self.BULK_CREATE_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert len(response.data) == 1
        # quantity=1: label must be used as-is, no suffix
        assert response.data[0]["label"] == "LAMP"
        up = UsagePoint.objects.get(id=response.data[0]["id"])
        assert up.label == "LAMP"
        assert up.household_id == hh.id

    def test_bulk_create_quantity_3_creates_three_usage_points_with_suffixed_labels(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        client = _client_for(owner)
        payload = self._up_payload(zone.id, label="PRISE", quantity=3)
        response = client.post(self.BULK_CREATE_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert len(response.data) == 3
        labels = [item["label"] for item in response.data]
        assert labels == ["PRISE-01", "PRISE-02", "PRISE-03"]
        # Verify all three exist in DB and belong to the right household
        for item in response.data:
            up = UsagePoint.objects.get(id=item["id"])
            assert up.household_id == hh.id

    def test_bulk_create_returns_201_with_list_of_created_objects(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        client = _client_for(owner)
        payload = self._up_payload(zone.id, quantity=2)
        response = client.post(self.BULK_CREATE_URL(), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert isinstance(response.data, list)
        assert len(response.data) == 2
        # Each item must have an id field (serializer output)
        for item in response.data:
            assert "id" in item

    def test_bulk_create_quantity_0_is_invalid(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        client = _client_for(owner)
        payload = self._up_payload(zone.id, quantity=0)
        response = client.post(self.BULK_CREATE_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "quantity" in response.data

    def test_bulk_create_quantity_51_is_invalid(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        client = _client_for(owner)
        payload = self._up_payload(zone.id, quantity=51)
        response = client.post(self.BULK_CREATE_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "quantity" in response.data

    def test_bulk_create_quantity_not_integer_is_invalid(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        client = _client_for(owner)
        payload = self._up_payload(zone.id, quantity="abc")
        response = client.post(self.BULK_CREATE_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "quantity" in response.data

    def test_bulk_create_label_conflict_returns_400(self):
        # The UniqueConstraint on (household, label) must surface as a 400.
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        zone = ZoneFactory(household=hh)
        # Pre-create a usage point whose label will collide with quantity=1 request
        UsagePointFactory(household=hh, zone=zone, label="CONFLICT")
        client = _client_for(owner)
        payload = self._up_payload(zone.id, label="CONFLICT", quantity=1)
        response = client.post(self.BULK_CREATE_URL(), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        # DB must still contain exactly one usage point with that label
        assert UsagePoint.objects.filter(household=hh, label="CONFLICT").count() == 1

    def test_bulk_create_requires_authentication(self):
        response = _anon_client().post(self.BULK_CREATE_URL(), {}, format="json")
        assert response.status_code in {
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        }


# ---------------------------------------------------------------------------
# CircuitUsagePointLinkViewSet
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCircuitUsagePointLinkViewSet:
    """CRUD + deactivate action tests for /api/electricity/links/."""

    LIST_URL = staticmethod(lambda: reverse("electricity-link-list"))
    DETAIL_URL = staticmethod(lambda pk: reverse("electricity-link-detail", args=[pk]))
    DEACTIVATE_URL = staticmethod(
        lambda pk: reverse("electricity-link-deactivate", args=[pk])
    )

    def test_create_link_returns_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        circuit = ElectricCircuitFactory(household=hh)
        up = UsagePointFactory(household=hh)
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            {"circuit": str(circuit.id), "usage_point": str(up.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        link = CircuitUsagePointLink.objects.get(id=response.data["id"])
        assert link.circuit_id == circuit.id
        assert link.usage_point_id == up.id

    def test_create_link_usage_point_already_active_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        existing = CircuitUsagePointLinkFactory(household=hh, is_active=True)
        circuit2 = ElectricCircuitFactory(
            household=hh,
            board=existing.circuit.board,
            protective_device=existing.circuit.protective_device,
        )
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            {"circuit": str(circuit2.id), "usage_point": str(existing.usage_point_id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "usage_point" in response.data

    def test_deactivate_link_returns_200(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        link = CircuitUsagePointLinkFactory(household=hh, is_active=True)
        client = _client_for(owner)
        response = client.post(self.DEACTIVATE_URL(link.id))
        assert response.status_code == status.HTTP_200_OK
        link.refresh_from_db()
        assert link.is_active is False

    def test_deactivate_already_inactive_link_is_idempotent(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        link = CircuitUsagePointLinkFactory(household=hh, is_active=False)
        client = _client_for(owner)
        response = client.post(self.DEACTIVATE_URL(link.id))
        assert response.status_code == status.HTTP_200_OK

    def test_deactivate_sets_deactivated_at_and_by(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        link = CircuitUsagePointLinkFactory(household=hh, is_active=True)
        client = _client_for(owner)
        client.post(self.DEACTIVATE_URL(link.id))
        link.refresh_from_db()
        assert link.deactivated_at is not None
        assert link.deactivated_by == owner

    def test_deactivate_creates_plan_change_log(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        link = CircuitUsagePointLinkFactory(household=hh, is_active=True)
        client = _client_for(owner)
        client.post(self.DEACTIVATE_URL(link.id))
        log = PlanChangeLog.objects.filter(
            household=hh,
            entity_type="link",
            entity_id=link.id,
        ).first()
        assert log is not None
        assert log.action == "deactivate"

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cross_household_link_not_visible(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_link = CircuitUsagePointLinkFactory()
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        ids = [r["id"] for r in response.data]
        assert str(other_link.id) not in ids


# ---------------------------------------------------------------------------
# MaintenanceEventViewSet
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestMaintenanceEventViewSet:
    """CRUD + permission tests for /api/electricity/maintenance-events/."""

    LIST_URL = staticmethod(lambda: reverse("electricity-maintenance-event-list"))
    DETAIL_URL = staticmethod(
        lambda pk: reverse("electricity-maintenance-event-detail", args=[pk])
    )

    def _event_payload(self, **overrides):
        payload = {
            "event_date": "2026-01-15",
            "description": "Test maintenance",
            "board": None,
            "performed_by": None,
        }
        payload.update(overrides)
        return payload

    def test_list_returns_household_events(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        MaintenanceEventFactory(household=hh)
        MaintenanceEventFactory()  # other household
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK
        for item in response.data:
            ev = MaintenanceEvent.objects.get(id=item["id"])
            assert ev.household_id == hh.id

    def test_create_event_returns_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(self.LIST_URL(), self._event_payload(), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        ev = MaintenanceEvent.objects.get(id=response.data["id"])
        assert ev.household_id == hh.id

    def test_create_event_without_board_returns_201(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(self.LIST_URL(), self._event_payload(board=None), format="json")
        assert response.status_code == status.HTTP_201_CREATED
        ev = MaintenanceEvent.objects.get(id=response.data["id"])
        assert ev.board is None

    def test_create_event_with_board_from_other_household_returns_400(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_board = ElectricityBoardFactory()
        client = _client_for(owner)
        response = client.post(
            self.LIST_URL(),
            self._event_payload(board=str(other_board.id)),
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "board" in response.data

    def test_patch_event_returns_200(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        event = MaintenanceEventFactory(household=hh)
        client = _client_for(owner)
        response = client.patch(
            self.DETAIL_URL(event.id),
            {"description": "Updated description"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        event.refresh_from_db()
        assert event.description == "Updated description"

    def test_delete_event_returns_204(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        event = MaintenanceEventFactory(household=hh)
        client = _client_for(owner)
        response = client.delete(self.DETAIL_URL(event.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not MaintenanceEvent.objects.filter(id=event.id).exists()

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# PlanChangeLogViewSet
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestPlanChangeLogViewSet:
    """Read-only viewset: GET allowed, POST/DELETE must return 405."""

    LIST_URL = staticmethod(lambda: reverse("electricity-change-log-list"))
    DETAIL_URL = staticmethod(lambda pk: reverse("electricity-change-log-detail", args=[pk]))

    def _make_log(self, household, actor):
        return PlanChangeLog.objects.create(
            household=household,
            actor=actor,
            action="create",
            entity_type="circuit",
            entity_id=uuid.uuid4(),
            payload={},
            created_by=actor,
            updated_by=actor,
        )

    def test_list_returns_200(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        self._make_log(hh, owner)
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        assert response.status_code == status.HTTP_200_OK

    def test_post_returns_405(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        client = _client_for(owner)
        response = client.post(self.LIST_URL(), {}, format="json")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_delete_returns_405(self):
        hh = HouseholdFactory()
        owner = _make_owner(hh)
        log = self._make_log(hh, owner)
        client = _client_for(owner)
        response = client.delete(self.DETAIL_URL(log.id))
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_cross_household_logs_not_visible(self):
        hh = HouseholdFactory()
        other_hh = HouseholdFactory()
        owner = _make_owner(hh)
        other_owner = _make_owner(other_hh)
        other_log = self._make_log(other_hh, other_owner)
        client = _client_for(owner)
        response = client.get(self.LIST_URL())
        ids = [r["id"] for r in response.data]
        assert str(other_log.id) not in ids

    def test_anonymous_gets_401(self):
        response = _anon_client().get(self.LIST_URL())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


