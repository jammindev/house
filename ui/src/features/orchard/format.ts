import { formatQuantity } from '@/lib/format';
import type { HarvestTotal } from '@/lib/api/orchard';

/**
 * Rend une liste de totaux **unité par unité**, jamais additionnés.
 *
 * 12 kg et 40 pièces ne font pas 52 de quoi que ce soit : sortir un seul nombre
 * obligerait à choisir dans quelle unité mentir. La fonction vit ici et pas dans
 * un composant pour que les deux écrans qui l'affichent — l'aperçu de la page et
 * la série de la fiche — lisent le même texte.
 */
export function formatTotals(
  totals: HarvestTotal[],
  unitLabel: (unit: string) => string,
): string {
  return totals
    .map((total) => `${formatQuantity(total.quantity)} ${unitLabel(total.unit)}`)
    .join(' · ');
}
