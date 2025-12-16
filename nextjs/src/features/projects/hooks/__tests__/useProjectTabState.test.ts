import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectTabState } from "@projects/hooks/useProjectTabState";

const STORAGE_KEY = "project-tabs";

type MockStorage = ReturnType<typeof createMockStorage>;

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

describe("useProjectTabState", () => {
  let localStorageMock: MockStorage;

  beforeEach(() => {
    localStorageMock = createMockStorage();
    vi.stubGlobal("localStorage", localStorageMock.localStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses default tab when storage is empty", () => {
    const { result } = renderHook(() => useProjectTabState("project-1", "notes"));

    expect(result.current.tab).toBe("notes");
    expect(localStorageMock.localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("restores saved tab for the project", () => {
    localStorageMock.store.set(STORAGE_KEY, JSON.stringify({ "project-1": "tasks" }));

    const { result } = renderHook(() => useProjectTabState("project-1", "notes"));

    expect(result.current.tab).toBe("tasks");
  });

  it("persists updates and preserves other project tabs", () => {
    localStorageMock.store.set(STORAGE_KEY, JSON.stringify({ "project-2": "photos" }));

    const { result } = renderHook(() => useProjectTabState("project-1", "notes"));

    act(() => {
      result.current.setTab("links");
    });

    const saved = JSON.parse(localStorageMock.store.get(STORAGE_KEY) ?? "{}");
    expect(saved).toEqual({ "project-1": "links", "project-2": "photos" });
  });

  it("switches tab state when project id changes", () => {
    localStorageMock.store.set(STORAGE_KEY, JSON.stringify({ "project-1": "tasks" }));

    const { result, rerender } = renderHook(({ pid }) => useProjectTabState(pid, "notes"), {
      initialProps: { pid: "project-1" },
    });

    expect(result.current.tab).toBe("tasks");

    rerender({ pid: "project-2" });

    expect(result.current.tab).toBe("notes");
  });

  it("falls back to default when storage is invalid", () => {
    localStorageMock.store.set(STORAGE_KEY, "not-json");

    const { result } = renderHook(() => useProjectTabState("project-1", "notes"));

    expect(result.current.tab).toBe("notes");
  });
});
