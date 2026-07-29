import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MIN_QUERY_LENGTH, searchHousehold, type SearchResult } from '@/lib/api/search';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

export const searchKeys = {
  all: ['search'] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
};

/** Debounce before hitting the network: a keystroke is not a request. */
const DEBOUNCE_MS = 250;

/**
 * Search-as-you-type over the household. Returns the *debounced* query alongside
 * the results so the caller can tell "still typing" from "nothing found" — the two
 * look identical from `data === []` alone, and showing "no results" while the user
 * is mid-word reads as a wrong answer.
 */
export function useHouseholdSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const search = useQuery<SearchResult[]>({
    queryKey: searchKeys.query(debounced),
    queryFn: () => searchHousehold(debounced),
    enabled,
    // Results are re-fetched on the next open rather than kept warm: the palette is
    // a navigation tool, and stale rows would point at entities that may be gone.
    staleTime: 30_000,
  });

  return {
    ...search,
    /** The query the results correspond to (not what is currently typed). */
    debouncedQuery: debounced,
    /** True while the typed query has not reached the network yet. */
    isTyping: query.trim() !== debounced,
    hasQuery: enabled,
  };
}

/**
 * ⌘K / Ctrl-K opens the palette, from anywhere in the app.
 *
 * `/` is deliberately *not* bound: the app is full of text inputs, and a bare
 * letter shortcut would steal a character from whoever is typing in one.
 */
export function useSearchShortcut(onOpen: () => void) {
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      onOpen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
