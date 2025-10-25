// nextjs/src/features/interactions/components/InteractionItem.tsx
"use client";
import Link from "next/link";
import { Folder, Paperclip } from "lucide-react";

import { formatContactLabel, formatStructureLabel } from "@interactions/lib/formatParticipants";
import type { Interaction } from "@interactions/types";

interface Props {
  interaction: Interaction;
  documentCount: number;
  t: (key: string, args?: Record<string, string | number>) => string;
}

export default function InteractionItem({ interaction, documentCount, t }: Props) {
  const occurredAt = new Date(interaction.occurred_at).toLocaleString();
  const statusLabel = interaction.status ? t(`interactionsstatus.${interaction.status}`) : t("interactionsstatusNone");
  const tags = interaction.tags || [];
  const hasLinks = interaction.contacts.length > 0 || interaction.structures.length > 0;
  const projectStatusLabel = interaction.project ? t(`projects.status.${interaction.project.status}`) : null;
  return (
    <Link
      href={`/app/interactions/${interaction.id}`}
      className="border rounded-lg p-4 bg-white flex gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 line-clamp-1">{interaction.subject}</span>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
              {t(`interactionstypes.${interaction.type}`)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{occurredAt}</span>
            <span>•</span>
            <span>{statusLabel}</span>
            {documentCount > 0 && (
              <span className="flex items-center gap-1 text-gray-600" title={t("interactionsattachments")}>
                <Paperclip className="w-4 h-4" />
                <span className="text-xs">{documentCount}</span>
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">{interaction.content}</p>

        {interaction.project && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span className="flex items-center gap-1 font-medium text-gray-700">
              <Folder className="h-3.5 w-3.5" />
              {t("interactionsprojectLabel")}
            </span>
            <span className="text-sm font-semibold text-gray-900">{interaction.project.title}</span>
            {projectStatusLabel && (
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">
                {projectStatusLabel}
              </span>
            )}
          </div>
        )}

        {hasLinks && (
          <div className="flex flex-wrap gap-2">
            {interaction.contacts.map((contact) => (
              <span
                key={`contact-${contact.id}`}
                className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700"
              >
                {formatContactLabel(contact)}
              </span>
            ))}
            {interaction.structures.map((structure) => (
              <span
                key={`structure-${structure.id}`}
                className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"
              >
                {formatStructureLabel(structure)}
              </span>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
