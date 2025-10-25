// nextjs/src/app/app/projects/page.tsx
"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";

import AppPageLayout from "@/components/layout/AppPageLayout";
import ProjectFilters from "@projects/components/ProjectFilters";
import ProjectList from "@projects/components/ProjectList";
import { DEFAULT_PROJECT_FILTERS, useProjects } from "@projects/hooks/useProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function ProjectsPage() {
  const { t } = useI18n();
  const { projects, loading, error, filters, setFilters } = useProjects();

  const resetFilters = () => setFilters({ ...DEFAULT_PROJECT_FILTERS });

  const content = useMemo(() => {
    if (loading) {
      return <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{t("common.loading")}</div>;
    }
    if (error) {
      return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
    }
    return <ProjectList projects={projects} />;
  }, [error, loading, projects, t]);

  return (
    <AppPageLayout
      title={t("projects.title")}
      subtitle={t("projects.subtitle")}
      actions={[{
        icon: Plus,
        href: "/app/projects/new",
      }]}
      hideBackButton
    >
      <ProjectFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
      {content}
    </AppPageLayout>
  );
}
