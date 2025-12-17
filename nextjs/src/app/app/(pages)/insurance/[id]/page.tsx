// nextjs/src/app/app/(pages)/insurance/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useInsuranceContract } from "@insurance/hooks/useInsuranceContract";
import InsuranceDetailView from "@insurance/components/InsuranceDetailView";
import ResourcePageShell from "@shared/layout/ResourcePageShell";

export default function InsuranceDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const contractId = params?.id as string;
  
  const { contract, loading, error, reload } = useInsuranceContract(contractId);

  if (loading) {
    return (
      <ResourcePageShell title={t("common.loading")} bodyClassName="mt-4 pb-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-slate-500">{t("common.loading")}</div>
        </div>
      </ResourcePageShell>
    );
  }

  if (error || !contract) {
    return (
      <ResourcePageShell title={t("insurance.title")} bodyClassName="mt-4 pb-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-red-600">{error || t("insurance.loadFailed")}</div>
        </div>
      </ResourcePageShell>
    );
  }

  return (
    <ResourcePageShell title={contract.name} bodyClassName="mt-4 pb-6">
      <InsuranceDetailView contract={contract} onRefresh={reload} />
    </ResourcePageShell>
  );
}
