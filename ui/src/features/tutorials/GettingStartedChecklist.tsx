import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';

import { Card } from '@/design-system/card';
import { startDoneKey } from './content';
import { useCompletedTutorials, useVisibleTutorials, useToggleTutorial } from './hooks';

/**
 * La checklist « Bien démarrer », montée à deux endroits.
 *
 * Elle vivait inline dans `TutorialsPage`, et le tableau de bord d'un foyer
 * vide en avait besoin — c'est **le** contenu qui manquait à son accueil, déjà
 * écrit et traduit dans les quatre langues, et que rien ne montrait. Recopiée,
 * elle aurait divergé au premier module ajouté, et c'est celle qu'on ne relit
 * pas qui serait restée affichée au nouveau venu.
 *
 * Les items viennent de `useVisibleTutorials`, qui filtre déjà sur les modules
 * activés du foyer : une étape « déclarer un compte bancaire » n'apparaît pas
 * là où l'argent est désactivé.
 */
export default function GettingStartedChecklist() {
  const { t } = useTranslation();
  const { startItems } = useVisibleTutorials();
  const { completed } = useCompletedTutorials();
  const { toggle } = useToggleTutorial();

  if (startItems.length === 0) return null;

  return (
    <Card className="divide-y divide-border">
      {startItems.map((item) => {
        const doneKey = startDoneKey(item.key);
        const isDone = completed.has(doneKey);
        return (
          <div key={item.key} className="flex items-center gap-3 p-3">
            <button
              type="button"
              onClick={() => toggle(doneKey)}
              aria-pressed={isDone}
              aria-label={isDone ? t('tutorials.markUndone') : t('tutorials.markDone')}
              title={isDone ? t('tutorials.markUndone') : t('tutorials.markDone')}
              className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-primary"
            >
              {isDone ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}
              >
                {t(`tutorials.start.items.${item.key}.title`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(`tutorials.start.items.${item.key}.description`)}
              </p>
            </div>
            <Link
              to={item.to}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t('tutorials.goThere')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        );
      })}
    </Card>
  );
}
