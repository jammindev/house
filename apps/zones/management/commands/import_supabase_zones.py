import importlib
import os
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from households.models import Household
from zones.models import Zone


SOURCE_ZONES_SQL = """
SELECT
    id,
    household_id,
    name,
    created_at,
    parent_id,
    created_by,
    note,
    surface,
    color
FROM public.zones
ORDER BY created_at NULLS LAST, id
"""

HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import zones from a Supabase Postgres database into local Django DB."

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

        target_household = Household.objects.filter(id=target_household_id).first()
        if not target_household:
            raise CommandError(f"Target household not found: {target_household_id}")

        user_model = get_user_model()
        fallback_user = user_model.objects.filter(id=fallback_user_id).first()
        if not fallback_user:
            raise CommandError(f"Fallback user not found: id={fallback_user_id}")

        existing_user_ids = set(user_model.objects.values_list("id", flat=True))

        self.stdout.write(self.style.NOTICE("Fetching source zones from Supabase..."))
        source_rows = self._fetch_source_rows(dsn, SOURCE_ZONES_SQL)
        self.stdout.write(self.style.NOTICE(f"Fetched {len(source_rows)} zones from source."))

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            counters = self._import_zones(
                rows=source_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"zones import: created={counters.created}, updated={counters.updated}, skipped={counters.skipped}"
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

    def _import_zones(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        # Pass 1: import zones without parent links to avoid ordering issues.
        for row in rows:
            zone_id = row.get("id")
            if not zone_id:
                counters.skipped += 1
                continue

            defaults = {
                "household_id": target_household_id,
                "name": (row.get("name") or "").strip() or "Unnamed zone",
                "parent_id": None,
                "note": row.get("note") or "",
                "surface": self._normalize_surface(row.get("surface")),
                "color": self._normalize_color(row.get("color")),
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
            }

            exists = Zone.objects.filter(id=zone_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Zone.objects.update_or_create(id=zone_id, defaults=defaults)
            self._preserve_timestamps(
                model_class=obj.__class__,
                object_id=obj.id,
                created_at=row.get("created_at"),
                updated_at=row.get("created_at"),
            )

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        # Pass 2: set parent relations when parent exists in target set.
        row_by_zone_id = {row.get("id"): row for row in rows if row.get("id")}
        if not dry_run:
            for zone_id, row in row_by_zone_id.items():
                parent_id = row.get("parent_id")
                if not parent_id:
                    continue

                if not Zone.objects.filter(id=parent_id, household_id=target_household_id).exists():
                    continue

                Zone.objects.filter(id=zone_id, household_id=target_household_id).update(parent_id=parent_id)

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

    def _normalize_color(self, color_value: Any) -> str:
        color = (str(color_value).strip() if color_value is not None else "")
        if HEX_COLOR_RE.match(color):
            return color
        return "#f4f4f5"

    def _normalize_surface(self, surface_value: Any):
        if surface_value is None:
            return None

        try:
            value = Decimal(str(surface_value))
        except (InvalidOperation, TypeError, ValueError):
            return None

        if value < 0:
            return Decimal("0")
        return value
