import uuid
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from app_settings.tests.factories import HouseholdFactory
from zones.models import Zone


class ImportSupabaseZonesCommandTests(TestCase):
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

    @patch("zones.management.commands.import_supabase_zones.Command._fetch_source_rows")
    def test_import_creates_zones_with_parent_linking(self, fetch_source_rows_mock):
        root_id = uuid.uuid4()
        child_id = uuid.uuid4()
        fetch_source_rows_mock.return_value = [
            {
                "id": root_id,
                "household_id": uuid.uuid4(),
                "name": " Root ",
                "created_at": None,
                "parent_id": None,
                "created_by": str(uuid.uuid4()),
                "note": None,
                "surface": "12.50",
                "color": "#ABCDEF",
            },
            {
                "id": child_id,
                "household_id": uuid.uuid4(),
                "name": " Child ",
                "created_at": None,
                "parent_id": root_id,
                "created_by": None,
                "note": "child note",
                "surface": "-2",
                "color": "bad-color",
            },
        ]

        call_command(
            "import_supabase_zones",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        root = Zone.objects.get(id=root_id)
        child = Zone.objects.get(id=child_id)

        self.assertEqual(str(root.household_id), self.target_household_id)
        self.assertEqual(root.name, "Root")
        self.assertEqual(root.note, "")
        self.assertEqual(root.surface, Decimal("12.50"))
        self.assertEqual(root.color, "#ABCDEF")
        self.assertEqual(root.created_by_id, 1)

        self.assertEqual(str(child.household_id), self.target_household_id)
        self.assertEqual(child.name, "Child")
        self.assertEqual(child.note, "child note")
        self.assertEqual(child.surface, Decimal("0"))
        self.assertEqual(child.color, "#f4f4f5")
        self.assertEqual(child.parent_id, root_id)
        self.assertEqual(child.created_by_id, 1)

    @patch("zones.management.commands.import_supabase_zones.Command._fetch_source_rows")
    def test_import_is_idempotent_with_updates(self, fetch_source_rows_mock):
        zone_id = uuid.uuid4()
        Zone.objects.create(
            id=zone_id,
            household_id=self.target_household_id,
            name="Initial",
            note="",
            surface=1,
            color="#f4f4f5",
            created_by_id=1,
            updated_by_id=1,
        )

        fetch_source_rows_mock.return_value = [
            {
                "id": zone_id,
                "household_id": uuid.uuid4(),
                "name": "Updated",
                "created_at": None,
                "parent_id": None,
                "created_by": None,
                "note": "updated",
                "surface": "4.20",
                "color": "#112233",
            }
        ]

        call_command(
            "import_supabase_zones",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        zone = Zone.objects.get(id=zone_id)
        self.assertEqual(zone.name, "Updated")
        self.assertEqual(zone.note, "updated")
        self.assertEqual(zone.surface, Decimal("4.20"))
        self.assertEqual(zone.color, "#112233")
