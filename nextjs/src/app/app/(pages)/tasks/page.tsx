"use client";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectTasksPanel from "@projects/components/ProjectTasksPanel";
import type { InteractionStatus } from "@interactions/types";
import NewTaskDialog from "@interactions/components/NewTaskDialog";
import { useState } from "react";

const TASK_STATUSES: InteractionStatus[] = ["pending", "in_progress", "done"];

export default function TasksPage() {
  const { t } = useI18n();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTaskCreated = () => {
    // Force refresh of the panel by updating the key
    setRefreshKey(prev => prev + 1);
  };

  return (
    <ResourcePageShell 
      title={t("tasks.title")} 
      subtitle={t("tasks.subtitle")} 
      hideBackButton 
      bodyClassName="space-y-6"
      actions={[
        {
          element: (
            <NewTaskDialog
              defaultStatus="pending"
              onCreated={handleTaskCreated}
              variant="icon-only"
            />
          )
        }
      ]}
    >
      <ProjectTasksPanel 
        key={refreshKey}
        scope="household" 
        statusFilter={TASK_STATUSES} 
        hideArchived 
        withProjectLabel 
        showAddButton={false}
      />
    </ResourcePageShell>
  );
}
