// nextjs/src/app/app/(pages)/project-groups/new/page.tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectGroupCreateForm, {
  type ProjectGroupCreateFormValues,
} from "@project-groups/components/ProjectGroupCreateForm";
import { useProjectGroups } from "@project-groups/hooks/useProjectGroups";

export default function NewProjectGroupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { createProjectGroup } = useProjectGroups();

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

  return (
    <ResourcePageShell title={t("projectGroups.createTitle")} subtitle={t("projectGroups.createDescription")}>
      {submitError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("projectGroups.createFailed")}</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <ProjectGroupCreateForm onSubmit={handleSubmit} onCancel={handleCancel} t={t} />
    </ResourcePageShell>
  );
}
