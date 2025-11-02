"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function DetailSkeleton() {
  return (
    <div className="space-y-4 rounded-md border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
