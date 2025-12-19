"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { ZonePicker } from "@interactions/components/ZonePicker";
import { useZones } from "@zones/hooks/useZones";
import type { ProjectFormData } from "../../types";
import type { ProjectStatus } from "../../types";
import { PROJECT_STATUSES } from "../../constants";
import { projectDetailsSchema, type ProjectDetailsFormData } from "../../lib/schemas";

interface ProjectDetailsStepProps {
  formData: ProjectFormData;
  onUpdate: (data: ProjectFormData) => void;
  onNext: () => void;
  onCancel: () => void;
}

export function ProjectDetailsStep({
  formData,
  onUpdate,
  onNext,
  onCancel,
}: ProjectDetailsStepProps) {
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { zones, loading: zonesLoading } = useZones();

  // Initialize react-hook-form with Zod validation
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProjectDetailsFormData>({
    resolver: zodResolver(projectDetailsSchema),
    defaultValues: {
      description: formData.description || "",
      status: formData.status,
      priority: formData.priority,
      startDate: formData.startDate,
      dueDate: formData.dueDate,
      tags: formData.tags,
      plannedBudget: formData.plannedBudget,
      zoneIds: formData.zoneIds,
    },
  });

  // Preselect the first root zone (zone without parent) on mount
  useEffect(() => {
    if (zones.length > 0 && formData.zoneIds.length === 0) {
      const rootZones = zones.filter(zone => !zone.parent_id);
      if (rootZones.length > 0) {
        setValue("zoneIds", [rootZones[0].id]);
      }
    }
  }, [zones, formData.zoneIds, setValue]); // Only run when zones load or zoneIds change

  const onSubmit = (data: ProjectDetailsFormData) => {
    onUpdate(data as ProjectFormData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">
          {t("projects.fields.status")} <span className="text-destructive">*</span>
        </Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              id="status"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PROJECT_STATUSES.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {t(`projects.status.${statusOption}`)}
                </option>
              ))}
            </select>
          )}
        />
        {errors.status && (
          <p className="text-sm text-destructive">{errors.status.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">{t("projects.fields.description")}</Label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              id="description"
              placeholder={t("projects.form.descriptionPlaceholder")}
              rows={4}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">
          {t("projects.wizard.descriptionHelper")}
        </p>
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Zones */}
      <div className="space-y-2">
        <Label>
          {t("projects.fields.zones")} <span className="text-destructive">*</span>
        </Label>
        <Controller
          name="zoneIds"
          control={control}
          render={({ field }) => (
            <ZonePicker
              zones={zones}
              value={field.value}
              onChange={(zoneIds) => {
                const ids = typeof zoneIds === 'function' ? zoneIds(field.value) : zoneIds;
                field.onChange(ids);
              }}
            />
          )}
        />
        {errors.zoneIds && (
          <p className="text-sm text-destructive">{t(errors.zoneIds.message || "projects.wizard.zonesRequired")}</p>
        )}
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor="priority">
          {t("projects.fields.priority")}: {watch("priority")}
        </Label>
        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <Slider
              id="priority"
              min={1}
              max={5}
              step={1}
              value={[field.value]}
              onValueChange={([value]: number[]) => field.onChange(value)}
            />
          )}
        />
        {errors.priority && (
          <p className="text-sm text-destructive">{errors.priority.message}</p>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">{t("projects.fields.startDate")}</Label>
          <Controller
            name="startDate"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="startDate"
                type="date"
                value={field.value || ""}
                onChange={(e) => field.onChange(e.target.value || undefined)}
              />
            )}
          />
          {errors.startDate && (
            <p className="text-sm text-destructive">{errors.startDate.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">{t("projects.fields.dueDate")}</Label>
          <Controller
            name="dueDate"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="dueDate"
                type="date"
                value={field.value || ""}
                onChange={(e) => field.onChange(e.target.value || undefined)}
              />
            )}
          />
          {errors.dueDate && (
            <p className="text-sm text-destructive">{errors.dueDate.message}</p>
          )}
        </div>
      </div>

      {/* Planned Budget */}
      <div className="space-y-2">
        <Label htmlFor="budget">{t("projects.fields.plannedBudget")}</Label>
        <Controller
          name="plannedBudget"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              id="budget"
              type="number"
              min="0"
              step="0.01"
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.00"
            />
          )}
        />
        {errors.plannedBudget && (
          <p className="text-sm text-destructive">{errors.plannedBudget.message}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">{t("projects.fields.tags")}</Label>
        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              id="tags"
              value={field.value.join(", ")}
              onChange={(e) =>
                field.onChange(
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                )
              }
              placeholder={t("projects.form.tagsPlaceholder")}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">
          {t("projects.form.tagsHint")}
        </p>
        {errors.tags && (
          <p className="text-sm text-destructive">{errors.tags.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel} type="button">
          {t("projects.wizard.cancel")}
        </Button>
        <Button type="submit">
          {t("projects.wizard.next")}
        </Button>
      </div>
    </form>
  );
}
