// nextjs/src/features/insurance/components/InsuranceForm.tsx
"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Insurance, InsuranceFormData } from "../types";
import { INSURANCE_TYPES, INSURANCE_STATUSES, PAYMENT_FREQUENCIES } from "../constants";

type Mode = "create" | "edit";

interface InsuranceFormProps {
  contract?: Insurance;
  mode?: Mode;
  onSuccess?: (contractId: string) => void;
  onCancel?: () => void;
}

export default function InsuranceForm({ 
  contract, 
  mode = "create", 
  onSuccess,
  onCancel 
}: InsuranceFormProps) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t } = useI18n();
  const { show } = useToast();

  const isEdit = mode === "edit" && Boolean(contract);

  const insuranceFormSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t("insurance.form.nameRequired")).transform((s) => s.trim()),
        provider: z.string(),
        contract_number: z.string(),
        type: z.enum(["health", "home", "car", "life", "liability", "other"] as const),
        insured_item: z.string(),
        start_date: z.string(),
        end_date: z.string(),
        renewal_date: z.string(),
        status: z.enum(["active", "suspended", "terminated"] as const),
        payment_frequency: z.enum(["monthly", "quarterly", "yearly"] as const),
        monthly_cost: z.string(),
        yearly_cost: z.string(),
        coverage_summary: z.string(),
        notes: z.string(),
      }),
    [t]
  );

  type FormData = z.infer<typeof insuranceFormSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(insuranceFormSchema),
    defaultValues: {
      name: contract?.name ?? "",
      provider: contract?.provider ?? "",
      contract_number: contract?.contract_number ?? "",
      type: contract?.type ?? "other",
      insured_item: contract?.insured_item ?? "",
      start_date: contract?.start_date ?? "",
      end_date: contract?.end_date ?? "",
      renewal_date: contract?.renewal_date ?? "",
      status: contract?.status ?? "active",
      payment_frequency: contract?.payment_frequency ?? "monthly",
      monthly_cost: contract?.monthly_cost != null ? contract.monthly_cost.toString() : "",
      yearly_cost: contract?.yearly_cost != null ? contract.yearly_cost.toString() : "",
      coverage_summary: contract?.coverage_summary ?? "",
      notes: contract?.notes ?? "",
    },
  });

  useEffect(() => {
    if (isEdit && contract) {
      reset({
        name: contract.name ?? "",
        provider: contract.provider ?? "",
        contract_number: contract.contract_number ?? "",
        type: contract.type ?? "other",
        insured_item: contract.insured_item ?? "",
        start_date: contract.start_date ?? "",
        end_date: contract.end_date ?? "",
        renewal_date: contract.renewal_date ?? "",
        status: contract.status ?? "active",
        payment_frequency: contract.payment_frequency ?? "monthly",
        monthly_cost: contract.monthly_cost != null ? contract.monthly_cost.toString() : "",
        yearly_cost: contract.yearly_cost != null ? contract.yearly_cost.toString() : "",
        coverage_summary: contract.coverage_summary ?? "",
        notes: contract.notes ?? "",
      });
    }
  }, [isEdit, contract, reset]);

  const onSubmit: SubmitHandler<FormData> = useCallback(
    async (data) => {
      if (!householdId) return;

      clearErrors();

      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        const payload = {
          name: data.name,
          provider: data.provider,
          contract_number: data.contract_number,
          type: data.type,
          insured_item: data.insured_item,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          renewal_date: data.renewal_date || null,
          status: data.status,
          payment_frequency: data.payment_frequency,
          monthly_cost: data.monthly_cost ? Number(data.monthly_cost) : 0,
          yearly_cost: data.yearly_cost ? Number(data.yearly_cost) : 0,
          coverage_summary: data.coverage_summary,
          notes: data.notes,
        };

        if (isEdit && contract) {
          const { data: updated, error: updateError } = await client
            .from("insurance_contracts")
            .update(payload)
            .eq("id", contract.id)
            .eq("household_id", householdId)
            .select("id")
            .single();

          if (updateError) throw updateError;
          if (!updated?.id) throw new Error(t("common.unexpectedError"));

          show({ title: t("insurance.form.successUpdate"), variant: "success" });
          onSuccess?.(contract.id);
        } else {
          const { data: inserted, error: insertError } = await client
            .from("insurance_contracts")
            .insert({ ...payload, household_id: householdId })
            .select("id")
            .single();

          if (insertError) throw insertError;
          if (!inserted?.id) throw new Error(t("common.unexpectedError"));

          show({ title: t("insurance.form.successCreate"), variant: "success" });
          onSuccess?.(inserted.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("common.unexpectedError");
        setError("root", { message });
      }
    },
    [householdId, isEdit, contract, onSuccess, show, t, setError, clearErrors]
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name and Provider */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.name")} *
          </label>
          <Input {...register("name")} placeholder={t("insurance.form.namePlaceholder")} />
          {errors.name && <span className="text-xs text-red-600">{errors.name.message}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.provider")}
          </label>
          <Input {...register("provider")} placeholder={t("insurance.form.providerPlaceholder")} />
        </div>
      </div>

      {/* Type and Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">{t("insurance.fields.type")}</label>
          <select
            {...register("type")}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {INSURANCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`insurance.types.${type}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">{t("insurance.fields.status")}</label>
          <select
            {...register("status")}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {INSURANCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`insurance.status.${status}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Contract Number and Insured Item */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.contractNumber")}
          </label>
          <Input
            {...register("contract_number")}
            placeholder={t("insurance.form.contractNumberPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.insuredItem")}
          </label>
          <Input
            {...register("insured_item")}
            placeholder={t("insurance.form.insuredItemPlaceholder")}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.startDate")}
          </label>
          <Input type="date" {...register("start_date")} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.endDate")}
          </label>
          <Input type="date" {...register("end_date")} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.renewalDate")}
          </label>
          <Input type="date" {...register("renewal_date")} />
        </div>
      </div>

      {/* Payment */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.paymentFrequency")}
          </label>
          <select
            {...register("payment_frequency")}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {PAYMENT_FREQUENCIES.map((freq) => (
              <option key={freq} value={freq}>
                {t(`insurance.paymentFrequency.${freq}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.monthlyCost")}
          </label>
          <Input type="number" step="0.01" {...register("monthly_cost")} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            {t("insurance.fields.yearlyCost")}
          </label>
          <Input type="number" step="0.01" {...register("yearly_cost")} />
        </div>
      </div>

      {/* Coverage Summary */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">
          {t("insurance.fields.coverageSummary")}
        </label>
        <Textarea
          {...register("coverage_summary")}
          placeholder={t("insurance.form.coveragePlaceholder")}
          rows={3}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">{t("insurance.fields.notes")}</label>
        <Textarea
          {...register("notes")}
          placeholder={t("insurance.form.notesPlaceholder")}
          rows={3}
        />
      </div>

      {/* Error Display */}
      {errors.root && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{errors.root.message}</div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? t("insurance.form.submitting")
            : isEdit
            ? t("insurance.form.update")
            : t("insurance.form.create")}
        </Button>
      </div>
    </form>
  );
}
