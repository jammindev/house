import * as React from 'react';
import PhotoThumb from './PhotoThumb';
import type { DocumentItem, PhotoPhase } from '@/lib/api/documents';

/** Gouttière et colonnes de toute grille de photos — une seule définition. */
const GRID_CLASS = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4';

interface PhotoGridProps {
  photos: DocumentItem[];
  onPhotoClick: (photo: DocumentItem) => void;
  /** Pastille de phase par photo. Renvoyer `undefined` = pas de pastille. */
  phaseOf?: (photo: DocumentItem) => PhotoPhase | '' | undefined;
  /** Menu d'actions posé sur chaque vignette. */
  renderActions?: (photo: DocumentItem) => React.ReactNode;
  /**
   * Fourni = mode sélection : les vignettes cochent au lieu d'ouvrir. Un `undefined`
   * porte le mode « normal », donc la grille n'a pas de booléen à tenir en plus.
   */
  onToggleSelected?: (photo: DocumentItem) => void;
  isSelected?: (photo: DocumentItem) => boolean;
}

export default function PhotoGrid({
  photos,
  onPhotoClick,
  phaseOf,
  renderActions,
  onToggleSelected,
  isSelected,
}: PhotoGridProps) {
  return (
    <div className={GRID_CLASS}>
      {photos.map((photo) => (
        <PhotoThumb
          key={photo.id}
          photo={photo}
          onOpen={() => onPhotoClick(photo)}
          phase={phaseOf?.(photo)}
          actions={renderActions?.(photo)}
          onToggleSelected={onToggleSelected ? () => onToggleSelected(photo) : undefined}
          selected={isSelected?.(photo) ?? false}
        />
      ))}
    </div>
  );
}

/**
 * Squelette de chargement d'une grille de photos. Exporté pour que la page et
 * l'onglet par entité partagent la **même** géométrie que la grille réelle : les
 * deux la redéclaraient, et elles avaient déjà divergé (`md:` d'un côté, rien de
 * l'autre) — le contenu sautait d'une colonne à l'arrivée des données.
 */
export function PhotoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID_CLASS} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
