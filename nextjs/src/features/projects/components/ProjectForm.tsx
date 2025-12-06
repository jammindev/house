"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Project, ProjectPriority, ProjectStatus, ProjectType } from "@projects/types";
import { PROJECT_PRIORITY_OPTIONS, PROJECT_STATUSES, PROJECT_TYPE_META, PROJECT_TYPES } from "@projects/constants";
import { useProjectGroups } from "@project-groups/hooks/useProjectGroups";
import { ZonePicker } from "@interactions/components/ZonePicker";
import type { ZoneOption } from "@interactions/types";

type Mode = "create" | "edit";

interface ProjectFormProps {
  project?: Project;
  mode?: Mode;
  onSuccess?: (projectId: string) => void;
  zones: ZoneOption[];
  zonesLoading?: boolean;
}

interface ProjectFormData {
  title: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  type: ProjectType;
  startDate: string;
  dueDate: string;
  plannedBudget: string;
  tagsInput: string;
  projectGroupId: string;
  selectedZones: string[];
}

const ensureTagsArray = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export default function ProjectForm({ project, mode = "create", onSuccess, zones, zonesLoading = false }: ProjectFormProps) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const { show } = useToast();

  const isEdit = mode === "edit" && Boolean(project);

  // State to maintain loading until redirection
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Find the first root zone (zone with no parent) to use as default
  const defaultZone = useMemo(() => {
    const rootZones = zones.filter(zone => !zone.parent_id);
    return rootZones.length > 0 ? [rootZones[0].id] : [];
  }, [zones]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
    reset
  } = useForm<ProjectFormData>({
    defaultValues: {
      title: project?.title ?? "",
      description: project?.description ?? "",
      status: project?.status ?? "draft",
      priority: project?.priority ?? 3,
      type: project?.type ?? "other",
      startDate: project?.start_date ?? "",
      dueDate: project?.due_date ?? "",
      plannedBudget: project?.planned_budget != null ? project.planned_budget.toString() : "",
      tagsInput: project?.tags?.join(", ") ?? "",
      projectGroupId: project?.project_group_id ?? "",
      selectedZones: project?.zones?.map(z => z.id) ?? defaultZone
    }
  });

  const watchedType = watch("type");
  const watchedSelectedZones = watch("selectedZones");

  const tagHint = useMemo(() => t("projects.form.tagsHint"), [t]);
  const { groups: groupOptions, loading: groupsLoading, error: groupsError } = useProjectGroups();
  const typeMeta = PROJECT_TYPE_META[watchedType] ?? PROJECT_TYPE_META.other;
  const typeHelperText = t(typeMeta.helperKey);

  const handleTypeChange = useCallback((nextType: ProjectType) => {
    setValue("type", nextType);
    const meta = PROJECT_TYPE_META[nextType];
    // Auto-adjust defaults if not manually changed yet
    if (!isEdit) {
      setValue("status", meta.defaults.status);
      setValue("priority", meta.defaults.priority);
    }
  }, [setValue, isEdit]);

  const handleAddSuggestedTag = useCallback((tag: string) => {
    const currentTagsInput = watch("tagsInput");
    const currentTags = ensureTagsArray(currentTagsInput);
    if (currentTags.includes(tag)) return;
    const nextTags = [...currentTags, tag];
    setValue("tagsInput", nextTags.join(", "));
  }, [watch, setValue]);

  // Reset form when project prop changes (for edit mode)
  useEffect(() => {
    if (isEdit && project) {
      reset({
        title: project.title ?? "",
        description: project.description ?? "",
        status: project.status ?? "draft",
        priority: project.priority ?? 3,
        type: project.type ?? "other",
        startDate: project.start_date ?? "",
        dueDate: project.due_date ?? "",
        plannedBudget: project.planned_budget != null ? project.planned_budget.toString() : "",
        tagsInput: project.tags?.join(", ") ?? "",
        projectGroupId: project.project_group_id ?? "",
        selectedZones: project.zones?.map(z => z.id) ?? defaultZone
      });
    }
  }, [isEdit, project, reset, defaultZone]);

  // Set default zone when zones load and no zone is selected yet (for create mode)
  useEffect(() => {
    if (!isEdit && defaultZone.length > 0) {
      const currentZones = watch("selectedZones");
      if (currentZones.length === 0) {
        setValue("selectedZones", defaultZone);
      }
    }
  }, [defaultZone, isEdit, watch, setValue]);

  const groupIds = useMemo(() => new Set(groupOptions.map((g) => g.id)), [groupOptions]);
  const currentProjectGroupId = watch("projectGroupId");
  const hasCurrentGroupOption = currentProjectGroupId ? groupIds.has(currentProjectGroupId) : true;

  const onSubmit: SubmitHandler<ProjectFormData> = useCallback(
    async (data) => {
      if (!householdId) return;

      clearErrors();
      setIsRedirecting(false); // Reset redirection state at start

      const trimmedTitle = data.title.trim();
      if (!trimmedTitle) {
        setError("title", { message: t("projects.form.errorTitleRequired") });
        return;
      }

      if (data.dueDate && data.startDate && data.dueDate < data.startDate) {
        setError("dueDate", { message: t("projects.form.errorDates") });
        return;
      }

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const parsedBudget = data.plannedBudget ? Number(data.plannedBudget) : 0;

        const baseFields = {
          title: trimmedTitle,
          description: data.description.trim(),
          status: data.status,
          priority: data.priority,
          type: data.type,
          start_date: data.startDate || null,
          due_date: data.dueDate || null,
          planned_budget: parsedBudget,
          tags: ensureTagsArray(data.tagsInput),
          project_group_id: data.projectGroupId || null,
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

          // Handle zones: delete old ones and add new ones
          const { error: deleteZonesError } = await (client as any)
            .from("project_zones")
            .delete()
            .eq("project_id", project.id);
          if (deleteZonesError) throw deleteZonesError;

          if (data.selectedZones.length > 0) {
            const zoneInserts = data.selectedZones.map((zoneId: string) => ({
              project_id: project.id,
              zone_id: zoneId,
            }));
            const { error: insertZonesError } = await (client as any)
              .from("project_zones")
              .insert(zoneInserts);
            if (insertZonesError) throw insertZonesError;
          }

          show({ title: t("projects.form.successUpdate"), variant: "success" });
          setIsRedirecting(true);
          onSuccess?.(project.id);
        } else {
          const insertPayload = {
            household_id: householdId,
            ...baseFields,
          };
          const { data: insertedData, error: insertError } = await client
            .from("projects")
            .insert(insertPayload)
            .select("id")
            .single();
          if (insertError) throw insertError;
          const newId = insertedData?.id;

          // Add selected zones
          if (newId && data.selectedZones.length > 0) {
            const zoneInserts = data.selectedZones.map((zoneId: string) => ({
              project_id: newId,
              zone_id: zoneId,
            }));
            const { error: insertZonesError } = await (client as any)
              .from("project_zones")
              .insert(zoneInserts);
            if (insertZonesError) throw insertZonesError;
          }

          show({ title: t("projects.form.successCreate"), variant: "success" });
          if (newId) {
            setIsRedirecting(true);
            onSuccess?.(newId);
          }
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t("common.unexpectedError");
        setError("root", { message });
        setIsRedirecting(false);
      }
    },
    [
      householdId,
      isEdit,
      project,
      onSuccess,
      show,
      t,
      setError,
      clearErrors
    ]
  );

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 py-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.title")}</label>
              <Input
                {...register("title", { required: t("projects.form.errorTitleRequired") })}
                placeholder={t("projects.form.titlePlaceholder")}
              />
              {errors.title && (
                <span className="text-xs text-red-600">{errors.title.message}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.type")}</label>
              <select
                {...register("type")}
                onChange={(event) => handleTypeChange(event.target.value as ProjectType)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PROJECT_TYPES.map((projectType) => (
                  <option key={projectType} value={projectType}>
                    {t(`projects.types.${projectType}.label`)}
                  </option>
                ))}
              </select>
              {typeHelperText ? <span className="text-xs text-slate-500">{typeHelperText}</span> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.status")}</label>
              <select
                {...register("status")}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PROJECT_STATUSES.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {t(`projects.status.${statusOption}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.priority")}</label>
              <select
                {...register("priority", { valueAsNumber: true })}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PROJECT_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2 md:max-w-sm">
              <label className="text-sm font-medium text-slate-700">
                {t("projects.fields.plannedBudget")}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                {...register("plannedBudget")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.projectGroup")}</label>
              <select
                {...register("projectGroupId")}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={groupsLoading}
              >
                <option value="">{groupsLoading ? t("projects.form.groupLoading") : t("projects.form.groupNone")}</option>
                {!hasCurrentGroupOption && currentProjectGroupId ? (
                  <option value={currentProjectGroupId}>
                    {project?.project_group?.name || t("projects.form.groupCurrent")}
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
              <Input type="date" {...register("startDate")} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{t("projects.fields.dueDate")}</label>
              <Input type="date" {...register("dueDate")} />
              {errors.dueDate && (
                <span className="text-xs text-red-600">{errors.dueDate.message}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              {t("projects.fields.zones")}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {t("projects.form.zonesHelper")}
              </span>
            </label>
            {zonesLoading ? (
              <div className="p-4 text-center text-sm text-slate-500">
                {t("projects.form.zonesLoading")}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 p-3">
                <ZonePicker
                  zones={zones}
                  value={watchedSelectedZones}
                  onChange={(zonesOrFunction) => {
                    if (typeof zonesOrFunction === 'function') {
                      setValue("selectedZones", zonesOrFunction(watchedSelectedZones));
                    } else {
                      setValue("selectedZones", zonesOrFunction);
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">{t("projects.fields.tags")}</label>
            <Input
              {...register("tagsInput")}
              placeholder={t("projects.form.tagsPlaceholder")}
            />
            <span className="text-xs text-slate-500">{tagHint}</span>
            {typeMeta.suggestedTags.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">{t("projects.form.suggestedTagsLabel")}</span>
                {typeMeta.suggestedTags.map((tag: string) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddSuggestedTag(tag)}
                    className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              {t("projects.fields.description")}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {t("projects.form.descriptionHelper")}
              </span>
            </label>
            <Textarea
              {...register("description")}
              rows={6}
              placeholder={t("projects.form.descriptionPlaceholder")}
            />
          </div>

          {errors.root && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
              {errors.root.message}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-end border-t border-slate-200 bg-slate-50 py-4">
          <Button type="submit" disabled={isSubmitting || isRedirecting}>
            {(isSubmitting || isRedirecting) ? t("projects.form.submitting") : isEdit ? t("projects.form.update") : t("projects.form.create")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
