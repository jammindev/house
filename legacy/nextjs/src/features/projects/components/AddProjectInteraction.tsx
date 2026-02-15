// nextjs/src/features/projects/components/AddProjectInteraction.tsx
"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

import ActionsGrid, { type CustomAction } from "@/components/ui/actions-grid";
import ProjectLinkInteractionModal from "@/features/projects/components/ProjectLinkInteractionModal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  getInteractionTypesByCategory,
} from "@interactions/constants/interactionTypes";
import type { InteractionType } from "@interactions/types";

export interface AddProjectInteractionProps {
  projectId: string;
  onInteractionAdded?: () => void;
}

// Types à exclure (si besoin d'exclure des doublons)
const EXCLUDED_TYPES: InteractionType[] = []; // Note: garde tous les types pour l'instant

export default function AddProjectInteraction({
  projectId,
  onInteractionAdded,
}: AddProjectInteractionProps) {
  const { t } = useI18n();
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Récupérer seulement les configs compatibles avec les projets
  const typesByCategory = getInteractionTypesByCategory(undefined, "project");
  const interactionActions = Object.values(typesByCategory)
    .flat()
    .filter((config) => !EXCLUDED_TYPES.includes(config.type))
    .map((config) => ({
      type: config.type,
    }));

  const customActions: CustomAction[] = [
    {
      key: "link-existing",
      labelKey: "projects.quickActions.linkExisting",
      descriptionKey: "projects.linkInteraction.description",
      icon: Link2,
      color: "border-blue-200 bg-blue-50 text-blue-600",
      onClick: () => setShowLinkDialog(true),
      category: "other",
    },
  ];

  return (
    <>
      <ActionsGrid
        interactionActions={interactionActions}
        customActions={customActions}
        projectId={projectId}
        showCategoryHeaders={true}
        responsive={true}
      />

      <ProjectLinkInteractionModal
        open={showLinkDialog}
        projectId={projectId}
        onOpenChange={setShowLinkDialog}
        onLinked={() => {
          setShowLinkDialog(false);
          onInteractionAdded?.();
        }}
      />
    </>
  );
}
