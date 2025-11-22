"use client";

import { FileText, Link2, NotebookPen, Paperclip, Plus, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

interface ProjectQuickActionsProps {
  projectId: string;
  onLinkExisting?: () => void;
}

export default function ProjectQuickActions({ projectId, onLinkExisting }: ProjectQuickActionsProps) {
  const { t } = useI18n();
  const projectPagePath = `/app/projects/${projectId}`;

  const buildInteractionUrl = (basePath: string, extraParams: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams({
      projectId,
      returnTo: projectPagePath,
    });
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Button asChild variant="outline" className="justify-start gap-2">
        <LinkWithOverlay href={buildInteractionUrl("/app/interactions/new/todo")}>
          <NotebookPen className="h-4 w-4" />
          {t("projects.quickActions.addTask")}
        </LinkWithOverlay>
      </Button>
      <Button asChild variant="outline" className="justify-start gap-2">
        <LinkWithOverlay href={buildInteractionUrl("/app/interactions/new/note")}>
          <Plus className="h-4 w-4" />
          {t("projects.quickActions.addNote")}
        </LinkWithOverlay>
      </Button>
      <Button asChild variant="outline" className="justify-start gap-2">
        <LinkWithOverlay href={buildInteractionUrl("/app/interactions/new", { type: "document" })}>
          <Paperclip className="h-4 w-4" />
          {t("projects.quickActions.addDocument")}
        </LinkWithOverlay>
      </Button>
      <Button asChild variant="outline" className="justify-start gap-2">
        <LinkWithOverlay href={buildInteractionUrl("/app/interactions/new/expense")}>
          <Receipt className="h-4 w-4" />
          {t("projects.quickActions.addExpense")}
        </LinkWithOverlay>
      </Button>
      <Button asChild variant="outline" className="justify-start gap-2">
        <LinkWithOverlay href={buildInteractionUrl("/app/interactions/new/call")}>
          <FileText className="h-4 w-4" />
          {t("projects.quickActions.addCall")}
        </LinkWithOverlay>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="justify-start gap-2"
        onClick={() => onLinkExisting?.()}
      >
        <Link2 className="h-4 w-4" />
        {t("projects.quickActions.linkExisting")}
      </Button>
    </div>
  );
}
