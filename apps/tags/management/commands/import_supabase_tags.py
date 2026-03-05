import importlib
import os
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from households.models import Household
from interactions.models import Interaction
from tags.models import Tag, TagLink


SOURCE_TAGS_SQL = """
SELECT
    id,
    household_id,
    type,
    name,
    created_at,
    created_by
FROM public.tags
ORDER BY created_at NULLS LAST, id
"""

SOURCE_INTERACTION_TAGS_SQL = """
SELECT
    interaction_id,
    tag_id,
    created_at,
    created_by
FROM public.interaction_tags
ORDER BY created_at NULLS LAST, interaction_id, tag_id
"""


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import tags and interaction_tags from Supabase into local Django DB."

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
            help="Fallback user id when source created_by is missing or not mappable.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dsn = options["supabase_dsn"]
        if not dsn:
            raise CommandError("Missing Supabase DSN. Use --supabase-dsn or SUPABASE_DSN.")

        target_household_id = options["target_household_id"]
        fallback_user_id = options["fallback_user_id"]
        dry_run = options["dry_run"]

        if not Household.objects.filter(id=target_household_id).exists():
            raise CommandError(f"Target household not found: {target_household_id}")

        user_model = get_user_model()
        if not user_model.objects.filter(id=fallback_user_id).exists():
            raise CommandError(f"Fallback user not found: id={fallback_user_id}")
        existing_user_ids = set(user_model.objects.values_list("id", flat=True))

        self.stdout.write(self.style.NOTICE("Fetching source tags rows from Supabase..."))
        tags_rows = self._fetch_source_rows(dsn, SOURCE_TAGS_SQL)
        interaction_tag_rows = self._fetch_source_rows(dsn, SOURCE_INTERACTION_TAGS_SQL)
        self.stdout.write(
            self.style.NOTICE(
                f"Fetched {len(tags_rows)} tags and {len(interaction_tag_rows)} interaction_tags."
            )
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            tags_counts = self._import_tags(
                rows=tags_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            links_counts = self._import_interaction_tags(
                rows=interaction_tag_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )

            if dry_run:
                transaction.set_rollback(True)

        self._print_counts("tags", tags_counts)
        self._print_counts("interaction_tags", links_counts)

    def _print_counts(self, label: str, counters: ImportCounters):
        self.stdout.write(
            self.style.SUCCESS(
                f"{label} import: created={counters.created}, updated={counters.updated}, skipped={counters.skipped}"
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

    def _import_tags(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()
        valid_types = {choice for choice, _label in Tag.TagType.choices}

        for row in rows:
            tag_id = row.get("id")
            if not tag_id:
                counters.skipped += 1
                continue

            tag_type = (row.get("type") or Tag.TagType.INTERACTION).strip().lower()
            if tag_type not in valid_types:
                tag_type = Tag.TagType.INTERACTION

            defaults = {
                "household_id": target_household_id,
                "type": tag_type,
                "name": (row.get("name") or "").strip() or "untitled",
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
            }

            exists = Tag.objects.filter(id=tag_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Tag.objects.update_or_create(id=tag_id, defaults=defaults)
            self._preserve_tag_timestamp(obj.id, row.get("created_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_interaction_tags(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()
        interaction_ct = ContentType.objects.get_for_model(Interaction)

        for row in rows:
            tag_id = row.get("tag_id")
            interaction_id = row.get("interaction_id")
            if not tag_id or not interaction_id:
                counters.skipped += 1
                continue

            tag = Tag.objects.filter(id=tag_id, household_id=target_household_id).first()
            if not tag:
                counters.skipped += 1
                continue

            interaction = Interaction.objects.filter(
                id=interaction_id,
                household_id=target_household_id,
            ).first()
            if not interaction:
                counters.skipped += 1
                continue

            object_id = str(interaction.id)
            defaults = {
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
            }

            exists = TagLink.objects.filter(
                household_id=target_household_id,
                tag=tag,
                content_type=interaction_ct,
                object_id=object_id,
            ).exists()

            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = TagLink.objects.update_or_create(
                household_id=target_household_id,
                tag=tag,
                content_type=interaction_ct,
                object_id=object_id,
                defaults=defaults,
            )
            self._preserve_link_timestamp(obj.id, row.get("created_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _preserve_tag_timestamp(self, tag_id, created_at):
        if created_at is not None:
            Tag.objects.filter(id=tag_id).update(created_at=created_at)

    def _preserve_link_timestamp(self, link_id, created_at):
        if created_at is not None:
            TagLink.objects.filter(id=link_id).update(created_at=created_at)

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
