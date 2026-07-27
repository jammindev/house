import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/design-system/button';

interface PagerProps {
  /** Index de la première ligne affichée (0-based). */
  offset: number;
  /** Taille de page demandée. */
  limit: number;
  /** Nombre de lignes réellement rendues sur cette page. */
  shown: number;
  /** Total côté serveur. */
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  isFetching?: boolean;
}

/**
 * « 51–100 sur 260 », avec les deux flèches.
 *
 * Les bornes sont affichées, pas seulement un numéro de page : sur un registre
 * d'argent, savoir *où* on est dans la liste vaut mieux que savoir sur quelle
 * page — c'est ce qui permet de dire « j'ai traité jusqu'au 100e » et de
 * reprendre.
 *
 * Ne rend rien quand tout tient sur une page.
 */
export default function Pager({
  offset,
  limit,
  shown,
  total,
  onPrevious,
  onNext,
  isFetching = false,
}: PagerProps) {
  const { t } = useTranslation();

  if (total <= limit) return null;

  const hasPrevious = offset > 0;
  const hasNext = offset + shown < total;

  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={!hasPrevious || isFetching}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        {t('common.previous')}
      </Button>

      <p className="text-xs text-muted-foreground">
        {t('common.rangeOfTotal', {
          from: shown === 0 ? 0 : offset + 1,
          to: offset + shown,
          total,
        })}
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={!hasNext || isFetching}
      >
        {t('common.next')}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
