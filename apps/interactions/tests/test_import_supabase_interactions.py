import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory
from interactions.models import Interaction, InteractionDocument, InteractionZone
from projects.models import Project
from zones.models import Zone


class ImportSupabaseInteractionsCommandTests(TestCase):
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

    @patch("interactions.management.commands.import_supabase_interactions.Command._fetch_source_rows")
    def test_import_interactions_and_links(self, fetch_source_rows_mock):
        project_id = uuid.uuid4()
        zone_id = uuid.uuid4()
        interaction_id = uuid.uuid4()
        missing_zone_id = uuid.uuid4()
        missing_document_id = uuid.uuid4()

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
            is_pinned=False,
            created_by_id=1,
            updated_by_id=1,
        )
        Zone.objects.create(
            id=zone_id,
            household_id=self.target_household_id,
            name="Kitchen",
            note="",
            color="#f4f4f5",
            created_by_id=1,
            updated_by_id=1,
        )

        now = timezone.now()
        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": interaction_id,
                    "household_id": uuid.uuid4(),
                    "content": None,
                    "enriched_text": None,
                    "metadata": None,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": str(uuid.uuid4()),
                    "updated_by": str(uuid.uuid4()),
                    "subject": "S" * 550,
                    "type": "weird",
                    "status": "wrong",
                    "occurred_at": now,
                    "project_id": project_id,
                    "is_private": True,
                }
            ],
            [
                {"interaction_id": interaction_id, "zone_id": zone_id},
                {"interaction_id": interaction_id, "zone_id": missing_zone_id},
            ],
            [],
            [],
            [
                {
                    "interaction_id": interaction_id,
                    "document_id": missing_document_id,
                    "role": "attachment",
                    "note": "x",
                    "created_at": now,
                }
            ],
        ]

        call_command(
            "import_supabase_interactions",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        interaction = Interaction.objects.get(id=interaction_id)
        self.assertEqual(str(interaction.household_id), self.target_household_id)
        self.assertEqual(interaction.type, "note")
        self.assertIsNone(interaction.status)
        self.assertEqual(len(interaction.subject), 500)
        self.assertEqual(interaction.content, "")
        self.assertEqual(interaction.metadata, {})
        self.assertEqual(interaction.project_id, project_id)
        self.assertEqual(interaction.created_by_id, 1)
        self.assertEqual(interaction.updated_by_id, 1)

        self.assertTrue(InteractionZone.objects.filter(interaction_id=interaction_id, zone_id=zone_id).exists())
        self.assertFalse(InteractionZone.objects.filter(interaction_id=interaction_id, zone_id=missing_zone_id).exists())
        self.assertFalse(InteractionDocument.objects.filter(interaction_id=interaction_id).exists())

    @patch("interactions.management.commands.import_supabase_interactions.Command._fetch_source_rows")
    def test_import_is_idempotent_updates_existing_interaction(self, fetch_source_rows_mock):
        interaction_id = uuid.uuid4()
        occurred_at = timezone.now()

        Interaction.objects.create(
            id=interaction_id,
            household_id=self.target_household_id,
            subject="Initial",
            content="",
            type="note",
            status=None,
            occurred_at=occurred_at,
            metadata={},
            enriched_text="",
            is_private=False,
            created_by_id=1,
            updated_by_id=1,
        )

        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": interaction_id,
                    "household_id": uuid.uuid4(),
                    "content": "updated content",
                    "enriched_text": "text",
                    "metadata": {"k": "v"},
                    "created_at": occurred_at,
                    "updated_at": occurred_at,
                    "created_by": None,
                    "updated_by": None,
                    "subject": "Updated",
                    "type": "todo",
                    "status": "done",
                    "occurred_at": occurred_at,
                    "project_id": None,
                    "is_private": True,
                }
            ],
            [],
            [],
            [],
            [],
        ]

        call_command(
            "import_supabase_interactions",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        interaction = Interaction.objects.get(id=interaction_id)
        self.assertEqual(interaction.subject, "Updated")
        self.assertEqual(interaction.type, "todo")
        self.assertEqual(interaction.status, "done")
        self.assertEqual(interaction.content, "updated content")
        self.assertEqual(interaction.enriched_text, "text")
        self.assertEqual(interaction.metadata, {"k": "v"})
        self.assertTrue(interaction.is_private)
