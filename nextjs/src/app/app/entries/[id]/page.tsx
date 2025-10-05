"use client";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEntry } from "@entries/hooks/useEntry";

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { entry, files, loading, error } = useEntry(id);

  if (loading) return <div className="p-6 text-gray-500">{t("common.loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!entry) return <div className="p-6 text-gray-500">{t("entries.notFound")}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">{t("entries.details")}</h1>
      <div className="text-sm text-gray-500">{new Date(entry.created_at).toLocaleString()}</div>
      <pre className="mt-3 whitespace-pre-wrap text-gray-900">{entry.raw_text}</pre>

      {/* TODO: afficher files si besoin */}
    </div>
  );
}