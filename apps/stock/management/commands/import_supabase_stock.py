import importlib
import os
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from households.models import Household
from stock.models import StockCategory, StockItem
from zones.models import Zone


SOURCE_STOCK_CATEGORIES_SQL = """
SELECT
    id,
    household_id,
    name,
    color,
    emoji,
    description,
    sort_order,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.stock_categories
ORDER BY created_at NULLS LAST, id
"""

SOURCE_STOCK_ITEMS_SQL = """
SELECT
    id,
    household_id,
    category_id,
    zone_id,
    name,
    description,
    sku,
    barcode,
    quantity,
    unit,
    min_quantity,
    max_quantity,
    unit_price,
    purchase_date,
    expiration_date,
    last_restocked_at,
    status,
    supplier,
    notes,
    tags,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.stock_items
ORDER BY created_at NULLS LAST, id
"""


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import stock_categories and stock_items from Supabase into local Django DB."

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

        self.stdout.write(self.style.NOTICE("Fetching source stock rows from Supabase..."))
        categories_rows = self._fetch_source_rows(dsn, SOURCE_STOCK_CATEGORIES_SQL)
        items_rows = self._fetch_source_rows(dsn, SOURCE_STOCK_ITEMS_SQL)
        self.stdout.write(self.style.NOTICE(f"Fetched {len(categories_rows)} stock_categories and {len(items_rows)} stock_items."))

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            categories_counts = self._import_categories(
                rows=categories_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )
            items_counts = self._import_items(
                rows=items_rows,
                target_household_id=target_household_id,
                fallback_user_id=fallback_user_id,
                existing_user_ids=existing_user_ids,
                dry_run=dry_run,
            )

            if dry_run:
                transaction.set_rollback(True)

        self._print_counts("stock_categories", categories_counts)
        self._print_counts("stock_items", items_counts)

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

    def _import_categories(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()

        for row in rows:
            category_id = row.get("id")
            if not category_id:
                counters.skipped += 1
                continue

            defaults = {
                "household_id": target_household_id,
                "name": (row.get("name") or "").strip() or "Unnamed category",
                "color": (row.get("color") or "#94a3b8").strip() or "#94a3b8",
                "emoji": row.get("emoji") or "📦",
                "description": row.get("description") or "",
                "sort_order": row.get("sort_order") or 0,
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = StockCategory.objects.filter(id=category_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = StockCategory.objects.update_or_create(id=category_id, defaults=defaults)
            self._preserve_category_timestamps(obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _import_items(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()
        valid_statuses = {choice for choice, _label in StockItem.Status.choices}

        for row in rows:
            item_id = row.get("id")
            if not item_id:
                counters.skipped += 1
                continue

            category_id = row.get("category_id")
            category = StockCategory.objects.filter(id=category_id, household_id=target_household_id).first()
            if not category:
                counters.skipped += 1
                continue

            zone_id = row.get("zone_id")
            if zone_id and not Zone.objects.filter(id=zone_id, household_id=target_household_id).exists():
                zone_id = None

            status_value = (row.get("status") or StockItem.Status.IN_STOCK).strip() or StockItem.Status.IN_STOCK
            if status_value not in valid_statuses:
                status_value = StockItem.Status.IN_STOCK

            defaults = {
                "household_id": target_household_id,
                "category_id": category.id,
                "zone_id": zone_id,
                "name": (row.get("name") or "").strip() or "Unnamed item",
                "description": row.get("description") or "",
                "sku": row.get("sku") or "",
                "barcode": row.get("barcode") or "",
                "quantity": row.get("quantity") or 0,
                "unit": (row.get("unit") or "unit").strip() or "unit",
                "min_quantity": row.get("min_quantity"),
                "max_quantity": row.get("max_quantity"),
                "unit_price": row.get("unit_price"),
                "purchase_date": row.get("purchase_date"),
                "expiration_date": row.get("expiration_date"),
                "last_restocked_at": row.get("last_restocked_at"),
                "status": status_value,
                "supplier": row.get("supplier") or "",
                "notes": row.get("notes") or "",
                "tags": self._normalize_tags(row.get("tags")),
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = StockItem.objects.filter(id=item_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = StockItem.objects.update_or_create(id=item_id, defaults=defaults)
            self._preserve_item_timestamps(obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _preserve_category_timestamps(self, category_id, created_at, updated_at):
        updates = {}
        if created_at is not None:
            updates["created_at"] = created_at
        if updated_at is not None:
            updates["updated_at"] = updated_at
        if updates:
            StockCategory.objects.filter(id=category_id).update(**updates)

    def _preserve_item_timestamps(self, item_id, created_at, updated_at):
        updates = {}
        if created_at is not None:
            updates["created_at"] = created_at
        if updated_at is not None:
            updates["updated_at"] = updated_at
        if updates:
            StockItem.objects.filter(id=item_id).update(**updates)

    def _normalize_tags(self, value: Any) -> list[str]:
        if not value:
            return []
        if isinstance(value, list):
            return [str(v) for v in value if v is not None]
        return [str(value)]

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
