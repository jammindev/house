import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import {
  fetchBoards,
  fetchDevices,
  fetchCircuits,
  fetchUsagePoints,
  fetchLinks,
  createBoard,
  updateBoard,
  deleteBoard,
  createDevice,
  updateDevice,
  deleteDevice,
  createCircuit,
  updateCircuit,
  deleteCircuit,
  createUsagePoint,
  bulkCreateUsagePoints,
  updateUsagePoint,
  deleteUsagePoint,
  createLink,
  deactivateLink,
  type BoardPayload,
  type DevicePayload,
  type CircuitPayload,
  type UsagePointPayload,
} from '@/lib/api/electricity';

// ── Query key factory ─────────────────────────────────────────────────────────

export const electricityKeys = {
  all: ['electricity'] as const,
  boards: () => [...electricityKeys.all, 'boards'] as const,
  devices: (boardId?: string) => [...electricityKeys.all, 'devices', boardId ?? 'all'] as const,
  circuits: (boardId?: string) => [...electricityKeys.all, 'circuits', boardId ?? 'all'] as const,
  usagePoints: () => [...electricityKeys.all, 'usage-points'] as const,
  links: (boardId?: string) => [...electricityKeys.all, 'links', boardId ?? 'all'] as const,
};

// ── Query hooks ───────────────────────────────────────────────────────────────

export function useElectricityBoards() {
  return useQuery({
    queryKey: electricityKeys.boards(),
    queryFn: fetchBoards,
  });
}

export function useProtectiveDevices(boardId?: string) {
  return useQuery({
    queryKey: electricityKeys.devices(boardId),
    queryFn: () => fetchDevices(boardId),
    enabled: Boolean(boardId),
  });
}

export function useCircuits(boardId?: string) {
  return useQuery({
    queryKey: electricityKeys.circuits(boardId),
    queryFn: () => fetchCircuits(boardId),
    enabled: Boolean(boardId),
  });
}

export function useUsagePoints() {
  return useQuery({
    queryKey: electricityKeys.usagePoints(),
    queryFn: fetchUsagePoints,
  });
}

export function useLinks(boardId?: string) {
  return useQuery({
    queryKey: electricityKeys.links(boardId),
    queryFn: () => fetchLinks(boardId),
    enabled: Boolean(boardId),
  });
}

// ── Board mutations ───────────────────────────────────────────────────────────

export function useCreateBoard() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: BoardPayload) => createBoard(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.boards() });
      toast({ description: t('electricity.board.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BoardPayload> }) =>
      updateBoard(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.boards() });
      toast({ description: t('electricity.board.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => deleteBoard(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.all });
      toast({ description: t('electricity.board.deleted'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

// ── Device mutations ──────────────────────────────────────────────────────────

export function useCreateDevice() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: DevicePayload) => createDevice(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.all });
      toast({ description: t('electricity.device.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<DevicePayload> }) =>
      updateDevice(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.all });
      toast({ description: t('electricity.device.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => deleteDevice(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.all });
      toast({ description: t('electricity.device.deleted'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

// ── Circuit mutations ─────────────────────────────────────────────────────────

export function useCreateCircuit() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: CircuitPayload) => createCircuit(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.all });
      toast({ description: t('electricity.circuit.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateCircuit() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CircuitPayload> }) =>
      updateCircuit(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.all });
      toast({ description: t('electricity.circuit.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteCircuit() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => deleteCircuit(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.all });
      toast({ description: t('electricity.circuit.deleted'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

// ── Usage point mutations ─────────────────────────────────────────────────────

export function useCreateUsagePoint() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: UsagePointPayload) => createUsagePoint(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.usagePoints() });
      toast({ description: t('electricity.usagePoint.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useBulkCreateUsagePoints() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: UsagePointPayload & { quantity: number }) =>
      bulkCreateUsagePoints(payload),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: electricityKeys.usagePoints() });
      toast({
        description: t('electricity.usagePoint.createdBulk', { count: data.length }),
        variant: 'success',
      });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateUsagePoint() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UsagePointPayload> }) =>
      updateUsagePoint(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.usagePoints() });
      toast({ description: t('electricity.usagePoint.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteUsagePoint() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => deleteUsagePoint(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.usagePoints() });
      toast({ description: t('electricity.usagePoint.deleted'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

// ── Link mutations ────────────────────────────────────────────────────────────

export function useCreateLink() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ circuitId, usagePointId }: { circuitId: string; usagePointId: string }) =>
      createLink(circuitId, usagePointId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.all });
      toast({ description: t('electricity.link.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeactivateLink() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => deactivateLink(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: electricityKeys.all });
      toast({ description: t('electricity.link.deactivated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
