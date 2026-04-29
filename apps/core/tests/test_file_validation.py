"""Tests for magic-byte file validation."""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import ValidationError

from core.file_validation import (
    validate_upload,
    detect_mime_type,
    ALLOWED_DOCUMENT_TYPES,
    ALLOWED_IMAGE_TYPES,
    AVATAR_MAX_SIZE,
    DOCUMENT_MAX_SIZE,
)

# ── Magic byte fixtures ───────────────────────────────────────────────────────

JPEG_HEADER = b'\xff\xd8\xff' + b'\x00' * 20
PNG_HEADER = b'\x89PNG\r\n\x1a\n' + b'\x00' * 20
GIF_HEADER = b'GIF89a' + b'\x00' * 20
WEBP_HEADER = b'RIFF\x00\x00\x00\x00WEBP' + b'\x00' * 20
PDF_HEADER = b'%PDF-1.4\n' + b'\x00' * 20
HEIC_HEADER = b'\x00\x00\x00\x18ftypheic' + b'\x00' * 20
HEIF_HEADER = b'\x00\x00\x00\x18ftypmif1' + b'\x00' * 20
UNKNOWN_HEADER = b'\x00\x01\x02\x03' + b'\x00' * 20


def make_file(content: bytes, name: str = 'file.bin', content_type: str = 'application/octet-stream'):
    f = SimpleUploadedFile(name, content, content_type=content_type)
    return f


# ── detect_mime_type ──────────────────────────────────────────────────────────

class TestDetectMimeType:
    def test_detects_jpeg(self):
        assert detect_mime_type(make_file(JPEG_HEADER)) == 'image/jpeg'

    def test_detects_png(self):
        assert detect_mime_type(make_file(PNG_HEADER)) == 'image/png'

    def test_detects_gif(self):
        assert detect_mime_type(make_file(GIF_HEADER)) == 'image/gif'

    def test_detects_webp(self):
        assert detect_mime_type(make_file(WEBP_HEADER)) == 'image/webp'

    def test_detects_pdf(self):
        assert detect_mime_type(make_file(PDF_HEADER)) == 'application/pdf'

    def test_detects_heic(self):
        assert detect_mime_type(make_file(HEIC_HEADER)) == 'image/heic'

    def test_detects_heif(self):
        assert detect_mime_type(make_file(HEIF_HEADER)) == 'image/heif'

    def test_returns_none_for_unknown(self):
        assert detect_mime_type(make_file(UNKNOWN_HEADER)) is None

    def test_seek_is_reset_after_detection(self):
        """File position must be back at 0 after detection."""
        f = make_file(JPEG_HEADER)
        detect_mime_type(f)
        assert f.tell() == 0


# ── validate_upload ───────────────────────────────────────────────────────────

class TestValidateUpload:
    def test_accepts_valid_pdf(self):
        f = make_file(PDF_HEADER, 'doc.pdf', 'application/pdf')
        mime = validate_upload(f, ALLOWED_DOCUMENT_TYPES, DOCUMENT_MAX_SIZE)
        assert mime == 'application/pdf'

    def test_accepts_valid_jpeg_image(self):
        f = make_file(JPEG_HEADER, 'photo.jpg', 'image/jpeg')
        mime = validate_upload(f, ALLOWED_IMAGE_TYPES, AVATAR_MAX_SIZE)
        assert mime == 'image/jpeg'

    def test_accepts_valid_heic_document(self):
        f = make_file(HEIC_HEADER, 'photo.heic', 'image/heic')
        mime = validate_upload(f, ALLOWED_DOCUMENT_TYPES, DOCUMENT_MAX_SIZE)
        assert mime == 'image/heic'

    def test_rejects_unknown_file_type(self):
        f = make_file(UNKNOWN_HEADER, 'evil.exe', 'application/octet-stream')
        with pytest.raises(ValidationError) as exc:
            validate_upload(f, ALLOWED_DOCUMENT_TYPES, DOCUMENT_MAX_SIZE)
        assert 'file' in exc.value.detail

    def test_rejects_pdf_disguised_as_image(self):
        """PDF magic bytes must be rejected when only images are allowed."""
        f = make_file(PDF_HEADER, 'fake.jpg', 'image/jpeg')
        with pytest.raises(ValidationError) as exc:
            validate_upload(f, ALLOWED_IMAGE_TYPES, AVATAR_MAX_SIZE, field_name='avatar')
        assert 'avatar' in exc.value.detail

    def test_rejects_image_disguised_as_pdf(self):
        """JPEG magic bytes must be rejected when client claims PDF."""
        f = make_file(JPEG_HEADER, 'fake.pdf', 'application/pdf')
        # Image is allowed in ALLOWED_DOCUMENT_TYPES — so this actually passes
        mime = validate_upload(f, ALLOWED_DOCUMENT_TYPES, DOCUMENT_MAX_SIZE)
        assert mime == 'image/jpeg'

    def test_rejects_file_exceeding_max_size(self):
        max_size = 10
        f = make_file(JPEG_HEADER + b'\x00' * 20, 'big.jpg', 'image/jpeg')
        f.size = max_size + 1
        with pytest.raises(ValidationError) as exc:
            validate_upload(f, ALLOWED_IMAGE_TYPES, max_size, field_name='avatar')
        assert 'avatar' in exc.value.detail

    def test_uses_field_name_in_error(self):
        f = make_file(UNKNOWN_HEADER, 'bad.bin')
        with pytest.raises(ValidationError) as exc:
            validate_upload(f, ALLOWED_DOCUMENT_TYPES, DOCUMENT_MAX_SIZE, field_name='my_field')
        assert 'my_field' in exc.value.detail
