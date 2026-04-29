"""Tests for the `extract_documents_text` management command."""
from __future__ import annotations

import io
from unittest.mock import patch

import pytest
from django.core.management import CommandError, call_command

from documents.models import Document


pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(db):
    from accounts.tests.factories import UserFactory

    return UserFactory(email="extract-cmd-owner@example.com")


@pytest.fixture
def household(db, owner):
    from households.models import Household, HouseholdMember

    instance = Household.objects.create(name="Backfill House")
    HouseholdMember.objects.create(user=owner, household=instance, role=HouseholdMember.Role.OWNER)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def other_household(db, owner):
    from households.models import Household, HouseholdMember

    instance = Household.objects.create(name="Other House")
    HouseholdMember.objects.create(user=owner, household=instance, role=HouseholdMember.Role.OWNER)
    return instance


def _make_document(household, owner, **overrides) -> Document:
    payload = {
        "household": household,
        "created_by": owner,
        "file_path": f"docs/{overrides.get('name', 'doc')}.pdf",
        "name": overrides.get("name", "doc"),
        "mime_type": overrides.get("mime_type", "application/pdf"),
        "type": overrides.get("type", "document"),
        "ocr_text": overrides.get("ocr_text", ""),
    }
    return Document.objects.create(**payload)


def _call(*args) -> tuple[str, str]:
    out, err = io.StringIO(), io.StringIO()
    call_command("extract_documents_text", *args, stdout=out, stderr=err)
    return out.getvalue(), err.getvalue()


def _scoped(household, *extra):
    return ("--household", str(household.id), *extra)


class TestExtractDocumentsTextCommand:
    def test_skips_documents_with_existing_ocr_text_by_default(self, household, owner):
        already = _make_document(household, owner, name="already", ocr_text="cached")
        empty = _make_document(household, owner, name="empty")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("Hello world", "pypdf"),
        ) as mock_extract:
            out, _ = _call(*_scoped(household))

        already.refresh_from_db()
        empty.refresh_from_db()

        assert already.ocr_text == "cached"
        assert empty.ocr_text == "Hello world"
        assert mock_extract.call_count == 1
        assert "Documents to process: 1" in out
        assert "skipped already-extracted: 1" in out
        assert "extracted=1" in out

    def test_force_reprocesses_documents_already_having_text(self, household, owner):
        document = _make_document(household, owner, name="cached", ocr_text="old text")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("fresh text", "pypdf"),
        ):
            _call(*_scoped(household, "--force"))

        document.refresh_from_db()
        assert document.ocr_text == "fresh text"
        assert document.metadata["ocr_method"] == "pypdf"
        assert "ocr_extracted_at" in document.metadata

    def test_household_filter_scopes_processing(self, household, other_household, owner):
        in_scope = _make_document(household, owner, name="in")
        out_of_scope = _make_document(other_household, owner, name="out")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("text", "pypdf"),
        ) as mock_extract:
            _call("--household", str(household.id))

        in_scope.refresh_from_db()
        out_of_scope.refresh_from_db()

        assert in_scope.ocr_text == "text"
        assert out_of_scope.ocr_text == ""
        assert mock_extract.call_count == 1

    def test_type_filter_restricts_to_given_document_type(self, household, owner):
        invoice = _make_document(household, owner, name="invoice", type="invoice")
        manual = _make_document(household, owner, name="manual", type="manual")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("text", "pypdf"),
        ) as mock_extract:
            _call(*_scoped(household, "--type", "invoice"))

        invoice.refresh_from_db()
        manual.refresh_from_db()

        assert invoice.ocr_text == "text"
        assert manual.ocr_text == ""
        assert mock_extract.call_count == 1

    def test_limit_caps_batch_size(self, household, owner):
        for i in range(5):
            _make_document(household, owner, name=f"doc{i}")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("text", "pypdf"),
        ) as mock_extract:
            _call(*_scoped(household, "--limit", "2"))

        assert mock_extract.call_count == 2
        assert Document.objects.filter(household=household).exclude(ocr_text="").count() == 2

    def test_dry_run_does_not_write_anything(self, household, owner):
        document = _make_document(household, owner, name="doc")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
        ) as mock_extract:
            out, _ = _call(*_scoped(household, "--dry-run"))

        document.refresh_from_db()
        assert document.ocr_text == ""
        assert "ocr_method" not in (document.metadata or {})
        mock_extract.assert_not_called()
        assert "would process" in out
        assert "Dry-run complete" in out

    def test_extraction_exception_is_recorded_as_failure(self, household, owner):
        good = _make_document(household, owner, name="good")
        boom = _make_document(household, owner, name="boom")

        def fake_extract(document):
            if document.name == "boom":
                raise RuntimeError("explode")
            return ("text ok", "pypdf")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            side_effect=fake_extract,
        ):
            out, err = _call(*_scoped(household))

        good.refresh_from_db()
        boom.refresh_from_db()

        assert good.ocr_text == "text ok"
        assert boom.ocr_text == ""
        assert boom.metadata["ocr_method"] == "skipped"
        assert "extracted=1" in out
        assert "failed=1" in out
        assert str(boom.id) in err

    def test_vision_attempts_appear_in_summary_with_cost(self, household, owner):
        _make_document(household, owner, name="img1", mime_type="image/jpeg")
        _make_document(household, owner, name="img2", mime_type="image/jpeg")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("text", "vision_haiku"),
        ):
            out, _ = _call(*_scoped(household))

        assert "vision_attempts=2" in out
        assert "estimated_cost_usd=0.006" in out

    def test_vision_attempts_count_empty_results_too(self, household, owner):
        """Vision API was billed even when it returned no text (the whole reason for this fix)."""
        _make_document(household, owner, name="img1", mime_type="image/jpeg")
        _make_document(household, owner, name="img2", mime_type="image/jpeg")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("", "vision_empty"),
        ):
            out, _ = _call(*_scoped(household))

        assert "vision_attempts=2" in out
        assert "estimated_cost_usd=0.006" in out
        assert "extracted=0" in out
        assert "failed=2" in out

    def test_negative_limit_raises(self, household, owner):
        with pytest.raises(CommandError):
            _call("--limit", "0")

    def test_skips_photos_by_default(self, household, owner):
        document = _make_document(household, owner, name="invoice", type="document")
        photo = _make_document(household, owner, name="souvenir", type="photo")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("text", "pypdf"),
        ) as mock_extract:
            out, _ = _call(*_scoped(household))

        document.refresh_from_db()
        photo.refresh_from_db()

        assert document.ocr_text == "text"
        assert photo.ocr_text == ""
        assert mock_extract.call_count == 1
        assert "Documents to process: 1" in out

    def test_include_photos_flag_processes_photos(self, household, owner):
        document = _make_document(household, owner, name="invoice", type="document")
        photo = _make_document(household, owner, name="souvenir", type="photo")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("text", "vision_haiku"),
        ) as mock_extract:
            _call(*_scoped(household, "--include-photos"))

        document.refresh_from_db()
        photo.refresh_from_db()

        assert document.ocr_text == "text"
        assert photo.ocr_text == "text"
        assert mock_extract.call_count == 2

    def test_explicit_type_photo_overrides_default_exclusion(self, household, owner):
        document = _make_document(household, owner, name="invoice", type="document")
        photo = _make_document(household, owner, name="souvenir", type="photo")

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("text", "vision_haiku"),
        ) as mock_extract:
            _call(*_scoped(household, "--type", "photo"))

        document.refresh_from_db()
        photo.refresh_from_db()

        assert document.ocr_text == ""
        assert photo.ocr_text == "text"
        assert mock_extract.call_count == 1

    def test_excludes_documents_without_file_path(self, household, owner):
        empty = Document.objects.create(
            household=household,
            created_by=owner,
            file_path="",
            name="no-file",
            mime_type="application/pdf",
            type="document",
        )

        with patch(
            "documents.management.commands.extract_documents_text.extract_text",
            return_value=("text", "pypdf"),
        ) as mock_extract:
            out, _ = _call(*_scoped(household))

        empty.refresh_from_db()
        assert empty.ocr_text == ""
        mock_extract.assert_not_called()
        assert "Documents to process: 0" in out
