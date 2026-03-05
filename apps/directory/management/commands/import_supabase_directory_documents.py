import importlib
import os
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from directory.models import Address, Contact, Email, Phone, Structure
from documents.models import Document
from households.models import Household


SOURCE_STRUCTURES_SQL = """
SELECT
    id,
    household_id,
    name,
    type,
    description,
    website,
    tags,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.structures
ORDER BY created_at NULLS LAST, id
"""

SOURCE_CONTACTS_SQL = """
SELECT
    id,
    household_id,
    structure_id,
    first_name,
    last_name,
    position,
    notes,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.contacts
ORDER BY created_at NULLS LAST, id
"""

SOURCE_DOCUMENTS_SQL = """
SELECT
    id,
    household_id,
    file_path,
    mime_type,
    ocr_text,
    metadata,
    created_at,
    created_by,
    type,
    name,
    notes
FROM public.documents
ORDER BY created_at NULLS LAST, id
"""

SOURCE_ADDRESSES_SQL = """
SELECT
    id,
    household_id,
    contact_id,
    structure_id,
    address_1,
    address_2,
    zipcode,
    city,
    country,
    label,
    is_primary,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.addresses
ORDER BY created_at NULLS LAST, id
"""

SOURCE_EMAILS_SQL = """
SELECT
    id,
    household_id,
    contact_id,
    structure_id,
    email,
    label,
    is_primary,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.emails
ORDER BY created_at NULLS LAST, id
"""

SOURCE_PHONES_SQL = """
SELECT
    id,
    household_id,
    contact_id,
    structure_id,
    phone,
    label,
    is_primary,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.phones
ORDER BY created_at NULLS LAST, id
"""


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import structures, contacts, and documents from Supabase into local Django DB."

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

        if not Household.objects.filter(id=target_household_id).exists():
            raise CommandError(f"Target household not found: {target_household_id}")

        user_model = get_user_model()
        if not user_model.objects.filter(id=fallback_user_id).exists():
            raise CommandError(f"Fallback user not found: id={fallback_user_id}")

        existing_user_ids = set(user_model.objects.values_list("id", flat=True))

        self.stdout.write(self.style.NOTICE("Fetching source rows from Supabase..."))
        structures_rows = self._fetch_source_rows(dsn, SOURCE_STRUCTURES_SQL)
        contacts_rows = self._fetch_source_rows(dsn, SOURCE_CONTACTS_SQL)
        documents_rows = self._fetch_source_rows(dsn, SOURCE_DOCUMENTS_SQL)
        addresses_rows = self._fetch_source_rows(dsn, SOURCE_ADDRESSES_SQL)
        emails_rows = self._fetch_source_rows(dsn, SOURCE_EMAILS_SQL)
        phones_rows = self._fetch_source_rows(dsn, SOURCE_PHONES_SQL)

        self.stdout.write(
            self.style.NOTICE(
                "Fetched "
                f"{len(structures_rows)} structures, "
                f"{len(contacts_rows)} contacts, "
                f"{len(documents_rows)} documents, "
                f"{len(addresses_rows)} addresses, "
                f"{len(emails_rows)} emails, "
                f"{len(phones_rows)} phones."
            )
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            structures_counts = self._import_structures(
                rows=structures_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            contacts_counts = self._import_contacts(
                rows=contacts_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            documents_counts = self._import_documents(
                rows=documents_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            addresses_counts = self._import_addresses(
                rows=addresses_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            emails_counts = self._import_emails(
                rows=emails_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            phones_counts = self._import_phones(
                rows=phones_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )

            if dry_run:
                transaction.set_rollback(True)

        self._print_counts("structures", structures_counts)
        self._print_counts("contacts", contacts_counts)
        self._print_counts("documents", documents_counts)
        self._print_counts("addresses", addresses_counts)
        self._print_counts("emails", emails_counts)
        self._print_counts("phones", phones_counts)

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

    def _import_structures(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            structure_id = row.get("id")
            if not structure_id:
                counters.skipped += 1
                continue

            defaults = {
                "household_id": target_household_id,
                "name": (row.get("name") or "").strip(),
                "type": row.get("type") or "",
                "description": row.get("description") or "",
                "website": row.get("website") or "",
                "tags": self._normalize_tags(row.get("tags")),
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = Structure.objects.filter(id=structure_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Structure.objects.update_or_create(id=structure_id, defaults=defaults)
            self._preserve_timestamps(obj.__class__, obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_contacts(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            contact_id = row.get("id")
            if not contact_id:
                counters.skipped += 1
                continue

            structure_id = row.get("structure_id")
            if structure_id and not Structure.objects.filter(id=structure_id, household_id=target_household_id).exists():
                structure_id = None

            defaults = {
                "household_id": target_household_id,
                "structure_id": structure_id,
                "first_name": row.get("first_name") or "",
                "last_name": row.get("last_name") or "",
                "position": row.get("position") or "",
                "notes": row.get("notes") or "",
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = Contact.objects.filter(id=contact_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Contact.objects.update_or_create(id=contact_id, defaults=defaults)
            self._preserve_timestamps(obj.__class__, obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_documents(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()
        valid_document_types = {choice for choice, _label in Document.DOCUMENT_TYPES}

        for row in rows:
            source_document_id = row.get("id")
            if not source_document_id:
                counters.skipped += 1
                continue

            file_path = row.get("file_path") or ""
            file_path = str(file_path)
            if len(file_path) > 500:
                file_path = file_path[:500]

            document_type = (row.get("type") or "document").strip()
            if document_type not in valid_document_types:
                document_type = "document"

            metadata = row.get("metadata")
            if not isinstance(metadata, dict):
                metadata = {}
            metadata = {**metadata, "supabase_document_id": str(source_document_id)}

            name_value = row.get("name") or ""
            name_value = str(name_value)
            if len(name_value) > 255:
                name_value = name_value[:255]

            mime_value = row.get("mime_type") or ""
            mime_value = str(mime_value)
            if len(mime_value) > 100:
                mime_value = mime_value[:100]

            defaults = {
                "household_id": target_household_id,
                "file_path": file_path,
                "name": name_value,
                "mime_type": mime_value,
                "type": document_type,
                "ocr_text": row.get("ocr_text") or "",
                "metadata": metadata,
                "notes": row.get("notes") or "",
                "interaction_id": None,
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
            }

            existing_doc = Document.objects.filter(
                household_id=target_household_id,
                metadata__supabase_document_id=str(source_document_id),
            ).first()
            exists = existing_doc is not None
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            if existing_doc:
                for field_name, value in defaults.items():
                    setattr(existing_doc, field_name, value)
                existing_doc.save()
                obj = existing_doc
                created = False
            else:
                obj = Document.objects.create(**defaults)
                created = True
            self._preserve_timestamps(obj.__class__, obj.id, row.get("created_at"), row.get("created_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _resolve_one_parent(self, target_household_id: str, contact_id, structure_id):
        resolved_contact_id = None
        resolved_structure_id = None

        if contact_id and Contact.objects.filter(id=contact_id, household_id=target_household_id).exists():
            resolved_contact_id = contact_id
        if structure_id and Structure.objects.filter(id=structure_id, household_id=target_household_id).exists():
            resolved_structure_id = structure_id

        # Mirrors Supabase one_parent_check semantics.
        if bool(resolved_contact_id) == bool(resolved_structure_id):
            return None, None
        return resolved_contact_id, resolved_structure_id

    def _import_addresses(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            address_id = row.get("id")
            if not address_id:
                counters.skipped += 1
                continue

            contact_id, structure_id = self._resolve_one_parent(
                target_household_id,
                row.get("contact_id"),
                row.get("structure_id"),
            )
            if not contact_id and not structure_id:
                counters.skipped += 1
                continue

            defaults = {
                "household_id": target_household_id,
                "contact_id": contact_id,
                "structure_id": structure_id,
                "address_1": row.get("address_1") or "",
                "address_2": row.get("address_2") or "",
                "zipcode": row.get("zipcode") or "",
                "city": row.get("city") or "",
                "country": row.get("country") or "",
                "label": row.get("label") or "",
                "is_primary": bool(row.get("is_primary", False)),
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = Address.objects.filter(id=address_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Address.objects.update_or_create(id=address_id, defaults=defaults)
            self._preserve_timestamps(obj.__class__, obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_emails(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            email_id = row.get("id")
            if not email_id:
                counters.skipped += 1
                continue

            contact_id, structure_id = self._resolve_one_parent(
                target_household_id,
                row.get("contact_id"),
                row.get("structure_id"),
            )
            if not contact_id and not structure_id:
                counters.skipped += 1
                continue

            defaults = {
                "household_id": target_household_id,
                "contact_id": contact_id,
                "structure_id": structure_id,
                "email": row.get("email") or "",
                "label": row.get("label") or "",
                "is_primary": bool(row.get("is_primary", False)),
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = Email.objects.filter(id=email_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Email.objects.update_or_create(id=email_id, defaults=defaults)
            self._preserve_timestamps(obj.__class__, obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_phones(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            phone_id = row.get("id")
            if not phone_id:
                counters.skipped += 1
                continue

            contact_id, structure_id = self._resolve_one_parent(
                target_household_id,
                row.get("contact_id"),
                row.get("structure_id"),
            )
            if not contact_id and not structure_id:
                counters.skipped += 1
                continue

            defaults = {
                "household_id": target_household_id,
                "contact_id": contact_id,
                "structure_id": structure_id,
                "phone": row.get("phone") or "",
                "label": row.get("label") or "",
                "is_primary": bool(row.get("is_primary", False)),
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = Phone.objects.filter(id=phone_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Phone.objects.update_or_create(id=phone_id, defaults=defaults)
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
            tag = str(value).strip()
            if tag and tag not in normalized:
                normalized.append(tag)
        return normalized
