// nextjs/src/app/app/projects/new/page.tsx
"use client";

import { useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import AppPageLayout from "@/components/layout/AppPageLayout";
import ProjectForm from "@projects/components/ProjectForm";

export default function NewProjectPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <AppPageLayout
      title={t("projects.newTitle")}
      subtitle={t("projects.newSubtitle")}
      className=""
      contentClassName="mt-4 px-4 pb-6 sm:px-0"
    >
      <ProjectForm
        onSuccess={(projectId) => {
          router.push(`/app/projects/${projectId}`);
        }}
      />
    </AppPageLayout>
  );
}
