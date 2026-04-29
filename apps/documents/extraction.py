"""
Text extraction for uploaded documents.

Two pipelines:
- images → Claude Haiku 4.5 Vision (OCR)
- PDFs   → pypdf (text-based PDFs only — scanned PDFs are V2)

Everything is fail-soft. Returning ``("", "skipped")`` is a perfectly acceptable
outcome — the upload must never fail because text extraction did.
"""
from __future__ import annotations

import base64
import logging
from typing import TYPE_CHECKING, Tuple

from django.conf import settings
from django.core.files.storage import default_storage

if TYPE_CHECKING:
    from documents.models import Document

logger = logging.getLogger(__name__)

VISION_MODEL = "claude-haiku-4-5"
VISION_MAX_TOKENS = 4096
VISION_PROMPT = (
    "Extract all visible text from this image, preserving the original line "
    "breaks and reading order. Return only the raw text — no commentary, no "
    "labels, no markdown."
)
VISION_MEDIA_TYPES = {
    "image/jpeg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "image/gif": "image/gif",
}

ExtractionResult = Tuple[str, str]


def _get_anthropic_client():
    """Return an Anthropic client or ``None`` when no key is configured.

    Indirected so tests can patch ``apps.documents.extraction._get_anthropic_client``
    without touching the SDK or the network.
    """
    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        return None
    try:
        import anthropic
    except ImportError:
        logger.warning("extraction: anthropic SDK not installed")
        return None
    return anthropic.Anthropic(api_key=api_key)


def _extract_with_vision(file_bytes: bytes, media_type: str) -> str:
    client = _get_anthropic_client()
    if client is None:
        return ""

    encoded = base64.standard_b64encode(file_bytes).decode("ascii")
    message = client.messages.create(
        model=VISION_MODEL,
        max_tokens=VISION_MAX_TOKENS,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": encoded,
                        },
                    },
                    {"type": "text", "text": VISION_PROMPT},
                ],
            }
        ],
    )

    parts: list[str] = []
    for block in getattr(message, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
        elif isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "\n".join(p for p in parts if p).strip()


def _extract_with_pypdf(file_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        logger.warning("extraction: pypdf not installed")
        return ""

    from io import BytesIO

    reader = PdfReader(BytesIO(file_bytes))
    pages: list[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception as exc:
            logger.info("extraction: pypdf page failed: %s", exc)
    return "\n\n".join(p.strip() for p in pages if p and p.strip()).strip()


def extract_text(document: "Document") -> ExtractionResult:
    """Extract text content from a stored document.

    Returns ``(text, method)`` where ``method`` is one of:
    - ``"vision_haiku"`` : image processed by Claude Haiku Vision
    - ``"pypdf"``        : PDF text extracted by pypdf
    - ``"skipped"``      : nothing extracted (unsupported, error, or empty)
    """
    if not document.file_path:
        return "", "skipped"
    try:
        if not default_storage.exists(document.file_path):
            return "", "skipped"
    except OSError as exc:
        logger.info("extraction: storage check failed for %s: %s", document.file_path, exc)
        return "", "skipped"

    mime = (document.mime_type or "").lower()
    try:
        with default_storage.open(document.file_path, "rb") as fh:
            file_bytes = fh.read()
    except OSError as exc:
        logger.info("extraction: cannot read %s: %s", document.file_path, exc)
        return "", "skipped"

    if mime in VISION_MEDIA_TYPES:
        try:
            text = _extract_with_vision(file_bytes, VISION_MEDIA_TYPES[mime])
        except Exception as exc:
            logger.warning("extraction: vision failed for %s: %s", document.file_path, exc)
            return "", "skipped"
        if not text:
            return "", "skipped"
        return text, "vision_haiku"

    if mime == "application/pdf":
        try:
            text = _extract_with_pypdf(file_bytes)
        except Exception as exc:
            logger.warning("extraction: pypdf failed for %s: %s", document.file_path, exc)
            return "", "skipped"
        if not text:
            return "", "skipped"
        return text, "pypdf"

    return "", "skipped"


__all__ = ["extract_text", "VISION_MODEL"]
