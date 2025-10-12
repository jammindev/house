// nextjs/src/features/entries/components/EntryZonesList.tsx
"use client";

import { Layers } from "lucide-react";
import { useEntryZones } from "@/features/entries/hooks/useEntryZones";

type Props = {
  entryId: string;
};

export default function EntryZonesList({ entryId }: Props) {
  const { zones } = useEntryZones(entryId);

  return (
    <>
      {zones.length > 0 && (
        <ul role="list" className="flex flex-wrap gap-2">
          {zones.map((z) => (
            <li key={z.id}>
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700 text-xs">
                <Layers className="h-3 w-3" />
                {z.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

