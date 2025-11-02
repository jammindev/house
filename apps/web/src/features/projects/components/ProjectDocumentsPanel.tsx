"use client";

import { Paperclip } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Document } from "@interactions/types";

interface ProjectDocumentsPanelProps {
  documents: Document[];
}

export default function ProjectDocumentsPanel({ documents }: ProjectDocumentsPanelProps) {
  const { t } = useI18n();

  if (!documents.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        {t("projects.documents.empty")}
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {documents.map((doc) => (
        <li key={doc.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <Paperclip className="h-5 w-5 text-slate-600" />
            </span>
            <div className="flex-1 space-y-1">
              <div className="text-sm font-semibold text-slate-900">{doc.name}</div>
              {doc.notes ? <p className="text-xs text-slate-500">{doc.notes}</p> : null}
              <div className="text-xs text-slate-400">
                {doc.mime_type ?? "—"} · {doc.type}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
