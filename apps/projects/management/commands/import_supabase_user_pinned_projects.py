import importlib
import os
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from households.models import Household, HouseholdMember
from projects.models import Project, UserPinnedProject


SOURCE_USER_PINNED_PROJECTS_SQL = """
SELECT user_id, project_id, household_id, created_at
FROM public.user_pinned_projects
ORDER BY created_at NULLS LAST
"""


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import user_pinned_projects from Supabase into local Django DB (mapped to HouseholdMember)."

    def add_arguments(self, parser):
        parser.add_argument("--supabase-dsn", default=os.getenv("SUPABASE_DSN"))
        parser.add_argument(
            "--target-household-id",
            default="ff28b251-8abc-400a-8bdc-8303b2086d70",
            help="Only rows for this source household are imported.",
        )
        parser.add_argument(
            "--fallback-user-id",
            type=int,
            default=1,
            help="Fallback user id when source user is missing/unmappable.",
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
        if not user_model.objects.filter(id=fallback_user_id).exists():
            raise CommandError(f"Fallback user not found: id={fallback_user_id}")
        existing_user_ids = set(user_model.objects.values_list("id", flat=True))

        self.stdout.write(self.style.NOTICE("Fetching user_pinned_projects rows from Supabase..."))
        rows = self._fetch_source_rows(dsn, SOURCE_USER_PINNED_PROJECTS_SQL)
        self.stdout.write(self.style.NOTICE(f"Fetched {len(rows)} user_pinned_projects rows."))

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            counters = self._import_rows(
                rows=rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                "user_pinned_projects import: "
                f"created={counters.created}, updated={counters.updated}, skipped={counters.skipped}"
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

    def _import_rows(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            source_household_id = row.get("household_id")
            if str(source_household_id) != str(target_household_id):
                counters.skipped += 1
                continue

            project_id = row.get("project_id")
            if not project_id:
                counters.skipped += 1
                continue

            project = Project.objects.filter(id=project_id, household_id=target_household_id).first()
            if not project:
                counters.skipped += 1
                continue

            user_id = self._map_user_id(row.get("user_id"), fallback_user_id, existing_user_ids)
            membership = HouseholdMember.objects.filter(
                household_id=target_household_id,
                user_id=user_id,
            ).first()
            if not membership:
                counters.skipped += 1
                continue

            exists = UserPinnedProject.objects.filter(
                household_member_id=membership.id,
                project_id=project.id,
            ).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = UserPinnedProject.objects.get_or_create(
                household_member_id=membership.id,
                project_id=project.id,
            )

            created_at = row.get("created_at")
            if created_at is not None:
                UserPinnedProject.objects.filter(pk=obj.pk).update(created_at=created_at)

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

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
