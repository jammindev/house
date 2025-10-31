// nextjs/src/app/app/(pages)/project-groups/page.tsx
"use client";

import { useEffect, useMemo } from "react";
import { Plus } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";

import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";
import { useProjectGroups } from "@project-groups/hooks/useProjectGroups";

import ProjectGroupList from "@project-groups/components/ProjectGroupList";

export default function ProjectGroupsPage() {
  const { t } = useI18n();
  const { groups, loading, error } = useProjectGroups();
  const setPageLayoutConfig = usePageLayoutConfig();

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

  useEffect(() => {
    setPageLayoutConfig({
      title: t("projectGroups.title"),
      subtitle: t("projectGroups.subtitle"),
      context: undefined,
      actions: [
        {
          icon: Plus,
          href: "/app/project-groups/new",
        },
      ],
      className: undefined,
      contentClassName: undefined,
      hideBackButton: true,
      loading: false,
    });
  }, [setPageLayoutConfig, t]);

  return <>{content}</>;
}
