// nextjs/src/features/interactions/components/InteractionItem.tsx
"use client";
import Link from "next/link";
import { Building2, CalendarDays, Folder, Paperclip, Tag as TagIcon, UserRound } from "lucide-react";

import type { Interaction } from "@interactions/types";

interface Props {
  interaction: Interaction;
  documentCount: number;
  t: (key: string, args?: Record<string, string | number>) => string;
}

const statusBadgeStyles: Partial<Record<NonNullable<Interaction["status"]>, string>> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  in_progress: "border-sky-200 bg-sky-50 text-sky-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
  archived: "border-gray-200 bg-gray-50 text-gray-600",
};

const typeBadgeStyles: Partial<Record<Interaction["type"], string>> = {
  note: "bg-slate-100 text-slate-800",
  todo: "bg-amber-100 text-amber-800",
  call: "bg-indigo-100 text-indigo-800",
  meeting: "bg-purple-100 text-purple-800",
  document: "bg-blue-100 text-blue-800",
  expense: "bg-rose-100 text-rose-800",
  quote: "bg-emerald-100 text-emerald-800",
  message: "bg-teal-100 text-teal-800",
  signature: "bg-fuchsia-100 text-fuchsia-800",
  other: "bg-gray-100 text-gray-800",
};

export default function InteractionItem({ interaction, documentCount, t }: Props) {
  const occurredDate = new Date(interaction.occurred_at);
  const occurredDateLabel = occurredDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const statusLabel = interaction.status ? t(`interactionsstatus.${interaction.status}`) : null;
  const tags = interaction.tags || [];
  const contacts = interaction.contacts || [];
  const structures = interaction.structures || [];
  const projectStatusLabel = interaction.project ? t(`projects.status.${interaction.project.status}`) : null;
  const statusBadgeClass =
    interaction.status ? statusBadgeStyles[interaction.status] ?? "border-gray-200 bg-gray-50 text-gray-600" : "border-gray-200 bg-gray-50 text-gray-600";
  const typeBadgeClass = typeBadgeStyles[interaction.type] ?? "bg-slate-100 text-slate-800";

  return (
    <Link
      href={`/app/interactions/${interaction.id}`}
      className="group block rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm ring-1 ring-transparent transition hover:border-indigo-200 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 w-full space-y-1">
            <div className="flex flex-nowrap justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1 font-medium text-gray-900 text-xs">
                  <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                  {occurredDateLabel}
                </span>
              </div>
              <span className={`inline-flex items-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold h-fit ${typeBadgeClass}`}>
                {t(`interactionstypes.${interaction.type}`)}
              </span>
            </div>
            <span className="text-sm font-semibold text-gray-900 line-clamp-1">{interaction.subject}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {interaction.project && (
            <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-800">
              <Folder className="h-3.5 w-3.5" />
              {interaction.project.title}
              {projectStatusLabel && (
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium uppercase text-purple-600">
                  {projectStatusLabel}
                </span>
              )}
            </span>
          )}
          {statusLabel && <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${statusBadgeClass}`}>
            {statusLabel}
          </span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {documentCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700"
              title={t("interactionsattachments")}
            >
              <Paperclip className="h-3.5 w-3.5" />
              {documentCount}
            </span>
          )}
          {tags.length > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-600"
              title={t("interactionstagsLabel")}
            >
              <TagIcon className="h-3.5 w-3.5" />
              {tags.length}
            </span>
          )}

          {contacts.length > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
              title={t("interactionscontacts.sectionTitle")}
            >
              <UserRound className="h-3.5 w-3.5" />
              {contacts.length}
            </span>
          )}
          {structures.length > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800"
              title={t("interactionsstructures.sectionTitle")}
            >
              <Building2 className="h-3.5 w-3.5" />
              {structures.length}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
