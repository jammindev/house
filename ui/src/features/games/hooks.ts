import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { toast } from '@/lib/toast';
import { useInvalidate } from '@/lib/invalidate';
import {
  abandonHunt,
  createHunt,
  deleteHunt,
  fetchActiveHunt,
  fetchHunt,
  fetchHuntPlay,
  fetchHunts,
  startHunt,
  updateHunt,
  type HuntPayload,
} from '@/lib/api/games';

export const huntKeys = {
  all: ['games'] as const,
  list: () => [...huntKeys.all, 'list'] as const,
  detail: (id: string) => [...huntKeys.all, 'detail', id] as const,
  active: () => [...huntKeys.all, 'active'] as const,
  play: (id: string) => [...huntKeys.all, 'play', id] as const,
};

export function useHunts() {
  return useQuery({ queryKey: huntKeys.list(), queryFn: fetchHunts });
}

export function useHunt(id: string | undefined) {
  return useQuery({
    queryKey: huntKeys.detail(id ?? ''),
    queryFn: () => fetchHunt(id as string),
    enabled: Boolean(id),
  });
}

/**
 * La chasse en cours.
 *
 * `refetchOnWindowFocus` est **rallumé ici**, contre le défaut du QueryClient :
 * c'est le seul écran du produit qu'on regarde pendant qu'un *autre* appareil
 * écrit dedans. Le téléphone passe de main en main, le parent suit sur le sien —
 * un écran de suivi qui affiche l'étape d'il y a cinq minutes ne sert à rien.
 */
export function useActiveHunt() {
  return useQuery({
    queryKey: huntKeys.active(),
    queryFn: fetchActiveHunt,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

/** La partie d'une chasse désignée — sert aussi l'écran de victoire. */
export function useHuntPlay(id: string | undefined) {
  return useQuery({
    queryKey: huntKeys.play(id ?? ''),
    queryFn: () => fetchHuntPlay(id as string),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

export function useCreateHunt() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: HuntPayload) => createHunt(payload),
    onSuccess: () => {
      invalidate('games');
      toast({ description: t('games.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateHunt() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<HuntPayload> }) =>
      updateHunt(id, payload),
    onSuccess: () => {
      invalidate('games');
      toast({ description: t('games.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useDeleteHunt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteHunt(id),
    onSuccess: () => invalidate('games'),
  });
}

export function useStartHunt() {
  const invalidate = useInvalidate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => startHunt(id),
    onSuccess: () => invalidate('games'),
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast({ description: detail ?? t('games.startFailed'), variant: 'destructive' });
    },
  });
}

export function useAbandonHunt() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => abandonHunt(id),
    onSuccess: () => {
      invalidate('games');
      void qc.invalidateQueries({ queryKey: huntKeys.active() });
    },
  });
}
