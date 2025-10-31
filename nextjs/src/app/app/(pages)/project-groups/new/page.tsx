// nextjs/src/app/app/(pages)/project-groups/new/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";
import ProjectGroupCreateForm, {
  type ProjectGroupCreateFormValues,
} from "@project-groups/components/ProjectGroupCreateForm";
import { useProjectGroups } from "@project-groups/hooks/useProjectGroups";

export default function NewProjectGroupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { createProjectGroup } = useProjectGroups();
  const setPageLayoutConfig = usePageLayoutConfig();

  const [submitError, setSubmitError] = useState("");

  const handleSubmit = useCallback(
    async (values: ProjectGroupCreateFormValues) => {
      if (!selectedHouseholdId) {
        setSubmitError(t("projectGroups.householdRequired"));
        return;
      }

      try {
        setSubmitError("");
        const tags = values.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        await createProjectGroup({
          householdId: selectedHouseholdId,
          name: values.name,
          description: values.description,
          tags,
        });

        router.push("/app/project-groups?created=1");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t("projectGroups.createFailed");
        setSubmitError(message);
      }
    },
    [createProjectGroup, router, selectedHouseholdId, t],
  );

  const handleCancel = useCallback(() => {
    router.push("/app/project-groups");
  }, [router]);

  useEffect(() => {
    setPageLayoutConfig({
      title: t("projectGroups.createTitle"),
      subtitle: t("projectGroups.createDescription"),
      context: undefined,
      actions: undefined,
      className: undefined,
      contentClassName: undefined,
      hideBackButton: false,
      loading: false,
    });
  }, [setPageLayoutConfig, t]);

  return (
    <>
      {submitError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{submitError}</div>
      )}

      <ProjectGroupCreateForm onSubmit={handleSubmit} onCancel={handleCancel} t={t} />
    </>
  );
}
