import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory
from documents.models import Document
from projects.models import Project, ProjectDocument, ProjectZone
from zones.models import Zone


class ImportSupabaseProjectLinksCommandTests(TestCase):
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

    @patch("projects.management.commands.import_supabase_project_links.Command._fetch_source_rows")
    def test_import_project_zones_and_documents(self, fetch_source_rows_mock):
        project_id = uuid.uuid4()
        zone_id = uuid.uuid4()
        source_document_uuid = uuid.uuid4()

        Project.objects.create(
            id=project_id,
            household_id=self.target_household_id,
            title="Project",
            description="",
            status=Project.Status.DRAFT,
            priority=3,
            tags=[],
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
            created_by_id=1,
            updated_by_id=1,
        )
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
            file_path="/tmp/a.pdf",
            name="A",
            mime_type="application/pdf",
            type="document",
            ocr_text="",
            metadata={"supabase_document_id": str(source_document_uuid)},
            notes="",
            created_by_id=1,
            updated_by_id=1,
        )

        now = timezone.now()
        fetch_source_rows_mock.side_effect = [
            [{"project_id": project_id, "zone_id": zone_id, "created_at": now, "created_by": None}],
            [
                {
                    "project_id": project_id,
                    "document_id": source_document_uuid,
                    "role": "supporting",
                    "note": "note",
                    "created_at": now,
                    "created_by": None,
                }
            ],
        ]

        call_command(
            "import_supabase_project_links",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        self.assertTrue(ProjectZone.objects.filter(project_id=project_id, zone_id=zone_id).exists())
        link = ProjectDocument.objects.get(project_id=project_id, document_id=doc.id)
        self.assertEqual(link.role, "supporting")
        self.assertEqual(link.note, "note")
        self.assertEqual(link.created_by_id, 1)

    @patch("projects.management.commands.import_supabase_project_links.Command._fetch_source_rows")
    def test_idempotent_update(self, fetch_source_rows_mock):
        project_id = uuid.uuid4()
        zone_id = uuid.uuid4()

        Project.objects.create(
            id=project_id,
            household_id=self.target_household_id,
            title="Project",
            description="",
            status=Project.Status.DRAFT,
            priority=3,
            tags=[],
            planned_budget=0,
            actual_cost_cached=0,
            type=Project.Type.OTHER,
            created_by_id=1,
            updated_by_id=1,
        )
        Zone.objects.create(
            id=zone_id,
            household_id=self.target_household_id,
            name="Zone",
            note="",
            color="#f4f4f5",
            created_by_id=1,
            updated_by_id=1,
        )
        ProjectZone.objects.create(project_id=project_id, zone_id=zone_id, created_by_id=1)

        fetch_source_rows_mock.side_effect = [
            [{"project_id": project_id, "zone_id": zone_id, "created_at": None, "created_by": None}],
            [],
        ]

        call_command(
            "import_supabase_project_links",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        self.assertEqual(ProjectZone.objects.filter(project_id=project_id, zone_id=zone_id).count(), 1)
