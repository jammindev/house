/**
 * Flatten formatted content to a single clean line of plain text — for places
 * where formatting must NOT render (conversation titles, list previews…).
 *
 * Handles the two formats agent messages can carry: Telegram HTML (the digest
 * emits `<b>…</b>`) and markdown (`**bold**`, headings, lists, links). Tags are
 * dropped, entities decoded, markdown markers removed, and all whitespace
 * collapsed to single spaces.
 */
export function toPlainText(input: string | null | undefined): string {
  if (!input) return '';
  let text = input;

  // Strip HTML tags, then decode the handful of entities html.escape produces.
  text = text.replace(/<[^>]*>/g, '');
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&');

  // Markdown links [text](url) → keep the visible text only.
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Inline emphasis / code markers.
  text = text.replace(/[*_`~]/g, '');
  // Line-leading heading / blockquote / list markers.
  text = text.replace(/^\s*#{1,6}\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');

  // Collapse every run of whitespace (incl. newlines) to a single space.
  return text.replace(/\s+/g, ' ').trim();
}
