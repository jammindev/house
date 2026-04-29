"""
Text extraction for uploaded documents.

Three pipelines:
- images → Claude Haiku 4.5 Vision (OCR)
- text-based PDFs → pypdf (fast, free)
- scanned PDFs → fallback Vision page-by-page (each page rendered as image)

Everything is fail-soft. Returning ``("", <method>)`` is a perfectly acceptable
outcome — the upload must never fail because text extraction did.
"""
from __future__ import annotations

import base64
import io
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

# DPI used when rasterizing scanned PDF pages for Vision OCR.
# Higher = better OCR quality but bigger payloads. 200 DPI is a typical
# balance — sharp enough for receipts/contracts, image stays under 2 MB.
PDF_VISION_RENDER_DPI = 200

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

    reader = PdfReader(io.BytesIO(file_bytes))
    pages: list[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception as exc:
            logger.info("extraction: pypdf page failed: %s", exc)
    return "\n\n".join(p.strip() for p in pages if p and p.strip()).strip()


def _extract_pdf_with_vision(file_bytes: bytes) -> str:
    """Render every PDF page and run Vision OCR on each. Concatenate the results.

    Used as a fallback when ``_extract_with_pypdf`` returns nothing — typically
    a scanned PDF where the pages are images embedded in a PDF wrapper. Each
    page is rasterized via pypdfium2, encoded as JPEG, then sent to Vision.
    """
    try:
        import pypdfium2  # type: ignore[import-not-found]
    except ImportError:
        logger.warning("extraction: pypdfium2 not installed, can't OCR scanned PDFs")
        return ""

    if _get_anthropic_client() is None:
        return ""

    pdf = pypdfium2.PdfDocument(file_bytes)
    page_texts: list[str] = []
    scale = PDF_VISION_RENDER_DPI / 72.0
    try:
        for page_index in range(len(pdf)):
            page = pdf[page_index]
            try:
                bitmap = page.render(scale=scale)
                pil_image = bitmap.to_pil()
                buffer = io.BytesIO()
                pil_image.save(buffer, format="JPEG", quality=85)
                text = _extract_with_vision(buffer.getvalue(), "image/jpeg")
            except Exception as exc:
                logger.warning("extraction: pdf-vision page %d failed: %s", page_index, exc)
                continue
            if text:
                page_texts.append(text)
    finally:
        # Explicit close avoids "Cannot close object, library is destroyed"
        # warnings during interpreter shutdown / GC.
        pdf.close()
    return "\n\n".join(page_texts).strip()


def extract_text(document: "Document") -> ExtractionResult:
    """Extract text content from a stored document.

    Returns ``(text, method)`` where ``method`` is one of:
    - ``"vision_haiku"``     : Vision called on an image, returned text
    - ``"vision_empty"``     : Vision called on an image, returned no text
    - ``"pypdf"``            : pypdf returned text from a text-based PDF
    - ``"pdf_vision_haiku"`` : pypdf was empty, Vision OCR'd each page successfully
    - ``"pdf_vision_empty"`` : pypdf was empty, Vision called on each page but no text
    - ``"skipped"``          : not attempted (no file, unsupported mime, IO error)

    The ``_empty`` variants indicate the API/library was actually invoked, which
    matters for cost accounting (a Vision call has a real $ cost even when the
    response is empty).
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
            return "", "vision_empty"
        if not text:
            return "", "vision_empty"
        return text, "vision_haiku"

    if mime == "application/pdf":
        try:
            text = _extract_with_pypdf(file_bytes)
        except Exception as exc:
            logger.warning("extraction: pypdf failed for %s: %s", document.file_path, exc)
            text = ""
        if text:
            return text, "pypdf"

        # Scanned/image-only PDF — fall back to Vision page by page.
        try:
            vision_text = _extract_pdf_with_vision(file_bytes)
        except Exception as exc:
            logger.warning("extraction: pdf-vision failed for %s: %s", document.file_path, exc)
            return "", "pdf_vision_empty"
        if not vision_text:
            return "", "pdf_vision_empty"
        return vision_text, "pdf_vision_haiku"

    return "", "skipped"


__all__ = ["extract_text", "VISION_MODEL"]
