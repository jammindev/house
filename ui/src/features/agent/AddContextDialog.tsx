import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { useContextSearch } from './hooks';
import { ENTITY_ICONS, ENTITY_ICON_FALLBACK } from './entityIcons';
import type { AgentSearchResult } from './api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `entity_type:object_id` keys already in context — shown as disabled. */
  presentKeys: Set<string>;
  onSelect: (result: AgentSearchResult) => void;
}

/**
 * Search-and-pick dialog to add an extra entity to the agent's context. Reuses
 * the agent's own retrieval (`useContextSearch`) so the results are exactly what
 * the agent could find. Entities already in context are shown disabled.
 */
export default function AddContextDialog({ open, onOpenChange, presentKeys, onSelect }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  // Reset the search each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setDebounced('');
    }
  }, [open]);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  const search = useContextSearch(debounced);
  const results = search.data ?? [];
  const hasQuery = debounced.trim().length >= 2;

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('agent.context.addTitle')}
      description={t('agent.context.addDescription')}
      size="l"
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('agent.context.searchPlaceholder')}
            className="pl-9"
            data-testid="agent-context-search"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!hasQuery ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {t('agent.context.searchHint')}
            </p>
          ) : search.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {t('agent.context.noResults')}
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((result) => {
                const key = `${result.entity_type}:${result.object_id}`;
                const present = presentKeys.has(key);
                const Icon = ENTITY_ICONS[result.entity_type] ?? ENTITY_ICON_FALLBACK;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      disabled={present}
                      onClick={() => onSelect(result)}
                      data-testid="agent-context-result"
                      className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {result.label}
                      </span>
                      {present ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t('agent.context.alreadyAdded')}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SheetDialog>
  );
}
