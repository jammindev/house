"""Tests for thumbnail generation, serialization, cleanup and back-fill."""
import io
import shutil
import tempfile
from io import StringIO

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import override_settings
from PIL import Image
from rest_framework.test import APIRequestFactory

from accounts.tests.factories import UserFactory
from documents.models import Document
from documents.serializers import DocumentSerializer
from documents.thumbnails import (
    THUMBNAIL_SIZES,
    delete_thumbnails,
    generate_thumbnails,
    thumbnail_storage_path,
)
from households.models import Household, HouseholdMember


@pytest.fixture
def media_root():
    path = tempfile.mkdtemp(prefix="house-thumbs-")
    with override_settings(MEDIA_ROOT=path):
        yield path
    shutil.rmtree(path, ignore_errors=True)


@pytest.fixture
def household(db):
    return Household.objects.create(name="Thumb House")


@pytest.fixture
def owner(db, household):
    user = UserFactory(email="thumb-owner@example.com")
    HouseholdMember.objects.create(user=user, household=household, role=HouseholdMember.Role.OWNER)
    return user


def _jpeg_bytes(width: int = 1600, height: int = 1200, color=(255, 0, 0)) -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _save_photo(household, owner, *, file_path="documents/test/2026/04/photo.jpg", payload=None):
    payload = payload if payload is not None else _jpeg_bytes()
    saved_path = default_storage.save(file_path, ContentFile(payload))
    return Document.objects.create(
        household=household,
        created_by=owner,
        file_path=saved_path,
        name="Photo",
        mime_type="image/jpeg",
        type="photo",
    )


@pytest.mark.django_db
class TestGenerateThumbnails:
    def test_generates_thumb_and_medium_at_expected_paths(self, media_root, owner, household):
        document = _save_photo(household, owner)

        generated = generate_thumbnails(document)

        assert set(generated.keys()) == {"thumb", "medium"}
        for size in ("thumb", "medium"):
            path = thumbnail_storage_path(document.file_path, size)
            assert default_storage.exists(path)

        # thumb is square 400×400 (crop)
        with default_storage.open(thumbnail_storage_path(document.file_path, "thumb"), "rb") as fh:
            with Image.open(fh) as img:
                assert img.size == (400, 400)

        # medium fits within 1200×1200, aspect preserved (1600×1200 → 1200×900)
        with default_storage.open(thumbnail_storage_path(document.file_path, "medium"), "rb") as fh:
            with Image.open(fh) as img:
                assert img.size == (1200, 900)
                assert img.format == "JPEG"

    def test_returns_empty_dict_for_non_image(self, media_root, owner, household):
        document = _save_photo(
            household,
            owner,
            file_path="documents/test/2026/04/note.pdf",
            payload=b"%PDF-1.4 not really a pdf but not an image",
        )

        assert generate_thumbnails(document) == {}

    def test_returns_empty_dict_when_original_missing(self, media_root, owner, household):
        document = Document.objects.create(
            household=household,
            created_by=owner,
            file_path="documents/missing/photo.jpg",
            name="Missing",
            type="photo",
        )

        assert generate_thumbnails(document) == {}

    def test_idempotent_overwrites_existing(self, media_root, owner, household):
        document = _save_photo(household, owner)
        first = generate_thumbnails(document)
        second = generate_thumbnails(document)

        assert set(first.keys()) == set(second.keys()) == {"thumb", "medium"}
        for size in THUMBNAIL_SIZES:
            assert default_storage.exists(thumbnail_storage_path(document.file_path, size))


@pytest.mark.django_db
class TestDeleteThumbnails:
    def test_removes_all_sizes(self, media_root, owner, household):
        document = _save_photo(household, owner)
        generate_thumbnails(document)

        delete_thumbnails(document.file_path)

        for size in THUMBNAIL_SIZES:
            assert not default_storage.exists(thumbnail_storage_path(document.file_path, size))

    def test_silent_when_no_thumbnails(self, media_root, owner, household):
        # Should not raise even when nothing to delete
        delete_thumbnails("documents/never/created.jpg")


@pytest.mark.django_db
class TestSerializerExposesUrls:
    def test_returns_thumbnail_and_medium_when_files_exist(self, media_root, owner, household):
        document = _save_photo(household, owner)
        generate_thumbnails(document)

        request = APIRequestFactory().get("/api/documents/")
        data = DocumentSerializer(document, context={"request": request}).data

        assert data["file_url"].endswith(f"/media/{document.file_path}")
        assert data["thumbnail_url"].endswith(
            f"/media/{thumbnail_storage_path(document.file_path, 'thumb')}"
        )
        assert data["medium_url"].endswith(
            f"/media/{thumbnail_storage_path(document.file_path, 'medium')}"
        )

    def test_returns_none_when_thumbnails_missing(self, media_root, owner, household):
        document = _save_photo(household, owner)
        # do NOT generate thumbnails

        request = APIRequestFactory().get("/api/documents/")
        data = DocumentSerializer(document, context={"request": request}).data

        assert data["file_url"] is not None
        assert data["thumbnail_url"] is None
        assert data["medium_url"] is None


@pytest.mark.django_db
class TestPostDeleteSignal:
    def test_deleting_document_cleans_thumbnails(self, media_root, owner, household):
        document = _save_photo(household, owner)
        generate_thumbnails(document)
        file_path = document.file_path

        document.delete()

        assert not default_storage.exists(file_path)
        for size in THUMBNAIL_SIZES:
            assert not default_storage.exists(thumbnail_storage_path(file_path, size))


@pytest.mark.django_db
class TestRegenerateCommand:
    def test_backfills_missing_thumbnails(self, media_root, owner, household):
        document = _save_photo(household, owner)

        out = StringIO()
        call_command("regenerate_photo_thumbnails", stdout=out, stderr=StringIO())

        for size in THUMBNAIL_SIZES:
            assert default_storage.exists(thumbnail_storage_path(document.file_path, size))
        assert "processed=1" in out.getvalue()

    def test_skips_when_thumbnails_already_present(self, media_root, owner, household):
        document = _save_photo(household, owner)
        generate_thumbnails(document)

        out = StringIO()
        call_command("regenerate_photo_thumbnails", stdout=out, stderr=StringIO())

        assert "processed=0" in out.getvalue()
        assert "skipped=1" in out.getvalue()

    def test_force_rebuilds_even_when_present(self, media_root, owner, household):
        document = _save_photo(household, owner)
        generate_thumbnails(document)

        out = StringIO()
        call_command("regenerate_photo_thumbnails", "--force", stdout=out, stderr=StringIO())

        assert "processed=1" in out.getvalue()

    def test_ignores_non_photo_documents(self, media_root, owner, household):
        Document.objects.create(
            household=household,
            created_by=owner,
            file_path="documents/test/note.pdf",
            name="Note",
            mime_type="application/pdf",
            type="document",
        )

        out = StringIO()
        call_command(
            "regenerate_photo_thumbnails",
            "--household",
            str(household.id),
            stdout=out,
            stderr=StringIO(),
        )

        assert "Photos to inspect: 0" in out.getvalue()
