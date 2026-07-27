import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createWaiver,
  deleteWaiver,
  fetchComplianceGroup,
  fetchComplianceSummary,
} from '@/lib/api/banking';
import { toast } from '@/lib/toast';
import { complianceKeys } from './keys';
import { useInvalidateMoney } from './invalidate';

export { complianceKeys };

/**
 * Les compteurs de la coque. `staleTime` court plutôt que zéro : le badge est lu
 * à chaque changement d'onglet, et re-compter à chaque fois ferait payer
 * plusieurs `COUNT(*)` par détecteur pour un chiffre qui n'a pas bougé.
 */
export function useComplianceSummary() {
  return useQuery({
    queryKey: complianceKeys.summary(),
    queryFn: fetchComplianceSummary,
    staleTime: 30_000,
  });
}

export function useComplianceGroup(
  kind: string | undefined,
  options: { waived?: boolean; offset?: number; limit?: number } = {},
) {
  const waived = options.waived ?? false;
  const offset = options.offset ?? 0;
  return useQuery({
    queryKey: complianceKeys.group(kind ?? '', waived, offset),
    queryFn: () => fetchComplianceGroup(kind as string, { waived, offset, limit: options.limit }),
    enabled: Boolean(kind),
  });
}

/**
 * Arbitrer un écart. Jamais un « ignorer » : le motif part au serveur, qui le
 * refuse s'il est vide. Un second appel sur le même écart met à jour le motif et
 * le fingerprint — c'est le chemin du « ré-arbitrer » sur un arbitrage périmé.
 */
export function useWaiveFinding() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: { finding_kind: string; object_id: string; reason: string }) =>
      createWaiver(payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('money.compliance.waived'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/** Révoquer : l'écart resurgit à l'identique. C'est ce qui rend l'arbitrage sûr. */
export function useRevokeWaiver() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => deleteWaiver(id),
    onSuccess: () => {
      invalidate();
      toast({ description: t('money.compliance.revoked'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
