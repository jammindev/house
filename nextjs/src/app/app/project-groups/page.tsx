// nextjs/src/app/app/project-groups/page.tsx
"use client";

import { useMemo } from "react";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectGroupList from "@project-groups/components/ProjectGroupList";
import { useProjectGroups } from "@project-groups/hooks/useProjectGroups";

export default function ProjectGroupsPage() {
  const { t } = useI18n();
  const { groups, loading, error } = useProjectGroups();

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          {t("common.loading")}
        </div>
      );
    }
    if (error) {
      return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
    }
    return <ProjectGroupList groups={groups} />;
  }, [error, groups, loading, t]);

  return (
    <AppPageLayout
      title={t("projectGroups.title")}
      subtitle={t("projectGroups.subtitle")}
      hideBackButton
    >
      {content}
    </AppPageLayout>
  );
}
