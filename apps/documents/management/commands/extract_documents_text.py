"""Backfill text extraction (OCR / pypdf) on existing documents.

By default photos (Document.type == 'photo') are excluded — consistent with
the upload pipeline (#88) which also skips OCR on photos. Use --include-photos
to opt in, or --type photo to backfill only photos explicitly.

Usage:

    python manage.py extract_documents_text                       # all non-photo docs
    python manage.py extract_documents_text --household <uuid>    # scope to one household
    python manage.py extract_documents_text --type invoice        # filter by Document.type
    python manage.py extract_documents_text --limit 10            # cap batch size
    python manage.py extract_documents_text --force               # re-extract docs that already have text
    python manage.py extract_documents_text --include-photos      # also process type='photo'
    python manage.py extract_documents_text --dry-run             # list what would be processed, change nothing
"""
from __future__ import annotations

import logging

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from documents.extraction import extract_text
from documents.models import Document


logger = logging.getLogger(__name__)


VISION_COST_PER_IMAGE_USD = 0.003


class Command(BaseCommand):
    help = "Backfill ocr_text for documents that haven't been processed yet."

    def add_arguments(self, parser):
        parser.add_argument(
            "--household",
            help="Only process documents of the given household id (UUID).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-extract even when ocr_text is already populated.",
        )
        parser.add_argument(
            "--type",
            dest="doc_type",
            help="Filter by Document.type (invoice, manual, photo, ...).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="Maximum number of documents to process.",
        )
        parser.add_argument(
            "--include-photos",
            action="store_true",
            help="Also process documents with type='photo' (excluded by default).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List candidates without writing to the database.",
        )

    def handle(self, *args, **options):
        household_id = options.get("household")
        force: bool = options["force"]
        doc_type: str | None = options.get("doc_type")
        limit: int | None = options.get("limit")
        include_photos: bool = options["include_photos"]
        dry_run: bool = options["dry_run"]

        if limit is not None and limit <= 0:
            raise CommandError("--limit must be a positive integer.")

        candidates = Document.objects.exclude(file_path="").order_by("created_at")
        if household_id:
            candidates = candidates.filter(household_id=household_id)
        if doc_type:
            candidates = candidates.filter(type=doc_type)
        elif not include_photos:
            candidates = candidates.exclude(type="photo")

        already_processed = candidates.exclude(ocr_text="").count() if not force else 0
        if not force:
            candidates = candidates.filter(ocr_text="")
        if limit is not None:
            candidates = candidates[:limit]

        total = candidates.count()
        self.stdout.write(f"Documents to process: {total} (skipped already-extracted: {already_processed})")
        if total == 0:
            return

        extracted = 0
        failed = 0
        vision_attempts = 0

        for index, document in enumerate(candidates.iterator(), start=1):
            prefix = f"[{index}/{total}]"

            if dry_run:
                self.stdout.write(
                    f"  {prefix} would process {document.id} ({document.mime_type or 'unknown'})"
                )
                continue

            try:
                text, method = extract_text(document)
            except Exception as exc:
                logger.warning("extract_documents_text: %s raised: %s", document.pk, exc)
                text, method = "", "skipped"

            metadata = dict(document.metadata or {})
            metadata["ocr_extracted_at"] = timezone.now().isoformat()
            metadata["ocr_method"] = method
            document.ocr_text = text or ""
            document.metadata = metadata
            document.save(update_fields=["ocr_text", "metadata", "updated_at"])

            if method in ("vision_haiku", "vision_empty"):
                vision_attempts += 1

            if text:
                extracted += 1
                self.stdout.write(
                    f"  {prefix} ✓ {document.id} via {method} ({len(text)} chars)"
                )
            else:
                failed += 1
                self.stderr.write(
                    f"  {prefix} ✗ {document.id} no text via {method} ({document.mime_type or 'unknown'})"
                )

        cost_estimate = vision_attempts * VISION_COST_PER_IMAGE_USD
        if dry_run:
            summary = f"Dry-run complete. would_process={total}"
        else:
            summary = (
                f"Done. extracted={extracted} failed={failed} "
                f"skipped={already_processed} vision_attempts={vision_attempts} "
                f"estimated_cost_usd={cost_estimate:.3f}"
            )

        self.stdout.write(self.style.SUCCESS(summary))
