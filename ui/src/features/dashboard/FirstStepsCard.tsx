import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

import GettingStartedChecklist from '@/features/tutorials/GettingStartedChecklist';

/**
 * Ce que voit un foyer qui vient de naître, à la place des cartes vides.
 *
 * Le contenu n'est pas neuf : la checklist « Bien démarrer » existait, écrite et
 * traduite dans les quatre langues, sur `/app/tutorial` — et **rien du tableau
 * de bord n'y menait**. L'accueil austère n'était donc pas un manque de matière,
 * c'était de la matière invisible.
 *
 * Le composant est celui de `features/tutorials/`, monté ici tel quel : deux
 * listes de premiers pas divergeraient au premier module ajouté, et c'est celle
 * qu'on ne relit pas qui resterait affichée au nouveau venu.
 */
export default function FirstStepsCard() {
  const { t } = useTranslation();

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            {t('dashboard.firstSteps.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('dashboard.firstSteps.hint')}</p>
        </div>
        <Link
          to="/app/tutorial"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t('dashboard.firstSteps.seeGuides')}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <GettingStartedChecklist />
    </section>
  );
}
