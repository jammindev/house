// nextjs/src/features/insurance/components/InsuranceDetailView.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Calendar, DollarSign, FileText, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useToast } from "@/components/ToastProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { Insurance } from "../types";
import AuditHistoryCard from "@/components/AuditHistoryCard";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import InsuranceForm from "./InsuranceForm";

interface InsuranceDetailViewProps {
  contract: Insurance;
  onRefresh?: () => void;
}

export default function InsuranceDetailView({ contract, onRefresh }: InsuranceDetailViewProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { selectedHouseholdId: householdId } = useGlobal();
  const { show } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(
        new Date(value)
      );
    } catch {
      return value;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "suspended":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "terminated":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const isRenewalSoon = () => {
    if (!contract.renewal_date) return false;
    const renewalDate = new Date(contract.renewal_date);
    const today = new Date();
    const daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilRenewal > 0 && daysUntilRenewal <= 60;
  };

  const handleDelete = async () => {
    if (!householdId) return;

    setIsDeleting(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();

      const { error } = await client
        .from("insurance_contracts")
        .delete()
        .eq("id", contract.id)
        .eq("household_id", householdId);

      if (error) throw error;

      show({ title: t("insurance.deleteSuccess"), variant: "success" });
      router.push("/app/insurance");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("insurance.deleteFailed");
      show({ title: message, variant: "error" });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleEditSuccess = (contractId: string) => {
    setIsEditOpen(false);
    onRefresh?.();
  };

  const auditLines = [
    contract.created_at
      ? t("insurance.auditCreated", {
          date: new Date(contract.created_at).toLocaleString(locale),
        })
      : null,
    contract.updated_at
      ? t("insurance.auditUpdated", {
          date: new Date(contract.updated_at).toLocaleString(locale),
        })
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{contract.name}</h1>
            <Badge variant="outline" className={getStatusColor(contract.status)}>
              {t(`insurance.status.${contract.status}`)}
            </Badge>
            {isRenewalSoon() && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                {t("insurance.renewalSoon")}
              </Badge>
            )}
          </div>
          <Badge variant="secondary">{t(`insurance.types.${contract.type}`)}</Badge>
        </div>

        <div className="flex gap-2">
          <SheetDialog
            trigger={
              <Button variant="outline" size="icon">
                <Pencil className="h-4 w-4 mr-2" />
                {t("common.edit")}
              </Button>
            }
            title={t("insurance.editTitle")}
            description={t("insurance.editSubtitle")}
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
          >
            {({ close }) => (
              <InsuranceForm
                contract={contract}
                mode="edit"
                onSuccess={handleEditSuccess}
                onCancel={close}
              />
            )}
          </SheetDialog>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("common.delete")}
          </Button>
        </div>
      </div>

      {/* General Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("insurance.detail.generalInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contract.provider && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">{t("insurance.fields.provider")}</span>
              <span className="text-sm font-medium text-slate-900">{contract.provider}</span>
            </div>
          )}
          {contract.contract_number && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">{t("insurance.fields.contractNumber")}</span>
              <span className="text-sm font-medium text-slate-900">{contract.contract_number}</span>
            </div>
          )}
          {contract.insured_item && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">{t("insurance.fields.insuredItem")}</span>
              <span className="text-sm font-medium text-slate-900">{contract.insured_item}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coverage Details */}
      {contract.coverage_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("insurance.detail.coverage")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{contract.coverage_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Important Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("insurance.detail.dates")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contract.start_date && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">{t("insurance.fields.startDate")}</span>
              <span className="text-sm font-medium text-slate-900">{formatDate(contract.start_date)}</span>
            </div>
          )}
          {contract.end_date && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">{t("insurance.fields.endDate")}</span>
              <span className="text-sm font-medium text-slate-900">{formatDate(contract.end_date)}</span>
            </div>
          )}
          {contract.renewal_date && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">{t("insurance.fields.renewalDate")}</span>
              <span className="text-sm font-medium text-slate-900">{formatDate(contract.renewal_date)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Costs & Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t("insurance.detail.costs")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">{t("insurance.fields.paymentFrequency")}</span>
            <span className="text-sm font-medium text-slate-900">
              {t(`insurance.paymentFrequency.${contract.payment_frequency}`)}
            </span>
          </div>
          {contract.monthly_cost > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">{t("insurance.fields.monthlyCost")}</span>
              <span className="text-sm font-medium text-slate-900">
                {formatCurrency(contract.monthly_cost)}
              </span>
            </div>
          )}
          {contract.yearly_cost > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">{t("insurance.fields.yearlyCost")}</span>
              <span className="text-sm font-medium text-slate-900">
                {formatCurrency(contract.yearly_cost)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {contract.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("insurance.detail.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{contract.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Audit History */}
      <AuditHistoryCard lines={auditLines} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>{t("insurance.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t("common.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
