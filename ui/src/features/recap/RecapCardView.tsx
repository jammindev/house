import { formatAmount } from '@/lib/format';
import type { RecapCard } from '@/lib/api/recap';

/**
 * One screen of the story: an emoji, one big figure, a short label, a caption.
 *
 * Deliberately plain. A recap is the kind of screen that invites heavy animation and
 * decorative gradients, and both would make the figure harder to read — which is the
 * only thing the card is for.
 */
export default function RecapCardView({ card }: { card: RecapCard }) {
  const value = card.value_type === 'money' ? formatAmount(card.value) : card.value;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-4xl" aria-hidden>
        {card.emoji}
      </span>

      <p className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">{value}</p>

      <p className="text-base text-muted-foreground">{card.headline}</p>

      <p className="max-w-sm text-pretty text-sm text-foreground/80">{card.caption}</p>
    </div>
  );
}
