"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Cuboid, Folder, Pin } from "lucide-react";

import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import ProjectCard from "@projects/components/project-card/ProjectCard";
import type { Project, ProjectMetrics, ProjectWithMetrics } from "@projects/types";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { computeProjectFlags } from "@projects/utils/projectFlags";
import { sortProjectsByPinAndUpdate } from "@projects/utils/sortProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function DashboardPinnedProjects() {
  const { selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const [projects, setProjects] = useState<ProjectWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedHouseholdId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      
      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // Get user's pinned project IDs
      const { data: pinnedData, error: pinnedError } = await client
        .from("user_pinned_projects")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("household_id", selectedHouseholdId);

      if (pinnedError) throw pinnedError;
      
      const pinnedProjectIds = (pinnedData ?? []).map((item) => item.project_id);
      
      if (!pinnedProjectIds.length) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const { data: projectRows, error: projectsError } = await client
        .from("projects")
        .select(
          `
            id,
            household_id,
            title,
            description,
            status,
            priority,
            type,
            start_date,
            due_date,
            closed_at,
            tags,
            planned_budget,
            actual_cost_cached,
            cover_interaction_id,
            project_group_id,
            is_pinned,
            project_group:project_groups (
              id,
              name
            ),
            created_at,
            updated_at,
            created_by,
            updated_by
          `
        )
        .eq("household_id", selectedHouseholdId)
        .in("id", pinnedProjectIds)
        .order("updated_at", { ascending: false });

      if (projectsError) throw projectsError;

      const typedProjects = (projectRows ?? []) as Project[];
      const projectIds = typedProjects.map((item) => item.id);
      const groupIds = Array.from(
        new Set(
          typedProjects
            .map((item) => item.project_group_id)
            .filter((value): value is string => Boolean(value))
        )
      );

      let metricsByProject = new Map<string, ProjectMetrics>();
      if (projectIds.length) {
        const { data: metricsRows, error: metricsError } = await client
          .from("project_metrics")
          .select("project_id, open_todos, done_todos, documents_count, actual_cost")
          .in("project_id", projectIds);
        if (metricsError) throw metricsError;
        metricsByProject = new Map(
          (metricsRows ?? []).map((item) => [item.project_id, item as ProjectMetrics])
        );
      }

      let groupCountsById = new Map<string, number>();
      if (groupIds.length) {
        const { data: groupMetricsRows, error: groupMetricsError } = await client
          .from("project_group_metrics")
          .select("group_id, projects_count")
          .in("group_id", groupIds);
        if (groupMetricsError) throw groupMetricsError;
        groupCountsById = new Map(
          (groupMetricsRows ?? []).map(
            (item) => [item.group_id as string, (item as { projects_count: number }).projects_count]
          )
        );
      }

      const enriched: ProjectWithMetrics[] = typedProjects.map((project) => {
        const metrics = metricsByProject.get(project.id) ?? null;
        const flags = computeProjectFlags(project, metrics);
        const groupRecord = (project.project_group as { id: string; name: string } | null) ?? null;
        const projectsCount = groupRecord ? groupCountsById.get(groupRecord.id) : undefined;
        const group = groupRecord ? { ...groupRecord, projectsCount } : null;
        return {
          ...project,
          metrics,
          ...flags,
          group,
        };
      });

      setProjects(sortProjectsByPinAndUpdate(enriched));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-2">
      <header className="flex  gap-2 justify-between items-center">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4" />
          <h2 className="text-lg font-semibold text-foreground">{t("dashboard.pinnedProjects.title")}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="justify-start gap-1 text-primary-700">
            <LinkWithOverlay href="/app/projects">
              {t("dashboard.pinnedProjects.viewAll")}
              <ArrowRight className="h-4 w-4" />
            </LinkWithOverlay>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-primary-700"
            title={t("dashboard.pinnedProjects.openSketchup")}
          >
            <a href="https://app.sketchup.com/app" target="_blank" rel="noreferrer">
              <Cuboid className="h-4 w-4" />
              <span className="sr-only">{t("dashboard.pinnedProjects.openSketchup")}</span>
            </a>
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-48 rounded-xl border border-slate-200 bg-slate-100/60 animate-pulse" />
          ))}
        </div>
      ) : projects.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Folder className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("dashboard.pinnedProjects.empty")}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t("dashboard.pinnedProjects.hint")}</p>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <LinkWithOverlay href="/app/projects">{t("dashboard.pinnedProjects.viewAll")}</LinkWithOverlay>
          </Button>
        </div>
      )}
    </section>
  );
}
