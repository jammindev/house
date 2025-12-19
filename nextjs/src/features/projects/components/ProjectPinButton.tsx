"use client";

import { useEffect, useState } from "react";
import { Pin } from "lucide-react";

import { Button } from "@/components/ui/button";
import ActiveIndicator from "@shared/components/ActiveIndicator";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

interface ProjectPinButtonProps {
  projectId: string;
  isPinned: boolean;
  onPinnedChange?: (next: boolean) => void;
}

export default function ProjectPinButton({ projectId, isPinned, onPinnedChange }: ProjectPinButtonProps) {
  const { selectedHouseholdId } = useGlobal();
  const { show } = useToast();
  const { t } = useI18n();
  const [pinned, setPinned] = useState(isPinned);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPinned(isPinned);
  }, [isPinned]);

  const handleToggle = async () => {
    if (!selectedHouseholdId || isSaving) return;
    const nextPinned = !pinned;
    setIsSaving(true);
    try {
      const supa = await createSPASassClient();
      const client = supa.getSupabaseClient();
      
      // Get current user
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      if (nextPinned) {
        // Pin: insert into user_pinned_projects
        const { error } = await client
          .from("user_pinned_projects")
          .insert({
            user_id: user.id,
            project_id: projectId,
            household_id: selectedHouseholdId,
          });
        if (error) throw error;
      } else {
        // Unpin: delete from user_pinned_projects
        const { error } = await client
          .from("user_pinned_projects")
          .delete()
          .eq("user_id", user.id)
          .eq("project_id", projectId);
        if (error) throw error;
      }

      setPinned(nextPinned);
      onPinnedChange?.(nextPinned);
      show({
        title: nextPinned ? t("projects.pin.success") : t("projects.unpin.success"),
        variant: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("projects.pin.error");
      show({ title: message, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const label = pinned ? t("projects.unpin.action") : t("projects.pin.action");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      className="relative"
      disabled={!selectedHouseholdId || isSaving}
      onClick={handleToggle}
    >
      <Pin
        className={cn(
          "h-4 w-4 transition-colors",
        )}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
      {pinned ? <ActiveIndicator /> : null}
    </Button>
  );
}
