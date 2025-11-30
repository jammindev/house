"use client";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectTasksPanel from "@projects/components/ProjectTasksPanel";
import type { InteractionStatus } from "@interactions/types";

const TASK_STATUSES: InteractionStatus[] = ["pending", "in_progress", "done"];

export default function TasksPage() {
  const { t } = useI18n();

  return (
    <ResourcePageShell title={t("tasks.title")} subtitle={t("tasks.subtitle")} hideBackButton bodyClassName="space-y-6">
      {/* TaskBoard is temporarily commented while it gets reworked */}
      <ProjectTasksPanel scope="household" statusFilter={TASK_STATUSES} hideArchived withProjectLabel />
    </ResourcePageShell>
  );
}
