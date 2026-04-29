"""
Thumbnail generation for photo documents.

Two fixed sizes:
- ``thumb`` : 400×400, center-cropped, for the photo grid
- ``medium`` : up to 1200×1200, aspect preserved, for the detail panel

Thumbnails are stored as JPEG next to the original at
``<original_dir>/.thumbnails/<size>/<filename>.jpg`` and read via
``default_storage`` so they work with any storage backend.
"""
from __future__ import annotations

import io
import logging
from pathlib import PurePosixPath
from typing import TYPE_CHECKING

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, ImageOps, UnidentifiedImageError

if TYPE_CHECKING:
    from documents.models import Document

logger = logging.getLogger(__name__)

THUMBNAIL_DIR = ".thumbnails"
JPEG_QUALITY = 82

# (max_width, max_height, mode)
# mode: "crop" = fill + center-crop ; "fit" = fit within bounds, preserve aspect
THUMBNAIL_SIZES: dict[str, tuple[int, int, str]] = {
    "thumb": (400, 400, "crop"),
    "medium": (1200, 1200, "fit"),
}


def thumbnail_storage_path(file_path: str, size: str) -> str:
    """Return the storage path of the thumbnail for ``size`` of ``file_path``.

    Does not check whether the file exists.
    """
    if not file_path or size not in THUMBNAIL_SIZES:
        return ""
    p = PurePosixPath(file_path)
    return str(p.parent / THUMBNAIL_DIR / size / f"{p.stem}.jpg")


def thumbnail_exists(file_path: str, size: str) -> bool:
    path = thumbnail_storage_path(file_path, size)
    return bool(path) and default_storage.exists(path)


def generate_thumbnails(document: "Document") -> dict[str, str]:
    """Generate all thumbnail sizes for ``document`` and return a dict
    ``{size: storage_path}`` of successfully generated thumbnails.

    Silently skips non-image files and missing originals. Logs but does not
    raise on individual size failures — a broken thumbnail must never block
    the surrounding workflow (upload, save, etc.).
    """
    if not document.file_path or not default_storage.exists(document.file_path):
        return {}

    try:
        with default_storage.open(document.file_path, "rb") as fh:
            source = Image.open(fh)
            source.load()
    except (UnidentifiedImageError, OSError) as exc:
        logger.info("thumbnails: not an image, skipping (%s): %s", document.file_path, exc)
        return {}

    source = ImageOps.exif_transpose(source)
    if source.mode not in ("RGB", "L"):
        source = source.convert("RGB")

    generated: dict[str, str] = {}
    for size_name, (max_w, max_h, mode) in THUMBNAIL_SIZES.items():
        try:
            thumb = _resize(source, max_w, max_h, mode)
            buf = io.BytesIO()
            thumb.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
            buf.seek(0)
            target_path = thumbnail_storage_path(document.file_path, size_name)
            if default_storage.exists(target_path):
                default_storage.delete(target_path)
            saved = default_storage.save(target_path, ContentFile(buf.read()))
            generated[size_name] = saved
        except OSError as exc:
            logger.warning(
                "thumbnails: failed to generate %s for %s: %s",
                size_name,
                document.file_path,
                exc,
            )

    return generated


def delete_thumbnails(file_path: str) -> None:
    """Best-effort cleanup of every thumbnail size for ``file_path``."""
    if not file_path:
        return
    for size_name in THUMBNAIL_SIZES:
        path = thumbnail_storage_path(file_path, size_name)
        try:
            if default_storage.exists(path):
                default_storage.delete(path)
        except OSError:
            pass


def _resize(image: Image.Image, max_w: int, max_h: int, mode: str) -> Image.Image:
    if mode == "crop":
        return ImageOps.fit(image, (max_w, max_h), method=Image.Resampling.LANCZOS)
    copy = image.copy()
    copy.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    return copy
