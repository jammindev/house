"use client";

import Link from "next/link";
import { FileText, Link2, NotebookPen, Paperclip, Plus, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface ProjectQuickActionsProps {
  projectId: string;
  onLinkExisting?: () => void;
}

export default function ProjectQuickActions({ projectId, onLinkExisting }: ProjectQuickActionsProps) {
  const { t } = useI18n();

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Button asChild variant="outline" className="justify-start gap-2">
        <Link href={`/app/interactions/new?projectId=${projectId}&type=todo`}>
          <NotebookPen className="h-4 w-4" />
          {t("projects.quickActions.addTask")}
        </Link>
      </Button>
      <Button asChild variant="outline" className="justify-start gap-2">
        <Link href={`/app/interactions/new?projectId=${projectId}&type=note`}>
          <Plus className="h-4 w-4" />
          {t("projects.quickActions.addNote")}
        </Link>
      </Button>
      <Button asChild variant="outline" className="justify-start gap-2">
        <Link href={`/app/interactions/new?projectId=${projectId}&type=document`}>
          <Paperclip className="h-4 w-4" />
          {t("projects.quickActions.addDocument")}
        </Link>
      </Button>
      <Button asChild variant="outline" className="justify-start gap-2">
        <Link href={`/app/interactions/new?projectId=${projectId}&type=expense`}>
          <Receipt className="h-4 w-4" />
          {t("projects.quickActions.addExpense")}
        </Link>
      </Button>
      <Button asChild variant="outline" className="justify-start gap-2">
        <Link href={`/app/interactions/new?projectId=${projectId}&type=call`}>
          <FileText className="h-4 w-4" />
          {t("projects.quickActions.addCall")}
        </Link>
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
