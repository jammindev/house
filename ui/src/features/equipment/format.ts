// Réexport des formatters partagés + variant de badge de statut équipement.
export { formatDate, formatDateTime } from '@/lib/format';

export function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'maintenance') return 'secondary';
  if (status === 'lost') return 'destructive';
  if (status === 'retired' || status === 'storage') return 'outline';
  return 'default';
}
