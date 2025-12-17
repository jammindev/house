// nextjs/src/features/insurance/components/InsuranceList.tsx
"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Insurance } from "../types";
import InsuranceCard from "./InsuranceCard";

interface InsuranceListProps {
  contracts: Insurance[];
}

export default function InsuranceList({ contracts }: InsuranceListProps) {
  const { t } = useI18n();

  if (!contracts.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        {t("insurance.emptyState")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {contracts.map((contract) => (
        <InsuranceCard key={contract.id} contract={contract} />
      ))}
    </div>
  );
}
