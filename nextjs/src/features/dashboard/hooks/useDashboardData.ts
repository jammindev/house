"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Project, ProjectMetrics, ProjectStatus, ProjectWithMetrics } from "@projects/types";

import type {
  DashboardData,
  DashboardDocument,
  DashboardInteraction,
  DashboardSummaryMetrics,
  DashboardTask,
} from "@dashboard/types";

type RawDashboardInteraction = {
  id: string;
  subject: string;
  content: string;
  type: string;
  status: string | null;
  occurred_at: string | null;
  created_at: string;
  project: {
    id: string;
    title: string;
    status: ProjectStatus;
  } | null;
};

type RawDashboardTask = RawDashboardInteraction;

type RawDashboardDocument = {
  id: string;
  household_id: string;
  name: string;
  notes: string;
  type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  interaction_documents: {
    interaction_id: string;
    interaction: { id: string; subject: string | null } | null;
  }[] | null;
};

type RawProject = Project;

const EMPTY_DATA: DashboardData = {
  summary: null,
  recentInteractions: [],
  tasks: [],
  highlightProjects: [],
  documents: [],
};

const MS_IN_DAY = 1000 * 60 * 60 * 24;

const computeIsOverdue = (project: ProjectWithMetrics, metrics: ProjectMetrics | null) => {
  if (!project.due_date || project.status === "completed" || project.status === "cancelled") return false;
  const due = new Date(project.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const openTodos = metrics?.open_todos ?? 0;
  return due < today && openTodos > 0;
};

const computeIsDueSoon = (project: ProjectWithMetrics, metrics: ProjectMetrics | null) => {
  if (!project.due_date || project.status === "completed" || project.status === "cancelled") return false;
  const due = new Date(project.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const delta = (due.getTime() - today.getTime()) / MS_IN_DAY;
  const openTodos = metrics?.open_todos ?? 0;
  return delta >= 0 && delta <= 7 && openTodos > 0;
};

export function useDashboardData() {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!householdId) {
      setData(EMPTY_DATA);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const interactionsQuery = client
        .from("interactions")
        .select(
          `
            id,
            subject,
            content,
            type,
            status,
            occurred_at,
            created_at,
            project:projects (
              id,
              title,
              status
            )
          `,
          { count: "exact" }
        )
        .eq("household_id", householdId)
        .order("occurred_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(10);

      const tasksQuery = client
        .from("interactions")
        .select(
          `
            id,
            subject,
            content,
            type,
            status,
            occurred_at,
            created_at,
            project:projects (
              id,
              title,
              status
            )
          `
        )
        .eq("household_id", householdId)
        .eq("type", "todo")
        .in("status", ["pending", "in_progress"])
        .order("occurred_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(5);

      const contactsCountQuery = client
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId);

      const zonesCountQuery = client
        .from("zones")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId);

      const documentsQuery = client
        .from("documents")
        .select(
          `
            id,
            household_id,
            name,
            notes,
            type,
            metadata,
            created_at,
            interaction_documents (
              interaction_id,
              interaction:interactions (
                id,
                subject
              )
            )
          `,
          { count: "exact" }
        )
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(8);

      const projectsQuery = client
        .from("projects")
        .select(
          `
            id,
            household_id,
            title,
            description,
            status,
            priority,
            start_date,
            due_date,
            closed_at,
            tags,
            planned_budget,
            actual_cost_cached,
            cover_interaction_id,
            created_at,
            updated_at,
            created_by,
            updated_by
          `
        )
        .eq("household_id", householdId)
        .in("status", ["active", "draft", "on_hold"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(6);

      const [
        interactionsResponse,
        tasksResponse,
        contactsResponse,
        zonesResponse,
        documentsResponse,
        projectsResponse,
      ] = await Promise.all([
        interactionsQuery,
        tasksQuery,
        contactsCountQuery,
        zonesCountQuery,
        documentsQuery,
        projectsQuery,
      ]);

      if (interactionsResponse.error) throw interactionsResponse.error;
      if (tasksResponse.error) throw tasksResponse.error;
      if (contactsResponse.error) throw contactsResponse.error;
      if (zonesResponse.error) throw zonesResponse.error;
      if (documentsResponse.error) throw documentsResponse.error;
      if (projectsResponse.error) throw projectsResponse.error;

      const rawInteractions = (interactionsResponse.data ?? []) as RawDashboardInteraction[];
      const rawTasks = (tasksResponse.data ?? []) as RawDashboardTask[];
      const rawDocuments = (documentsResponse.data ?? []) as RawDashboardDocument[];
      const rawProjects = (projectsResponse.data ?? []) as RawProject[];

      let metricsByProject = new Map<string, ProjectMetrics>();
      if (rawProjects.length > 0) {
        const { data: metricsRows, error: metricsError } = await client
          .from("project_metrics")
          .select("project_id, open_todos, done_todos, documents_count, actual_cost")
          .in(
            "project_id",
            rawProjects.map((project) => project.id)
          );

        if (metricsError) throw metricsError;

        metricsByProject = new Map(
          (metricsRows ?? []).map((row) => [row.project_id, row as ProjectMetrics])
        );
      }

      const summary: DashboardSummaryMetrics = {
        interactions: interactionsResponse.count ?? 0,
        contacts: contactsResponse.count ?? 0,
        zones: zonesResponse.count ?? 0,
        documents: documentsResponse.count ?? 0,
      };

      const recentInteractions: DashboardInteraction[] = rawInteractions.map((item) => ({
        id: item.id,
        subject: item.subject,
        content: item.content,
        type: item.type as DashboardInteraction["type"],
        status: (item.status ?? null) as DashboardInteraction["status"],
        occurred_at: item.occurred_at ?? item.created_at,
        created_at: item.created_at,
        project: item.project
          ? {
              id: item.project.id,
              title: item.project.title,
              status: item.project.status,
            }
          : null,
      }));

      const tasks: DashboardTask[] = rawTasks.map((item) => ({
        id: item.id,
        subject: item.subject,
        status: (item.status ?? null) as DashboardTask["status"],
        occurred_at: item.occurred_at,
        created_at: item.created_at,
        project: item.project
          ? {
              id: item.project.id,
              title: item.project.title,
              status: item.project.status,
            }
          : null,
      }));

      const documents: DashboardDocument[] = rawDocuments.map((item) => ({
        id: item.id,
        household_id: item.household_id,
        name: item.name,
        notes: item.notes,
        type: (item.type ?? "document") as DashboardDocument["type"],
        metadata: item.metadata,
        created_at: item.created_at,
        links:
          item.interaction_documents?.map((link) => ({
            interactionId: link.interaction_id,
            subject: link.interaction?.subject ?? null,
          })) ?? [],
      }));

      const highlightProjects: ProjectWithMetrics[] = rawProjects
        .map<ProjectWithMetrics>((project) => {
          const metrics = metricsByProject.get(project.id) ?? null;
          const enriched: ProjectWithMetrics = {
            ...project,
            metrics,
            isOverdue: computeIsOverdue(project, metrics),
            isDueSoon: computeIsDueSoon(project, metrics),
          };
          return enriched;
        })
        .filter((project) => project.isOverdue || project.isDueSoon)
        .slice(0, 3);

      setData({ summary, recentInteractions, tasks, highlightProjects, documents });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }, [householdId, t]);

  useEffect(() => {
    setData(EMPTY_DATA);
    if (!householdId) return;
    void load();
  }, [householdId, load]);

  const memoizedData = useMemo(() => data, [data]);

  return {
    ...memoizedData,
    loading,
    error,
    reload: load,
  };
}
