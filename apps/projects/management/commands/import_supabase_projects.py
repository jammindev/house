import os
import importlib
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from households.models import Household
from interactions.models import Interaction
from projects.models import Project, ProjectGroup


SOURCE_GROUPS_SQL = """
SELECT
    id,
    household_id,
    name,
    description,
    tags,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.project_groups
ORDER BY created_at NULLS LAST, id
"""

SOURCE_PROJECTS_SQL = """
SELECT
    id,
    household_id,
    title,
    description,
    status,
    priority,
    start_date,
    due_date,
    closed_at,
    tags,
    planned_budget,
    actual_cost_cached,
    cover_interaction_id,
    project_group_id,
    type,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.projects
ORDER BY created_at NULLS LAST, id
"""


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import project_groups and projects from a Supabase Postgres database into local Django DB."

    def add_arguments(self, parser):
        parser.add_argument("--supabase-dsn", default=os.getenv("SUPABASE_DSN"))
        parser.add_argument(
            "--target-household-id",
            default="ff28b251-8abc-400a-8bdc-8303b2086d70",
            help="All imported rows are forced to this household id.",
        )
        parser.add_argument(
            "--fallback-user-id",
            type=int,
            default=1,
            help="Fallback user id when source created_by/updated_by is missing or not mappable.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dsn = options["supabase_dsn"]
        if not dsn:
            raise CommandError("Missing Supabase DSN. Use --supabase-dsn or SUPABASE_DSN.")

        target_household_id = options["target_household_id"]
        fallback_user_id = options["fallback_user_id"]
        dry_run = options["dry_run"]

        target_household = Household.objects.filter(id=target_household_id).first()
        if not target_household:
            raise CommandError(f"Target household not found: {target_household_id}")

        user_model = get_user_model()
        fallback_user = user_model.objects.filter(id=fallback_user_id).first()
        if not fallback_user:
            raise CommandError(f"Fallback user not found: id={fallback_user_id}")

        existing_user_ids = set(user_model.objects.values_list("id", flat=True))

        self.stdout.write(self.style.NOTICE("Fetching source rows from Supabase..."))
        source_groups = self._fetch_source_rows(dsn, SOURCE_GROUPS_SQL)
        source_projects = self._fetch_source_rows(dsn, SOURCE_PROJECTS_SQL)
        self.stdout.write(
            self.style.NOTICE(
                f"Fetched {len(source_groups)} project_groups and {len(source_projects)} projects from source."
            )
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            group_counts = self._import_groups(
                rows=source_groups,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )

            project_counts = self._import_projects(
                rows=source_projects,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                "project_groups import: "
                f"created={group_counts.created}, updated={group_counts.updated}, skipped={group_counts.skipped}"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "projects import: "
                f"created={project_counts.created}, updated={project_counts.updated}, skipped={project_counts.skipped}"
            )
        )

    def _fetch_source_rows(self, dsn: str, query: str) -> list[dict[str, Any]]:
        try:
            import psycopg
            from psycopg.rows import dict_row

            with psycopg.connect(dsn) as conn:
                with conn.cursor(row_factory=dict_row) as cursor:
                    cursor.execute(query)
                    return list(cursor.fetchall())
        except Exception as psycopg_error:
            try:
                psycopg2 = importlib.import_module("psycopg2")
                extras = importlib.import_module("psycopg2.extras")
                real_dict_cursor = getattr(extras, "RealDictCursor")

                with psycopg2.connect(dsn) as conn:
                    with conn.cursor(cursor_factory=real_dict_cursor) as cursor:
                        cursor.execute(query)
                        return [dict(row) for row in cursor.fetchall()]
            except Exception as psycopg2_error:
                raise CommandError(
                    "Unable to fetch source rows from Supabase. "
                    f"psycopg error: {psycopg_error}; psycopg2 error: {psycopg2_error}"
                ) from psycopg2_error

    def _import_groups(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            group_id = row.get("id")
            if not group_id:
                counters.skipped += 1
                continue

            defaults = {
                "household_id": target_household_id,
                "name": (row.get("name") or "").strip() or "Untitled group",
                "description": row.get("description") or "",
                "tags": self._normalize_tags(row.get("tags")),
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = ProjectGroup.objects.filter(id=group_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = ProjectGroup.objects.update_or_create(id=group_id, defaults=defaults)
            self._preserve_timestamps(obj.__class__, obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_projects(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        valid_statuses = {choice for choice, _label in Project.Status.choices}
        valid_types = {choice for choice, _label in Project.Type.choices}

        for row in rows:
            project_id = row.get("id")
            if not project_id:
                counters.skipped += 1
                continue

            project_group_id = row.get("project_group_id")
            if project_group_id and not ProjectGroup.objects.filter(id=project_group_id).exists():
                project_group_id = None

            cover_interaction_id = row.get("cover_interaction_id")
            if cover_interaction_id and not Interaction.objects.filter(
                id=cover_interaction_id,
                household_id=target_household_id,
            ).exists():
                cover_interaction_id = None

            status_value = (row.get("status") or Project.Status.DRAFT).strip()
            if status_value not in valid_statuses:
                status_value = Project.Status.DRAFT

            type_value = (row.get("type") or Project.Type.OTHER).strip()
            if type_value not in valid_types:
                type_value = Project.Type.OTHER

            defaults = {
                "household_id": target_household_id,
                "title": (row.get("title") or "").strip() or "Untitled project",
                "description": row.get("description") or "",
                "status": status_value,
                "priority": self._normalize_priority(row.get("priority")),
                "start_date": row.get("start_date"),
                "due_date": row.get("due_date"),
                "closed_at": row.get("closed_at"),
                "tags": self._normalize_tags(row.get("tags")),
                "planned_budget": self._normalize_non_negative_decimal(row.get("planned_budget")),
                "actual_cost_cached": self._normalize_non_negative_decimal(row.get("actual_cost_cached")),
                "cover_interaction_id": cover_interaction_id,
                "project_group_id": project_group_id,
                "type": type_value,
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            if defaults["start_date"] and defaults["due_date"] and defaults["due_date"] < defaults["start_date"]:
                defaults["due_date"] = defaults["start_date"]

            exists = Project.objects.filter(id=project_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Project.objects.update_or_create(id=project_id, defaults=defaults)
            self._preserve_timestamps(obj.__class__, obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _preserve_timestamps(self, model_class, object_id, created_at, updated_at):
        updates = {}
        if created_at is not None:
            updates["created_at"] = created_at
        if updated_at is not None:
            updates["updated_at"] = updated_at
        if updates:
            model_class.objects.filter(id=object_id).update(**updates)

    def _map_user_id(self, source_user: Any, fallback_user_id: int, existing_user_ids: set[int]) -> int:
        if source_user is None:
            return fallback_user_id

        try:
            candidate = int(str(source_user))
        except (TypeError, ValueError):
            return fallback_user_id

        if candidate in existing_user_ids:
            return candidate
        return fallback_user_id

    def _normalize_tags(self, tags_value: Any) -> list[str]:
        if not isinstance(tags_value, list):
            return []

        normalized = []
        for value in tags_value:
            name = str(value).strip()
            if name and name not in normalized:
                normalized.append(name)
        return normalized

    def _normalize_priority(self, value: Any) -> int:
        try:
            priority = int(value)
        except (TypeError, ValueError):
            return 3

        if priority < 1:
            return 1
        if priority > 5:
            return 5
        return priority

    def _normalize_non_negative_decimal(self, value: Any) -> Decimal:
        try:
            decimal_value = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal("0")

        if decimal_value < 0:
            return Decimal("0")
        return decimal_value
