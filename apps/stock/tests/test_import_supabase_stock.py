import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory
from stock.models import StockCategory, StockItem
from zones.models import Zone


class ImportSupabaseStockCommandTests(TestCase):
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

    @patch("stock.management.commands.import_supabase_stock.Command._fetch_source_rows")
    def test_import_categories_and_items(self, fetch_source_rows_mock):
        category_id = uuid.uuid4()
        item_id = uuid.uuid4()
        zone_id = uuid.uuid4()

        Zone.objects.create(
            id=zone_id,
            household_id=self.target_household_id,
            name="Garage",
            note="",
            color="#f4f4f5",
            created_by_id=1,
            updated_by_id=1,
        )

        now = timezone.now()
        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": category_id,
                    "household_id": uuid.uuid4(),
                    "name": "Tools",
                    "color": "#111111",
                    "emoji": "🔧",
                    "description": "Tooling",
                    "sort_order": 3,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
            [
                {
                    "id": item_id,
                    "household_id": uuid.uuid4(),
                    "category_id": category_id,
                    "zone_id": zone_id,
                    "name": "Screws",
                    "description": "Box",
                    "sku": "SCR-1",
                    "barcode": "123",
                    "quantity": "42.500",
                    "unit": "pcs",
                    "min_quantity": "5.000",
                    "max_quantity": "100.000",
                    "unit_price": "0.10",
                    "purchase_date": None,
                    "expiration_date": None,
                    "last_restocked_at": now,
                    "status": "in_stock",
                    "supplier": "Local",
                    "notes": "Imported",
                    "tags": ["hardware"],
                    "created_at": now,
                    "updated_at": now,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
        ]

        call_command(
            "import_supabase_stock",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        category = StockCategory.objects.get(id=category_id)
        self.assertEqual(category.household_id, uuid.UUID(self.target_household_id))
        self.assertEqual(category.name, "Tools")
        self.assertEqual(category.created_by_id, 1)

        item = StockItem.objects.get(id=item_id)
        self.assertEqual(item.household_id, uuid.UUID(self.target_household_id))
        self.assertEqual(item.category_id, category_id)
        self.assertEqual(item.zone_id, zone_id)
        self.assertEqual(item.tags, ["hardware"])
        self.assertEqual(item.status, StockItem.Status.IN_STOCK)

    @patch("stock.management.commands.import_supabase_stock.Command._fetch_source_rows")
    def test_idempotent_update(self, fetch_source_rows_mock):
        category_id = uuid.uuid4()
        item_id = uuid.uuid4()

        StockCategory.objects.create(
            id=category_id,
            household_id=self.target_household_id,
            name="Old",
            color="#94a3b8",
            emoji="📦",
            description="",
            sort_order=0,
            created_by_id=1,
            updated_by_id=1,
        )
        StockItem.objects.create(
            id=item_id,
            household_id=self.target_household_id,
            category_id=category_id,
            name="Old item",
            description="",
            sku="",
            barcode="",
            quantity=1,
            unit="pcs",
            status=StockItem.Status.IN_STOCK,
            supplier="",
            notes="",
            tags=[],
            created_by_id=1,
            updated_by_id=1,
        )

        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": category_id,
                    "household_id": self.target_household_id,
                    "name": "Updated",
                    "color": "#222222",
                    "emoji": "🧰",
                    "description": "Updated",
                    "sort_order": 9,
                    "created_at": None,
                    "updated_at": None,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
            [
                {
                    "id": item_id,
                    "household_id": self.target_household_id,
                    "category_id": category_id,
                    "zone_id": None,
                    "name": "Updated item",
                    "description": "Updated",
                    "sku": "UPD",
                    "barcode": "999",
                    "quantity": "3",
                    "unit": "box",
                    "min_quantity": None,
                    "max_quantity": None,
                    "unit_price": "2.00",
                    "purchase_date": None,
                    "expiration_date": None,
                    "last_restocked_at": None,
                    "status": "low_stock",
                    "supplier": "Supplier",
                    "notes": "Updated",
                    "tags": ["updated"],
                    "created_at": None,
                    "updated_at": None,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
        ]

        call_command(
            "import_supabase_stock",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        self.assertEqual(StockCategory.objects.filter(id=category_id).count(), 1)
        category = StockCategory.objects.get(id=category_id)
        self.assertEqual(category.name, "Updated")
        self.assertEqual(category.sort_order, 9)

        self.assertEqual(StockItem.objects.filter(id=item_id).count(), 1)
        item = StockItem.objects.get(id=item_id)
        self.assertEqual(item.name, "Updated item")
        self.assertEqual(item.status, StockItem.Status.LOW_STOCK)
        self.assertEqual(item.tags, ["updated"])
