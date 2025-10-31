// nextjs/src/app/app/projects/page.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import ProjectFilters from "@projects/components/ProjectFilters";
import ProjectList from "@projects/components/ProjectList";
import { DEFAULT_PROJECT_FILTERS, useProjects } from "@projects/hooks/useProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  const { t } = useI18n();
  const { projects, loading, error, filters, setFilters } = useProjects();

  const actions = useMemo(
    () => [
      {
        icon: Plus,
        href: "/app/projects/new",
        label: t("projects.new"),
        variant: "default" as const,
      },
    ],
    [t]
  );

  const resetFilters = () => setFilters({ ...DEFAULT_PROJECT_FILTERS });

  const toolbar = (
    <ProjectFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
  );

  return (
    <ListPageLayout
      title={t("projects.title")}
      subtitle={t("projects.subtitle")}
      hideBackButton
      actions={actions}
      toolbar={toolbar}
      loading={loading}
      error={error ?? null}
      errorTitle={t("projects.loadFailed")}
      isEmpty={!loading && projects.length === 0}
      emptyState={
        <EmptyState
          title={t("projects.emptyState")}
          description={t("projects.newSubtitle")}
          action={
            <Button asChild>
              <Link href="/app/projects/new">{t("projects.new")}</Link>
            </Button>
          }
        />
      }
    >
      <ProjectList projects={projects} />
    </ListPageLayout>
  );
}
