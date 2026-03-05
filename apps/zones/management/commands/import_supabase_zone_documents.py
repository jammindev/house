import importlib
import os
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from documents.models import Document
from zones.models import Zone, ZoneDocument


SOURCE_ZONE_DOCUMENTS_SQL = """
SELECT zone_id, document_id, role, note, created_at, created_by
FROM public.zone_documents
"""


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import zone_documents links from Supabase into local Django DB."

    def add_arguments(self, parser):
        parser.add_argument("--supabase-dsn", default=os.getenv("SUPABASE_DSN"))
        parser.add_argument(
            "--target-household-id",
            default="ff28b251-8abc-400a-8bdc-8303b2086d70",
            help="Only links where zone belongs to this household are imported.",
        )
        parser.add_argument(
            "--fallback-user-id",
            type=int,
            default=1,
            help="Fallback user id for created_by when source user is missing/unmappable.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dsn = options["supabase_dsn"]
        if not dsn:
            raise CommandError("Missing Supabase DSN. Use --supabase-dsn or SUPABASE_DSN.")

        target_household_id = options["target_household_id"]
        fallback_user_id = options["fallback_user_id"]
        dry_run = options["dry_run"]

        user_model = get_user_model()
        if not user_model.objects.filter(id=fallback_user_id).exists():
            raise CommandError(f"Fallback user not found: id={fallback_user_id}")
        existing_user_ids = set(user_model.objects.values_list("id", flat=True))

        self.stdout.write(self.style.NOTICE("Fetching zone_documents rows from Supabase..."))
        rows = self._fetch_source_rows(dsn, SOURCE_ZONE_DOCUMENTS_SQL)
        self.stdout.write(self.style.NOTICE(f"Fetched {len(rows)} zone_documents."))

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            counts = self._import_zone_documents(
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
                f"zone_documents import: created={counts.created}, updated={counts.updated}, skipped={counts.skipped}"
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

    def _import_zone_documents(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            zone_id = row.get("zone_id")
            source_document_id = row.get("document_id")
            if not zone_id or not source_document_id:
                counters.skipped += 1
                continue

            zone = Zone.objects.filter(id=zone_id, household_id=target_household_id).first()
            if not zone:
                counters.skipped += 1
                continue

            document = Document.objects.filter(
                household_id=target_household_id,
                metadata__supabase_document_id=str(source_document_id),
            ).first()
            if not document:
                counters.skipped += 1
                continue

            role_value = (row.get("role") or "photo").strip() or "photo"
            note_value = row.get("note") or ""

            exists = ZoneDocument.objects.filter(zone_id=zone.id, document_id=document.id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = ZoneDocument.objects.update_or_create(
                zone_id=zone.id,
                document_id=document.id,
                defaults={
                    "role": role_value,
                    "note": note_value,
                    "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                },
            )
            if row.get("created_at") is not None:
                ZoneDocument.objects.filter(pk=obj.pk).update(created_at=row["created_at"])

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
