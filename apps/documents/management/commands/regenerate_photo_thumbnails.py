"""Back-fill thumbnails for existing photo documents.

Usage:

    python manage.py regenerate_photo_thumbnails
    python manage.py regenerate_photo_thumbnails --force         # rebuild even if up-to-date
    python manage.py regenerate_photo_thumbnails --household <uuid>
"""
from django.core.management.base import BaseCommand

from documents.models import Document
from documents.thumbnails import (
    THUMBNAIL_SIZES,
    generate_thumbnails,
    thumbnail_exists,
)


class Command(BaseCommand):
    help = "Regenerate thumbnail images for all (or selected) photo documents."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Regenerate even if every thumbnail size already exists.",
        )
        parser.add_argument(
            "--household",
            help="Only process documents of the given household id.",
        )

    def handle(self, *args, **options):
        force: bool = options["force"]
        household_id = options.get("household")

        qs = Document.objects.filter(type="photo").exclude(file_path="")
        if household_id:
            qs = qs.filter(household_id=household_id)

        total = qs.count()
        self.stdout.write(f"Photos to inspect: {total}")

        processed = 0
        skipped = 0
        failed = 0

        for document in qs.iterator():
            if not force and all(
                thumbnail_exists(document.file_path, size)
                for size in THUMBNAIL_SIZES
            ):
                skipped += 1
                continue

            generated = generate_thumbnails(document)
            if generated:
                processed += 1
                self.stdout.write(
                    f"  ✓ {document.id} → {', '.join(sorted(generated))}"
                )
            else:
                failed += 1
                self.stderr.write(
                    f"  ✗ {document.id} ({document.file_path}) — no thumbnails generated"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. processed={processed} skipped={skipped} failed={failed}"
            )
        )
