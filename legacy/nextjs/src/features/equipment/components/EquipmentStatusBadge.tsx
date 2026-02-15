// nextjs/src/features/equipment/components/EquipmentStatusBadge.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { EQUIPMENT_STATUS_COLORS } from "../constants";
import type { EquipmentStatus } from "../types";

type Props = {
  status: EquipmentStatus;
  t: (key: string, args?: Record<string, string | number>) => string;
};

export default function EquipmentStatusBadge({ status, t }: Props) {
  const className = EQUIPMENT_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-800 border-slate-200";
  return (
    <Badge variant="outline" className={`border ${className}`}>
      {t(`equipment.status.${status}`)}
    </Badge>
  );
}
