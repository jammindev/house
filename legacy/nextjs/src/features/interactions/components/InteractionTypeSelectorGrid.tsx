// nextjs/src/features/interactions/components/InteractionTypeSelectorGrid.tsx
"use client";

import ActionsGrid from "@/components/ui/actions-grid";
import {
  getInteractionTypesByCategory,
} from "@interactions/constants/interactionTypes";
import type { InteractionType } from "@interactions/types";

interface InteractionTypeSelectorGridProps {
  projectId?: string | null;
  returnTo?: string | null;
  zones?: string | null;
}

// Types à exclure (si besoin d'exclure des doublons)  
const EXCLUDED_TYPES: InteractionType[] = []; // Note: garde tous les types pour l'instant

export default function InteractionTypeSelectorGrid({
  projectId,
  returnTo,
  zones,
}: InteractionTypeSelectorGridProps) {
  // Récupérer toutes les configs groupées par catégorie
  const typesByCategory = getInteractionTypesByCategory();
  const interactionActions = Object.values(typesByCategory)
    .flat()
    .filter((config) => !EXCLUDED_TYPES.includes(config.type))
    .map((config) => ({
      type: config.type,
    }));

  return (
    <ActionsGrid
      interactionActions={interactionActions}
      projectId={projectId}
      returnTo={returnTo}
      zones={zones}
      showCategoryHeaders={true}
      responsive={true}
    />
  );
}