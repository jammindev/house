import os
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from documents.models import Document


@dataclass
class DownloadCounters:
    downloaded: int = 0
    skipped: int = 0
    missing: int = 0
    failed: int = 0


class Command(BaseCommand):
    help = "Download document/photo files from Supabase Storage bucket into local MEDIA_ROOT."

    def add_arguments(self, parser):
        parser.add_argument(
            "--supabase-url",
            default=os.getenv("SUPABASE_URL", "https://jgeqwzauejbvxavylnxi.supabase.co"),
            help="Supabase project URL (e.g. https://<project-ref>.supabase.co)",
        )
        parser.add_argument(
            "--supabase-key",
            default=os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY"),
            help="Supabase API key. Use service-role key for private buckets.",
        )
        parser.add_argument(
            "--bucket",
            default=os.getenv("SUPABASE_STORAGE_BUCKET", "files"),
            help="Supabase Storage bucket name.",
        )
        parser.add_argument(
            "--target-household-id",
            default=None,
            help="Optional household id filter.",
        )
        parser.add_argument(
            "--types",
            default="photo,document",
            help="Comma-separated document types to download. Use * for all types.",
        )
        parser.add_argument("--overwrite", action="store_true", help="Overwrite existing local files.")
        parser.add_argument("--dry-run", action="store_true", help="Show what would be downloaded.")
        parser.add_argument("--limit", type=int, default=0, help="Max number of rows to process (0 = no limit).")

    def handle(self, *args, **options):
        supabase_url = (options["supabase_url"] or "").rstrip("/")
        supabase_key = options["supabase_key"]
        bucket = options["bucket"]
        target_household_id = options["target_household_id"]
        overwrite = options["overwrite"]
        dry_run = options["dry_run"]
        limit = options["limit"]

        if not supabase_url:
            raise CommandError("Missing --supabase-url (or SUPABASE_URL).")
        if not supabase_key:
            raise CommandError("Missing --supabase-key (or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY).")
        if not bucket:
            raise CommandError("Missing --bucket.")

        types = self._parse_types(options["types"])

        queryset = Document.objects.exclude(file_path="")
        if target_household_id:
            queryset = queryset.filter(household_id=target_household_id)
        if types is not None:
            queryset = queryset.filter(type__in=types)
        queryset = queryset.order_by("created_at", "id")
        if limit and limit > 0:
            queryset = queryset[:limit]

        media_root = Path(settings.MEDIA_ROOT)
        counters = DownloadCounters()
        self.stdout.write(self.style.NOTICE(f"Scanning {queryset.count()} documents to download from bucket '{bucket}'..."))

        for doc in queryset:
            normalized = self._normalize_file_path(doc.file_path)
            if not normalized:
                counters.skipped += 1
                continue

            local_path = media_root / normalized
            if local_path.exists() and not overwrite:
                counters.skipped += 1
                continue

            if dry_run:
                counters.downloaded += 1
                continue

            try:
                content = self._download_object(
                    supabase_url=supabase_url,
                    supabase_key=supabase_key,
                    bucket=bucket,
                    object_path=normalized,
                )
            except HTTPError as exc:
                if exc.code == 404:
                    counters.missing += 1
                    continue
                counters.failed += 1
                self.stdout.write(self.style.ERROR(f"HTTP {exc.code} for {normalized}: {exc.reason}"))
                continue
            except URLError as exc:
                counters.failed += 1
                self.stdout.write(self.style.ERROR(f"Network error for {normalized}: {exc.reason}"))
                continue
            except Exception as exc:  # pragma: no cover
                counters.failed += 1
                self.stdout.write(self.style.ERROR(f"Unexpected error for {normalized}: {exc}"))
                continue

            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(content)
            counters.downloaded += 1

        self.stdout.write(
            self.style.SUCCESS(
                "download summary: "
                f"downloaded={counters.downloaded}, "
                f"skipped={counters.skipped}, "
                f"missing={counters.missing}, "
                f"failed={counters.failed}"
            )
        )

    def _parse_types(self, raw: str) -> list[str] | None:
        value = (raw or "").strip()
        if value == "*":
            return None
        types = [item.strip() for item in value.split(",") if item.strip()]
        if not types:
            return ["photo", "document"]
        return types

    def _normalize_file_path(self, file_path: str) -> str | None:
        if not file_path:
            return None

        raw = file_path.strip().lstrip("/")
        if not raw:
            return None

        path = PurePosixPath(raw)
        if path.is_absolute() or ".." in path.parts:
            return None

        return path.as_posix()

    def _download_object(self, supabase_url: str, supabase_key: str, bucket: str, object_path: str) -> bytes:
        encoded_path = "/".join(quote(part, safe="") for part in object_path.split("/"))
        encoded_bucket = quote(bucket, safe="")
        url = f"{supabase_url}/storage/v1/object/{encoded_bucket}/{encoded_path}"

        request = Request(
            url,
            headers={
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
            },
            method="GET",
        )

        with urlopen(request, timeout=30) as response:
            return response.read()
