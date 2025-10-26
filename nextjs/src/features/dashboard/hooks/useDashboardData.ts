"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeProjectFlags } from "@projects/utils/projectFlags";
import type { Project, ProjectMetrics, ProjectWithMetrics } from "@projects/types";
import type { SupabaseDocumentRow } from "@documents/types";
import { normalizeDocuments } from "@documents/utils/normalizeDocuments";

import type {
  DashboardDocumentItem,
  DashboardResult,
  DashboardState,
  DashboardSummaryMetric,
  DashboardTodoItem,
} from "../types";
import { createInitialDashboardState } from "../utils/state";

const TODO_STATUS_FILTER = ["pending", "in_progress"] as const;
const TODO_DUE_SOON_THRESHOLD_DAYS = 3;

const MS_IN_DAY = 1000 * 60 * 60 * 24;

type SupabaseInteractionSummary = {
  id: string;
  subject: string | null;
  content: string | null;
  occurred_at: string | null;
  created_at: string;
  type: string | null;
};

type SupabaseTodoRow = {
  id: string;
  subject: string | null;
  status: string | null;
  occurred_at: string | null;
  created_at: string;
};

type SupabaseDocumentLinkCountRow = {
  id: string;
  interaction_documents: { interaction_id: string }[] | null;
};

type SummaryResult = {
  metrics: DashboardSummaryMetric[];
  recentInteractions: DashboardState["recentInteractions"];
};

type ProjectResult = ProjectWithMetrics[];

type DocumentsResult = DashboardState["documents"];

const createTodoFlags = (occurredAt: string | null): Pick<DashboardTodoItem, "isDueSoon" | "isOverdue"> => {
  if (!occurredAt) {
    return {
      isDueSoon: false,
      isOverdue: false,
    };
  }

  const due = new Date(occurredAt);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (due < today) {
    return {
      isDueSoon: false,
      isOverdue: true,
    };
  }

  const deltaDays = (due.getTime() - today.getTime()) / MS_IN_DAY;

  return {
    isOverdue: false,
    isDueSoon: deltaDays >= 0 && deltaDays <= TODO_DUE_SOON_THRESHOLD_DAYS,
  };
};

const fetchSummary = async (
  client: SupabaseClient,
  householdId: string
): Promise<SummaryResult> => {
  const [{ data: interactionsData, count: interactionCount, error: interactionsError }, { count: zoneCount, error: zoneError }, { count: contactCount, error: contactError }] =
    await Promise.all([
      client
        .from("interactions")
        .select(
          "id, subject, content, occurred_at, created_at, type",
          { count: "exact" }
        )
        .eq("household_id", householdId)
        .order("occurred_at", { ascending: false, nullsLast: false })
        .order("created_at", { ascending: false })
        .limit(5),
      client
        .from("zones")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId),
      client
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId),
    ]);

  if (interactionsError) throw interactionsError;
  if (zoneError) throw zoneError;
  if (contactError) throw contactError;

  const interactions = (interactionsData ?? []) as SupabaseInteractionSummary[];
  const recentInteractions = {
    total: interactionCount ?? 0,
    items: interactions.map((interaction) => ({
      id: interaction.id,
      subject: interaction.subject,
      content: interaction.content,
      occurredAt: interaction.occurred_at,
      createdAt: interaction.created_at,
      type: interaction.type,
    })),
  };

  const metrics: DashboardSummaryMetric[] = [
    {
      key: "interactions",
      total: interactionCount ?? 0,
      labelKey: "dashboard.interactions",
      descriptionKey: "dashboard.totalInHousehold",
    },
    {
      key: "contacts",
      total: contactCount ?? 0,
      labelKey: "dashboard.contacts",
      descriptionKey: "dashboard.peopleAndVendors",
    },
    {
      key: "zones",
      total: zoneCount ?? 0,
      labelKey: "dashboard.zones",
      descriptionKey: "dashboard.roomsAndAreas",
    },
  ];

  return {
    metrics,
    recentInteractions,
  };
};

const fetchTodos = async (
  client: SupabaseClient,
  householdId: string
): Promise<DashboardTodoItem[]> => {
  const { data, error } = await client
    .from("interactions")
    .select("id, subject, status, occurred_at, created_at")
    .eq("household_id", householdId)
    .eq("type", "todo")
    .in("status", [...TODO_STATUS_FILTER])
    .order("occurred_at", { ascending: true, nullsLast: false })
    .order("created_at", { ascending: true })
    .limit(15);

  if (error) throw error;

  const rows = (data ?? []) as SupabaseTodoRow[];
  return rows.map((row) => {
    const flags = createTodoFlags(row.occurred_at);
    return {
      id: row.id,
      subject: row.subject,
      status: row.status,
      occurredAt: row.occurred_at,
      createdAt: row.created_at,
      ...flags,
    };
  });
};

const fetchProjects = async (
  client: SupabaseClient,
  householdId: string
): Promise<ProjectResult> => {
  const { data, error } = await client
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
    .in("status", ["active", "draft"])
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  const typedProjects = (data ?? []) as Project[];
  const ids = typedProjects.map((item) => item.id);

  let metricsByProject = new Map<string, ProjectMetrics>();
  if (ids.length) {
    const { data: metricsRows, error: metricsError } = await client
      .from("project_metrics")
      .select("project_id, open_todos, done_todos, documents_count, actual_cost")
      .in("project_id", ids);
    if (metricsError) throw metricsError;
    metricsByProject = new Map(
      (metricsRows ?? []).map((item) => [item.project_id, item as ProjectMetrics])
    );
  }

  return typedProjects.map((project) => {
    const metrics = metricsByProject.get(project.id) ?? null;
    const flags = computeProjectFlags(project, metrics);
    return {
      ...project,
      metrics,
      ...flags,
    };
  });
};

const fetchDocuments = async (
  client: SupabaseClient,
  householdId: string
): Promise<DocumentsResult> => {
  const [{ data, error }, { data: linkRows, error: linkError }] = await Promise.all([
    client
      .from("documents")
      .select(
        `
          id,
          household_id,
          file_path,
          name,
          notes,
          mime_type,
          type,
          metadata,
          created_at,
          created_by,
          interaction_documents (
            interaction_id,
            interaction:interactions (
              id,
              subject
            )
          )
        `
      )
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(5),
    client
      .from("documents")
      .select(
        `
          id,
          interaction_documents (
            interaction_id
          )
        `
      )
      .eq("household_id", householdId),
  ]);

  if (error) throw error;
  if (linkError) throw linkError;

  const normalized = normalizeDocuments(data as SupabaseDocumentRow[] | null);
  const items: DashboardDocumentItem[] = normalized.map((doc) => ({
    ...doc,
    hasLinks: doc.links.length > 0,
  }));

  const linkRowsSafe = (linkRows ?? []) as SupabaseDocumentLinkCountRow[];
  const unlinkedCount = linkRowsSafe.reduce((count, row) => {
    const links = row.interaction_documents ?? [];
    return links.length === 0 ? count + 1 : count;
  }, 0);

  return {
    items,
    unlinkedCount,
  };
};

export function useDashboardData(): DashboardResult {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardState>(() => createInitialDashboardState());

  const load = useCallback(async () => {
    if (!householdId) {
      setData(createInitialDashboardState());
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const [summary, todos, projects, documents] = await Promise.all([
        fetchSummary(client, householdId),
        fetchTodos(client, householdId),
        fetchProjects(client, householdId),
        fetchDocuments(client, householdId),
      ]);

      setData({
        summary: summary.metrics,
        recentInteractions: summary.recentInteractions,
        todos,
        projects,
        documents,
      });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
      setData(createInitialDashboardState());
    } finally {
      setLoading(false);
    }
  }, [householdId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    error,
    ...data,
  };
}
