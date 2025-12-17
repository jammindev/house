import type { InsuranceType, InsuranceStatus, PaymentFrequency } from "./types";

export const INSURANCE_TYPES: InsuranceType[] = [
  "health",
  "home",
  "car",
  "life",
  "liability",
  "other",
];

export const INSURANCE_STATUSES: InsuranceStatus[] = [
  "active",
  "suspended",
  "terminated",
];

export const PAYMENT_FREQUENCIES: PaymentFrequency[] = [
  "monthly",
  "quarterly",
  "yearly",
];

export const DEFAULT_INSURANCE_FILTERS = {
  search: "",
  types: [],
  statuses: ["active"] as InsuranceStatus[],
};
