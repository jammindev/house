interface ListSkeletonProps {
  /** Nombre de barres (défaut 3). */
  rows?: number;
  /** Hauteur Tailwind de chaque barre (défaut `h-14`). */
  rowClassName?: string;
  /** Classes du conteneur (défaut `space-y-2`). */
  className?: string;
}

/**
 * Skeleton de chargement générique : barres pulsantes en token `bg-muted`.
 * Remplace les boucles `animate-pulse rounded-lg bg-muted` recopiées dans les pages.
 */
export default function ListSkeleton({
  rows = 3,
  rowClassName = 'h-14',
  className = 'space-y-2',
}: ListSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${rowClassName} animate-pulse rounded-lg bg-muted`} />
      ))}
    </div>
  );
}
