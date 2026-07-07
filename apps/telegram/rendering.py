"""
AnswerResult -> Telegram messages (HTML parse_mode, ≤ 4096 chars each).

The agent's answer text embeds ``<cite id="entity_type:id"/>`` markers (see
``agent.service``). The web UI turns them into chips; here each marker becomes
a numbered inline link and the cited items are listed once at the bottom, as
absolute links into the SPA (``FRONTEND_URL`` + the citation's ``url_path``).
Everything else is plain text, HTML-escaped.
"""
from __future__ import annotations

import html
import re

TELEGRAM_MESSAGE_LIMIT = 4096

# Same pattern as agent.service._CITE_RE — duplicated on purpose: that name is
# private to the orchestrator and this transport must not reach into it.
_CITE_RE = re.compile(r'''<cite\s+id=["'](?P<tag>[^"']+)["']\s*/?>''', re.IGNORECASE)


def render_answer(result, frontend_url: str) -> list[str]:
    """Render an ``AnswerResult`` into ready-to-send HTML message chunks."""
    base = frontend_url.rstrip("/")
    by_tag = {f"{c.entity_type}:{c.id}": c for c in result.citations}
    cited_tags: list[str] = []

    parts: list[str] = []
    cursor = 0
    answer = result.answer or ""
    for match in _CITE_RE.finditer(answer):
        parts.append(html.escape(answer[cursor : match.start()]))
        cursor = match.end()
        citation = by_tag.get(match.group("tag"))
        if citation is None:
            continue  # the model cited something we never retrieved — drop it
        if match.group("tag") not in cited_tags:
            cited_tags.append(match.group("tag"))
        number = cited_tags.index(match.group("tag")) + 1
        parts.append(f'<a href="{base}{citation.url_path}">[{number}]</a>')
    parts.append(html.escape(answer[cursor:]))
    text = "".join(parts).strip()

    # Citations that never appeared as inline markers still deserve a footer
    # entry — they were resolved, the user should get the links.
    for tag in by_tag:
        if tag not in cited_tags:
            cited_tags.append(tag)
    if cited_tags:
        lines = []
        for number, tag in enumerate(cited_tags, start=1):
            citation = by_tag[tag]
            label = html.escape(citation.label or tag)
            lines.append(f'{number}. <a href="{base}{citation.url_path}">{label}</a>')
        text = f"{text}\n\n—\n" + "\n".join(lines)

    return _chunk(text)


def _chunk(text: str, limit: int = TELEGRAM_MESSAGE_LIMIT) -> list[str]:
    """Split on line boundaries so a chunk never cuts an ``<a>`` tag in half.

    Lines longer than the limit (no newline to split on) are hard-split; that
    can only mangle a link inside a pathological 4k-char line, which Telegram
    would have rejected anyway.
    """
    if len(text) <= limit:
        return [text] if text else []
    chunks: list[str] = []
    current = ""
    for line in text.split("\n"):
        while len(line) > limit:
            chunks.append(line[:limit])
            line = line[limit:]
        candidate = f"{current}\n{line}" if current else line
        if len(candidate) > limit:
            chunks.append(current)
            current = line
        else:
            current = candidate
    if current:
        chunks.append(current)
    return [c for c in (chunk.strip("\n") for chunk in chunks) if c]
