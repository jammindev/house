# electricity/tests/test_models.py
"""Unit tests for electricity domain models: constraints, clean(), and __str__."""

from datetime import date

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from electricity.models import (
    CircuitUsagePointLink,
    ElectricCircuit,
    ElectricityBoard,
    MaintenanceEvent,
    ProtectiveDevice,
    UsagePoint,
)
from electricity.tests.factories import (
    CircuitUsagePointLinkFactory,
    ElectricCircuitFactory,
    ElectricityBoardFactory,
    HouseholdFactory,
    MaintenanceEventFactory,
    ProtectiveDeviceFactory,
    UserFactory,
    UsagePointFactory,
    ZoneFactory,
)


# ---------------------------------------------------------------------------
# ElectricityBoard
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestElectricityBoardModel:
    """DB-level constraints and basic creation for ElectricityBoard."""

    def test_create_single_phase_root_with_zone(self):
        board = ElectricityBoardFactory(supply_type="single_phase")
        assert board.pk is not None
        assert board.supply_type == "single_phase"
        assert board.zone is not None

    def test_create_three_phase_root_with_zone(self):
        board = ElectricityBoardFactory(supply_type="three_phase")
        assert board.supply_type == "three_phase"

    def test_create_board_without_zone_raises(self):
        hh = HouseholdFactory()
        user = UserFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ElectricityBoard.objects.create(
                    household=hh,
                    name="No zone",
                    supply_type="single_phase",
                    created_by=user,
                    updated_by=user,
                )

    def test_create_sub_board_with_parent(self):
        root = ElectricityBoardFactory()
        sub = ElectricityBoardFactory(
            household=root.household,
            zone=root.zone,
            parent=root,
        )
        assert sub.parent == root

    def test_create_multiple_sub_boards_under_same_parent(self):
        root = ElectricityBoardFactory()
        sub1 = ElectricityBoardFactory(household=root.household, zone=root.zone, parent=root)
        sub2 = ElectricityBoardFactory(household=root.household, zone=root.zone, parent=root)
        assert sub1.parent_id == root.pk
        assert sub2.parent_id == root.pk

    def test_two_active_root_boards_same_household_raises(self):
        board = ElectricityBoardFactory(is_active=True, parent=None)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ElectricityBoardFactory(
                    household=board.household,
                    zone=board.zone,
                    is_active=True,
                    parent=None,
                )

    def test_two_active_root_boards_different_households_ok(self):
        board1 = ElectricityBoardFactory(is_active=True, parent=None)
        board2 = ElectricityBoardFactory(is_active=True, parent=None)
        assert board1.household_id != board2.household_id

    def test_two_active_sub_boards_same_household_ok(self):
        root = ElectricityBoardFactory()
        sub1 = ElectricityBoardFactory(household=root.household, zone=root.zone, parent=root)
        sub2 = ElectricityBoardFactory(household=root.household, zone=root.zone, parent=root)
        assert sub1.pk != sub2.pk

    def test_deactivate_root_then_create_new_root_ok(self):
        root = ElectricityBoardFactory(is_active=True, parent=None)
        root.is_active = False
        root.save(update_fields=["is_active"])
        new_root = ElectricityBoardFactory(
            household=root.household,
            zone=root.zone,
            is_active=True,
            parent=None,
        )
        assert new_root.pk is not None

    def test_delete_zone_referenced_by_board_raises(self):
        board = ElectricityBoardFactory()
        zone = board.zone
        with pytest.raises(ProtectedError):
            with transaction.atomic():
                zone.delete()

    def test_duplicate_label_same_household_raises(self):
        board = ElectricityBoardFactory(label="TB-MAIN")
        hh = board.household
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ElectricityBoardFactory(household=hh, zone=board.zone, label="TB-MAIN")

    def test_same_label_different_households_ok(self):
        b1 = ElectricityBoardFactory(label="TB-MAIN")
        b2 = ElectricityBoardFactory(label="TB-MAIN")
        assert b1.household_id != b2.household_id

    def test_two_null_labels_same_household_ok(self):
        board = ElectricityBoardFactory(label=None)
        ElectricityBoardFactory(
            household=board.household, zone=board.zone, label=None, is_active=False
        )

    def test_str_includes_name(self):
        board = ElectricityBoardFactory(name="Tableau cuisine")
        assert "Tableau cuisine" in str(board)


# ---------------------------------------------------------------------------
# ProtectiveDevice
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProtectiveDeviceModel:
    """DB-level constraints, clean() validation, and __str__ for ProtectiveDevice."""

    def test_create_breaker_with_full_fields(self):
        user = UserFactory()
        board = ElectricityBoardFactory(supply_type="single_phase")
        pd = ProtectiveDevice.objects.create(
            household=board.household,
            board=board,
            label="D1",
            device_type="breaker",
            row=1,
            position=1,
            rating_amps=20,
            curve_type="c",
            created_by=user,
            updated_by=user,
        )
        assert pd.pk is not None
        assert pd.label == "D1"

    def test_create_rcd_without_label_with_rcd_fields(self):
        user = UserFactory()
        board = ElectricityBoardFactory()
        pd = ProtectiveDevice.objects.create(
            household=board.household,
            board=board,
            label=None,
            device_type="rcd",
            sensitivity_ma=30,
            type_code="a",
            phase_coverage=["L1", "L2", "L3"],
            created_by=user,
            updated_by=user,
        )
        assert pd.label is None
        assert pd.sensitivity_ma == 30

    def test_create_combined_device(self):
        user = UserFactory()
        board = ElectricityBoardFactory()
        pd = ProtectiveDevice.objects.create(
            household=board.household,
            board=board,
            label="COMBO-1",
            device_type="combined",
            rating_amps=20,
            curve_type="c",
            sensitivity_ma=30,
            type_code="a",
            created_by=user,
            updated_by=user,
        )
        assert pd.device_type == "combined"

    def test_create_spare_device(self):
        pd = ProtectiveDeviceFactory(is_spare=True)
        assert pd.is_spare is True

    def test_create_device_without_row_position_ok(self):
        pd = ProtectiveDeviceFactory(row=None, position=None)
        assert pd.row is None
        assert pd.position is None

    def test_two_null_labels_same_household_ok(self):
        """Conditional unique constraint: label=None may appear multiple times."""
        board = ElectricityBoardFactory()
        user = UserFactory()
        pd1 = ProtectiveDevice.objects.create(
            household=board.household, board=board, label=None, device_type="rcd",
            created_by=user, updated_by=user,
        )
        pd2 = ProtectiveDevice.objects.create(
            household=board.household, board=board, label=None, device_type="rcd",
            created_by=user, updated_by=user,
        )
        assert pd1.pk != pd2.pk

    def test_duplicate_non_null_label_same_household_raises(self):
        board = ElectricityBoardFactory()
        ProtectiveDeviceFactory(board=board, household=board.household, label="SAME")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ProtectiveDeviceFactory(board=board, household=board.household, label="SAME")

    def test_same_label_different_households_ok(self):
        pd1 = ProtectiveDeviceFactory(label="DUP")
        pd2 = ProtectiveDeviceFactory(label="DUP")
        assert pd1.household_id != pd2.household_id

    def test_two_devices_same_board_row_position_raises(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        ProtectiveDevice.objects.create(
            household=board.household, board=board, label="D-A",
            device_type="breaker", row=1, position=1,
            created_by=user, updated_by=user,
        )
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ProtectiveDevice.objects.create(
                    household=board.household, board=board, label="D-B",
                    device_type="breaker", row=1, position=1,
                    created_by=user, updated_by=user,
                )

    def test_row_set_without_position_raises(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ProtectiveDevice.objects.create(
                    household=board.household, board=board, label="D-X",
                    device_type="breaker", row=1, position=None,
                    created_by=user, updated_by=user,
                )

    def test_position_set_without_row_raises(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ProtectiveDevice.objects.create(
                    household=board.household, board=board, label="D-Y",
                    device_type="breaker", row=None, position=1,
                    created_by=user, updated_by=user,
                )

    def test_breaker_with_sensitivity_ma_raises_check(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ProtectiveDevice.objects.create(
                    household=board.household, board=board, label="D-BRK-S",
                    device_type="breaker", sensitivity_ma=30,
                    created_by=user, updated_by=user,
                )

    def test_breaker_with_type_code_raises_check(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ProtectiveDevice.objects.create(
                    household=board.household, board=board, label="D-BRK-T",
                    device_type="breaker", type_code="a",
                    created_by=user, updated_by=user,
                )

    def test_rcd_with_curve_type_raises_check(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ProtectiveDevice.objects.create(
                    household=board.household, board=board, label=None,
                    device_type="rcd", curve_type="c",
                    created_by=user, updated_by=user,
                )

    def test_clean_rcd_with_curve_type_raises_validation_error(self):
        pd = ProtectiveDevice(
            household=HouseholdFactory(),
            board=ElectricityBoardFactory(),
            device_type="rcd",
            curve_type="c",
        )
        with pytest.raises(ValidationError) as exc_info:
            pd.clean()
        assert "curve_type" in exc_info.value.message_dict

    def test_clean_breaker_with_sensitivity_ma_raises_validation_error(self):
        board = ElectricityBoardFactory()
        pd = ProtectiveDevice(
            household=board.household,
            board=board,
            device_type="breaker",
            sensitivity_ma=30,
        )
        with pytest.raises(ValidationError) as exc_info:
            pd.clean()
        assert "sensitivity_ma" in exc_info.value.message_dict

    def test_clean_breaker_with_type_code_raises_validation_error(self):
        board = ElectricityBoardFactory()
        pd = ProtectiveDevice(
            household=board.household,
            board=board,
            device_type="breaker",
            type_code="a",
        )
        with pytest.raises(ValidationError) as exc_info:
            pd.clean()
        assert "type_code" in exc_info.value.message_dict

    def test_clean_breaker_with_phase_coverage_raises_validation_error(self):
        board = ElectricityBoardFactory()
        pd = ProtectiveDevice(
            household=board.household,
            board=board,
            device_type="breaker",
            phase_coverage=["L1"],
        )
        with pytest.raises(ValidationError) as exc_info:
            pd.clean()
        assert "phase_coverage" in exc_info.value.message_dict

    def test_str_with_label(self):
        pd = ProtectiveDeviceFactory(label="D-KITCHEN")
        assert str(pd) == "D-KITCHEN"

    def test_str_without_label(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        pd = ProtectiveDevice.objects.create(
            household=board.household, board=board, label=None,
            device_type="rcd", created_by=user, updated_by=user,
        )
        assert str(pd) == str(pd.id)


# ---------------------------------------------------------------------------
# ElectricCircuit
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestElectricCircuitModel:
    """Constraints and clean() for ElectricCircuit."""

    def test_create_circuit_with_breaker(self):
        circuit = ElectricCircuitFactory()
        assert circuit.pk is not None
        assert circuit.protective_device.device_type == "breaker"

    def test_create_circuit_with_combined_device(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        pd = ProtectiveDevice.objects.create(
            household=board.household, board=board, label="COMBO",
            device_type="combined", rating_amps=20, curve_type="c",
            sensitivity_ma=30, type_code="a",
            created_by=user, updated_by=user,
        )
        circuit = ElectricCircuit.objects.create(
            household=board.household, board=board,
            protective_device=pd, label="CIR-C", name="Combined circuit",
            created_by=user, updated_by=user,
        )
        assert circuit.pk is not None

    def test_create_circuit_with_main_device(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        pd = ProtectiveDevice.objects.create(
            household=board.household, board=board, label="MAIN",
            device_type="main", created_by=user, updated_by=user,
        )
        circuit = ElectricCircuit.objects.create(
            household=board.household, board=board,
            protective_device=pd, label="CIR-M", name="Main circuit",
            created_by=user, updated_by=user,
        )
        assert circuit.pk is not None

    def test_clean_circuit_with_rcd_raises_validation_error(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        rcd = ProtectiveDevice.objects.create(
            household=board.household, board=board, label=None,
            device_type="rcd", created_by=user, updated_by=user,
        )
        circuit = ElectricCircuit(
            household=board.household, board=board,
            protective_device=rcd, label="CIR-RCD", name="RCD circuit",
        )
        with pytest.raises(ValidationError) as exc_info:
            circuit.clean()
        assert "protective_device" in exc_info.value.message_dict

    def test_duplicate_label_same_household_raises(self):
        circuit = ElectricCircuitFactory(label="SAME-LABEL")
        board = circuit.board
        user = UserFactory()
        pd = ProtectiveDeviceFactory(board=board, household=board.household, label="NEW-D")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ElectricCircuit.objects.create(
                    household=board.household, board=board,
                    protective_device=pd, label="SAME-LABEL", name="Dup",
                    created_by=user, updated_by=user,
                )

    def test_same_label_different_households_ok(self):
        c1 = ElectricCircuitFactory(label="SHARED")
        c2 = ElectricCircuitFactory(label="SHARED")
        assert c1.household_id != c2.household_id


# ---------------------------------------------------------------------------
# UsagePoint
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestUsagePointModel:
    """Constraints for UsagePoint."""

    def test_create_socket_with_zone_and_power(self):
        up = UsagePointFactory(kind="socket", max_power_watts=2000, is_dedicated_circuit=True)
        assert up.kind == "socket"
        assert up.max_power_watts == 2000

    def test_create_light_with_zone(self):
        up = UsagePointFactory(kind="light")
        assert up.kind == "light"

    def test_create_without_zone_raises(self):
        hh = HouseholdFactory()
        user = UserFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                UsagePoint.objects.create(
                    household=hh, label="UP-NOZONE", name="No zone",
                    kind="socket", zone_id=None,
                    created_by=user, updated_by=user,
                )

    def test_delete_zone_referenced_by_usage_point_raises(self):
        up = UsagePointFactory()
        zone = up.zone
        with pytest.raises(ProtectedError):
            with transaction.atomic():
                zone.delete()

    def test_duplicate_label_same_household_raises(self):
        up = UsagePointFactory(label="SAME-UP")
        hh = up.household
        zone = ZoneFactory(household=hh)
        user = UserFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                UsagePoint.objects.create(
                    household=hh, label="SAME-UP", name="Dup",
                    kind="socket", zone=zone,
                    created_by=user, updated_by=user,
                )


# ---------------------------------------------------------------------------
# CircuitUsagePointLink
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCircuitUsagePointLinkModel:
    """Constraints for CircuitUsagePointLink."""

    def test_create_active_link(self):
        link = CircuitUsagePointLinkFactory(is_active=True)
        assert link.is_active is True

    def test_two_active_links_same_usage_point_raises(self):
        link = CircuitUsagePointLinkFactory(is_active=True)
        circuit2 = ElectricCircuitFactory(
            household=link.household,
            board=link.circuit.board,
            protective_device=link.circuit.protective_device,
        )
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                user = UserFactory()
                CircuitUsagePointLink.objects.create(
                    household=link.household,
                    circuit=circuit2,
                    usage_point=link.usage_point,
                    is_active=True,
                    created_by=user,
                    updated_by=user,
                )

    def test_two_inactive_links_same_usage_point_ok(self):
        link = CircuitUsagePointLinkFactory(is_active=False)
        circuit2 = ElectricCircuitFactory(
            household=link.household,
            board=link.circuit.board,
            protective_device=link.circuit.protective_device,
        )
        user = UserFactory()
        link2 = CircuitUsagePointLink.objects.create(
            household=link.household,
            circuit=circuit2,
            usage_point=link.usage_point,
            is_active=False,
            created_by=user,
            updated_by=user,
        )
        assert link2.pk is not None

    def test_inactive_link_plus_new_active_link_same_usage_point_ok(self):
        link = CircuitUsagePointLinkFactory(is_active=False)
        circuit2 = ElectricCircuitFactory(
            household=link.household,
            board=link.circuit.board,
            protective_device=link.circuit.protective_device,
        )
        user = UserFactory()
        active_link = CircuitUsagePointLink.objects.create(
            household=link.household,
            circuit=circuit2,
            usage_point=link.usage_point,
            is_active=True,
            created_by=user,
            updated_by=user,
        )
        assert active_link.is_active is True


# ---------------------------------------------------------------------------
# MaintenanceEvent
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestMaintenanceEventModel:
    """Creation and __str__ for MaintenanceEvent."""

    def test_create_with_all_fields(self):
        board = ElectricityBoardFactory()
        user = UserFactory()
        event = MaintenanceEvent.objects.create(
            household=board.household,
            board=board,
            performed_by=user,
            event_date=date(2026, 1, 15),
            description="Annual inspection of the main panel",
            created_by=user,
            updated_by=user,
        )
        assert event.pk is not None
        assert event.board == board
        assert event.performed_by == user

    def test_create_without_board_and_performed_by(self):
        hh = HouseholdFactory()
        user = UserFactory()
        event = MaintenanceEvent.objects.create(
            household=hh,
            board=None,
            performed_by=None,
            event_date=date(2026, 1, 15),
            description="Generic note",
            created_by=user,
            updated_by=user,
        )
        assert event.board is None
        assert event.performed_by is None

    def test_str_returns_date_and_description_prefix(self):
        event = MaintenanceEventFactory(
            event_date=date(2026, 3, 1),
            description="Replaced main breaker in kitchen panel",
        )
        s = str(event)
        assert "2026-03-01" in s
        assert "Replaced main breaker" in s
