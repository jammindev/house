import { api } from '@/lib/axios';

export type InsuranceType = 'health' | 'home' | 'car' | 'life' | 'liability' | 'other';
export type InsuranceStatus = 'active' | 'suspended' | 'terminated';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface InsuranceContract {
  id: string;
  household: string;
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
  monthly_cost: string;
  yearly_cost: string;
  coverage_summary: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface InsurancePayload {
  name: string;
  provider?: string;
  contract_number?: string;
  type: InsuranceType;
  insured_item?: string;
  start_date?: string | null;
  end_date?: string | null;
  renewal_date?: string | null;
  status: InsuranceStatus;
  payment_frequency: PaymentFrequency;
  monthly_cost?: string;
  yearly_cost?: string;
  coverage_summary?: string;
  notes?: string;
}

interface FetchInsuranceOptions {
  search?: string;
  type?: string;
  status?: string;
}

function normalize(payload: unknown): InsuranceContract[] {
  if (Array.isArray(payload)) return payload as InsuranceContract[];
  const p = payload as { results?: InsuranceContract[] };
  return Array.isArray(p.results) ? p.results : [];
}

export async function fetchInsuranceList(options: FetchInsuranceOptions = {}): Promise<InsuranceContract[]> {
  const params: Record<string, string> = { ordering: 'name' };
  if (options.search) params.search = options.search;
  if (options.type) params.type = options.type;
  if (options.status) params.status = options.status;
  const { data } = await api.get('/insurance/', { params });
  return normalize(data);
}

export async function fetchInsurance(id: string): Promise<InsuranceContract> {
  const { data } = await api.get(`/insurance/${id}/`);
  return data as InsuranceContract;
}

export async function createInsurance(payload: InsurancePayload): Promise<InsuranceContract> {
  const { data } = await api.post('/insurance/', payload);
  return data as InsuranceContract;
}

export async function updateInsurance(id: string, payload: InsurancePayload): Promise<InsuranceContract> {
  const { data } = await api.patch(`/insurance/${id}/`, payload);
  return data as InsuranceContract;
}

export async function deleteInsurance(id: string): Promise<void> {
  await api.delete(`/insurance/${id}/`);
}
