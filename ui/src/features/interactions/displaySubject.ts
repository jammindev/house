import type { TFunction } from 'i18next';
import type { InteractionListItem } from '@/lib/api/interactions';

/**
 * Returns the user-facing subject for an Interaction.
 *
 * For interactions auto-created by composed endpoints (e.g. stock purchase),
 * the backend stores a stable English subject + a machine-readable
 * `metadata.kind` discriminator. This helper renders a localized title in
 * the user's UI language instead of the stored English source.
 *
 * Falls back to the raw subject for everything else.
 */
export function getInteractionDisplaySubject(
  item: Pick<InteractionListItem, 'subject' | 'metadata'>,
  t: TFunction,
): string {
  const metadata = item.metadata as { kind?: string; stock_item_name?: string } | undefined;
  if (metadata?.kind === 'stock_purchase') {
    return t('stock.purchase.interaction_subject', {
      name: metadata.stock_item_name ?? '',
    });
  }
  return item.subject;
}
