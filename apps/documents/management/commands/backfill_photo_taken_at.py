"""Back-fill `Document.taken_at` en relisant l'EXIF des fichiers déjà stockés.

Usage :

    python manage.py backfill_photo_taken_at
    python manage.py backfill_photo_taken_at --dry-run
    python manage.py backfill_photo_taken_at --household <uuid>
    python manage.py backfill_photo_taken_at --force     # relit aussi les photos déjà datées

## Ce que cette command ne peut PAS faire, et pourquoi elle le dit

`normalize_image` ré-encode en JPEG sans transmettre l'EXIF : pour tout HEIC/HEIF et
pour toute image qui dépassait `MAX_DIMENSION` à l'upload, la date de prise de vue a
été **détruite au moment de l'import**. Elle n'est donc pas dans le fichier stocké, et
aucun back-fill ne la retrouvera — il faudrait ré-uploader l'original.

D'où le rapport final : la command annonce combien de photos restent sans date. Un
back-fill qui se contente de dire « 43 mises à jour » laisserait croire que la galerie
est désormais triable de bout en bout, alors qu'une partie continuera de se ranger à sa
date d'ajout. Un compteur muet sur ce qu'il n'a pas fait est le même piège qu'une coche
verte sur un contrôle qui n'a rien pu vérifier.
"""
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from documents.exif import read_taken_at
from documents.models import Document


class Command(BaseCommand):
    help = "Read the EXIF capture date of stored photos into Document.taken_at."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing anything.",
        )
        parser.add_argument(
            "--household",
            help="Only process documents of the given household id.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-read photos that already have a taken_at.",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]
        force: bool = options["force"]
        household_id = options.get("household")

        qs = Document.objects.filter(type="photo").exclude(file_path="")
        if household_id:
            qs = qs.filter(household_id=household_id)
        if not force:
            qs = qs.filter(taken_at__isnull=True)
        qs = qs.select_related("household").order_by("created_at")

        total = qs.count()
        if total == 0:
            self.stdout.write("Aucune photo à traiter.")
            return

        filled = 0
        unchanged = 0
        missing_file = 0
        no_exif = 0

        for document in qs.iterator(chunk_size=200):
            if not default_storage.exists(document.file_path):
                missing_file += 1
                continue

            try:
                with default_storage.open(document.file_path, "rb") as handle:
                    taken_at = read_taken_at(handle, household=document.household)
            except Exception as exc:  # noqa: BLE001 — un fichier illisible ne stoppe pas le lot
                self.stderr.write(f"  ! {document.id}: {exc}")
                missing_file += 1
                continue

            if taken_at is None:
                no_exif += 1
                continue

            if document.taken_at == taken_at:
                unchanged += 1
                continue

            filled += 1
            if not dry_run:
                document.taken_at = taken_at
                document.save(update_fields=["taken_at", "updated_at"])

        prefix = "[dry-run] " if dry_run else ""
        self.stdout.write(f"{prefix}{total} photo(s) examinée(s)")
        self.stdout.write(self.style.SUCCESS(f"{prefix}  {filled} datée(s) depuis l'EXIF"))
        if unchanged:
            self.stdout.write(f"{prefix}  {unchanged} déjà à jour")
        if missing_file:
            self.stdout.write(self.style.WARNING(f"{prefix}  {missing_file} fichier(s) illisible(s)"))

        # Le chiffre qui compte vraiment : ce que la galerie continuera de ranger à sa
        # date d'ajout, faute de mieux.
        if no_exif:
            self.stdout.write(
                self.style.WARNING(
                    f"{prefix}  {no_exif} sans date de prise de vue récupérable "
                    "— EXIF absent, ou détruit au ré-encodage de l'upload. "
                    "Ces photos resteront triées à leur date d'ajout."
                )
            )
