import * as React from 'react';

import { Button } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';

import type { Household } from '@/lib/api/households';
import type { HouseholdEditFormValues } from '../types';
import { HouseholdFormFields } from './HouseholdFormFields';

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
  labels: {
    edit: string;
    save: string;
    saving: string;
    name: string;
    address: string;
    city: string;
    country: string;
    contextNotes: string;
    aiPromptContext: string;
  };
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
}: HouseholdEditSheetProps) {
  return (
    <SheetDialog
      trigger={
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpen(household)}
        >
          {labels.edit}
        </Button>
      }
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
        labels={{
          submit: labels.save,
          submitting: labels.saving,
          name: labels.name,
          address: labels.address,
          city: labels.city,
          country: labels.country,
          contextNotes: labels.contextNotes,
          aiPromptContext: labels.aiPromptContext,
        }}
        onFieldChange={onFieldChange}
        onSubmit={() => onSubmit(household.id)}
      />
    </SheetDialog>
  );
}
