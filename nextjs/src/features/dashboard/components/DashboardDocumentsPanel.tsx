"use client";

import Link from "next/link";
import { FileQuestion, FileText, LinkIcon, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";

import type { DashboardDocument } from "@dashboard/types";

type DashboardDocumentsPanelProps = {
  documents: DashboardDocument[];
  loading?: boolean;
};

const formatDate = (value: string, locale: string) => {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function DashboardDocumentsPanel({ documents, loading = false }: DashboardDocumentsPanelProps) {
  const { locale, t } = useI18n();

  const backlog = documents.filter((doc) => doc.links.length === 0).slice(0, 3);
  const recentUploads = documents.slice(0, 5);

  return (
    <Card aria-labelledby="dashboard-documents">
      <CardHeader>
        <CardTitle id="dashboard-documents" className="text-lg font-semibold text-slate-900">
          {t("dashboard.documents.title")}
        </CardTitle>
        <CardDescription>{t("dashboard.documents.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div data-testid="documents-loading" className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-14 w-full animate-pulse rounded-lg bg-slate-200" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <section aria-label={t("dashboard.documents.unlinked")} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <LinkIcon className="h-4 w-4 text-amber-500" aria-hidden />
                {t("dashboard.documents.unlinked")}
              </div>
              {backlog.length === 0 ? (
                <p className="text-sm text-slate-600">{t("dashboard.documents.unlinkedEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {backlog.map((doc) => (
                    <li key={doc.id} className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-900">{doc.name}</p>
                      <p className="text-xs text-amber-700">{formatDate(doc.created_at, locale)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-label={t("dashboard.documents.recent")} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Paperclip className="h-4 w-4 text-slate-500" aria-hidden />
                {t("dashboard.documents.recent")}
              </div>
              {recentUploads.length === 0 ? (
                <p className="text-sm text-slate-600">{t("dashboard.documents.recentEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {recentUploads.map((doc) => (
                    <li key={doc.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{doc.name}</p>
                          <p className="text-xs text-slate-500">{formatDate(doc.created_at, locale)}</p>
                        </div>
                        {doc.links.length > 0 ? (
                          <span className="text-xs text-emerald-600">
                            <FileText className="mr-1 inline h-4 w-4 align-middle" aria-hidden />
                            {doc.links[0]?.subject ?? t("dashboard.documents.linked")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <FileQuestion className="h-4 w-4" aria-hidden />
                            {t("dashboard.documents.unlinked")}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Link href="/app/documents" aria-label={t("dashboard.documents.viewAll")}>
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            {t("dashboard.documents.viewAll")}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
