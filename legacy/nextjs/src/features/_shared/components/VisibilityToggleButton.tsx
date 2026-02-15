// nextjs/src/features/_shared/components/VisibilityToggleButton.tsx
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToggleVisibility, type EntityType } from "@shared/hooks/useToggleVisibility";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface VisibilityToggleButtonProps {
  entityType: EntityType;
  entityId: string;
  isPrivate: boolean;
  onToggled: () => void;
  showToast?: (message: { title: string; variant?: "default" | "destructive" }) => void;
}

export default function VisibilityToggleButton({
  entityType,
  entityId,
  isPrivate,
  onToggled,
  showToast,
}: VisibilityToggleButtonProps) {
  const { t } = useI18n();
  const [optimisticIsPrivate, setOptimisticIsPrivate] = useState(isPrivate);

  // Sync with prop when it changes (after data reload)
  useEffect(() => {
    setOptimisticIsPrivate(isPrivate);
  }, [isPrivate]);

  const { toggle, loading } = useToggleVisibility({
    entityType,
    entityId,
    onSuccess: () => {
      // Refresh data
      onToggled();
      // At this point, optimisticIsPrivate contains the NEW value
      // If optimisticIsPrivate is true, we changed TO private
      // If optimisticIsPrivate is false, we changed TO household
      showToast?.({
        title: optimisticIsPrivate
          ? t("visibility.changedToPrivate")
          : t("visibility.changedToHousehold"),
        variant: "default",
      });
    },
    onError: (error) => {
      // Revert optimistic update on error
      setOptimisticIsPrivate(isPrivate);
      showToast?.({
        title: t("visibility.toggleFailed"),
        variant: "destructive",
      });
      console.error("Failed to toggle visibility:", error);
    },
  });

  const handleClick = () => {
    // Optimistic update for immediate UI feedback
    const newValue = !optimisticIsPrivate;
    setOptimisticIsPrivate(newValue);
    toggle(isPrivate);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleClick}
      disabled={loading}
      aria-label={
        optimisticIsPrivate ? t("visibility.makeHousehold") : t("visibility.makePrivate")
      }
      title={
        optimisticIsPrivate ? t("visibility.makeHousehold") : t("visibility.makePrivate")
      }
    >
      {optimisticIsPrivate ? (
        <EyeOff className="h-5 w-5" />
      ) : (
        <Eye className="h-5 w-5" />
      )}
    </Button>
  );
}
