import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import type { RecapCard } from '@/lib/api/recap';
import { useRecap } from './hooks';
import RecapCardView from './RecapCardView';
import { monthLabel } from './month';

/** A card plus the chapter it came from — the chapter is context, not a screen. */
type StoryCard = RecapCard & { chapterTitle: string; chapterEmoji: string };

/** Below this horizontal travel a touch is a tap, not a swipe. */
const SWIPE_THRESHOLD_PX = 48;

export default function RecapStoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { month } = useParams<{ month: string }>();
  const query = useRecap(month);
  const showSkeleton = useDelayedLoading(query.isLoading);

  const cards: StoryCard[] = React.useMemo(
    () =>
      (query.data?.chapters ?? []).flatMap((chapter) =>
        chapter.cards.map((card) => ({
          ...card,
          chapterTitle: chapter.title,
          chapterEmoji: chapter.emoji,
        })),
      ),
    [query.data],
  );

  const [index, setIndex] = React.useState(0);
  // A shorter recap (or a chapter the user just switched off) must not leave the
  // cursor past the end.
  React.useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(cards.length - 1, 0)));
  }, [cards.length]);

  const go = React.useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(cards.length - 1, 0)));
    },
    [cards.length],
  );

  const close = React.useCallback(() => navigate('/app/recap'), [navigate]);

  // Keyboard is a first-class way through the story, not an afterthought: arrows
  // move, Escape leaves. There is no auto-advance — a recap is not an ad.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'Escape') close();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, close]);

  const touchStartX = React.useRef<number | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const travel = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(travel) < SWIPE_THRESHOLD_PX) return;
    go(travel < 0 ? 1 : -1);
  };

  if (showSkeleton) {
    return <div className="h-[26rem] animate-pulse rounded-lg bg-muted" />;
  }
  if (query.isLoading) return null;

  if (query.isError || cards.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title={t('recap.story.unavailable')}
        description={t('recap.story.unavailableDescription')}
        action={{ label: t('recap.backToHistory'), onClick: close }}
      />
    );
  }

  const card = cards[index];
  const isFirst = index === 0;
  const isLast = index === cards.length - 1;

  return (
    // Bounded width on purpose: full-bleed, the figure floats in a banner and stops
    // reading as a card. The story is a stack of cards, not a dashboard panel.
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold capitalize text-foreground">
            {monthLabel(month)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {card.chapterEmoji} {card.chapterTitle}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={close} aria-label={t('common.close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* The card area. `select-none` so a swipe doesn't highlight the figure. */}
      <Card
        className="relative h-[26rem] select-none overflow-hidden p-0"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          role="group"
          aria-roledescription={t('recap.story.cardRole')}
          aria-label={t('recap.story.position', { current: index + 1, total: cards.length })}
          className="h-full"
        >
          <RecapCardView card={card} />
        </div>

        {/* Tap zones: a pointer affordance, nothing more. They duplicate the footer
            buttons, so they stay out of the accessibility tree and out of the tab
            order — otherwise a screen reader announces "Next" twice, and tabbing
            through the story hits two controls that do the same thing. */}
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={isFirst}
          aria-hidden
          tabIndex={-1}
          className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize disabled:cursor-default"
        />
        <button
          type="button"
          onClick={() => go(1)}
          disabled={isLast}
          aria-hidden
          tabIndex={-1}
          className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize disabled:cursor-default"
        />
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={isFirst}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('recap.story.previous')}
        </Button>

        <div
          className="flex flex-wrap items-center justify-center gap-1.5"
          aria-label={t('recap.story.position', { current: index + 1, total: cards.length })}
        >
          {cards.map((c, i) => (
            <button
              key={`${c.kind}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t('recap.story.goTo', { position: i + 1 })}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <Button variant="outline" size="sm" onClick={close}>
            {t('recap.story.done')}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => go(1)}>
            {t('recap.story.next')}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
