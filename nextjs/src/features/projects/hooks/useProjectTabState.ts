"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "project-tabs";

type TabMap = Record<string, string>;

const readTabMap = (): TabMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as TabMap;
    }
  } catch (err) {
    console.error("Failed to read project tab map", err);
  }
  return {};
};

const writeTabMap = (map: TabMap) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error("Failed to persist project tab map", err);
  }
};

export function useProjectTabState<T extends string>(projectId: string | undefined, defaultTab: T) {
  const safeDefault = useMemo(() => defaultTab, [defaultTab]);

  const readTab = useCallback(() => {
    if (!projectId) return safeDefault;
    const map = readTabMap();
    return (map[projectId] as T | undefined) ?? safeDefault;
  }, [projectId, safeDefault]);

  const [tab, setTabState] = useState<T>(() => readTab());

  useEffect(() => {
    setTabState(readTab());
  }, [readTab]);

  const setTab = useCallback(
    (next: T) => {
      setTabState(next);
      if (!projectId) return;
      const map = readTabMap();
      map[projectId] = next;
      writeTabMap(map);
    },
    [projectId]
  );

  return { tab, setTab } as const;
}
