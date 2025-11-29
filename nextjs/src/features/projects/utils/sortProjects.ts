"use client";

import type { ProjectWithMetrics } from "@projects/types";

/**
 * Sorts projects by pin state first (pinned first) and falls back to updated_at (desc).
 */
export function sortProjectsByPinAndUpdate<T extends ProjectWithMetrics>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }

    const aTime = new Date(a.updated_at).getTime();
    const bTime = new Date(b.updated_at).getTime();

    return bTime - aTime;
  });
}
