import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/design-system/button';

interface LoadMoreProps {
  /** Nombre de lignes actuellement affichées. */
  shown: number;
  /** Nombre total côté serveur. */
  total: number;
  onLoadMore: () => void;
  /** Vrai pendant le rechargement — le bouton reste lisible, il ne disparaît pas. */
  isFetching?: boolean;
  /**
   * Plafond que le serveur ne dépassera pas en une requête. Atteint, le bouton
   * cède la place à une phrase : un bouton qui n'avance plus est exactement le
   * mur qu'on supprime ici, déplacé cinquante lignes plus loin.
   */
  max?: number;
  className?: string;
}

/**
 * « Voir plus », avec le compte exact de ce qui reste.
 *
 * Le libellé porte les deux nombres (`12 sur 116`) parce que le bouton seul ne
 * dit pas s'il reste trois lignes ou trois cents — or c'est ce qui décide si on
 * clique ou si on affine un filtre.
 *
 * Ne rend rien quand tout est affiché : un bouton qui ne fait rien apprend à
 * ignorer les boutons.
 */
export default function LoadMore({
  shown,
  total,
  onLoadMore,
  isFetching = false,
  max,
  className,
}: LoadMoreProps) {
  const { t } = useTranslation();

  if (shown >= total) return null;

  if (max !== undefined && shown >= max) {
    return (
      <p className={className ?? 'pt-2 text-center text-xs text-muted-foreground'}>
        {t('common.cappedAtMax', { shown, total })}
      </p>
    );
  }

  return (
    <div className={className ?? 'flex flex-col items-center gap-1 pt-1'}>
      <Button type="button" variant="outline" size="sm" onClick={onLoadMore} disabled={isFetching}>
        <ChevronDown className="mr-1.5 h-4 w-4" />
        {t('common.loadMore')}
      </Button>
      <p className="text-xs text-muted-foreground">{t('common.shownOfTotal', { shown, total })}</p>
    </div>
  );
}
