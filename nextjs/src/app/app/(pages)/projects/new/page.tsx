// nextjs/src/app/app/projects/new/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectForm from "@projects/components/ProjectForm";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function NewProjectPage() {
  const { t } = useI18n();
  const router = useRouter();
  const setPageLayoutConfig = usePageLayoutConfig();

  useEffect(() => {
    setPageLayoutConfig({
      title: t("projects.newTitle"),
      subtitle: t("projects.newSubtitle"),
      context: undefined,
      actions: undefined,
      className: undefined,
      contentClassName: "mt-4 px-4 pb-6 sm:px-0",
      hideBackButton: false,
      loading: false,
    });
  }, [setPageLayoutConfig, t]);

  return (
    <ProjectForm
      onSuccess={(projectId) => {
        router.push(`/app/projects/${projectId}`);
      }}
    />
  );
}
