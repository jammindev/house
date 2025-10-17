"use client";
import InteractionItem from "./InteractionItem";
import type { Interaction } from "@interactions/types";

interface Props {
  interactions: Interaction[];
  documentCounts: Record<string, number>;
  t: (key: string, args?: Record<string, any>) => string;
}

export default function InteractionList({ interactions, documentCounts, t }: Props) {
  if (interactions.length === 0) {
    return <div className="text-sm text-gray-500">{t("interactionsnone")}</div>;
  }
  return (
    <ul className="space-y-3">
      {interactions.map((interaction) => (
        <li key={interaction.id}>
          <InteractionItem interaction={interaction} documentCount={documentCounts[interaction.id] || 0} t={t} />
        </li>
      ))}
    </ul>
  );
}
