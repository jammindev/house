import importlib
import os
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from equipment.models import Equipment, EquipmentInteraction
from households.models import Household
from interactions.models import Interaction
from zones.models import Zone


SOURCE_EQUIPMENT_SQL = """
SELECT
    id,
    household_id,
    zone_id,
    name,
    category,
    manufacturer,
    model,
    serial_number,
    purchase_date,
    purchase_price,
    purchase_vendor,
    warranty_expires_on,
    warranty_provider,
    warranty_notes,
    maintenance_interval_months,
    last_service_at,
    status,
    condition,
    installed_at,
    retired_at,
    notes,
    tags,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.equipment
ORDER BY created_at NULLS LAST, id
"""

SOURCE_EQUIPMENT_INTERACTIONS_SQL = """
SELECT equipment_id, interaction_id, role, note, created_at, created_by
FROM public.equipment_interactions
"""


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import equipment and equipment_interactions from Supabase into local Django DB."

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

        self.stdout.write(self.style.NOTICE("Fetching source equipment rows from Supabase..."))
        equipment_rows = self._fetch_source_rows(dsn, SOURCE_EQUIPMENT_SQL)
        equipment_interaction_rows = self._fetch_source_rows(dsn, SOURCE_EQUIPMENT_INTERACTIONS_SQL)

        self.stdout.write(
            self.style.NOTICE(
                f"Fetched {len(equipment_rows)} equipment and {len(equipment_interaction_rows)} equipment_interactions."
            )
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            equipment_counts = self._import_equipment(
                rows=equipment_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            interaction_counts = self._import_equipment_interactions(
                rows=equipment_interaction_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )

            if dry_run:
                transaction.set_rollback(True)

        self._print_counts("equipment", equipment_counts)
        self._print_counts("equipment_interactions", interaction_counts)

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

    def _import_equipment(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()
        valid_statuses = {choice for choice, _label in Equipment.Status.choices}

        for row in rows:
            equipment_id = row.get("id")
            if not equipment_id:
                counters.skipped += 1
                continue

            zone_id = row.get("zone_id")
            if zone_id and not Zone.objects.filter(id=zone_id, household_id=target_household_id).exists():
                zone_id = None

            status_value = (row.get("status") or Equipment.Status.ACTIVE).strip() or Equipment.Status.ACTIVE
            if status_value not in valid_statuses:
                status_value = Equipment.Status.ACTIVE

            defaults = {
                "household_id": target_household_id,
                "zone_id": zone_id,
                "name": (row.get("name") or "").strip() or "Unnamed equipment",
                "category": (row.get("category") or "general").strip() or "general",
                "manufacturer": row.get("manufacturer") or None,
                "model": row.get("model") or None,
                "serial_number": row.get("serial_number") or None,
                "purchase_date": row.get("purchase_date"),
                "purchase_price": row.get("purchase_price"),
                "purchase_vendor": row.get("purchase_vendor") or None,
                "warranty_expires_on": row.get("warranty_expires_on"),
                "warranty_provider": row.get("warranty_provider") or None,
                "warranty_notes": row.get("warranty_notes") or "",
                "maintenance_interval_months": row.get("maintenance_interval_months"),
                "last_service_at": row.get("last_service_at"),
                "status": status_value,
                "condition": row.get("condition") or "good",
                "installed_at": row.get("installed_at"),
                "retired_at": row.get("retired_at"),
                "notes": row.get("notes") or "",
                "tags": self._normalize_tags(row.get("tags")),
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = Equipment.objects.filter(id=equipment_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = Equipment.objects.update_or_create(id=equipment_id, defaults=defaults)
            self._preserve_timestamps(obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_equipment_interactions(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            equipment_id = row.get("equipment_id")
            interaction_id = row.get("interaction_id")
            if not equipment_id or not interaction_id:
                counters.skipped += 1
                continue

            equipment = Equipment.objects.filter(id=equipment_id, household_id=target_household_id).first()
            if not equipment:
                counters.skipped += 1
                continue

            if not Interaction.objects.filter(id=interaction_id, household_id=target_household_id).exists():
                counters.skipped += 1
                continue

            exists = EquipmentInteraction.objects.filter(
                equipment_id=equipment.id,
                interaction_id=interaction_id,
            ).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = EquipmentInteraction.objects.update_or_create(
                equipment_id=equipment.id,
                interaction_id=interaction_id,
                defaults={
                    "role": (row.get("role") or "log").strip() or "log",
                    "note": row.get("note") or "",
                    "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                },
            )

            if row.get("created_at") is not None:
                EquipmentInteraction.objects.filter(pk=obj.pk).update(created_at=row["created_at"])

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _normalize_tags(self, value: Any) -> list[str]:
        if not value:
            return []
        if isinstance(value, list):
            return [str(v) for v in value if v is not None]
        return [str(value)]

    def _preserve_timestamps(self, equipment_id, created_at, updated_at):
        updates = {}
        if created_at is not None:
            updates["created_at"] = created_at
        if updated_at is not None:
            updates["updated_at"] = updated_at
        if updates:
            Equipment.objects.filter(id=equipment_id).update(**updates)

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
