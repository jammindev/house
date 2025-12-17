// nextjs/src/features/insurance/components/InsuranceCard.tsx
"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Insurance } from "../types";
import { Shield, Calendar, DollarSign } from "lucide-react";

interface InsuranceCardProps {
  contract: Insurance;
}

export default function InsuranceCard({ contract }: InsuranceCardProps) {
  const { t, locale } = useI18n();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(
        new Date(value)
      );
    } catch {
      return value;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "suspended":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "terminated":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const isRenewalSoon = () => {
    if (!contract.renewal_date) return false;
    const renewalDate = new Date(contract.renewal_date);
    const today = new Date();
    const daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilRenewal > 0 && daysUntilRenewal <= 60; // 60 days warning
  };

  const displayCost = contract.payment_frequency === "yearly" 
    ? formatCurrency(contract.yearly_cost)
    : formatCurrency(contract.monthly_cost);

  return (
    <Card className="flex flex-col h-full border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <LinkWithOverlay href={`/app/insurance/${contract.id}`} className="flex flex-col flex-1">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-600" />
              <h3 className="font-semibold text-lg text-slate-900 line-clamp-1">
                {contract.name}
              </h3>
            </div>
            <Badge variant="outline" className={getStatusColor(contract.status)}>
              {t(`insurance.status.${contract.status}`)}
            </Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {t(`insurance.types.${contract.type}`)}
            </Badge>
            {isRenewalSoon() && (
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                {t("insurance.renewalSoon")}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 flex-1">
          {contract.provider && (
            <div className="text-sm text-slate-600">
              <span className="font-medium">{t("insurance.fields.provider")}:</span>{" "}
              {contract.provider}
            </div>
          )}

          {contract.insured_item && (
            <div className="text-sm text-slate-600 line-clamp-2">
              <span className="font-medium">{t("insurance.fields.insuredItem")}:</span>{" "}
              {contract.insured_item}
            </div>
          )}

          <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1 text-sm text-slate-600">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium">{displayCost}</span>
              <span className="text-xs text-slate-500">
                / {t(`insurance.paymentFrequency.${contract.payment_frequency}`).toLowerCase()}
              </span>
            </div>

            {contract.renewal_date && (
              <div className="flex items-center gap-1 text-sm text-slate-600">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(contract.renewal_date)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </LinkWithOverlay>
    </Card>
  );
}
