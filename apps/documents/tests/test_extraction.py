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

    def test_image_returns_vision_empty_when_client_unavailable(self, monkeypatch, household, owner):
        path = _save("docs/test.jpg", _make_jpeg_bytes())
        document = self._make_document(household, owner, file_path=path, mime="image/jpeg")

        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: None)

        text, method = extraction.extract_text(document)

        assert text == ""
        assert method == "vision_empty"

    def test_image_failure_in_sdk_returns_vision_empty(self, monkeypatch, household, owner):
        path = _save("docs/test.jpg", _make_jpeg_bytes())
        document = self._make_document(household, owner, file_path=path, mime="image/jpeg")

        fake_client = MagicMock()
        fake_client.messages.create.side_effect = RuntimeError("boom")
        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: fake_client)

        text, method = extraction.extract_text(document)

        assert text == ""
        assert method == "vision_empty"

    def test_image_with_no_text_returns_vision_empty(self, monkeypatch, household, owner):
        path = _save("docs/test.jpg", _make_jpeg_bytes())
        document = self._make_document(household, owner, file_path=path, mime="image/jpeg")

        fake_block = SimpleNamespace(text="")
        fake_message = SimpleNamespace(content=[fake_block])
        fake_client = MagicMock()
        fake_client.messages.create.return_value = fake_message
        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: fake_client)

        text, method = extraction.extract_text(document)

        assert text == ""
        assert method == "vision_empty"
        # Vision was actually called — that's the whole point of this state.
        fake_client.messages.create.assert_called_once()

    def test_pdf_with_empty_pypdf_returns_pdf_vision_empty_when_no_client(self, monkeypatch, household, owner):
        """Blank PDF: pypdf returns empty, Vision fallback can't run (no client) → pdf_vision_empty."""
        path = _save("docs/blank.pdf", _make_pdf_bytes())
        document = self._make_document(household, owner, file_path=path, mime="application/pdf")
        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: None)

        text, method = extraction.extract_text(document)

        assert text == ""
        assert method == "pdf_vision_empty"

    def test_scanned_pdf_falls_back_to_vision_per_page(self, monkeypatch, household, owner):
        """pypdf returns empty (image-only PDF). Vision OCR-s each page."""
        path = _save("docs/scanned.pdf", _make_pdf_bytes())
        document = self._make_document(household, owner, file_path=path, mime="application/pdf")

        monkeypatch.setattr(extraction, "_extract_with_pypdf", lambda _b: "")
        monkeypatch.setattr(extraction, "_extract_pdf_with_vision", lambda _b: "Page 1 text\n\nPage 2 text")

        text, method = extraction.extract_text(document)

        assert text == "Page 1 text\n\nPage 2 text"
        assert method == "pdf_vision_haiku"

    def test_scanned_pdf_renders_pages_via_pypdfium(self, monkeypatch, household, owner):
        """End-to-end: real pypdfium rendering + mocked Vision client returning text per call."""
        path = _save("docs/scanned-real.pdf", _make_pdf_bytes())
        document = self._make_document(household, owner, file_path=path, mime="application/pdf")

        monkeypatch.setattr(extraction, "_extract_with_pypdf", lambda _b: "")

        call_count = {"n": 0}

        def fake_vision(_bytes, _media):
            call_count["n"] += 1
            return f"Page {call_count['n']}"

        monkeypatch.setattr(extraction, "_extract_with_vision", fake_vision)
        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: object())

        text, method = extraction.extract_text(document)

        assert method == "pdf_vision_haiku"
        assert "Page 1" in text

    def test_scanned_pdf_keeps_partial_text_when_some_pages_fail(self, monkeypatch, household, owner):
        """If Vision raises on one page, other pages' text is still kept."""
        from pypdf import PdfWriter

        writer = PdfWriter()
        writer.add_blank_page(width=72, height=72)
        writer.add_blank_page(width=72, height=72)
        buffer = io.BytesIO()
        writer.write(buffer)
        path = _save("docs/partial.pdf", buffer.getvalue())
        document = self._make_document(household, owner, file_path=path, mime="application/pdf")

        monkeypatch.setattr(extraction, "_extract_with_pypdf", lambda _b: "")
        monkeypatch.setattr(extraction, "_get_anthropic_client", lambda: object())

        call = {"n": 0}

        def flaky_vision(_b, _m):
            call["n"] += 1
            if call["n"] == 1:
                raise RuntimeError("page 1 boom")
            return "page 2 ok"

        monkeypatch.setattr(extraction, "_extract_with_vision", flaky_vision)

        text, method = extraction.extract_text(document)

        assert "page 2 ok" in text
        assert method == "pdf_vision_haiku"

    def test_pypdf_text_pdfs_skip_vision_fallback(self, monkeypatch, household, owner):
        """Text-based PDFs: pypdf works, Vision is never called."""
        path = _save("docs/text.pdf", _make_pdf_bytes())
        document = self._make_document(household, owner, file_path=path, mime="application/pdf")

        monkeypatch.setattr(extraction, "_extract_with_pypdf", lambda _b: "I am text from pypdf")

        def must_not_run(_b, _m):
            raise AssertionError("Vision should not run when pypdf returns text")

        monkeypatch.setattr(extraction, "_extract_with_vision", must_not_run)

        text, method = extraction.extract_text(document)

        assert text == "I am text from pypdf"
        assert method == "pypdf"

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
