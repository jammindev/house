export type InsuranceType = "health" | "home" | "car" | "life" | "liability" | "other";

export type InsuranceStatus = "active" | "suspended" | "terminated";

export type PaymentFrequency = "monthly" | "quarterly" | "yearly";

export type Insurance = {
  id: string;
  household_id: string;
  name: string;
  provider: string;
  contract_number: string;
  type: InsuranceType;
  insured_item: string;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  status: InsuranceStatus;
  payment_frequency: PaymentFrequency;
  monthly_cost: number;
  yearly_cost: number;
  coverage_summary: string;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type InsuranceFilters = {
  search?: string;
  types?: InsuranceType[];
  statuses?: InsuranceStatus[];
};

export type InsuranceFormData = {
  name: string;
  provider: string;
  contract_number: string;
  type: InsuranceType;
  insured_item: string;
  start_date: string;
  end_date: string;
  renewal_date: string;
  status: InsuranceStatus;
  payment_frequency: PaymentFrequency;
  monthly_cost: string;
  yearly_cost: string;
  coverage_summary: string;
  notes: string;
};
