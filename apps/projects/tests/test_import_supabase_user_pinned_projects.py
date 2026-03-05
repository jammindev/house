import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory
from households.models import HouseholdMember
from projects.models import Project, UserPinnedProject


class ImportSupabaseUserPinnedProjectsCommandTests(TestCase):
    def setUp(self):
        self.target_household_id = "ff28b251-8abc-400a-8bdc-8303b2086d70"
        if not HouseholdFactory._meta.model.objects.filter(id=self.target_household_id).exists():
            HouseholdFactory(id=self.target_household_id, name="Target household")

        user_model = get_user_model()
        self.user, _ = user_model.objects.get_or_create(
            id=1,
            defaults={
                "email": "fallback@example.com",
                "is_active": True,
            },
        )

        self.membership, _ = HouseholdMember.objects.get_or_create(
            household_id=self.target_household_id,
            user_id=self.user.id,
            defaults={"role": HouseholdMember.Role.OWNER},
        )

    @patch("projects.management.commands.import_supabase_user_pinned_projects.Command._fetch_source_rows")
    def test_import_pinned_projects_as_household_member_links(self, fetch_source_rows_mock):
        project_id = uuid.uuid4()
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
            created_by_id=self.user.id,
            updated_by_id=self.user.id,
        )

        now = timezone.now()
        fetch_source_rows_mock.return_value = [
            {
                "user_id": self.user.id,
                "project_id": project_id,
                "household_id": self.target_household_id,
                "created_at": now,
            }
        ]

        call_command(
            "import_supabase_user_pinned_projects",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        link = UserPinnedProject.objects.get(household_member=self.membership, project_id=project_id)
        self.assertEqual(link.household_member_id, self.membership.id)

    @patch("projects.management.commands.import_supabase_user_pinned_projects.Command._fetch_source_rows")
    def test_skips_when_household_member_missing(self, fetch_source_rows_mock):
        project_id = uuid.uuid4()
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
            created_by_id=self.user.id,
            updated_by_id=self.user.id,
        )

        HouseholdMember.objects.filter(pk=self.membership.id).delete()

        fetch_source_rows_mock.return_value = [
            {
                "user_id": self.user.id,
                "project_id": project_id,
                "household_id": self.target_household_id,
                "created_at": timezone.now(),
            }
        ]

        call_command(
            "import_supabase_user_pinned_projects",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        self.assertEqual(UserPinnedProject.objects.count(), 0)
