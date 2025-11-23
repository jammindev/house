// nextjs/src/features/equipment/components/EquipmentInteractionForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { getCurrentLocalDateTimeInput } from "@interactions/utils/datetime";
import { INTERACTION_STATUSES } from "@interactions/constants";
import type { InteractionStatus, InteractionType, ZoneOption } from "@interactions/types";
import { EQUIPMENT_EVENT_TYPES } from "../constants";
import type { Equipment } from "../types";

type Props = {
  equipment: Equipment;
  zones: ZoneOption[];
  defaultZoneId?: string | null;
  onCreated?: () => void;
  onCancel?: () => void;
};

type FormValues = {
  type: InteractionType;
  status: InteractionStatus | "none";
  subject: string;
  content: string;
  zone_id: string;
  occurred_at: string;
};

export default function EquipmentInteractionForm({ equipment, zones, defaultZoneId, onCreated, onCancel }: Props) {
  const { t } = useI18n();
  const { show } = useToast();
  const [error, setError] = useState<string | null>(null);

  const defaultValues = useMemo<FormValues>(
    () => ({
      type: "maintenance",
      status: "none",
      subject: "",
      content: "",
      zone_id: defaultZoneId ?? "none",
      occurred_at: getCurrentLocalDateTimeInput(),
    }),
    [defaultZoneId]
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
    setError: setFormError,
  } = useForm<FormValues>({
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const zoneOptions = useMemo(() => zones.map((z) => ({ id: z.id, name: z.name })), [zones]);

  const onSubmit = async (values: FormValues) => {
    if (!values.zone_id || values.zone_id === "none") {
      setFormError("zone_id", { type: "required", message: t("equipment.interactions.zoneRequired") });
      return;
    }
    if (!values.subject.trim()) {
      setFormError("subject", { type: "required", message: t("equipment.interactions.subjectRequired") });
      return;
    }
    setError(null);

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      const occurredISO = values.occurred_at ? new Date(values.occurred_at).toISOString() : null;
      const statusValue = values.status === "none" ? null : values.status;
      const { data, error: createError } = await client.rpc("create_interaction_with_zones", {
        p_household_id: equipment.household_id,
        p_subject: values.subject.trim(),
        p_zone_ids: [values.zone_id],
        p_content: values.content,
        p_type: values.type,
        p_status: statusValue,
        p_occurred_at: occurredISO,
        p_metadata: { equipment_id: equipment.id, source: "equipment" },
      });
      if (createError) throw createError;
      const interactionId = data as string | null;
      if (!interactionId) throw new Error("Failed to create interaction");

      const { error: linkError } = await client.from("equipment_interactions").insert({
        equipment_id: equipment.id,
        interaction_id: interactionId,
        role: "log",
        note: "",
      });
      if (linkError) {
        await client.from("interactions").delete().eq("id", interactionId);
        throw linkError;
      }

      show({
        title: t("equipment.interactions.created"),
        description: values.subject,
        variant: "success",
      });
      if (onCreated) onCreated();
      reset({
        ...defaultValues,
        occurred_at: getCurrentLocalDateTimeInput(),
        zone_id: defaultZoneId ?? "none",
      });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setError(message);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
      <div className="space-y-2">
        <label htmlFor="type">{t("equipment.interactions.type")}</label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="type">
                <SelectValue placeholder={t("equipment.interactions.type")} />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_EVENT_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`interactionstypes.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="subject">{t("equipment.interactions.subject")}</label>
        <Input
          id="subject"
          {...register("subject")}
          placeholder={t("equipment.interactions.subjectPlaceholder", { name: equipment.name })}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="status">{t("equipment.interactions.status")}</label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status">
                  <SelectValue placeholder={t("equipment.interactions.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("equipment.interactions.noStatus")}</SelectItem>
                  {INTERACTION_STATUSES.filter(Boolean).map((value) => (
                    <SelectItem key={value ?? "none"} value={value ?? "none"}>
                      {value ? t(`interactionsstatus.${value}`) : t("equipment.interactions.noStatus")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="occurredAt">{t("equipment.interactions.occurredAt")}</label>
          <Input
            id="occurredAt"
            type="datetime-local"
            {...register("occurred_at")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="zone">{t("equipment.interactions.zone")}</label>
        <Controller
          control={control}
          name="zone_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={zones.length === 0}>
              <SelectTrigger id="zone">
                <SelectValue placeholder={t("equipment.interactions.zonePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("equipment.fields.noZone")}</SelectItem>
                {zoneOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {zones.length === 0 ? (
          <p className="text-xs text-gray-500">{t("equipment.interactions.noZones")}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="content">{t("equipment.interactions.notes")}</label>
        <Textarea
          id="content"
          rows={4}
          {...register("content")}
          placeholder={t("equipment.interactions.notesPlaceholder")}
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {t("equipment.actions.cancel")}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting || zones.length === 0}>
          {isSubmitting ? t("equipment.actions.saving") : t("equipment.interactions.submit")}
        </Button>
      </div>
    </form>
  );
}
