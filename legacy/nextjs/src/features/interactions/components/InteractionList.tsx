// nextjs/src/features/interactions/components/InteractionList.tsx
"use client";
import { useMemo } from "react";
import InteractionItem from "./InteractionItem";
import type { Interaction } from "@interactions/types";
import { INTERACTION_TYPE_COLORS } from "@interactions/constants";

interface Props {
  interactions: Interaction[];
  documentCounts: Record<string, number>;
  t: (key: string, args?: Record<string, string | number>) => string;
  locale?: string;
  returnTo?: string;
}

type TimelineEntry =
  | { type: "separator"; key: string; label: string; isToday?: boolean }
  | { type: "item"; key: string; interaction: Interaction };

const getLocalDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getMonthLabel = (date: Date, locale?: string) => {
  try {
    return new Intl.DateTimeFormat(locale ?? undefined, { month: "short", year: "numeric" }).format(date);
  } catch {
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  }
};

const getTodayLabel = (locale?: string) => {
  try {
    return new Intl.RelativeTimeFormat(locale ?? undefined, { numeric: "auto" }).format(0, "day");
  } catch {
    return "Today";
  }
};

const getInteractionDotColor = (type: string) => {
  const colorClasses = INTERACTION_TYPE_COLORS[type as keyof typeof INTERACTION_TYPE_COLORS];
  if (!colorClasses) return "bg-primary-500";
  
  // Extract the bg-* class and convert to a dot color
  // e.g., "bg-blue-100 text-blue-800 border-blue-200" -> "bg-blue-500"
  const bgMatch = colorClasses.match(/bg-(\w+)-\d+/);
  if (!bgMatch) return "bg-primary-500";
  
  return `bg-${bgMatch[1]}-500`;
};

export default function InteractionList({ interactions, documentCounts, t, locale, returnTo }: Props) {
  const timelineEntries = useMemo(() => {
    if (!interactions.length) return [];

    const todayKey = getLocalDateKey(new Date());
    const todayLabel = getTodayLabel(locale);
    let lastMonthKey = "";
    let todayInserted = false;

    return interactions.reduce<TimelineEntry[]>((acc, interaction, index) => {
      const occurredDate = new Date(interaction.occurred_at);
      const dateKey = getLocalDateKey(occurredDate);
      const monthKey = `${occurredDate.getFullYear()}-${String(occurredDate.getMonth() + 1).padStart(2, "0")}`;

      if (dateKey === todayKey && !todayInserted) {
        acc.push({ type: "separator", key: "today", label: todayLabel, isToday: true });
        todayInserted = true;
      }

      if (dateKey !== todayKey && monthKey !== lastMonthKey) {
        acc.push({
          type: "separator",
          key: `month-${monthKey}-${index}`,
          label: getMonthLabel(occurredDate, locale),
        });
        lastMonthKey = monthKey;
      }

      acc.push({ type: "item", key: interaction.id, interaction });
      return acc;
    }, []);
  }, [interactions, locale]);

  return (
    <div className="space-y-2">
      {interactions.length === 0 ? (
        <div className="text-sm text-gray-500">{t("interactionsnone")}</div>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute left-[11px] top-3 bottom-3 w-px bg-slate-200" aria-hidden="true" />
          <ul className="space-y-3">
            {timelineEntries.map((entry) => (
              <li key={entry.key} className="relative pl-6">
                {entry.type === "separator" ? (
                  <div
                    className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    role="separator"
                    aria-label={entry.label}
                  >
                    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 shadow-sm ${
                        entry.isToday ? "border-primary-200 bg-primary-50 text-primary-700" : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${entry.isToday ? "bg-primary-500" : "bg-slate-400"}`}
                        aria-hidden="true"
                      />
                      <span>{entry.label}</span>
                    </span>
                    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  </div>
                ) : (
                  <>
                    <span
                      className={`absolute left-[7px] top-6 h-2.5 w-2.5 rounded-full ring-2 ring-white shadow-sm ${getInteractionDotColor(entry.interaction.type)}`}
                      aria-hidden="true"
                    />
                    <InteractionItem
                      interaction={entry.interaction}
                      documentCount={documentCounts[entry.interaction.id] || 0}
                      t={t}
                      returnTo={returnTo}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
