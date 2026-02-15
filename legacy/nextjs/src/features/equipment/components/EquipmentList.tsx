// nextjs/src/features/equipment/components/EquipmentList.tsx
"use client";

import { Calendar, MapPin, ShieldCheck, Wrench, Tag as TagIcon } from "lucide-react";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import EquipmentStatusBadge from "./EquipmentStatusBadge";
import type { Equipment } from "../types";

type Props = {
  equipment: Equipment[];
  t: (key: string, args?: Record<string, string | number>) => string;
};

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

export default function EquipmentList({ equipment, t }: Props) {
  const today = new Date();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {equipment.map((item) => {
        const warranty = formatDate(item.warranty_expires_on);
        const nextService = formatDate(item.next_service_due);
        const isOverdue = item.next_service_due ? new Date(item.next_service_due) < today : false;

        return (
          <LinkWithOverlay
            key={item.id}
            href={`/app/equipment/${item.id}`}
            className="group relative block h-full rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm ring-1 ring-transparent transition hover:border-indigo-200 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-gray-500">{item.category}</p>
                <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                {item.zone ? (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    <span className="truncate">{item.zone.name}</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">{t("equipment.fields.noZone")}</div>
                )}
              </div>
              <EquipmentStatusBadge status={item.status} t={t} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-700">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Wrench className="h-4 w-4 text-gray-400" />
                <span className={isOverdue ? "font-semibold text-rose-700" : ""}>
                  {nextService ? t("equipment.fields.nextService", { date: nextService }) : t("equipment.fields.noMaintenance")}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-600">
                <ShieldCheck className="h-4 w-4 text-gray-400" />
                <span>{warranty ? t("equipment.fields.warranty", { date: warranty }) : t("equipment.fields.noWarranty")}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>
                  {item.purchase_date
                    ? t("equipment.fields.purchasedOn", { date: formatDate(item.purchase_date) ?? "" })
                    : t("equipment.fields.noPurchase")}
                </span>
              </div>

              {item.tags?.length ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <TagIcon className="h-4 w-4 text-gray-400" />
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </LinkWithOverlay>
        );
      })}
    </div>
  );
}
