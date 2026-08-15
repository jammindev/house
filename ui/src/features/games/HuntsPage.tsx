import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import CardActions, { type CardAction } from '@/components/CardActions';
import { Button } from '@/design-system/button';
import { Card, CardTitle } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import HuntComposerDialog from './HuntComposerDialog';
import { useActiveHunt, useDeleteHunt, useHunts, useReplayHunt, useStartHunt } from './hooks';
import type { Hunt } from '@/lib/api/games';

export default function HuntsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: hunts, isLoading } = useHunts();
  const { data: active } = useActiveHunt();
  const startMutation = useStartHunt();
  const replayMutation = useReplayHunt();
  const deleteMutation = useDeleteHunt();
  const showSkeleton = useDelayedLoading(isLoading);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Hunt | undefined>(undefined);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('games.deleted'),
    onDelete: (id: string) => deleteMutation.mutateAsync(id),
  });

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function start(hunt: Hunt) {
    startMutation.mutate(hunt.id, {
      onSuccess: () => navigate(`/app/games/play?hunt=${hunt.id}`),
    });
  }

  if (showSkeleton) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const list = hunts ?? [];

  return (
    <div>
      <PageHeader title={t('games.title')}>
        <Button onClick={openCreate}>{t('games.new')}</Button>
      </PageHeader>

      {active && (
        <Card className="mb-4 flex items-center justify-between gap-3 border-primary/30 bg-primary/10 p-3">
          <div className="min-w-0">
            <CardTitle>🧭 {active.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('games.progress', {
                found: active.found_count,
                total: active.step_count,
              })}
            </p>
          </div>
          <Button onClick={() => navigate(`/app/games/play?hunt=${active.id}`)}>
            {t('games.resume')}
          </Button>
        </Card>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={Compass}
          title={t('games.none')}
          description={t('games.emptyDescription')}
          action={{ label: t('games.new'), onClick: openCreate }}
        />
      ) : (
        <div className="space-y-2">
          {list.map((hunt) => {
            const actions: CardAction[] = [
              {
                label: t('common.edit'),
                icon: Pencil,
                onClick: () => {
                  setEditing(hunt);
                  setDialogOpen(true);
                },
              },
              {
                label: t('common.delete'),
                icon: Trash2,
                onClick: () => deleteWithUndo(hunt.id, { onRemove: () => {}, onRestore: () => {} }),
                variant: 'danger',
              },
            ];
            return (
              <Card key={hunt.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle>{hunt.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t(`games.status.${hunt.status}`)} ·{' '}
                      {t('games.stepCount', { count: hunt.step_count })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {hunt.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => start(hunt)}
                        disabled={startMutation.isPending}
                      >
                        <Play className="mr-1 h-4 w-4" aria-hidden />
                        {t('games.start')}
                      </Button>
                    )}
                    {/* Rejouer ne s'offre que sur une chasse **finie** : sur un
                        brouillon il n'y a rien à ressortir, et sur une partie en
                        cours il faudrait d'abord la terminer. */}
                    {hunt.status === 'done' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => replayMutation.mutate(hunt.id)}
                        disabled={replayMutation.isPending}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
                        {t('games.replay')}
                      </Button>
                    )}
                    <CardActions actions={actions} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <HuntComposerDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />
    </div>
  );
}
