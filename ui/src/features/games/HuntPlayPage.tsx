import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, PartyPopper, QrCode } from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useAbandonHunt, useActiveHunt, useHuntPlay } from './hooks';

/**
 * L'écran de partie — celui qu'on tend aux enfants.
 *
 * Il n'a **aucun état local** : tout vient de `GET /games/hunts/active/`. C'est
 * ce qui fait qu'une partie survit à un rechargement et se reprend sur un autre
 * téléphone du foyer. L'avancement, lui, n'arrive jamais d'ici : il se produit
 * quand l'appareil photo ouvre `/z/<jeton>`.
 */
export default function HuntPlayPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // `?hunt=` désigne la partie qu'on vient de jouer — y compris **terminée**,
  // cas où « la chasse active » est déjà `null` alors qu'il reste le trésor à
  // révéler. Sans ce paramètre, on retombe sur la partie en cours.
  const requested = params.get('hunt') ?? undefined;
  const played = useHuntPlay(requested);
  const running = useActiveHunt();
  const hunt = requested ? played.data : running.data;
  const isLoading = requested ? played.isLoading : running.isLoading;
  const abandonMutation = useAbandonHunt();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  }

  if (!hunt) {
    return (
      <div>
        <PageHeader title={t('games.playTitle')} />
        <EmptyState
          icon={Compass}
          title={t('games.noActive')}
          description={t('games.noActiveDescription')}
          action={{ label: t('games.backToHunts'), onClick: () => navigate('/app/games') }}
        />
      </div>
    );
  }

  const finished = hunt.status === 'done';

  return (
    <div>
      <PageHeader title={hunt.name} />

      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        {finished ? (
          <>
            <PartyPopper className="h-10 w-10 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">{t('games.won')}</h2>
            <p className="max-w-md text-base text-foreground">{hunt.treasure_text}</p>
            <Button onClick={() => navigate('/app/games')}>{t('games.backToHunts')}</Button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">
              {t('games.progress', { found: hunt.found_count, total: hunt.step_count })}
            </span>
            <p className="max-w-md text-xl font-medium text-foreground">
              {hunt.current_step?.riddle || t('games.noRiddle')}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <QrCode className="h-4 w-4" aria-hidden />
              {t('games.scanHint')}
            </div>
          </>
        )}
      </Card>

      {!finished && (
        <div className="flex justify-center pt-4">
          {/* Abandonner libère la place : une seule chasse active par foyer. */}
          <Button
            variant="outline"
            onClick={() =>
              abandonMutation.mutate(hunt.id, { onSuccess: () => navigate('/app/games') })
            }
          >
            {t('games.abandon')}
          </Button>
        </div>
      )}
    </div>
  );
}
