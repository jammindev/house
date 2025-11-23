// nextjs/src/features/equipment/components/EquipmentForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useZones } from "@zones/hooks/useZones";
import type { Equipment, EquipmentPayload } from "../types";
import { EQUIPMENT_STATUSES } from "../constants";

type Props = {
  equipment?: Equipment | null;
  onSaved?: (id: string) => void;
  mode?: "create" | "edit";
};

type FormValues = {
  name: string;
  category: string;
  status: Equipment["status"];
  zone_id: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  purchase_date: string;
  purchase_price: string;
  purchase_vendor: string;
  warranty_expires_on: string;
  warranty_provider: string;
  warranty_notes: string;
  maintenance_interval_months: string;
  last_service_at: string;
  installed_at: string;
  retired_at: string;
  condition: string;
  notes: string;
  tags_input: string;
};

const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseNumber = (value: string) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function EquipmentForm({ equipment, onSaved, mode = "create" }: Props) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const { show } = useToast();
  const { zones, loading: zonesLoading } = useZones();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultValues = useMemo<FormValues>(
    () => ({
      name: equipment?.name ?? "",
      category: equipment?.category ?? "general",
      status: equipment?.status ?? "active",
      zone_id: equipment?.zone_id ?? "none",
      manufacturer: equipment?.manufacturer ?? "",
      model: equipment?.model ?? "",
      serial_number: equipment?.serial_number ?? "",
      purchase_date: equipment?.purchase_date ?? "",
      purchase_price: equipment?.purchase_price != null ? String(equipment.purchase_price) : "",
      purchase_vendor: equipment?.purchase_vendor ?? "",
      warranty_expires_on: equipment?.warranty_expires_on ?? "",
      warranty_provider: equipment?.warranty_provider ?? "",
      warranty_notes: equipment?.warranty_notes ?? "",
      maintenance_interval_months:
        equipment?.maintenance_interval_months != null ? String(equipment.maintenance_interval_months) : "",
      last_service_at: equipment?.last_service_at ?? "",
      installed_at: equipment?.installed_at ?? "",
      retired_at: equipment?.retired_at ?? "",
      condition: equipment?.condition ?? "",
      notes: equipment?.notes ?? "",
      tags_input: (equipment?.tags ?? []).join(", "),
    }),
    [equipment]
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
    reset,
    setError,
  } = useForm<FormValues>({ defaultValues });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const zoneOptions = useMemo(
    () =>
      zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
      })),
    [zones]
  );

  const onSubmit = async (values: FormValues) => {
    if (!householdId) {
      setServerError(t("equipment.errors.noHousehold"));
      return;
    }
    if (!values.name.trim()) {
      setError("name", { type: "required", message: t("equipment.errors.nameRequired") });
      return;
    }

    setServerError(null);

    const tags = values.tags_input
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload: EquipmentPayload = {
      household_id: equipment?.household_id ?? householdId,
      name: values.name.trim(),
      category: values.category.trim() || "general",
      status: values.status,
      zone_id: values.zone_id === "none" ? null : values.zone_id,
      manufacturer: toNullable(values.manufacturer),
      model: toNullable(values.model),
      serial_number: toNullable(values.serial_number),
      purchase_date: values.purchase_date || null,
      purchase_price: parseNumber(values.purchase_price),
      purchase_vendor: toNullable(values.purchase_vendor),
      warranty_expires_on: values.warranty_expires_on || null,
      warranty_provider: toNullable(values.warranty_provider),
      warranty_notes: values.warranty_notes.trim(),
      maintenance_interval_months: values.maintenance_interval_months
        ? Number.isFinite(Number.parseInt(values.maintenance_interval_months, 10))
          ? Number.parseInt(values.maintenance_interval_months, 10)
          : null
        : null,
      last_service_at: values.last_service_at || null,
      installed_at: values.installed_at || null,
      retired_at: values.retired_at || null,
      condition: toNullable(values.condition),
      notes: values.notes.trim(),
      tags,
    };

    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      let savedId: string | null = null;
      if (equipment) {
        const { data, error: updateError } = await client
          .from("equipment")
          .update(payload)
          .eq("id", equipment.id)
          .select("id")
          .single();
        if (updateError) throw updateError;
        savedId = data?.id ?? equipment.id;
      } else {
        const { data, error: insertError } = await client
          .from("equipment")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        savedId = data?.id ?? null;
      }

      if (!savedId) {
        throw new Error("Failed to save equipment");
      }

      show({
        title: t(equipment ? "equipment.toasts.updated" : "equipment.toasts.created"),
        description: values.name,
        variant: "success",
      });
      if (onSaved) onSaved(savedId);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t("common.unexpectedError");
      setServerError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("equipment.sections.general")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="name">{t("equipment.fields.name")}</label>
            <Input id="name" {...register("name", { required: true })} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="category">{t("equipment.fields.category")}</label>
            <Input id="category" {...register("category")} />
          </div>
          <div className="space-y-2">
            <label htmlFor="status">{t("equipment.fields.status")}</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder={t("equipment.fields.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`equipment.status.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="zone">{t("equipment.fields.zone")}</label>
            <Controller
              control={control}
              name="zone_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={zonesLoading || zones.length === 0}
                >
                  <SelectTrigger id="zone">
                    <SelectValue placeholder={t("equipment.fields.zonePlaceholder")} />
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
          </div>
          <div className="space-y-2">
            <label htmlFor="manufacturer">{t("equipment.fields.manufacturer")}</label>
            <Input id="manufacturer" {...register("manufacturer")} />
          </div>
          <div className="space-y-2">
            <label htmlFor="model">{t("equipment.fields.model")}</label>
            <Input id="model" {...register("model")} />
          </div>
          <div className="space-y-2">
            <label htmlFor="serial">{t("equipment.fields.serialNumber")}</label>
            <Input id="serial" {...register("serial_number")} />
          </div>
          <div className="space-y-2">
            <label htmlFor="condition">{t("equipment.fields.condition")}</label>
            <Input id="condition" {...register("condition")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("equipment.sections.purchase")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="purchaseDate">{t("equipment.fields.purchaseDate")}</label>
            <Input id="purchaseDate" type="date" {...register("purchase_date")} />
          </div>
          <div className="space-y-2">
            <label htmlFor="purchasePrice">{t("equipment.fields.purchasePrice")}</label>
            <Input
              id="purchasePrice"
              type="number"
              step="0.01"
              inputMode="decimal"
              {...register("purchase_price")}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="purchaseVendor">{t("equipment.fields.purchaseVendor")}</label>
            <Input id="purchaseVendor" {...register("purchase_vendor")} />
          </div>
          <div className="space-y-2">
            <label htmlFor="installedAt">{t("equipment.fields.installedAt")}</label>
            <Input id="installedAt" type="date" {...register("installed_at")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("equipment.sections.warranty")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="warrantyExpiresOn">{t("equipment.fields.warrantyExpiresOn")}</label>
            <Input
              id="warrantyExpiresOn"
              type="date"
              {...register("warranty_expires_on")}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="warrantyProvider">{t("equipment.fields.warrantyProvider")}</label>
            <Input
              id="warrantyProvider"
              {...register("warranty_provider")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="warrantyNotes">{t("equipment.fields.warrantyNotes")}</label>
            <Textarea
              id="warrantyNotes"
              {...register("warranty_notes")}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("equipment.sections.maintenance")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="maintenanceInterval">{t("equipment.fields.maintenanceInterval")}</label>
            <Input
              id="maintenanceInterval"
              type="number"
              inputMode="numeric"
              min={0}
              {...register("maintenance_interval_months")}
              placeholder="6"
            />
            <p className="text-xs text-gray-500">{t("equipment.fields.maintenanceIntervalHint")}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="lastServiceAt">{t("equipment.fields.lastServiceAt")}</label>
            <Input id="lastServiceAt" type="date" {...register("last_service_at")} />
          </div>
          <div className="space-y-2">
            <label htmlFor="retiredAt">{t("equipment.fields.retiredAt")}</label>
            <Input id="retiredAt" type="date" {...register("retired_at")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("equipment.sections.notes")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label htmlFor="tags">{t("equipment.fields.tags")}</label>
            <Input
              id="tags"
              {...register("tags_input")}
              placeholder={t("equipment.fields.tagsPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="notes">{t("equipment.fields.notes")}</label>
            <Textarea id="notes" {...register("notes")} rows={4} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={isSubmitting} className="self-end">
          {isSubmitting
            ? t("equipment.actions.saving")
            : t(mode === "edit" ? "equipment.actions.update" : "equipment.actions.create")}
        </Button>
      </div>
    </form>
  );
}
