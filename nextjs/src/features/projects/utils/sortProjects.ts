"use client";

import type { ProjectWithMetrics } from "@projects/types";

const compareBooleanDesc = (a: boolean, b: boolean) => {
  if (a === b) return 0;
  return a ? -1 : 1;
};

/**
 * Comparator used to prioritize pinned projects first, then overdue, then due soon, then most recently updated.
 */
export function compareProjectsByPriority<T extends ProjectWithMetrics>(a: T, b: T): number {
  const pinnedComparison = compareBooleanDesc(Boolean(a.is_pinned), Boolean(b.is_pinned));
  if (pinnedComparison !== 0) return pinnedComparison;

  const overdueComparison = compareBooleanDesc(Boolean(a.isOverdue), Boolean(b.isOverdue));
  if (overdueComparison !== 0) return overdueComparison;

  const dueSoonComparison = compareBooleanDesc(Boolean(a.isDueSoon), Boolean(b.isDueSoon));
  if (dueSoonComparison !== 0) return dueSoonComparison;

  const aTime = new Date(a.updated_at).getTime();
  const bTime = new Date(b.updated_at).getTime();

  return bTime - aTime;
}

/**
 * Sorts projects using the shared priority comparator.
 */
export function sortProjectsByPinAndUpdate<T extends ProjectWithMetrics>(projects: T[]): T[] {
  return [...projects].sort(compareProjectsByPriority);
}
