// nextjs/src/app/app/projects/page.tsx
"use client";

import { useMemo } from "react";
import { Plus, Sparkles } from "lucide-react";

import ProjectFilters from "@projects/components/ProjectFilters";
import TextSearch from "@projects/components/TextSearch";
import ProjectList from "@projects/components/ProjectList";
import { DEFAULT_PROJECT_FILTERS, useProjects } from "@projects/hooks/useProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import FiltersActionSheet from "@shared/components/FiltersActionSheet";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { ProjectWizardDialog } from "@projects/components/wizard";

export default function ProjectsPage() {
  const { t } = useI18n();
  const { projects, loading, error, filters, setFilters, resetFilters, reload } = useProjects();

  const hasActiveFilters = useMemo(() => {
    const defaultStatuses = DEFAULT_PROJECT_FILTERS.statuses ?? [];
    const currentStatuses = filters.statuses ?? [];
    const statusesChanged =
      defaultStatuses.length !== currentStatuses.length ||
      currentStatuses.some((status) => !defaultStatuses.includes(status));

    return Boolean(
      statusesChanged ||
      filters.search?.trim() ||
      (filters.tags?.length ?? 0) > 0 ||
      filters.startDateFrom ||
      filters.dueDateTo ||
      filters.projectGroupId
    );
  }, [filters]);

  const actions = useMemo(
    () => [
      {
        element: (
          <FiltersActionSheet
            title={t("projects.filters.title")}
            ariaLabel={t("common.filter")}
            isActive={hasActiveFilters}
            buttonSize={'icon'}
          >
            <ProjectFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
          </FiltersActionSheet>
        ),
      },
      {
        element: (
          <ProjectWizardDialog
            trigger={
              <Button size="icon" variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" />
              </Button>
            }
            onSuccess={() => {
              reload?.();
            }}
          />
        ),
      },
      {
        icon: Plus,
        href: "/app/projects/new",
        variant: "default" as const,
      },
    ],
    [filters, hasActiveFilters, resetFilters, setFilters, t, reload]
  );

  const toolbar = (
    <TextSearch filters={filters} setFilters={setFilters} />
  );

  return (
    <>
      <ListPageLayout
        title={t("projects.title")}
        // subtitle={t("projects.subtitle")}
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
                <LinkWithOverlay href="/app/projects/new">{t("projects.new")}</LinkWithOverlay>
              </Button>
            }
          />
        }
      >
        <ProjectList projects={projects} />
      </ListPageLayout>
    </>
  );
}
