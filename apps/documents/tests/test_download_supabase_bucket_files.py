import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from app_settings.tests.factories import HouseholdFactory
from documents.models import Document


class _Response:
    def __init__(self, payload: bytes):
        self._payload = payload

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class DownloadSupabaseBucketFilesTests(TestCase):
    def setUp(self):
        self.target_household_id = str(uuid.uuid4())
        if not HouseholdFactory._meta.model.objects.filter(id=self.target_household_id).exists():
            HouseholdFactory(id=self.target_household_id, name="Target household")

        user_model = get_user_model()
        user_model.objects.get_or_create(
            id=1,
            defaults={
                "email": "fallback@example.com",
                "is_active": True,
            },
        )

    @patch("documents.management.commands.download_supabase_bucket_files.urlopen")
    def test_downloads_photo_and_document(self, urlopen_mock):
        Document.objects.create(
            household_id=self.target_household_id,
            file_path="hh-1/documents/a.pdf",
            name="a.pdf",
            mime_type="application/pdf",
            type="document",
            created_by_id=1,
            updated_by_id=1,
        )
        Document.objects.create(
            household_id=self.target_household_id,
            file_path="hh-1/photos/b.jpg",
            name="b.jpg",
            mime_type="image/jpeg",
            type="photo",
            created_by_id=1,
            updated_by_id=1,
        )

        urlopen_mock.side_effect = [_Response(b"PDFDATA"), _Response(b"JPGDATA")]

        with tempfile.TemporaryDirectory() as tmp_dir:
            with override_settings(MEDIA_ROOT=tmp_dir):
                call_command(
                    "download_supabase_bucket_files",
                    "--supabase-url",
                    "https://example.supabase.co",
                    "--supabase-key",
                    "service-key",
                    "--bucket",
                    "files",
                    "--target-household-id",
                    self.target_household_id,
                )

            self.assertEqual((Path(tmp_dir) / "hh-1/documents/a.pdf").read_bytes(), b"PDFDATA")
            self.assertEqual((Path(tmp_dir) / "hh-1/photos/b.jpg").read_bytes(), b"JPGDATA")

    @patch("documents.management.commands.download_supabase_bucket_files.urlopen")
    def test_skips_existing_without_overwrite(self, urlopen_mock):
        Document.objects.create(
            household_id=self.target_household_id,
            file_path="hh-1/photos/existing.jpg",
            name="existing.jpg",
            mime_type="image/jpeg",
            type="photo",
            created_by_id=1,
            updated_by_id=1,
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            existing_path = Path(tmp_dir) / "hh-1/photos/existing.jpg"
            existing_path.parent.mkdir(parents=True, exist_ok=True)
            existing_path.write_bytes(b"EXISTING")

            with override_settings(MEDIA_ROOT=tmp_dir):
                call_command(
                    "download_supabase_bucket_files",
                    "--supabase-url",
                    "https://example.supabase.co",
                    "--supabase-key",
                    "service-key",
                    "--bucket",
                    "files",
                    "--target-household-id",
                    self.target_household_id,
                )

            self.assertEqual(existing_path.read_bytes(), b"EXISTING")
            urlopen_mock.assert_not_called()
