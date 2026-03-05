import uuid
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from app_settings.tests.factories import HouseholdFactory
from projects.models import Project, ProjectGroup


class ImportSupabaseProjectsCommandTests(TestCase):
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

    @patch("projects.management.commands.import_supabase_projects.Command._fetch_source_rows")
    def test_import_creates_and_normalizes_rows(self, fetch_source_rows_mock):
        group_id = uuid.uuid4()
        project_id = uuid.uuid4()

        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": group_id,
                    "household_id": uuid.uuid4(),
                    "name": "  Group A  ",
                    "description": None,
                    "tags": ["kitchen", "kitchen", "  ", "todo"],
                    "created_at": None,
                    "updated_at": None,
                    "created_by": str(uuid.uuid4()),
                    "updated_by": None,
                }
            ],
            [
                {
                    "id": project_id,
                    "household_id": uuid.uuid4(),
                    "title": "  Project A  ",
                    "description": None,
                    "status": "paused",
                    "priority": 9,
                    "start_date": None,
                    "due_date": None,
                    "closed_at": None,
                    "tags": None,
                    "planned_budget": "-15.12",
                    "actual_cost_cached": "32.50",
                    "cover_interaction_id": None,
                    "project_group_id": group_id,
                    "type": "custom_type",
                    "is_pinned": 1,
                    "created_at": None,
                    "updated_at": None,
                    "created_by": str(uuid.uuid4()),
                    "updated_by": str(uuid.uuid4()),
                }
            ],
        ]

        call_command(
            "import_supabase_projects",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        group = ProjectGroup.objects.get(id=group_id)
        self.assertEqual(str(group.household_id), self.target_household_id)
        self.assertEqual(group.name, "Group A")
        self.assertEqual(group.description, "")
        self.assertEqual(group.tags, ["kitchen", "todo"])
        self.assertEqual(group.created_by_id, 1)
        self.assertEqual(group.updated_by_id, 1)

        project = Project.objects.get(id=project_id)
        self.assertEqual(str(project.household_id), self.target_household_id)
        self.assertEqual(project.title, "Project A")
        self.assertEqual(project.description, "")
        self.assertEqual(project.status, Project.Status.DRAFT)
        self.assertEqual(project.type, Project.Type.OTHER)
        self.assertEqual(project.priority, 5)
        self.assertEqual(project.tags, [])
        self.assertEqual(project.planned_budget, Decimal("0"))
        self.assertEqual(project.actual_cost_cached, Decimal("32.50"))
        self.assertEqual(project.is_pinned, True)
        self.assertEqual(project.project_group_id, group_id)
        self.assertEqual(project.created_by_id, 1)
        self.assertEqual(project.updated_by_id, 1)

    @patch("projects.management.commands.import_supabase_projects.Command._fetch_source_rows")
    def test_import_is_idempotent_with_updates(self, fetch_source_rows_mock):
        group_id = uuid.uuid4()
        project_id = uuid.uuid4()

        ProjectGroup.objects.create(
            id=group_id,
            household_id=self.target_household_id,
            name="Initial group",
            description="",
            tags=[],
            created_by_id=1,
            updated_by_id=1,
        )
        Project.objects.create(
            id=project_id,
            household_id=self.target_household_id,
            title="Initial project",
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

        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": group_id,
                    "household_id": uuid.uuid4(),
                    "name": "Updated group",
                    "description": "new desc",
                    "tags": ["x"],
                    "created_at": None,
                    "updated_at": None,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
            [
                {
                    "id": project_id,
                    "household_id": uuid.uuid4(),
                    "title": "Updated project",
                    "description": "new",
                    "status": Project.Status.ACTIVE,
                    "priority": 2,
                    "start_date": None,
                    "due_date": None,
                    "closed_at": None,
                    "tags": ["a"],
                    "planned_budget": "99.90",
                    "actual_cost_cached": "10",
                    "cover_interaction_id": None,
                    "project_group_id": group_id,
                    "type": Project.Type.REPAIR,
                    "is_pinned": False,
                    "created_at": None,
                    "updated_at": None,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
        ]

        call_command(
            "import_supabase_projects",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        group = ProjectGroup.objects.get(id=group_id)
        self.assertEqual(group.name, "Updated group")
        self.assertEqual(group.description, "new desc")
        self.assertEqual(group.tags, ["x"])

        project = Project.objects.get(id=project_id)
        self.assertEqual(project.title, "Updated project")
        self.assertEqual(project.description, "new")
        self.assertEqual(project.status, Project.Status.ACTIVE)
        self.assertEqual(project.priority, 2)
        self.assertEqual(project.tags, ["a"])
        self.assertEqual(project.planned_budget, Decimal("99.90"))
        self.assertEqual(project.actual_cost_cached, Decimal("10"))
        self.assertEqual(project.type, Project.Type.REPAIR)
