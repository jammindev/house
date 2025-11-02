import type { Interaction } from "@interactions/types";

export const extractAmountFromMetadata = (
  metadata: Interaction["metadata"]
): number | null => {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).amount;
  if (typeof raw === "number") return Number.isNaN(raw) ? null : raw;
  if (typeof raw === "string") {
    const normalized = raw.trim();
    if (!normalized) return null;
    const parsed = Number(normalized.replace(",", "."));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

export const formatAmountForInput = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "";
  return `${value}`;
};

export const parseAmountInput = (value: string): number | null => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};
