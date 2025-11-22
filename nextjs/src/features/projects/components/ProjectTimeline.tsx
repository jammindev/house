"use client";

import { Fragment } from "react";
import { ArrowUpRight, Clock, FileText, Tag } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Document, Interaction } from "@interactions/types";
import { extractAmountFromMetadata } from "@interactions/utils/amount";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

interface ProjectTimelineProps {
  interactions: Interaction[];
  documentsByInteraction: Record<string, Document[]>;
}

const formatDateTime = (value: string, locale: string) => {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const badgeByType: Record<Interaction["type"], { labelKey: string; className: string }> = {
  note: { labelKey: "projects.timeline.types.note", className: "bg-blue-100 text-blue-700" },
  todo: { labelKey: "projects.timeline.types.todo", className: "bg-amber-100 text-amber-700" },
  call: { labelKey: "projects.timeline.types.call", className: "bg-emerald-100 text-emerald-700" },
  meeting: { labelKey: "projects.timeline.types.meeting", className: "bg-emerald-100 text-emerald-700" },
  document: { labelKey: "projects.timeline.types.document", className: "bg-purple-100 text-purple-700" },
  expense: { labelKey: "projects.timeline.types.expense", className: "bg-rose-100 text-rose-700" },
  message: { labelKey: "projects.timeline.types.message", className: "bg-indigo-100 text-indigo-700" },
  visit: { labelKey: "projects.timeline.types.visit", className: "bg-orange-100 text-orange-700" },
  quote: { labelKey: "projects.timeline.types.quote", className: "bg-emerald-100 text-emerald-700" },
  signature: { labelKey: "projects.timeline.types.signature", className: "bg-teal-100 text-teal-700" },
  other: { labelKey: "projects.timeline.types.other", className: "bg-slate-100 text-slate-700" },
};

export default function ProjectTimeline({ interactions, documentsByInteraction }: ProjectTimelineProps) {
  const { t, locale } = useI18n();

  if (!interactions.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        {t("projects.timeline.empty")}
      </div>
    );
  }

  return (
    <ol className="relative border-s border-l border-slate-200 pl-6">
      {interactions.map((interaction, index) => {
        const typeInfo = badgeByType[interaction.type] ?? badgeByType.other;
        const docs = documentsByInteraction[interaction.id] ?? [];
        const quoteAmount =
          interaction.type === "quote"
            ? extractAmountFromMetadata(interaction.metadata)
            : null;
        const formattedQuoteAmount =
          quoteAmount !== null
            ? new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(quoteAmount)
            : null;
        const primaryStructureName = interaction.structures[0]?.name;
        const primaryContactName = interaction.contacts[0]
          ? [interaction.contacts[0].first_name, interaction.contacts[0].last_name].filter(Boolean).join(" ").trim()
          : "";
        const headline =
          interaction.type === "quote"
            ? primaryStructureName || primaryContactName || interaction.subject
            : interaction.subject;

        return (
          <Fragment key={interaction.id}>
            <li className="mb-8 flex flex-col gap-2">
              <div className="absolute -left-2 mt-1 h-3 w-3 rounded-full border border-white bg-primary-500" />
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${typeInfo.className}`}>
                  {t(typeInfo.labelKey)}
                </span>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateTime(interaction.occurred_at, locale)}
                </div>
              </div>
              <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">{headline}</h3>
                  <LinkWithOverlay
                    href={`/app/interactions/${interaction.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    {t("projects.timeline.viewInteraction")}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </LinkWithOverlay>
                </div>
                {interaction.type === "quote" && (
                  <div className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <span className="font-medium uppercase tracking-wide">
                      {t("projects.timeline.quoteAmountLabel")}
                    </span>
                    <span className="text-base font-semibold text-emerald-900">
                      {formattedQuoteAmount ?? t("projects.timeline.quoteAmountMissing")}
                    </span>
                  </div>
                )}
                {interaction.content ? (
                  <p className="text-sm text-slate-600 whitespace-pre-line">{interaction.content}</p>
                ) : null}
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {interaction.tags.length ? (
                    <div className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {interaction.tags.map((tag) => `#${tag.name}`).join(", ")}
                    </div>
                  ) : null}
                  {docs.length ? (
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {t("projects.timeline.documentsCount", { count: docs.length })}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
            {index === interactions.length - 1 ? null : <div className="h-px w-full bg-transparent" />}
          </Fragment>
        );
      })}
    </ol>
  );
}
