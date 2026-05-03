import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import type { ProjectListItem } from '@/lib/api/projects';
import PurchaseForm, { type PurchaseFormPayload } from '@/features/interactions/PurchaseForm';
import { useRegisterProjectPurchase } from './hooks';

interface ProjectPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectListItem | null;
}

export default function ProjectPurchaseDialog({
  open,
  onOpenChange,
  project,
}: ProjectPurchaseDialogProps) {
  const { t } = useTranslation();
  const purchaseMutation = useRegisterProjectPurchase();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  if (!project) return null;

  async function handleSubmit(payload: PurchaseFormPayload) {
    setError(null);
    if (!project) return;
    try {
      await purchaseMutation.mutateAsync({
        id: project.id,
        payload: {
          amount: payload.amount,
          supplier: payload.supplier,
          occurred_at: payload.occurred_at,
          notes: payload.notes,
        },
      });
      onOpenChange(false);
    } catch {
      setError(t('purchase.errors.save_failed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('projects.purchase.title', { name: project.title })}</DialogTitle>
        </DialogHeader>

        <PurchaseForm
          isPending={purchaseMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          externalError={error}
        />
      </DialogContent>
    </Dialog>
  );
}
