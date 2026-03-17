import { Skeleton } from '../design-system/skeleton';

interface ListSkeletonProps {
  count?: number;
  className?: string;
}

export default function ListSkeleton({ count = 5, className }: ListSkeletonProps) {
  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
