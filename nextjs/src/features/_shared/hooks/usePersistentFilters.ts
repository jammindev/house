// nextjs/src/features/_shared/hooks/usePersistentFilters.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_STORAGE_SCOPE = "global";

const shallowEqual = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

const readFromStorage = <T,>(storageKey: string, fallback: T) => {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;

    return { ...fallback, ...(JSON.parse(raw) as T) };
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

  const fallbackSignature = useMemo(() => JSON.stringify(fallback), [fallback]);

  const readFilters = useCallback(
    () => readFromStorage(storageKey, fallback),
    [storageKey, fallbackSignature]
  );

  const [filters, setFilters] = useState<T>(() => readFilters());

  useEffect(() => {
    const next = readFilters();
    setFilters((prev) =>
      shallowEqual(prev as Record<string, unknown>, next as Record<string, unknown>) ? prev : next
    );
  }, [readFilters]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (err) {
      console.error("Failed to store filters", err);
    }
  }, [filters, storageKey]);

  const resetFilters = useCallback(
    () => setFilters({ ...(fallback as Record<string, unknown>) } as T),
    [fallbackSignature, fallback]
  );

  return { filters, setFilters, resetFilters } as const;
}
