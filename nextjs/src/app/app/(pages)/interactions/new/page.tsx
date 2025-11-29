"use client";

import { useSearchParams } from "next/navigation";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionTypeSelector from "@interactions/components/InteractionTypeSelector";

export default function NewInteractionPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams?.get("projectId");
  const returnToParam = searchParams?.get("returnTo");
  const zonesParam = searchParams?.get("zones");
  const redirectTo = returnToParam && returnToParam.startsWith("/") ? returnToParam : null;

  return (
    <ResourcePageShell
      title={t("interactions.newInteraction")}
      subtitle={t("interactions.newInteractionIntro")}
      hideBackButton={false}
      bodyClassName="gap-4"
    >
      <InteractionTypeSelector projectId={projectIdParam} returnTo={redirectTo} zones={zonesParam} />
    </ResourcePageShell>
  );
}
