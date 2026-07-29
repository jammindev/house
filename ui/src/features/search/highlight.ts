/**
 * Parsing of the `<<…>>` markers Postgres' `ts_headline` puts around matched
 * terms (`start_sel`/`stop_sel` in `apps/agent/retrieval.py`).
 *
 * The markers are the only thing that says *why* a result is a result — a snippet
 * shown without them is a blob of text the user has to re-read to find their own
 * query in. They are parsed here rather than injected as HTML: the snippet is
 * household content (a document's OCR, a note), and `dangerouslySetInnerHTML` on
 * it would make any `<` the user ever typed an injection point.
 */

export interface SnippetSegment {
  text: string;
  match: boolean;
}

const MARKER = /<<(.*?)>>/gs;

/**
 * Split a snippet into plain and matched segments, in order.
 *
 * Unpaired markers are left as literal text rather than swallowed: a `<<` with no
 * `>>` means the headline was truncated mid-marker, and showing it beats showing
 * nothing.
 */
export function parseSnippet(snippet: string): SnippetSegment[] {
  if (!snippet) return [];

  const segments: SnippetSegment[] = [];
  let cursor = 0;

  for (const found of snippet.matchAll(MARKER)) {
    const start = found.index ?? 0;
    if (start > cursor) {
      segments.push({ text: snippet.slice(cursor, start), match: false });
    }
    if (found[1]) segments.push({ text: found[1], match: true });
    cursor = start + found[0].length;
  }

  if (cursor < snippet.length) {
    segments.push({ text: snippet.slice(cursor), match: false });
  }

  return segments;
}

/** The snippet with every marker removed — for `title` attributes and tests. */
export function stripMarkers(snippet: string): string {
  return parseSnippet(snippet)
    .map((segment) => segment.text)
    .join('');
}
