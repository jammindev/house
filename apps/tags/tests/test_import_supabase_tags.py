import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory
from interactions.models import Interaction
from tags.models import Tag, TagLink


class ImportSupabaseTagsCommandTests(TestCase):
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

    @patch("tags.management.commands.import_supabase_tags.Command._fetch_source_rows")
    def test_import_tags_and_interaction_tags(self, fetch_source_rows_mock):
        tag_id = uuid.uuid4()
        interaction_id = uuid.uuid4()
        now = timezone.now()

        Interaction.objects.create(
            id=interaction_id,
            household_id=self.target_household_id,
            subject="Imported interaction",
            content="",
            type="note",
            occurred_at=now,
            created_by_id=1,
            updated_by_id=1,
        )

        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": tag_id,
                    "household_id": uuid.uuid4(),
                    "type": "interaction",
                    "name": "urgent",
                    "created_at": now,
                    "created_by": None,
                }
            ],
            [
                {
                    "interaction_id": interaction_id,
                    "tag_id": tag_id,
                    "created_at": now,
                    "created_by": None,
                }
            ],
        ]

        call_command(
            "import_supabase_tags",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        tag = Tag.objects.get(id=tag_id)
        self.assertEqual(str(tag.household_id), self.target_household_id)
        self.assertEqual(tag.type, Tag.TagType.INTERACTION)
        self.assertEqual(tag.name, "urgent")
        self.assertEqual(tag.created_by_id, 1)

        interaction_ct = ContentType.objects.get_for_model(Interaction)
        link = TagLink.objects.get(
            household_id=self.target_household_id,
            tag_id=tag_id,
            content_type=interaction_ct,
            object_id=str(interaction_id),
        )
        self.assertEqual(link.created_by_id, 1)

    @patch("tags.management.commands.import_supabase_tags.Command._fetch_source_rows")
    def test_idempotent_update(self, fetch_source_rows_mock):
        tag_id = uuid.uuid4()
        interaction_id = uuid.uuid4()

        Interaction.objects.create(
            id=interaction_id,
            household_id=self.target_household_id,
            subject="Old interaction",
            content="",
            type="note",
            occurred_at=timezone.now(),
            created_by_id=1,
            updated_by_id=1,
        )

        tag = Tag.objects.create(
            id=tag_id,
            household_id=self.target_household_id,
            type=Tag.TagType.INTERACTION,
            name="old-name",
            created_by_id=1,
            updated_by_id=1,
        )

        interaction_ct = ContentType.objects.get_for_model(Interaction)
        TagLink.objects.create(
            household_id=self.target_household_id,
            tag=tag,
            content_type=interaction_ct,
            object_id=str(interaction_id),
            created_by_id=1,
            updated_by_id=1,
        )

        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": tag_id,
                    "household_id": self.target_household_id,
                    "type": "INTERACTION",
                    "name": "new-name",
                    "created_at": None,
                    "created_by": None,
                }
            ],
            [
                {
                    "interaction_id": interaction_id,
                    "tag_id": tag_id,
                    "created_at": None,
                    "created_by": None,
                }
            ],
        ]

        call_command(
            "import_supabase_tags",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        self.assertEqual(Tag.objects.filter(id=tag_id).count(), 1)
        updated_tag = Tag.objects.get(id=tag_id)
        self.assertEqual(updated_tag.name, "new-name")
        self.assertEqual(updated_tag.type, Tag.TagType.INTERACTION)

        self.assertEqual(
            TagLink.objects.filter(
                household_id=self.target_household_id,
                tag_id=tag_id,
                content_type=interaction_ct,
                object_id=str(interaction_id),
            ).count(),
            1,
        )
