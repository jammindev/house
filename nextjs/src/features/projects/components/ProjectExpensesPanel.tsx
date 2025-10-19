"use client";

import { useMemo } from "react";
import { Receipt } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Interaction } from "@interactions/types";

interface ProjectExpensesPanelProps {
  expenses: Interaction[];
}

const parseAmount = (metadata: Interaction["metadata"]) => {
  if (!metadata) return 0;
  const raw = (metadata as Record<string, unknown>)?.amount;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim();
    const parsed = Number(normalized.replace(",", "."));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export default function ProjectExpensesPanel({ expenses }: ProjectExpensesPanelProps) {
  const { t, locale } = useI18n();

  const total = useMemo(
    () => expenses.reduce((sum, expense) => sum + parseAmount(expense.metadata), 0),
    [expenses]
  );

  if (!expenses.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        {t("projects.expenses.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
        <Receipt className="h-4 w-4" />
        {t("projects.expenses.total", {
          amount: new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(total),
        })}
      </div>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm">
        {expenses.map((expense) => {
          const amount = parseAmount(expense.metadata);
          return (
            <li key={expense.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{expense.subject}</div>
                  {expense.content ? <p className="text-xs text-slate-500">{expense.content}</p> : null}
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(amount)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
