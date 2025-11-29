"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectForm from "@projects/components/ProjectForm";
import { useProject } from "@projects/hooks/useProject";
import { useZones } from "@zones/hooks/useZones";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function ProjectEditPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const setPageLayoutConfig = usePageLayoutConfig();

  const projectIdParam = params?.id;
  const projectId = Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam ?? "";

  const { project, loading, error } = useProject(projectId);
  const { zones, loading: zonesLoading } = useZones();

  const zoneOptions = zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    parent_id: zone.parent_id,
  }));

  const title = t("projects.editTitle");
  const subtitle = t("projects.editSubtitle");

  useEffect(() => {
    setPageLayoutConfig({
      title,
      subtitle,
      context: undefined,
      actions: undefined,
      className: undefined,
      contentClassName: "mt-4 px-4 pb-6 sm:px-0",
      hideBackButton: false,
      loading: false,
    });
  }, [setPageLayoutConfig, subtitle, title]);

  let content: JSX.Element;

  if (!projectId) {
    content = (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("projects.notFound")}</div>
    );
  } else if (!selectedHouseholdId) {
    content = (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        {t("projects.householdRequired")}
      </div>
    );
  } else if (loading) {
    content = <div className="text-sm text-slate-600">{t("common.loading")}</div>;
  } else if (error) {
    content = <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  } else if (!project) {
    content = (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("projects.notFound")}</div>
    );
  } else {
    content = (
      <ProjectForm
        project={project}
        mode="edit"
        zones={zoneOptions}
        zonesLoading={zonesLoading}
        onSuccess={(updatedId) => {
          router.push(`/app/projects/${updatedId}`);
        }}
      />
    );
  }

  return content;
}
