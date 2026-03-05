import importlib
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from directory.models import Contact, Structure
from documents.models import Document
from households.models import Household
from interactions.models import (
    Interaction,
    InteractionContact,
    InteractionDocument,
    InteractionStructure,
    InteractionZone,
)
from projects.models import Project
from zones.models import Zone


SOURCE_INTERACTIONS_SQL = """
SELECT
    id,
    household_id,
    content,
    enriched_text,
    metadata,
    created_at,
    updated_at,
    created_by,
    updated_by,
    subject,
    type,
    status,
    occurred_at,
    project_id,
    is_private
FROM public.interactions
ORDER BY created_at NULLS LAST, id
"""

SOURCE_INTERACTION_ZONES_SQL = """
SELECT interaction_id, zone_id
FROM public.interaction_zones
"""

SOURCE_INTERACTION_CONTACTS_SQL = """
SELECT interaction_id, contact_id, created_at
FROM public.interaction_contacts
"""

SOURCE_INTERACTION_STRUCTURES_SQL = """
SELECT interaction_id, structure_id, created_at
FROM public.interaction_structures
"""

SOURCE_INTERACTION_DOCUMENTS_SQL = """
SELECT interaction_id, document_id, role, note, created_at
FROM public.interaction_documents
"""


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import interactions and interaction links from Supabase into local Django DB."

    def add_arguments(self, parser):
        parser.add_argument("--supabase-dsn", default=os.getenv("SUPABASE_DSN"))
        parser.add_argument(
            "--target-household-id",
            default="ff28b251-8abc-400a-8bdc-8303b2086d70",
            help="All imported interactions are forced to this household id.",
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

        if not Household.objects.filter(id=target_household_id).exists():
            raise CommandError(f"Target household not found: {target_household_id}")

        user_model = get_user_model()
        if not user_model.objects.filter(id=fallback_user_id).exists():
            raise CommandError(f"Fallback user not found: id={fallback_user_id}")

        existing_user_ids = set(user_model.objects.values_list("id", flat=True))

        self.stdout.write(self.style.NOTICE("Fetching source interactions from Supabase..."))
        source_interactions = self._fetch_source_rows(dsn, SOURCE_INTERACTIONS_SQL)
        source_interaction_zones = self._fetch_source_rows(dsn, SOURCE_INTERACTION_ZONES_SQL)
        source_interaction_contacts = self._fetch_source_rows(dsn, SOURCE_INTERACTION_CONTACTS_SQL)
        source_interaction_structures = self._fetch_source_rows(dsn, SOURCE_INTERACTION_STRUCTURES_SQL)
        source_interaction_documents = self._fetch_source_rows(dsn, SOURCE_INTERACTION_DOCUMENTS_SQL)

        self.stdout.write(
            self.style.NOTICE(
                "Fetched "
                f"{len(source_interactions)} interactions, "
                f"{len(source_interaction_zones)} interaction_zones, "
                f"{len(source_interaction_contacts)} interaction_contacts, "
                f"{len(source_interaction_structures)} interaction_structures, "
                f"{len(source_interaction_documents)} interaction_documents."
            )
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            interactions_counts = self._import_interactions(
                rows=source_interactions,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            zones_counts = self._import_interaction_zones(
                rows=source_interaction_zones,
                target_household_id=target_household_id,
                dry_run=dry_run,
            )
            contacts_counts = self._import_interaction_contacts(
                rows=source_interaction_contacts,
                target_household_id=target_household_id,
                dry_run=dry_run,
            )
            structures_counts = self._import_interaction_structures(
                rows=source_interaction_structures,
                target_household_id=target_household_id,
                dry_run=dry_run,
            )
            documents_counts = self._import_interaction_documents(
                rows=source_interaction_documents,
                target_household_id=target_household_id,
                dry_run=dry_run,
            )

            if dry_run:
                transaction.set_rollback(True)

        self._print_counts("interactions", interactions_counts)
        self._print_counts("interaction_zones", zones_counts)
        self._print_counts("interaction_contacts", contacts_counts)
        self._print_counts("interaction_structures", structures_counts)
        self._print_counts("interaction_documents", documents_counts)

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

    def _import_interactions(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()
        valid_types = {choice for choice, _label in Interaction.INTERACTION_TYPES}
        valid_statuses = {choice for choice, _label in Interaction.STATUS_CHOICES}

        for row in rows:
            interaction_id = row.get("id")
            if not interaction_id:
                counters.skipped += 1
                continue

            raw_project_id = row.get("project_id")
            project_id = None
            if raw_project_id and Project.objects.filter(id=raw_project_id, household_id=target_household_id).exists():
                project_id = raw_project_id

            type_value = (row.get("type") or "note").strip()
            if type_value not in valid_types:
                type_value = "note"

            status_value = row.get("status")
            if status_value is not None:
                status_value = str(status_value).strip() or None
            if status_value and status_value not in valid_statuses:
                status_value = None

            subject_value = (row.get("subject") or "").strip() or "Untitled interaction"
            if len(subject_value) > 500:
                subject_value = subject_value[:500]

            metadata_value = row.get("metadata")
            if not isinstance(metadata_value, dict):
                metadata_value = {}

            occurred_at = row.get("occurred_at") or row.get("created_at") or timezone.now()

            defaults = {
                "household_id": target_household_id,
                "subject": subject_value,
                "content": row.get("content") or "",
                "type": type_value,
                "status": status_value,
                "is_private": bool(row.get("is_private", False)),
                "occurred_at": occurred_at,
                "metadata": metadata_value,
                "enriched_text": row.get("enriched_text") or "",
                "project_id": project_id,
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = Interaction.objects.filter(id=interaction_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Interaction.objects.update_or_create(id=interaction_id, defaults=defaults)
            self._preserve_timestamps(obj.__class__, obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_interaction_zones(self, rows: list[dict[str, Any]], target_household_id: str, dry_run: bool) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            interaction_id = row.get("interaction_id")
            zone_id = row.get("zone_id")
            if not interaction_id or not zone_id:
                counters.skipped += 1
                continue

            if not Interaction.objects.filter(id=interaction_id, household_id=target_household_id).exists():
                counters.skipped += 1
                continue

            if not Zone.objects.filter(id=zone_id, household_id=target_household_id).exists():
                counters.skipped += 1
                continue

            exists = InteractionZone.objects.filter(interaction_id=interaction_id, zone_id=zone_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            _obj, created = InteractionZone.objects.get_or_create(
                interaction_id=interaction_id,
                zone_id=zone_id,
            )

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_interaction_contacts(self, rows: list[dict[str, Any]], target_household_id: str, dry_run: bool) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            interaction_id = row.get("interaction_id")
            contact_id = row.get("contact_id")
            if not interaction_id or not contact_id:
                counters.skipped += 1
                continue

            if not Interaction.objects.filter(id=interaction_id, household_id=target_household_id).exists():
                counters.skipped += 1
                continue

            if not Contact.objects.filter(id=contact_id, household_id=target_household_id).exists():
                counters.skipped += 1
                continue

            exists = InteractionContact.objects.filter(interaction_id=interaction_id, contact_id=contact_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = InteractionContact.objects.get_or_create(
                interaction_id=interaction_id,
                contact_id=contact_id,
            )
            if row.get("created_at") is not None:
                InteractionContact.objects.filter(pk=obj.pk).update(created_at=row["created_at"])

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_interaction_structures(self, rows: list[dict[str, Any]], target_household_id: str, dry_run: bool) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            interaction_id = row.get("interaction_id")
            structure_id = row.get("structure_id")
            if not interaction_id or not structure_id:
                counters.skipped += 1
                continue

            if not Interaction.objects.filter(id=interaction_id, household_id=target_household_id).exists():
                counters.skipped += 1
                continue

            if not Structure.objects.filter(id=structure_id, household_id=target_household_id).exists():
                counters.skipped += 1
                continue

            exists = InteractionStructure.objects.filter(
                interaction_id=interaction_id,
                structure_id=structure_id,
            ).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = InteractionStructure.objects.get_or_create(
                interaction_id=interaction_id,
                structure_id=structure_id,
            )
            if row.get("created_at") is not None:
                InteractionStructure.objects.filter(pk=obj.pk).update(created_at=row["created_at"])

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_interaction_documents(self, rows: list[dict[str, Any]], target_household_id: str, dry_run: bool) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            interaction_id = row.get("interaction_id")
            source_document_id = row.get("document_id")
            if not interaction_id or not source_document_id:
                counters.skipped += 1
                continue

            if not Interaction.objects.filter(id=interaction_id, household_id=target_household_id).exists():
                counters.skipped += 1
                continue

            document = Document.objects.filter(
                household_id=target_household_id,
                metadata__supabase_document_id=str(source_document_id),
            ).first()
            if not document:
                counters.skipped += 1
                continue

            role_value = (row.get("role") or "attachment").strip() or "attachment"
            note_value = row.get("note") or ""

            exists = InteractionDocument.objects.filter(
                interaction_id=interaction_id,
                document_id=document.id,
            ).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = InteractionDocument.objects.update_or_create(
                interaction_id=interaction_id,
                document_id=document.id,
                defaults={
                    "role": role_value,
                    "note": note_value,
                },
            )
            if row.get("created_at") is not None:
                InteractionDocument.objects.filter(pk=obj.pk).update(created_at=row["created_at"])

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _preserve_timestamps(self, model_class, object_id, created_at: datetime | None, updated_at: datetime | None):
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
