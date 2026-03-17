import * as React from 'react';

import { SheetDialog } from '@/design-system/sheet-dialog';

interface HouseholdActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function HouseholdActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: HouseholdActionDialogProps) {
  return (
    <SheetDialog
      trigger={<button type="button" className="hidden" aria-hidden="true" tabIndex={-1} />}
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      closeLabel={null}
      contentClassName="gap-3"
    >
      {children}
    </SheetDialog>
  );
}
