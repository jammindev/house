import * as React from 'react';

import { Button } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';

import type { Household } from '@/lib/api/households';
import type { HouseholdEditFormValues } from '../types';
import { HouseholdFormFields } from './HouseholdFormFields';
import type { HouseholdFormFieldsLabels } from './HouseholdFormFields';

interface HouseholdEditSheetProps {
  household: Household;
  title: string;
  isOpen: boolean;
  isSaving: boolean;
  values: HouseholdEditFormValues;
  onOpen: (household: Household) => void;
  onClose: () => void;
  onFieldChange: <K extends keyof HouseholdEditFormValues>(field: K, value: HouseholdEditFormValues[K]) => void;
  onSubmit: (householdId: string) => Promise<void>;
  labels: HouseholdFormFieldsLabels & { edit: string };
  trigger?: React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
}

export function HouseholdEditSheet({
  household,
  title,
  isOpen,
  isSaving,
  values,
  onOpen,
  onClose,
  onFieldChange,
  onSubmit,
  labels,
  trigger,
}: HouseholdEditSheetProps) {
  return (
    <SheetDialog
      trigger={trigger ?? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpen(household)}
        >
          {labels.edit}
        </Button>
      )}
      title={title}
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      contentClassName="gap-3"
    >
      <HouseholdFormFields
        values={values}
        isSaving={isSaving}
        labels={labels}
        onFieldChange={onFieldChange}
        onSubmit={() => onSubmit(household.id)}
      />
    </SheetDialog>
  );
}
