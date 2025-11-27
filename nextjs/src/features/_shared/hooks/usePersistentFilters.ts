// nextjs/src/features/_shared/hooks/usePersistentFilters.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_STORAGE_SCOPE = "global";

const readFromStorage = <T,>(storageKey: string, fallback: T) => {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as T;
    return { ...fallback, ...parsed };
  } catch (err) {
    console.error("Failed to read filters from storage", err);
    return fallback;
  }
};

export function usePersistentFilters<T extends Record<string, unknown>>({
  key,
  fallback,
  scope,
}: {
  key: string;
  fallback: T;
  scope?: string | null;
}) {
  const storageKey = useMemo(
    () => `${key}:${scope || DEFAULT_STORAGE_SCOPE}`,
    [key, scope]
  );

  const [filters, setFilters] = useState<T>(() => readFromStorage(storageKey, fallback));

  useEffect(() => {
    setFilters(readFromStorage(storageKey, fallback));
  }, [fallback, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (err) {
      console.error("Failed to store filters", err);
    }
  }, [filters, storageKey]);

  const resetFilters = useCallback(() => setFilters({ ...fallback }), [fallback]);

  return { filters, setFilters, resetFilters } as const;
}
