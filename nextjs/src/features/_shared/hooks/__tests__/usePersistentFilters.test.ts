import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePersistentFilters } from "@shared/hooks/usePersistentFilters";

type TestFilters = {
  status: string;
  search: string;
};

const STORAGE_KEY = "test-filters";
const fallbackFilters: TestFilters = { status: "open", search: "" };

const createMockStorage = () => {
  const store = new Map<string, string>();

  return {
    store,
    localStorage: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(() => store.clear()),
      key: vi.fn(),
      length: 0,
    },
  };
};

describe("usePersistentFilters", () => {
  let localStorageMock: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    localStorageMock = createMockStorage();
    vi.stubGlobal("window", { localStorage: localStorageMock.localStorage } as unknown as Window &
      typeof globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes with fallback values when storage is empty", () => {
    const { result } = renderHook(() =>
      usePersistentFilters<TestFilters>({ key: STORAGE_KEY, fallback: fallbackFilters })
    );

    expect(result.current.filters).toEqual(fallbackFilters);
  });

  it("restores saved filters and merges with fallback defaults", () => {
    const storageKey = `${STORAGE_KEY}:global`;
    localStorageMock.store.set(storageKey, JSON.stringify({ search: "query" }));

    const { result } = renderHook(() =>
      usePersistentFilters<TestFilters>({ key: STORAGE_KEY, fallback: fallbackFilters })
    );

    expect(result.current.filters).toEqual({ status: "open", search: "query" });
    expect(localStorageMock.localStorage.getItem).toHaveBeenCalledWith(storageKey);
  });

  it("persists updates and can reset to fallback values", async () => {
    const { result } = renderHook(() =>
      usePersistentFilters<TestFilters>({ key: STORAGE_KEY, fallback: fallbackFilters })
    );

    await act(async () => {
      result.current.setFilters({ status: "closed", search: "leak" });
    });

    const storageKey = `${STORAGE_KEY}:global`;
    await waitFor(() =>
      expect(localStorageMock.localStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify({ status: "closed", search: "leak" })
      )
    );

    await act(async () => {
      result.current.resetFilters();
    });

    expect(result.current.filters).toEqual(fallbackFilters);
  });

  it("scopes persisted values by the provided storage scope", () => {
    const scopedKey = `${STORAGE_KEY}:household-123`;
    localStorageMock.store.set(scopedKey, JSON.stringify({ status: "scheduled", search: "" }));

    const { result } = renderHook(() =>
      usePersistentFilters<TestFilters>({
        key: STORAGE_KEY,
        fallback: fallbackFilters,
        scope: "household-123",
      })
    );

    expect(result.current.filters).toEqual({ status: "scheduled", search: "" });
    expect(localStorageMock.localStorage.getItem).toHaveBeenCalledWith(scopedKey);
  });
});
