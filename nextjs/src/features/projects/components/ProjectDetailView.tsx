// nextjs/src/features/projects/components/ProjectDetailView.tsx
"use client";

import { useEffect, useState } from "react";

import AuditHistoryCard from "@/components/AuditHistoryCard";
import { Button } from "@/components/ui/button";
import OverdueBadge from "@/components/ui/OverdueBadge";
import DueSoonBadge from "@/components/ui/DueSoonBadge";
import { cn } from "@/lib/utils";
import type { ProjectInteractionSummary } from "@projects/hooks/useProjectInteractions";
import type { ProjectWithMetrics } from "@projects/types";
import ProjectTimeline from "@projects/components/ProjectTimeline";
import ProjectTasksPanel from "@projects/components/ProjectTasksPanel";
import ProjectDocumentsPanel from "@projects/components/ProjectDocumentsPanel";
import ProjectExpensesPanel from "@projects/components/ProjectExpensesPanel";
import NoteTab from "@projects/components/NoteTab";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectDeleteButton from "@projects/components/ProjectDeleteButton";
import ProjectCard from "@projects/components/project-card/ProjectCard";
import { useIsMobile } from "@documents/hooks/useIsMobile";
import { MobileOptimizedSelect } from "@/components/ui/mobile-optimized";
import TabSheet from "@projects/components/TabSheet";
import { CalendarDays, Coins, FolderKanban, Pin } from "lucide-react";
import CountBadge from "@/components/ui/CountBadge";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { PROJECT_TYPE_META } from "@projects/constants";
import ProjectStatusSheet from "@projects/components/ProjectStatusSheet";
import { PROJECT_STATUSES } from "@projects/constants";
import type { ProjectStatus } from "@projects/types";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useCallback } from "react";
import ProjectDescriptionTab from "@projects/components/ProjectDescriptionTab";
import { PhotoGrid } from "@photos/components/PhotoGrid";
import { useProjectPhotoDocuments } from "@projects/hooks/useProjectPhotoDocuments";
import { useSignedFilePreviews } from "@interactions/hooks/useSignedFilePreviews";
import ProjectLinksPanel from "@projects/components/ProjectLinksPanel";

interface ProjectDetailViewProps {
  project: ProjectWithMetrics;
  relatedProjects?: ProjectWithMetrics[];
  interactionsData: ProjectInteractionSummary;
  onRefresh?: () => void;
}

const TABS = ["tasks", "notes", "links", "description", "documents", "photos", "timeline", "metrics", "expenses"] as const;
const RELATED_PROJECTS_PAGE_SIZE = 3;

export default function ProjectDetailView({
  project,
  relatedProjects = [],
  interactionsData,
  onRefresh,
}: ProjectDetailViewProps) {
  const { t, locale } = useI18n();
  const isMobile = useIsMobile();
  const { selectedHouseholdId: householdId } = useGlobal();
  const { show } = useToast();
  const [tab, setTab] = useState<typeof TABS[number]>("notes");
  const [visibleRelatedCount, setVisibleRelatedCount] = useState(RELATED_PROJECTS_PAGE_SIZE);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [updating, setUpdating] = useState(false);
  const [projectDescription, setProjectDescription] = useState(project.description);
  const {
    photos: projectPhotos,
    loading: photosLoading,
    error: projectPhotosError,
    refresh: refreshProjectPhotos,
  } = useProjectPhotoDocuments(project.id);
  const { previews: photoPreviews, error: photoPreviewError } = useSignedFilePreviews(projectPhotos);
  const combinedPhotoError = projectPhotosError ?? (photoPreviewError || null);

  // Update local description when project changes
  useEffect(() => {
    setProjectDescription(project.description);
  }, [project.description]);
  const formatCurrency = (value: number, locale: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);

  const formatDate = (value: string | null, locale: string) => {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(
        new Date(value)
      );
    } catch {
      return value;
    }
  };

  const handleStatusChange = useCallback(
    async (nextStatus: ProjectStatus) => {
      if (!householdId || nextStatus === status) return;
      setUpdating(true);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { error } = await client
          .from("projects")
          .update({ status: nextStatus })
          .eq("id", project.id)
          .eq("household_id", householdId);

        if (error) throw error;
        setStatus(nextStatus);
        onRefresh?.();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("common.unexpectedError");
        show({ title: message, variant: "error" });
      } finally {
        setUpdating(false);
      }
    },
    [householdId, onRefresh, project.id, show, status, t]
  );

  const auditLines = [
    project.created_at
      ? t("projects.auditCreated", {
        date: new Date(project.created_at).toLocaleString(),
      })
      : null,
    project.updated_at
      ? t("projects.auditUpdated", {
        date: new Date(project.updated_at).toLocaleString(),
      })
      : null,
  ].filter((line): line is string => Boolean(line));

  const typeMeta = PROJECT_TYPE_META[project.type] ?? PROJECT_TYPE_META.other;
  const statusOptions = PROJECT_STATUSES;
  const metrics = project.metrics;
  const openTodos = metrics?.open_todos ?? 0;
  const doneTodos = metrics?.done_todos ?? 0;
  const documentsCount = metrics?.documents_count ?? 0;

  useEffect(() => {
    setVisibleRelatedCount(RELATED_PROJECTS_PAGE_SIZE);
  }, [project.id, relatedProjects.length]);

  useEffect(() => {
    setStatus(project.status);
  }, [project.status]);

  const relatedProjectsToShow = relatedProjects.slice(0, visibleRelatedCount);
  const displayedRelatedCount = relatedProjectsToShow.length;
  const hasMoreRelatedProjects = visibleRelatedCount < relatedProjects.length;
  const remainingRelatedProjects = relatedProjects.length - displayedRelatedCount;
  const nextBatchSize = Math.min(RELATED_PROJECTS_PAGE_SIZE, Math.max(remainingRelatedProjects, 0));

  return (
    <div className="space-y-4 pb-10">
      {/* Project Title */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">{project.title}</h1>

        {/* Badges section */}
        <div className="flex flex-wrap items-center gap-3">
          {project.is_pinned ? (
            <CountBadge
              icon={<Pin className="h-3.5 w-3.5" />}
              display="inline"
              tone="none"
              className="border-primary-100 bg-primary-50 text-primary-700"
            />
          ) : null}
          <ProjectStatusSheet
            className="shrink-0"
            status={status}
            options={statusOptions}
            disabled={updating}
            onSelect={handleStatusChange}
          />
          <CountBadge
            label={t(typeMeta.labelKey)}
            display="inline"
            tone="none"
            className={cn(typeMeta.accent.badge)}
          />
          {project.isOverdue ? (
            <OverdueBadge label={t("projects.badges.overdue")} />
          ) : null}
          {!project.isOverdue && project.isDueSoon ? (
            <DueSoonBadge label={t("projects.badges.dueSoon")} />
          ) : null}
          {project.group ? (
            <LinkWithOverlay
              href={`/app/project-groups/${project.group.id}`}
              className="inline-flex"
            >
              <CountBadge
                icon={<FolderKanban className="h-4 w-4" />}
                label={project.group.name}
                display="inline"
                tone="none"
                className="border border-slate-200 bg-slate-100 text-slate-600 transition-colors hover:text-primary-700"
              />
            </LinkWithOverlay>
          ) : null}
          {project.zones && project.zones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {project.zones.map((zone) => (
                <CountBadge
                  key={zone.id}
                  label={zone.name}
                  display="inline"
                  tone="none"
                  className="border border-slate-200 bg-slate-100 text-slate-600"
                />
              ))}
            </div>
          )}
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className={cn(("flex flex-col rounded-lg"), !isMobile && "bg-stone-50", isMobile && "space-y-2")}>
        {/* Mobile: TabSheet */}
        {isMobile ? (
          <TabSheet
            currentTab={tab}
            tabs={TABS}
            onSelect={(selectedTab) => setTab(selectedTab as typeof TABS[number])}
          />
        ) : (
          /* Desktop: Horizontal tabs */
          <div className="border border-slate-200 bg-white overflow-x-scroll rounded-t-lg shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-200 bg-slate-50/30">
              {TABS.map((tabKey) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setTab(tabKey)}
                  className={cn(
                    "flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap border-b-2 relative",
                    tab === tabKey
                      ? "border-primary-600 text-primary-700  font-semibold shadow-sm"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  )}
                >
                  {t(`projects.tabs.${tabKey}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className={cn(
          "min-h-72",
          isMobile ? "" : "p-6 border-l border-r border-b border-slate-200 rounded-b-lg shadow-sm"
        )}>
          {tab === "description" ? (
            <div className="space-y-8 px-2">
              <ProjectDescriptionTab
                project={{ ...project, description: projectDescription }}
                onDescriptionUpdated={setProjectDescription}
              />
            </div>
          ) : null}

          {tab === "metrics" ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-slate-900">{t("projects.tabs.metrics")}</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-500 rounded-lg">
                      <Coins className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-sm font-semibold text-emerald-800 uppercase tracking-wider">
                      {t("projects.metrics.budget")}
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                      <span className="text-emerald-700">{t("projects.metrics.planned")}</span>
                      <span className="font-bold text-emerald-900">
                        {formatCurrency(project.planned_budget ?? 0, locale)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                      <span className="text-emerald-700">{t("projects.metrics.actual")}</span>
                      <span
                        className={cn(
                          "font-bold",
                          project.actual_cost_cached > project.planned_budget ? "text-rose-600" : "text-emerald-900"
                        )}
                      >
                        {formatCurrency(project.actual_cost_cached ?? 0, locale)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <CalendarDays className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-sm font-semibold text-blue-800 uppercase tracking-wider">
                      {t("projects.metrics.schedule")}
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                      <span className="text-blue-700">{t("projects.fields.startDate")}</span>
                      <span className="font-semibold text-blue-900">{formatDate(project.start_date, locale)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                      <span className="text-blue-700">{t("projects.fields.dueDate")}</span>
                      <span className="font-semibold text-blue-900">{formatDate(project.due_date, locale)}</span>
                    </div>
                    {project.closed_at ? (
                      <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                        <span className="text-blue-700">{t("projects.fields.closedAt")}</span>
                        <span className="font-semibold text-blue-900">{formatDate(project.closed_at, locale)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <span className="text-white text-sm font-bold">#</span>
                    </div>
                    <div className="text-sm font-semibold text-purple-800 uppercase tracking-wider">
                      {t("projects.metrics.summary")}
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-purple-700 font-medium mb-1">Tâches</div>
                      <div className="text-purple-900 font-semibold">
                        {t("projects.metrics.tasksSummary", { open: openTodos, done: doneTodos })}
                      </div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg">
                      <div className="text-purple-700 font-medium mb-1">Documents</div>
                      <div className="text-purple-900 font-semibold">
                        {t("projects.metrics.documentsCount", { count: documentsCount })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "timeline" ? (
            <ProjectTimeline projectId={project.id} />
          ) : null}

          {tab === "notes" ? (
            <NoteTab projectId={project.id} onRefresh={onRefresh} />
          ) : null}

          {tab === "tasks" ? (
            <ProjectTasksPanel
              projectId={project.id}
              projectZones={project.zones?.map(zone => ({
                id: zone.id,
                name: zone.name,
                parent_id: zone.parent_id
              }))}
            />
          ) : null}

          {tab === "links" ? (
            <ProjectLinksPanel
              projectId={project.id}
              projectZones={project.zones?.map(zone => ({
                id: zone.id,
                name: zone.name,
                parent_id: zone.parent_id,
              }))}
              links={interactionsData.links}
              onRefresh={onRefresh}
            />
          ) : null}

          {tab === "documents" ? (
            <ProjectDocumentsPanel documents={interactionsData.documents} />
          ) : null}

          {tab === "photos" ? (
            <PhotoGrid
              photos={projectPhotos}
              previews={photoPreviews}
              loading={photosLoading}
              error={combinedPhotoError}
              onRefresh={refreshProjectPhotos}
            />
          ) : null}

          {tab === "expenses" ? (
            <ProjectExpensesPanel expenses={interactionsData.expenses} />
          ) : null}
        </div>
      </div>

      {project.group ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("projects.relatedProjects.title", { group: project.group.name })}
            </h2>
            {typeof project.group.projectsCount === "number" ? (
              <p className="text-sm text-slate-500">
                {t("projects.relatedProjects.count", { count: project.group.projectsCount })}
              </p>
            ) : null}
          </div>

          {relatedProjects.length ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {relatedProjectsToShow.map((relatedProject) => (
                  <ProjectCard key={relatedProject.id} project={relatedProject} />
                ))}
              </div>

              {relatedProjects.length > RELATED_PROJECTS_PAGE_SIZE ? (
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {t("projects.relatedProjects.showing", {
                      displayed: displayedRelatedCount,
                      total: relatedProjects.length,
                    })}
                  </p>
                  {hasMoreRelatedProjects ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setVisibleRelatedCount((count) =>
                          Math.min(count + RELATED_PROJECTS_PAGE_SIZE, relatedProjects.length)
                        )
                      }
                    >
                      {t("projects.relatedProjects.loadMore", {
                        count: nextBatchSize,
                      })}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              {t("projects.relatedProjects.empty", { group: project.group.name })}
            </div>
          )}
        </div>
      ) : null}

      <AuditHistoryCard
        lines={auditLines}
        actions={<ProjectDeleteButton project={project} onDeleted={onRefresh} />}
      />
    </div>
  );
}
