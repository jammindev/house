import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { pushBack } from '@/lib/backNavigation';
import { ENTITY_ICONS, ENTITY_ICON_FALLBACK } from '@/features/agent/entityIcons';
import type { SearchResult } from '@/lib/api/search';
import { useHouseholdSearch } from './hooks';
import { parseSnippet, stripMarkers } from './highlight';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Group {
  entityType: string;
  results: SearchResult[];
}

/**
 * Group results by entity type while preserving the server's ranking: the groups
 * come out in the order their best hit did, and each group keeps its own order. A
 * grouping that re-sorted (alphabetically, by a hardcoded type order) would put a
 * weak match above a strong one and quietly contradict the ranking.
 */
function groupByType(results: SearchResult[]): Group[] {
  const groups: Group[] = [];
  for (const result of results) {
    const existing = groups.find((group) => group.entityType === result.entity_type);
    if (existing) existing.results.push(result);
    else groups.push({ entityType: result.entity_type, results: [result] });
  }
  return groups;
}

/** Excerpt with the matched terms marked. Rendered as text — never as HTML. */
function Snippet({ snippet }: { snippet: string }) {
  const segments = React.useMemo(() => parseSnippet(snippet), [snippet]);
  if (segments.length === 0) return null;
  return (
    <span className="block truncate text-xs text-muted-foreground" title={stripMarkers(snippet)}>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className="bg-primary/20 text-foreground">
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        ),
      )}
    </span>
  );
}

/**
 * App-wide search — every entity the household owns, from one box.
 *
 * It queries the agent's own retrieval (`GET /api/search/`), so what the palette
 * finds and what the assistant can cite are the same index: a user who finds a
 * document here and hears "I don't know about it" in the chat would have no way to
 * tell which of the two is wrong.
 */
export default function SearchPalette({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);

  const { data, isLoading, isTyping, hasQuery } = useHouseholdSearch(open ? query : '');
  const results = React.useMemo(() => data ?? [], [data]);
  const groups = React.useMemo(() => groupByType(results), [results]);

  // Reset on each open — a palette reopening on the previous search would answer a
  // question the user is no longer asking.
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  // New results, new selection: keeping the old index would highlight (and, on
  // Enter, open) whatever now happens to sit at that position.
  React.useEffect(() => setActiveIndex(0), [results]);

  const go = React.useCallback(
    (result: SearchResult) => {
      onOpenChange(false);
      navigate(result.url, { state: pushBack(location) });
    },
    [location, navigate, onOpenChange],
  );

  /** Keeps the arrow-selected row visible: below the fold, ↑↓ would move a
   *  selection the user cannot see. `nearest` so it never jumps on mouse hover. */
  const scrollActiveIntoView = React.useCallback((node: HTMLButtonElement | null) => {
    node?.scrollIntoView({ block: 'nearest' });
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) go(target);
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('search.title')}
      description={t('search.description')}
      size="l"
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('search.placeholder')}
            aria-label={t('search.title')}
            className="pl-9"
            data-testid="global-search-input"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!hasQuery ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {t('search.hint')}
            </p>
          ) : isLoading || isTyping ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {t('search.noResults')}
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const Icon = ENTITY_ICONS[group.entityType] ?? ENTITY_ICON_FALLBACK;
                return (
                  <div key={group.entityType}>
                    <p className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t(`search.entity.${group.entityType}`)}
                    </p>
                    <ul className="space-y-1">
                      {group.results.map((result) => {
                        // Position in the flat, rank-ordered list — ↑↓ walks the
                        // whole list, group headings included.
                        const position = results.indexOf(result);
                        const isActive = position === activeIndex;
                        return (
                          <li key={`${result.entity_type}:${result.object_id}`}>
                            <button
                              type="button"
                              ref={isActive ? scrollActiveIntoView : undefined}
                              onClick={() => go(result)}
                              onMouseEnter={() => setActiveIndex(position)}
                              data-testid="global-search-result"
                              aria-current={isActive || undefined}
                              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                isActive
                                  ? 'border-primary/40 bg-primary/10'
                                  : 'border-border bg-card hover:bg-primary/10'
                              }`}
                            >
                              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-foreground">
                                  {result.label}
                                </span>
                                <Snippet snippet={result.snippet} />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SheetDialog>
  );
}
