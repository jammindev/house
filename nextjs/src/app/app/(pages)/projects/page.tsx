// nextjs/src/app/app/projects/page.tsx
"use client";

import { useMemo } from "react";
import { Filter, Plus } from "lucide-react";
import { SheetDialog } from "@/components/ui/sheet-dialog";

import ProjectFilters from "@projects/components/ProjectFilters";
import TextSearch from "@projects/components/TextSearch";
import ProjectList from "@projects/components/ProjectList";
import { DEFAULT_PROJECT_FILTERS, useProjects } from "@projects/hooks/useProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

export default function ProjectsPage() {
  const { t } = useI18n();
  const { projects, loading, error, filters, setFilters } = useProjects();

  const resetFilters = () => setFilters({ ...DEFAULT_PROJECT_FILTERS });

  const actions = useMemo(
    () => [
      {
        // Custom element action: open filters in a SheetDialog
        element: (
          <SheetDialog
            trigger={<Button variant="outline" size="sm"><Filter /></Button>}
          >
            <ProjectFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
          </SheetDialog>
        ),
      },
      {
        icon: Plus,
        href: "/app/projects/new",
        variant: "default" as const,
      },
    ],
    [filters, setFilters, resetFilters]
  );

  const toolbar = (
    <TextSearch filters={filters} setFilters={setFilters} />
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
              <LinkWithOverlay href="/app/projects/new">{t("projects.new")}</LinkWithOverlay>
            </Button>
          }
        />
      }
    >
      <ProjectList projects={projects} />
    </ListPageLayout>
  );
}
