import * as React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';

interface Props {
  /** Combien d'éléments sont cochés — **déjà traduit** par l'appelant. */
  label: string;
  allSelected: boolean;
  /** Bascule tout sélectionner / tout décocher — un seul bouton, deux libellés. */
  onToggleAll: () => void;
  /** Quitte le mode sélection (la croix). Distinct de « tout décocher ». */
  onExit: () => void;
  /** Actions de masse : boutons fournis par l'appelant. */
  children?: React.ReactNode;
}

/**
 * Barre d'action d'une sélection multiple — le contenant, pas le métier.
 *
 * Pendant visuel de `useMultiSelect` : posée en bas de l'écran, elle reste
 * atteignable au pouce sur mobile, où le haut de page est hors de portée dès que la
 * grille défile.
 *
 * Le libellé du compteur est **fourni** plutôt que composé ici : « 3 photos
 * sélectionnées » se dit mieux que « 3 éléments sélectionnés », et une barre
 * générique n'a pas à imposer le vocabulaire de ses appelants. Les deux boutons
 * universels (tout sélectionner, effacer) vivent en revanche dans `common`.
 */
export default function SelectionBar({
  label,
  allSelected,
  onToggleAll,
  onExit,
  children,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-wrap items-center gap-2 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:mx-0 sm:rounded-lg sm:border">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onToggleAll}>
          {allSelected ? t('common.clearSelection') : t('common.selectAll')}
        </Button>
        {children}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onExit}
          aria-label={t('common.exitSelection')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
