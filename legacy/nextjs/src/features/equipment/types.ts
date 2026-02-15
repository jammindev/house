// nextjs/src/features/equipment/types.ts
import type { InteractionStatus, InteractionType } from "@interactions/types";

export type EquipmentStatus = "active" | "maintenance" | "storage" | "retired" | "lost" | "ordered";

export type Equipment = {
  id: string;
  household_id: string;
  zone_id: string | null;
  name: string;
  category: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  purchase_vendor?: string | null;
  warranty_expires_on?: string | null;
  warranty_provider?: string | null;
  warranty_notes?: string;
  maintenance_interval_months?: number | null;
  last_service_at?: string | null;
  next_service_due?: string | null;
  status: EquipmentStatus;
  condition?: string | null;
  installed_at?: string | null;
  retired_at?: string | null;
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  zone?: { id: string; name: string } | null;
};

export type EquipmentFilters = {
  search?: string;
  statuses?: EquipmentStatus[];
  zoneId?: string | null;
};

export type EquipmentPayload = Omit<
  Equipment,
  "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "household_id" | "zone" | "tags"
> & {
  household_id?: string;
  tags?: string[];
};

export type EquipmentInteractionLink = {
  role?: string | null;
  note?: string | null;
  linked_at?: string | null;
};

export type EquipmentInteractionFormState = {
  subject: string;
  type: InteractionType;
  status: InteractionStatus | "";
  occurred_at: string;
  zone_ids: string[];
  content: string;
};
