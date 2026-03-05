import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory
from equipment.models import Equipment, EquipmentInteraction
from interactions.models import Interaction
from zones.models import Zone


class ImportSupabaseEquipmentCommandTests(TestCase):
    def setUp(self):
        self.target_household_id = "ff28b251-8abc-400a-8bdc-8303b2086d70"
        if not HouseholdFactory._meta.model.objects.filter(id=self.target_household_id).exists():
            HouseholdFactory(id=self.target_household_id, name="Target household")

        user_model = get_user_model()
        user_model.objects.get_or_create(
            id=1,
            defaults={
                "email": "fallback@example.com",
                "is_active": True,
            },
        )

    @patch("equipment.management.commands.import_supabase_equipment.Command._fetch_source_rows")
    def test_import_equipment_and_links(self, fetch_source_rows_mock):
        equipment_id = uuid.uuid4()
        zone_id = uuid.uuid4()
        interaction_id = uuid.uuid4()

        Zone.objects.create(
            id=zone_id,
            household_id=self.target_household_id,
            name="Kitchen",
            note="",
            color="#f4f4f5",
            created_by_id=1,
            updated_by_id=1,
        )
        Interaction.objects.create(
            id=interaction_id,
            household_id=self.target_household_id,
            subject="Changed filter",
            content="",
            type="maintenance",
            status="done",
            occurred_at=timezone.now(),
            is_private=False,
            metadata={},
            enriched_text="",
            created_by_id=1,
            updated_by_id=1,
        )

        now = timezone.now()
        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": equipment_id,
                    "household_id": uuid.uuid4(),
                    "zone_id": zone_id,
                    "name": "Water heater",
                    "category": "heating",
                    "manufacturer": "Brand",
                    "model": "X100",
                    "serial_number": "SN-1",
                    "purchase_date": None,
                    "purchase_price": "1000.50",
                    "purchase_vendor": "Vendor",
                    "warranty_expires_on": None,
                    "warranty_provider": "Provider",
                    "warranty_notes": "2y",
                    "maintenance_interval_months": 12,
                    "last_service_at": None,
                    "status": "active",
                    "condition": "good",
                    "installed_at": None,
                    "retired_at": None,
                    "notes": "Installed in basement",
                    "tags": ["critical", "plumbing"],
                    "created_at": now,
                    "updated_at": now,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
            [
                {
                    "equipment_id": equipment_id,
                    "interaction_id": interaction_id,
                    "role": "maintenance",
                    "note": "Annual check",
                    "created_at": now,
                    "created_by": None,
                }
            ],
        ]

        call_command(
            "import_supabase_equipment",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        equipment = Equipment.objects.get(id=equipment_id)
        self.assertEqual(equipment.household_id, uuid.UUID(self.target_household_id))
        self.assertEqual(equipment.zone_id, zone_id)
        self.assertEqual(equipment.tags, ["critical", "plumbing"])
        self.assertEqual(equipment.created_by_id, 1)

        link = EquipmentInteraction.objects.get(equipment_id=equipment_id, interaction_id=interaction_id)
        self.assertEqual(link.role, "maintenance")
        self.assertEqual(link.note, "Annual check")
        self.assertEqual(link.created_by_id, 1)

    @patch("equipment.management.commands.import_supabase_equipment.Command._fetch_source_rows")
    def test_idempotent_update(self, fetch_source_rows_mock):
        equipment_id = uuid.uuid4()
        interaction_id = uuid.uuid4()

        Equipment.objects.create(
            id=equipment_id,
            household_id=self.target_household_id,
            name="Boiler",
            category="heating",
            status=Equipment.Status.ACTIVE,
            condition="good",
            notes="",
            tags=[],
            created_by_id=1,
            updated_by_id=1,
        )
        Interaction.objects.create(
            id=interaction_id,
            household_id=self.target_household_id,
            subject="Initial",
            content="",
            type="note",
            status="done",
            occurred_at=timezone.now(),
            is_private=False,
            metadata={},
            enriched_text="",
            created_by_id=1,
            updated_by_id=1,
        )
        EquipmentInteraction.objects.create(
            equipment_id=equipment_id,
            interaction_id=interaction_id,
            role="log",
            note="",
            created_by_id=1,
        )

        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": equipment_id,
                    "household_id": self.target_household_id,
                    "zone_id": None,
                    "name": "Boiler Updated",
                    "category": "heating",
                    "manufacturer": None,
                    "model": None,
                    "serial_number": None,
                    "purchase_date": None,
                    "purchase_price": None,
                    "purchase_vendor": None,
                    "warranty_expires_on": None,
                    "warranty_provider": None,
                    "warranty_notes": "",
                    "maintenance_interval_months": None,
                    "last_service_at": None,
                    "status": "maintenance",
                    "condition": "fair",
                    "installed_at": None,
                    "retired_at": None,
                    "notes": "updated",
                    "tags": ["heating"],
                    "created_at": None,
                    "updated_at": None,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
            [
                {
                    "equipment_id": equipment_id,
                    "interaction_id": interaction_id,
                    "role": "maintenance",
                    "note": "updated note",
                    "created_at": None,
                    "created_by": None,
                }
            ],
        ]

        call_command(
            "import_supabase_equipment",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        equipment = Equipment.objects.get(id=equipment_id)
        self.assertEqual(equipment.name, "Boiler Updated")
        self.assertEqual(equipment.status, Equipment.Status.MAINTENANCE)
        self.assertEqual(equipment.condition, "fair")
        self.assertEqual(equipment.tags, ["heating"])

        self.assertEqual(
            EquipmentInteraction.objects.filter(equipment_id=equipment_id, interaction_id=interaction_id).count(),
            1,
        )
        link = EquipmentInteraction.objects.get(equipment_id=equipment_id, interaction_id=interaction_id)
        self.assertEqual(link.role, "maintenance")
        self.assertEqual(link.note, "updated note")
