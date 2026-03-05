import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory
from documents.models import Document
from zones.models import Zone, ZoneDocument


class ImportSupabaseZoneDocumentsCommandTests(TestCase):
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

    @patch("zones.management.commands.import_supabase_zone_documents.Command._fetch_source_rows")
    def test_import_zone_documents(self, fetch_source_rows_mock):
        zone_id = uuid.uuid4()
        source_document_id = uuid.uuid4()

        Zone.objects.create(
            id=zone_id,
            household_id=self.target_household_id,
            name="Zone",
            note="",
            color="#f4f4f5",
            created_by_id=1,
            updated_by_id=1,
        )
        doc = Document.objects.create(
            household_id=self.target_household_id,
            file_path="/tmp/doc.pdf",
            name="Doc",
            mime_type="application/pdf",
            type="document",
            ocr_text="",
            metadata={"supabase_document_id": str(source_document_id)},
            notes="",
            created_by_id=1,
            updated_by_id=1,
        )

        now = timezone.now()
        fetch_source_rows_mock.return_value = [
            {
                "zone_id": zone_id,
                "document_id": source_document_id,
                "role": "photo",
                "note": "n",
                "created_at": now,
                "created_by": None,
            }
        ]

        call_command(
            "import_supabase_zone_documents",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        link = ZoneDocument.objects.get(zone_id=zone_id, document_id=doc.id)
        self.assertEqual(link.role, "photo")
        self.assertEqual(link.note, "n")
        self.assertEqual(link.created_by_id, 1)

    @patch("zones.management.commands.import_supabase_zone_documents.Command._fetch_source_rows")
    def test_idempotent_update(self, fetch_source_rows_mock):
        zone_id = uuid.uuid4()
        source_document_id = uuid.uuid4()

        Zone.objects.create(
            id=zone_id,
            household_id=self.target_household_id,
            name="Zone",
            note="",
            color="#f4f4f5",
            created_by_id=1,
            updated_by_id=1,
        )
        doc = Document.objects.create(
            household_id=self.target_household_id,
            file_path="/tmp/doc.pdf",
            name="Doc",
            mime_type="application/pdf",
            type="document",
            ocr_text="",
            metadata={"supabase_document_id": str(source_document_id)},
            notes="",
            created_by_id=1,
            updated_by_id=1,
        )
        ZoneDocument.objects.create(zone_id=zone_id, document_id=doc.id, role="photo", note="", created_by_id=1)

        fetch_source_rows_mock.return_value = [
            {
                "zone_id": zone_id,
                "document_id": source_document_id,
                "role": "main",
                "note": "updated",
                "created_at": None,
                "created_by": None,
            }
        ]

        call_command(
            "import_supabase_zone_documents",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        link = ZoneDocument.objects.get(zone_id=zone_id, document_id=doc.id)
        self.assertEqual(link.role, "main")
        self.assertEqual(link.note, "updated")
