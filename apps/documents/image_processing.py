"""
Upload-time image normalization for documents.

Two responsibilities:
- HEIC / HEIF → JPEG (transcoded so downstream tooling, browsers and Vision
  models can read it without depending on pillow-heif everywhere)
- resize images whose longest edge exceeds ``MAX_DIMENSION`` to keep storage
  and Vision token cost bounded

Standard formats below the size threshold are returned unchanged: re-encoding
a JPEG just to "normalize" would grow it and lose quality.

The function is fail-soft: any unexpected error returns the original file. An
upload must never be lost because of normalization.
"""
from __future__ import annotations

import io
import logging
from pathlib import PurePosixPath

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

MAX_DIMENSION = 2000
JPEG_QUALITY = 85
HEIF_MIME_TYPES = {"image/heic", "image/heif"}
TRANSCODABLE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
} | HEIF_MIME_TYPES


def _replace_extension(filename: str, new_ext: str) -> str:
    """Swap the extension of ``filename`` for ``new_ext`` (without leading dot)."""
    name = PurePosixPath(filename or "image").name
    stem = PurePosixPath(name).stem or "image"
    return f"{stem}.{new_ext}"


def normalize_image(uploaded_file, mime_type: str) -> tuple[object, str, dict]:
    """Return a possibly-rewritten file together with its final mime type.

    The returned file is either ``uploaded_file`` itself (passthrough) or a
    fresh ``ContentFile`` with a sensible ``name``. The third element is a
    diagnostic dict describing what happened — useful for tests and metadata.
    """
    info: dict = {
        "original_mime_type": mime_type,
        "transcoded": False,
        "resized": False,
    }

    if mime_type not in TRANSCODABLE_MIME_TYPES:
        return uploaded_file, mime_type, info

    try:
        uploaded_file.seek(0)
        with Image.open(uploaded_file) as raw:
            raw.load()
            image = ImageOps.exif_transpose(raw) or raw
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.info("normalize_image: cannot decode (%s): %s", mime_type, exc)
        try:
            uploaded_file.seek(0)
        except (OSError, ValueError):
            pass
        return uploaded_file, mime_type, info

    is_heif = mime_type in HEIF_MIME_TYPES
    longest = max(image.size)
    needs_resize = longest > MAX_DIMENSION

    if not is_heif and not needs_resize:
        try:
            uploaded_file.seek(0)
        except (OSError, ValueError):
            pass
        return uploaded_file, mime_type, info

    if needs_resize:
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
        info["resized"] = True

    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    buffer.seek(0)

    original_name = getattr(uploaded_file, "name", "image")
    new_name = _replace_extension(original_name, "jpg")
    new_file = ContentFile(buffer.getvalue(), name=new_name)

    info["transcoded"] = True
    info["final_mime_type"] = "image/jpeg"
    info["final_dimensions"] = list(image.size)
    return new_file, "image/jpeg", info


__all__ = ["normalize_image", "MAX_DIMENSION", "JPEG_QUALITY"]
