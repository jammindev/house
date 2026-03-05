import importlib
import os
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from households.models import Household
from insurance.models import InsuranceContract


SOURCE_INSURANCE_CONTRACTS_SQL = """
SELECT
    id,
    household_id,
    name,
    provider,
    contract_number,
    type,
    insured_item,
    start_date,
    end_date,
    renewal_date,
    status,
    payment_frequency,
    monthly_cost,
    yearly_cost,
    coverage_summary,
    notes,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.insurance_contracts
ORDER BY created_at NULLS LAST, id
"""


@dataclass
class ImportCounters:
    created: int = 0
    updated: int = 0
    skipped: int = 0


class Command(BaseCommand):
    help = "Import insurance_contracts from Supabase into local Django DB."

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

        self.stdout.write(self.style.NOTICE("Fetching source insurance_contracts from Supabase..."))
        rows = self._fetch_source_rows(dsn, SOURCE_INSURANCE_CONTRACTS_SQL)
        self.stdout.write(self.style.NOTICE(f"Fetched {len(rows)} insurance_contracts."))

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no local writes will be performed."))

        with transaction.atomic():
            counts = self._import_contracts(
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
                f"insurance_contracts import: created={counts.created}, updated={counts.updated}, skipped={counts.skipped}"
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

    def _import_contracts(
        self,
        rows: list[dict[str, Any]],
        target_household_id: str,
        fallback_user_id: int,
        existing_user_ids: set[int],
        dry_run: bool,
    ) -> ImportCounters:
        counters = ImportCounters()
        valid_types = {choice for choice, _label in InsuranceContract.InsuranceType.choices}
        valid_statuses = {choice for choice, _label in InsuranceContract.InsuranceStatus.choices}
        valid_frequencies = {choice for choice, _label in InsuranceContract.PaymentFrequency.choices}

        for row in rows:
            contract_id = row.get("id")
            if not contract_id:
                counters.skipped += 1
                continue

            type_value = (row.get("type") or InsuranceContract.InsuranceType.OTHER).strip()
            if type_value not in valid_types:
                type_value = InsuranceContract.InsuranceType.OTHER

            status_value = (row.get("status") or InsuranceContract.InsuranceStatus.ACTIVE).strip()
            if status_value not in valid_statuses:
                status_value = InsuranceContract.InsuranceStatus.ACTIVE

            payment_frequency = (row.get("payment_frequency") or InsuranceContract.PaymentFrequency.MONTHLY).strip()
            if payment_frequency not in valid_frequencies:
                payment_frequency = InsuranceContract.PaymentFrequency.MONTHLY

            defaults = {
                "household_id": target_household_id,
                "name": (row.get("name") or "").strip() or "Untitled contract",
                "provider": row.get("provider") or "",
                "contract_number": row.get("contract_number") or "",
                "type": type_value,
                "insured_item": row.get("insured_item") or "",
                "start_date": row.get("start_date"),
                "end_date": row.get("end_date"),
                "renewal_date": row.get("renewal_date"),
                "status": status_value,
                "payment_frequency": payment_frequency,
                "monthly_cost": row.get("monthly_cost") or 0,
                "yearly_cost": row.get("yearly_cost") or 0,
                "coverage_summary": row.get("coverage_summary") or "",
                "notes": row.get("notes") or "",
                "created_by_id": self._map_user_id(row.get("created_by"), fallback_user_id, existing_user_ids),
                "updated_by_id": self._map_user_id(row.get("updated_by"), fallback_user_id, existing_user_ids),
            }

            exists = InsuranceContract.objects.filter(id=contract_id).exists()
            if dry_run:
                if exists:
                    counters.updated += 1
                else:
                    counters.created += 1
                continue

            obj, created = InsuranceContract.objects.update_or_create(id=contract_id, defaults=defaults)
            self._preserve_timestamps(obj.id, row.get("created_at"), row.get("updated_at"))

            if created:
                counters.created += 1
            else:
                counters.updated += 1

        return counters

    def _preserve_timestamps(self, contract_id, created_at, updated_at):
        updates = {}
        if created_at is not None:
            updates["created_at"] = created_at
        if updated_at is not None:
            updates["updated_at"] = updated_at
        if updates:
            InsuranceContract.objects.filter(id=contract_id).update(**updates)

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
