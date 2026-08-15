import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import { Button } from '@/design-system/button';
import type { SeasonRow } from '@/lib/api/orchard';
import { useCompleteCareRule, useCreateCareTask, useSeasonPanel } from './hooks';

/**
 * Ce que la saison réclame — le panneau qui ouvre la page.
 *
 * Deux choses s'y jouent, et les deux viennent du serveur :
 * - **`missed` n'est pas `due`.** Une fenêtre refermée ne se rattrape pas :
 *   proposer la taille d'hiver en juin serait un mauvais conseil, pas un rappel.
 *   Elle se **dit** quand même — c'est justement ce qu'il faut savoir.
 * - **une règle par type est une ligne par sujet.** Avoir taillé un pommier sur
 *   cinq ne solde pas la saison ; fondre les cinq en un drapeau laisserait
 *   quatre arbres non taillés derrière une coche verte.
 */

function RowActions({ row }: { row: SeasonRow }) {
  const { t } = useTranslation();
  const complete = useCompleteCareRule();
  const createTask = useCreateCareTask();

  // `missed` ne propose pas « c'est fait » : la saison est passée, et consigner
  // aujourd'hui écrirait une taille d'hiver datée de juin.
  if (row.state === 'missed') {
    return <span className="text-xs text-muted-foreground">{t('orchard.care.missedHint')}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* La règle **propose** une tâche, elle n'en fabrique jamais en tâche de
          fond : une liste de tâches que personne n'a demandées cesse d'être lue. */}
      <Button
        variant="outline"
        disabled={createTask.isPending}
        onClick={() => createTask.mutate({ id: row.rule, tree: row.tree })}
      >
        {t('orchard.care.createTask')}
      </Button>
      <Button
        disabled={complete.isPending}
        onClick={() => complete.mutate({ id: row.rule, tree: row.tree })}
      >
        {t('orchard.care.markDone')}
      </Button>
    </div>
  );
}

export default function SeasonPanel() {
  const { t } = useTranslation();
  const { data } = useSeasonPanel();
  const rows = data?.rows ?? [];

  if (!rows.length) return null;

  return (
    <Card className="mb-4 p-4">
      <CardTitle>{t('orchard.care.seasonTitle')}</CardTitle>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li
            key={`${row.rule}:${row.tree}`}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {row.emoji ? `${row.emoji} ` : ''}
                {row.rule_name} — {row.tree_name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.state === 'missed'
                  ? t('orchard.care.windowClosed', { date: row.window_end })
                  : t('orchard.care.windowOpen', { date: row.window_end })}
              </p>
            </div>
            <RowActions row={row} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
