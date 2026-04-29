"""Tests for upload-time image normalization."""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from documents.image_processing import (
    JPEG_QUALITY,
    MAX_DIMENSION,
    normalize_image,
)


def _jpeg_bytes(width: int, height: int, color: str = "red") -> bytes:
    image = Image.new("RGB", (width, height), color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY)
    return buffer.getvalue()


def _png_bytes(width: int, height: int, color: str = "blue") -> bytes:
    image = Image.new("RGB", (width, height), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _file(name: str, content: bytes, content_type: str) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content, content_type=content_type)


class TestNormalizeImage:
    def test_small_jpeg_is_passed_through(self):
        original = _jpeg_bytes(400, 300)
        upload = _file("photo.jpg", original, "image/jpeg")

        out, mime, info = normalize_image(upload, "image/jpeg")

        assert out is upload
        assert mime == "image/jpeg"
        assert info["transcoded"] is False
        assert info["resized"] is False

    def test_large_jpeg_is_resized_and_re_encoded(self):
        original = _jpeg_bytes(MAX_DIMENSION + 800, MAX_DIMENSION + 800)
        upload = _file("big.jpg", original, "image/jpeg")

        out, mime, info = normalize_image(upload, "image/jpeg")

        assert out is not upload
        assert mime == "image/jpeg"
        assert info["resized"] is True
        assert info["transcoded"] is True
        out.seek(0)
        with Image.open(io.BytesIO(out.read())) as result:
            assert max(result.size) == MAX_DIMENSION
        assert out.name.endswith(".jpg")

    def test_pdf_is_passed_through(self):
        original = b"%PDF-1.4 fake"
        upload = _file("file.pdf", original, "application/pdf")

        out, mime, info = normalize_image(upload, "application/pdf")

        assert out is upload
        assert mime == "application/pdf"
        assert info["transcoded"] is False

    def test_heic_branch_transcodes_to_jpeg(self, monkeypatch):
        """HEIC content is transcoded — exercised via a stubbed ``Image.open``."""
        sentinel_image = Image.new("RGB", (300, 200), "green")

        class _StubOpenContext:
            def __enter__(self_inner):
                return sentinel_image

            def __exit__(self_inner, *a):
                return False

        def fake_open(_file):
            return _StubOpenContext()

        monkeypatch.setattr("documents.image_processing.Image.open", fake_open)
        monkeypatch.setattr(
            "documents.image_processing.ImageOps.exif_transpose",
            lambda image: image,
        )

        upload = _file("photo.heic", b"\x00" * 32, "image/heic")
        out, mime, info = normalize_image(upload, "image/heic")

        assert mime == "image/jpeg"
        assert info["transcoded"] is True
        assert out.name.endswith(".jpg")
        out.seek(0)
        payload = out.read()
        assert payload.startswith(b"\xff\xd8\xff")  # JPEG SOI

    def test_corrupt_image_falls_back_to_passthrough(self):
        upload = _file("broken.jpg", b"not really a jpeg", "image/jpeg")

        out, mime, info = normalize_image(upload, "image/jpeg")

        assert out is upload
        assert mime == "image/jpeg"
        assert info["transcoded"] is False

    def test_png_under_threshold_is_passed_through(self):
        upload = _file("logo.png", _png_bytes(800, 600), "image/png")

        out, mime, info = normalize_image(upload, "image/png")

        assert out is upload
        assert mime == "image/png"
