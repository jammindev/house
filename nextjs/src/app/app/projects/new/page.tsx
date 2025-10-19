"use client";

import { useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectForm from "@projects/components/ProjectForm";

export default function NewProjectPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t("projects.newTitle")}</h1>
        <p className="text-sm text-slate-500">{t("projects.newSubtitle")}</p>
      </div>
      <ProjectForm
        onSuccess={(projectId) => {
          router.push(`/app/projects/${projectId}`);
        }}
      />
    </div>
  );
}
