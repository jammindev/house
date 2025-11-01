// nextjs/src/features/interactions/components/InteractionList.tsx
"use client";
import InteractionItem from "./InteractionItem";
import type { Interaction } from "@interactions/types";

interface Props {
  interactions: Interaction[];
  documentCounts: Record<string, number>;
  t: (key: string, args?: Record<string, string | number>) => string;
}

export default function InteractionList({ interactions, documentCounts, t }: Props) {
  return (
    <div className="space-y-2">
      {interactions.length === 0 ? (
        <div className="text-sm text-gray-500">{t("interactionsnone")}</div>
      ) : (
        <ul className="space-y-3">
          {interactions.map((interaction) => (
            <li key={interaction.id}>
              <InteractionItem
                interaction={interaction}
                documentCount={documentCounts[interaction.id] || 0}
                t={t}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
