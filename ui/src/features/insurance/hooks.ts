import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import {
  fetchInsuranceList,
  fetchInsurance,
  createInsurance,
  updateInsurance,
  deleteInsurance,
  type InsurancePayload,
} from '@/lib/api/insurance';

interface InsuranceFilters {
  search?: string;
  type?: string;
  status?: string;
}

export const insuranceKeys = {
  all: ['insurance'] as const,
  list: (filters?: InsuranceFilters) => [...insuranceKeys.all, 'list', filters] as const,
  detail: (id: string) => [...insuranceKeys.all, 'detail', id] as const,
};

export function useInsuranceList(filters: InsuranceFilters = {}) {
  return useQuery({
    queryKey: insuranceKeys.list(filters),
    queryFn: () => fetchInsuranceList(filters),
  });
}

export function useInsurance(id: string) {
  return useQuery({
    queryKey: insuranceKeys.detail(id),
    queryFn: () => fetchInsurance(id),
    enabled: !!id,
  });
}

export function useCreateInsurance() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: InsurancePayload) => createInsurance(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: insuranceKeys.all });
      toast({ description: t('insurance.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateInsurance() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InsurancePayload }) =>
      updateInsurance(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: insuranceKeys.all });
      toast({ description: t('insurance.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteInsurance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInsurance(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: insuranceKeys.all }),
  });
}
