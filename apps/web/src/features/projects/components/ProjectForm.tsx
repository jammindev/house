"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Project, ProjectPriority, ProjectStatus } from "@projects/types";
import { PROJECT_PRIORITY_OPTIONS, PROJECT_STATUSES } from "@projects/constants";
import { useProjectGroups } from "@project-groups/hooks/useProjectGroups";

type Mode = "create" | "edit";

interface ProjectFormProps {
  project?: Project;
  mode?: Mode;
  onSuccess?: (projectId: string) => void;
}

const ensureTagsArray = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export default function ProjectForm({ project, mode = "create", onSuccess }: ProjectFormProps) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const { show } = useToast();

  const isEdit = mode === "edit" && Boolean(project);

  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "draft");
  const [priority, setPriority] = useState<ProjectPriority>(project?.priority ?? 3);
  const [startDate, setStartDate] = useState(project?.start_date ?? "");
  const [dueDate, setDueDate] = useState(project?.due_date ?? "");
  const [plannedBudget, setPlannedBudget] = useState(
    project?.planned_budget != null ? project.planned_budget.toString() : ""
  );
  const [tagsInput, setTagsInput] = useState(project?.tags?.join(", ") ?? "");
  const [projectGroupId, setProjectGroupId] = useState(project?.project_group_id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const tagHint = useMemo(() => t("projects.form.tagsHint"), [t]);
  const { groups: groupOptions, loading: groupsLoading, error: groupsError } = useProjectGroups();

  // Ensure the group selector reflects changes when editing and the project prop updates
  useEffect(() => {
    if (isEdit && project) {
      setProjectGroupId(project.project_group_id ?? "");
    }
  }, [isEdit, project]);

  const groupIds = useMemo(() => new Set(groupOptions.map((g) => g.id)), [groupOptions]);
  const hasCurrentGroupOption = projectGroupId ? groupIds.has(projectGroupId) : true;

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!householdId) return;
      if (submitting) return;

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        setError(t("projects.form.errorTitleRequired"));
        return;
      }

      if (dueDate && startDate && dueDate < startDate) {
        setError(t("projects.form.errorDates"));
        return;
      }

      setSubmitting(true);
      setError("");

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const parsedBudget = plannedBudget ? Number(plannedBudget) : 0;

        const baseFields = {
          title: trimmedTitle,
          description: description.trim(),
          status,
          priority,
          start_date: startDate || null,
          due_date: dueDate || null,
          planned_budget: parsedBudget,
          tags: ensureTagsArray(tagsInput),
          project_group_id: projectGroupId || null,
        } as const;

        if (isEdit && project) {
          const updatePayload = { ...baseFields };
          const { data: updated, error: updateError } = await client
            .from("projects")
            .update(updatePayload)
            .eq("id", project.id)
            .eq("household_id", householdId)
            .select("id, project_group_id")
            .single();
          if (updateError) throw updateError;
          if (!updated?.id) throw new Error(t("common.unexpectedError"));
          show({ title: t("projects.form.successUpdate"), variant: "success" });
          onSuccess?.(project.id);
        } else {
          const insertPayload = {
            household_id: householdId,
            ...baseFields,
          };
          const { data, error: insertError } = await client
            .from("projects")
            .insert(insertPayload)
            .select("id")
            .single();
          if (insertError) throw insertError;
          const newId = data?.id;
          show({ title: t("projects.form.successCreate"), variant: "success" });
          if (newId) onSuccess?.(newId);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t("common.unexpectedError");
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      description,
      dueDate,
      householdId,
      isEdit,
      onSuccess,
      plannedBudget,
      priority,
      project,
      projectGroupId,
      show,
      startDate,
      status,
      submitting,
      t,
      tagsInput,
      title,
    ]
  );

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.title")}</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("projects.form.titlePlaceholder")}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.status")}</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ProjectStatus)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PROJECT_STATUSES.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {t(`projects.status.${statusOption}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.priority")}</label>
              <select
                value={priority}
                onChange={(event) => setPriority(Number(event.target.value) as ProjectPriority)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PROJECT_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">
                {t("projects.fields.plannedBudget")}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={plannedBudget}
                onChange={(event) => setPlannedBudget(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.projectGroup")}</label>
              <select
                value={projectGroupId}
                onChange={(e) => setProjectGroupId(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={groupsLoading}
              >
                <option value="">{groupsLoading ? t("projects.form.groupLoading") : t("projects.form.groupNone")}</option>
                {!hasCurrentGroupOption && projectGroupId ? (
                  <option value={projectGroupId}>
                    {project?.group?.name || t("projects.form.groupCurrent")}
                  </option>
                ) : null}
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {groupsError ? (
                <span className="text-xs text-rose-600">{groupsError}</span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.startDate")}</label>
              <Input type="date" value={startDate ?? ""} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.dueDate")}</label>
              <Input type="date" value={dueDate ?? ""} onChange={(event) => setDueDate(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">{t("projects.fields.tags")}</label>
            <Input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder={t("projects.form.tagsPlaceholder")}
            />
            <span className="text-xs text-slate-500">{tagHint}</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              {t("projects.fields.description")}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {t("projects.form.descriptionHelper")}
              </span>
            </label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              placeholder={t("projects.form.descriptionPlaceholder")}
            />
          </div>

          {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</div> : null}
        </CardContent>

        <CardFooter className="flex justify-end border-t border-slate-200 bg-slate-50 py-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? t("projects.form.submitting") : isEdit ? t("projects.form.update") : t("projects.form.create")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
