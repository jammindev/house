// nextjs/src/features/equipment/components/EquipmentDetailView.tsx
"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CreditCard, FileWarning, MapPin, ShieldCheck, Tag as TagIcon, Wrench } from "lucide-react";
import { format, differenceInYears, differenceInMonths, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { fr as dateFnsFr, enUS as dateFnsEn } from "date-fns/locale";

import InteractionList from "@interactions/components/InteractionList";
import type { Interaction, ZoneOption } from "@interactions/types";
import EquipmentStatusBadge from "./EquipmentStatusBadge";
import EquipmentDeleteButton from "./EquipmentDeleteButton";
import type { Equipment } from "../types";
import EquipmentInteractionForm from "./EquipmentInteractionForm";
import { useEquipmentAudit } from "../hooks/useEquipmentAudit";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AuditHistoryCard from "@/components/AuditHistoryCard";

type Props = {
  equipment: Equipment;
  interactions: Interaction[];
  documentCounts: Record<string, number>;
  zones: ZoneOption[];
  onInteractionAdded: () => void;
  onDeleted: () => void;
  interactionError?: string | null;
  interactionLoading?: boolean;
  locale?: string;
  t: (key: string, args?: Record<string, string | number>) => string;
};

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

const formatCurrency = (value?: number | null) => {
  if (value == null) return null;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(value);
};

// Helpers: localized public date and short relative time (14h, 1j, 1an)
const getDateFnsLocale = (loc?: string) => {
  if (!loc) return dateFnsEn;
  if (loc.startsWith("fr")) return dateFnsFr;
  return dateFnsEn;
};

const formatPublicDate = (isoDate?: string | null, locale?: string) => {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    // Pp -> localized date + time, friendly for "grand public"
    return format(d, "Pp", { locale: getDateFnsLocale(locale) });
  } catch (e) {
    console.error(e);
    return new Date(isoDate).toLocaleString();
  }
};

const formatRelativeShort = (isoDate?: string | null, locale?: string) => {
  if (!isoDate) return "";
  const now = new Date();
  const d = new Date(isoDate);
  const years = differenceInYears(now, d);
  if (years >= 1) {
    // French: 1an 2ans, English: 1y 2y
    if (locale?.startsWith("fr")) return `${years}${years === 1 ? "an" : "ans"}`;
    return `${years}y`;
  }
  const months = differenceInMonths(now, d);
  if (months >= 1) {
    if (locale?.startsWith("fr")) return `${months}${months === 1 ? "mois" : "mois"}`;
    return `${months}mo`;
  }
  const days = differenceInDays(now, d);
  if (days >= 1) {
    if (locale?.startsWith("fr")) return `${days}j`;
    return `${days}d`;
  }
  const hours = differenceInHours(now, d);
  if (hours >= 1) return `${hours}h`;
  const minutes = differenceInMinutes(now, d);
  if (minutes >= 1) return `${minutes}${locale?.startsWith("fr") ? "min" : "m"}`;
  const seconds = differenceInSeconds(now, d);
  if (seconds >= 5) return `${seconds}${locale?.startsWith("fr") ? "s" : "s"}`;
  // just now
  return locale?.startsWith("fr") ? "à l'instant" : "now";
};

export default function EquipmentDetailView({
  equipment,
  interactions,
  documentCounts,
  zones,
  onInteractionAdded,
  onDeleted,
  interactionError,
  interactionLoading = false,
  locale,
  t,
}: Props) {
  const [interactionOpen, setInteractionOpen] = useState(false);
  const { audit, loading: auditLoading } = useEquipmentAudit(equipment.id, equipment.updated_at);

  const nextService = formatDate(equipment.next_service_due);
  const lastService = formatDate(equipment.last_service_at);
  const warranty = formatDate(equipment.warranty_expires_on);
  const purchase = formatDate(equipment.purchase_date);
  const isOverdue = equipment.next_service_due ? new Date(equipment.next_service_due) < new Date() : false;
  const purchasePriceLabel = formatCurrency(equipment.purchase_price);

  const selectedZoneName = useMemo(() => equipment.zone?.name ?? null, [equipment.zone]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-gray-900">{equipment.name}</h2>
            <EquipmentStatusBadge status={equipment.status} t={t} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <Badge variant="outline">{equipment.category}</Badge>
            {selectedZoneName ? (
              <span className="inline-flex items-center gap-1 text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400" />
                {selectedZoneName}
              </span>
            ) : null}
            {equipment.condition ? (
              <span className="inline-flex items-center gap-1 text-gray-600">
                <FileWarning className="h-4 w-4 text-gray-400" />
                {equipment.condition}
              </span>
            ) : null}
          </div>
        </div>
        <SheetDialog
          open={interactionOpen}
          onOpenChange={setInteractionOpen}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Wrench className="h-4 w-4" />
              {t("equipment.interactions.logEvent")}
            </button>
          }
        >
          <EquipmentInteractionForm
            equipment={equipment}
            zones={zones}
            defaultZoneId={equipment.zone_id ?? undefined}
            onCreated={() => {
              onInteractionAdded();
              setInteractionOpen(false);
            }}
            onCancel={() => setInteractionOpen(false)}
          />
        </SheetDialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("equipment.detail.maintenanceTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-gray-400" />
              <span className={isOverdue ? "font-semibold text-rose-700" : ""}>
                {nextService
                  ? t("equipment.detail.nextService", { date: nextService })
                  : t("equipment.detail.nextServiceNone")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <span>
                {lastService
                  ? t("equipment.detail.lastService", { date: lastService })
                  : t("equipment.detail.lastServiceUnknown")}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {equipment.maintenance_interval_months
                ? t("equipment.detail.frequency", { months: equipment.maintenance_interval_months })
                : t("equipment.detail.frequencyMissing")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("equipment.detail.warrantyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gray-400" />
              <span>{warranty ? t("equipment.detail.warrantyUntil", { date: warranty }) : t("equipment.detail.warrantyMissing")}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <span>
                {purchase
                  ? purchasePriceLabel
                    ? t("equipment.detail.purchaseWithPrice", { date: purchase, price: purchasePriceLabel })
                    : t("equipment.detail.purchase", { date: purchase })
                  : t("equipment.detail.purchaseUnknown")}
              </span>
            </div>
            {equipment.purchase_vendor ? (
              <div className="text-xs text-gray-500">
                {t("equipment.detail.vendor", { vendor: equipment.purchase_vendor })}
              </div>
            ) : null}
            {equipment.warranty_provider ? (
              <div className="text-xs text-gray-500">
                {t("equipment.detail.warrantyProvider", { provider: equipment.warranty_provider })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("equipment.detail.specTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-gray-500">{t("equipment.fields.manufacturer")}</p>
            <p>{equipment.manufacturer || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">{t("equipment.fields.model")}</p>
            <p>{equipment.model || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">{t("equipment.fields.serialNumber")}</p>
            <p>{equipment.serial_number || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">{t("equipment.fields.condition")}</p>
            <p>{equipment.condition || "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase text-gray-500">{t("equipment.fields.notes")}</p>
            <p className="whitespace-pre-wrap">{equipment.notes || "—"}</p>
          </div>
          {equipment.tags?.length ? (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase text-gray-500 flex items-center gap-2">
                <TagIcon className="h-3.5 w-3.5" />
                {t("equipment.fields.tags")}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {equipment.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("equipment.detail.historyTitle")}</CardTitle>
          <button
            onClick={() => setInteractionOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Wrench className="h-4 w-4" />
            {t("equipment.interactions.add")}
          </button>
        </CardHeader>
        <CardContent>
          {interactionLoading ? (
            <p className="text-sm text-gray-500">{t("equipment.interactions.loading")}</p>
          ) : interactionError ? (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{interactionError}</div>
          ) : interactions.length === 0 ? (
            <p className="text-sm text-gray-500">{t("equipment.interactions.empty")}</p>
          ) : (
            <InteractionList interactions={interactions} documentCounts={documentCounts} t={t} />
          )}
        </CardContent>
      </Card>

      <AuditHistoryCard
        loading={auditLoading}
        lines={[
          t("equipment.audit.created", {
            date: formatPublicDate(equipment.created_at, locale),
            user: audit?.created_by?.username ?? audit?.created_by?.email ?? t("equipment.audit.unknownUser"),
          }),
          t("equipment.audit.updated", {
            date: formatRelativeShort(equipment.updated_at, locale),
            user: audit?.updated_by?.username ?? audit?.updated_by?.email ?? t("equipment.audit.unknownUser"),
          }),
        ]}
        actions={<EquipmentDeleteButton equipmentId={equipment.id} equipmentName={equipment.name} onDeleted={onDeleted} />}
      />
    </div>
  );
}
