// nextjs/src/app/app/(pages)/project-groups/page.tsx
"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import { useProjectGroups } from "@project-groups/hooks/useProjectGroups";
import ProjectGroupList from "@project-groups/components/ProjectGroupList";

export default function ProjectGroupsPage() {
  const { t } = useI18n();
  const { groups, loading, error } = useProjectGroups();

  const actions = useMemo(
    () => [
      {
        icon: Plus,
        href: "/app/project-groups/new",
        variant: "default" as const,
      },
    ],
    [t]
  );

  return (
    <ListPageLayout
      title={t("projectGroups.title")}
      subtitle={t("projectGroups.subtitle")}
      hideBackButton
      actions={actions}
      loading={loading}
      error={error ?? null}
      errorTitle={t("projectGroups.loadFailed")}
      isEmpty={!loading && groups.length === 0}
      emptyState={
        <EmptyState
          title={t("projectGroups.emptyState")}
          description={t("projectGroups.createDescription")}
          action={
            <Button asChild>
              <LinkWithOverlay href="/app/project-groups/new">{t("projectGroups.createTitle")}</LinkWithOverlay>
            </Button>
          }
        />
      }
    >
      <ProjectGroupList groups={groups} />
    </ListPageLayout>
  );
}
