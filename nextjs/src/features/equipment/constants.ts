// nextjs/src/features/equipment/constants.ts
import type { InteractionType } from "@interactions/types";
import type { EquipmentFilters, EquipmentStatus } from "./types";

export const EQUIPMENT_STATUSES: EquipmentStatus[] = ["active", "maintenance", "storage", "retired", "lost", "ordered"];

export const EQUIPMENT_STATUS_COLORS: Record<EquipmentStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  maintenance: "bg-amber-100 text-amber-800 border-amber-200",
  storage: "bg-slate-100 text-slate-800 border-slate-200",
  retired: "bg-gray-200 text-gray-800 border-gray-300",
  lost: "bg-rose-100 text-rose-800 border-rose-200",
  ordered: "bg-blue-100 text-blue-800 border-blue-200",
};

export const EQUIPMENT_EVENT_TYPES: InteractionType[] = [
  "maintenance",
  "repair",
  "inspection",
  "installation",
  "issue",
  "warranty",
  "replacement",
  "upgrade",
  "disposal",
  "expense",
];

export const DEFAULT_EQUIPMENT_FILTERS: EquipmentFilters = {
  search: "",
  statuses: [],
  zoneId: null,
};
