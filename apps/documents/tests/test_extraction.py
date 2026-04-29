"""Tests for document text extraction (Vision + pypdf), with the SDK mocked."""
from __future__ import annotations

import io
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from django.core.files.storage import default_storage
from PIL import Image
from pypdf import PdfWriter

from documents import extraction
from documents.models import Document


def _save(path: str, content: bytes) -> str:
    if default_storage.exists(path):
        default_storage.delete(path)
    return default_storage.save(path, io.BytesIO(content))


def _make_jpeg_bytes() -> bytes:
    image = Image.new("RGB", (10, 10), "red")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def _make_pdf_bytes() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


@pytest.fixture(autouse=True)
def _isolated_media(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    yield


@pytest.mark.django_db
class TestExtractText:
    def _make_document(self, household, owner, *, file_path: str, mime: str) -> Document:
        return Document.objects.create(
            household=household,
            created_by=owner,
            file_path=file_path,
            name="doc",
            mime_type=mime,
            type="document",
        )

    def test_returns_skipped_when_file_missing(self, household, owner):
        document = self._make_document(household, owner, file_path="missing.pdf", mime="application/pdf")

        text, method = extraction.extract_text(document)

        assert text == ""
        assert method == "skipped"

    def test_image_uses_vision_haiku(self, monkeypatch, household, owner):
        path = _save("docs/test.jpg", _make_jpeg_bytes())
        document = self._make_document(household, owner, file_path=path, mime="image/jpeg")

        fake_block = SimpleNamespace(text="Hello from receipt")
        fake_message = SimpleNamespace(content=[fake_block])
        fake_client = MagicMock()
        fake_client.messages.create.return_value = fake_message
        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: fake_client)

        text, method = extraction.extract_text(document)

        assert text == "Hello from receipt"
        assert method == "vision_haiku"
        fake_client.messages.create.assert_called_once()

    def test_image_returns_skipped_when_client_unavailable(self, monkeypatch, household, owner):
        path = _save("docs/test.jpg", _make_jpeg_bytes())
        document = self._make_document(household, owner, file_path=path, mime="image/jpeg")

        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: None)

        text, method = extraction.extract_text(document)

        assert text == ""
        assert method == "skipped"

    def test_image_failure_in_sdk_returns_skipped(self, monkeypatch, household, owner):
        path = _save("docs/test.jpg", _make_jpeg_bytes())
        document = self._make_document(household, owner, file_path=path, mime="image/jpeg")

        fake_client = MagicMock()
        fake_client.messages.create.side_effect = RuntimeError("boom")
        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: fake_client)

        text, method = extraction.extract_text(document)

        assert text == ""
        assert method == "skipped"

    def test_pdf_returns_skipped_for_blank_pages(self, monkeypatch, household, owner):
        path = _save("docs/blank.pdf", _make_pdf_bytes())
        document = self._make_document(household, owner, file_path=path, mime="application/pdf")
        # No anthropic call for PDFs — guard anyway.
        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: None)

        text, method = extraction.extract_text(document)

        assert text == ""
        assert method == "skipped"

    def test_pdf_extraction_uses_pypdf(self, monkeypatch, household, owner):
        path = _save("docs/text.pdf", _make_pdf_bytes())
        document = self._make_document(household, owner, file_path=path, mime="application/pdf")

        fake_page = MagicMock()
        fake_page.extract_text.return_value = "Some PDF body"
        fake_reader = MagicMock()
        fake_reader.pages = [fake_page]

        class _Reader:
            def __init__(self, _):
                self.pages = fake_reader.pages

        monkeypatch.setattr("pypdf.PdfReader", _Reader)

        text, method = extraction.extract_text(document)

        assert text == "Some PDF body"
        assert method == "pypdf"

    def test_unsupported_mime_returns_skipped(self, household, owner):
        path = _save("docs/file.txt", b"plain text")
        document = self._make_document(household, owner, file_path=path, mime="text/plain")

        text, method = extraction.extract_text(document)

        assert text == ""
        assert method == "skipped"


@pytest.fixture
def owner(db):
    from accounts.tests.factories import UserFactory

    return UserFactory(email="extraction-owner@example.com")


@pytest.fixture
def household(db, owner):
    from households.models import Household, HouseholdMember

    instance = Household.objects.create(name="Extraction House")
    HouseholdMember.objects.create(user=owner, household=instance, role=HouseholdMember.Role.OWNER)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance
