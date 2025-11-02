"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";

type DocumentsFiltersProps = {
  unlinkedOnly: boolean;
  onToggle: (value: boolean) => void;
  totalCount: number;
  unlinkedCount: number;
};

export function DocumentsFilters({ unlinkedOnly, onToggle, totalCount, unlinkedCount }: DocumentsFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">
          {t("documents.count.all", { count: totalCount })}
        </p>
        <p className="text-xs text-gray-500">
          {t("documents.count.unlinked", { count: unlinkedCount })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={unlinkedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => onToggle(!unlinkedOnly)}
          className="min-w-[10rem]"
        >
          {t(unlinkedOnly ? "documents.filter.unlinkedActive" : "documents.filter.unlinked")}
        </Button>
      </div>
    </div>
  );
}
