"""
Digest assembly + rendering — the single source of truth consumed by both the
ping (scheduled Telegram push) and the in-app preview endpoint.

``build_digest`` runs the active collectors for a household/user and returns a
``DigestResult``. Rendering is split by channel: ``render_telegram`` produces
the HTML string the Telegram client expects (content escaped), while the API
returns the structured sections directly.
"""
from __future__ import annotations

import html
import logging
from dataclasses import dataclass
from datetime import date

from django.utils import timezone
from django.utils.translation import gettext as _

from .collectors import SECTION_SPECS, DigestSection

logger = logging.getLogger(__name__)


@dataclass
class DigestResult:
    sections: list[DigestSection]

    @property
    def is_empty(self) -> bool:
        return not self.sections


def active_section_specs(household):
    """Section specs whose module is enabled for the household (order preserved)."""
    disabled_modules = frozenset(getattr(household, "disabled_modules", None) or [])
    return [
        spec
        for spec in SECTION_SPECS
        if spec.module is None or spec.module not in disabled_modules
    ]


def build_digest(household, user, *, today: date | None = None, disabled_sections=None) -> DigestResult:
    """Compose the digest for ``household``/``user``.

    Skips sections the user turned off (``disabled_sections``) and sections whose
    module the household disabled. A failing collector is logged and dropped —
    it never sinks the rest of the digest. Must be called inside the recipient's
    language for the section strings to be localized.
    """
    today = today or timezone.localdate()
    disabled = frozenset(disabled_sections or [])

    sections: list[DigestSection] = []
    for spec in active_section_specs(household):
        if spec.key in disabled:
            continue
        try:
            section = spec.collect(household, user, today=today)
        except Exception:  # noqa: BLE001 — isolate a broken collector
            logger.exception("digest: collector %s failed", spec.key)
            continue
        if section and section.lines:
            sections.append(section)
    return DigestResult(sections=sections)


def render_telegram(result: DigestResult) -> str:
    """Render the digest as the HTML string the Telegram client sends.

    Section titles are bold; every piece of module-supplied content is escaped
    so a task subject with ``<`` or ``&`` can never break the markup.
    """
    header = f"<b>{html.escape(_('☀️ Your daily digest'))}</b>"
    blocks: list[str] = []
    for section in result.sections:
        title = html.escape(f"{section.emoji} {section.title}")
        body = "\n".join(html.escape(line) for line in section.lines)
        blocks.append(f"<b>{title}</b>\n{body}")
    return header + "\n\n" + "\n\n".join(blocks)
