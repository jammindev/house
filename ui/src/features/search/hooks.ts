import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MIN_QUERY_LENGTH,
  searchHousehold,
  searchHouseholdBySense,
  type SearchResult,
} from '@/lib/api/search';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

export const searchKeys = {
  all: ['search'] as const,
  query: (q: string) => [...searchKeys.all, 'keyword', q] as const,
  sense: (q: string) => [...searchKeys.all, 'sense', q] as const,
};

/** Debounce before hitting the network: a keystroke is not a request. */
const DEBOUNCE_MS = 250;

// Results are re-fetched on the next open rather than kept warm: the palette is a
// navigation tool, and stale rows would point at entities that may be gone.
const STALE_MS = 30_000;

/**
 * Search-as-you-type over the household, **in two stages**.
 *
 * The keyword leg answers in milliseconds and is what the user sees while typing.
 * The semantic leg needs to embed the query (~200 ms, up to 1.6 s observed in
 * production) and returns only what the keywords could not reach, so it is fetched
 * *in parallel* and rendered as an extra group when it lands — never awaited, never
 * merged into the first list. Two separate queries rather than one: a single
 * `Promise.all` would hold the fast half hostage to the slow one.
 *
 * Also returns the *debounced* query so the caller can tell "still typing" from
 * "nothing found" — the two look identical from `data === []` alone, and showing
 * "no results" mid-word reads as a wrong answer.
 */
export function useHouseholdSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const keyword = useQuery<SearchResult[]>({
    queryKey: searchKeys.query(debounced),
    queryFn: () => searchHousehold(debounced),
    enabled,
    staleTime: STALE_MS,
  });

  const sense = useQuery<SearchResult[]>({
    queryKey: searchKeys.sense(debounced),
    queryFn: () => searchHouseholdBySense(debounced),
    enabled,
    staleTime: STALE_MS,
    // A semantic index that is unavailable is not an error the user should read: the
    // keyword results are already on screen and remain a complete answer.
    retry: false,
  });

  return {
    ...keyword,
    /** Keyword hits — the list shown while typing. */
    results: keyword.data ?? [],
    /** Semantic-only extras, already deduped server-side against `results`. */
    senseResults: sense.data ?? [],
    /** True while the semantic leg is still in flight for the current query. */
    isSearchingBySense: enabled && sense.isFetching,
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
