// nextjs/src/app/app/(pages)/insurance/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useInsurance } from "@insurance/hooks/useInsurance";
import InsuranceList from "@insurance/components/InsuranceList";
import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import { Button } from "@/components/ui/button";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import InsuranceForm from "@insurance/components/InsuranceForm";

export default function InsurancePage() {
  const { t } = useI18n();
  const { contracts, loading, error, reload } = useInsurance();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreateSuccess = (contractId: string) => {
    setIsCreateOpen(false);
    reload();
  };

  const actions = useMemo(
    () => [
      {
        element: (
          <SheetDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("insurance.new")}
              </Button>
            }
            title={t("insurance.newTitle")}
            description={t("insurance.newSubtitle")}
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
          >
            {({ close }) => (
              <InsuranceForm
                mode="create"
                onSuccess={handleCreateSuccess}
                onCancel={close}
              />
            )}
          </SheetDialog>
        ),
      },
    ],
    [t, isCreateOpen]
  );

  return (
    <ListPageLayout
      title={t("insurance.title")}
      subtitle={t("insurance.subtitle")}
      hideBackButton
      actions={actions}
      loading={loading}
      error={error ?? null}
      errorTitle={t("insurance.loadFailed")}
      isEmpty={!loading && contracts.length === 0}
      emptyState={
        <EmptyState
          title={t("insurance.emptyState")}
          description={t("insurance.emptyDescription")}
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("insurance.new")}
            </Button>
          }
        />
      }
    >
      <InsuranceList contracts={contracts} />
    </ListPageLayout>
  );
}
