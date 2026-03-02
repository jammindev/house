import * as React from 'react';

import { Button } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';

import type { HouseholdEditFormValues } from '../types';
import { HouseholdFormFields } from './HouseholdFormFields';

interface HouseholdCreateSheetProps {
  title: string;
  isSaving: boolean;
  values: HouseholdEditFormValues;
  onOpen: () => void;
  onFieldChange: <K extends keyof HouseholdEditFormValues>(field: K, value: HouseholdEditFormValues[K]) => void;
  onSubmit: () => Promise<boolean>;
  labels: {
    create: string;
    creating: string;
    name: string;
    address: string;
    city: string;
    country: string;
    contextNotes: string;
    aiPromptContext: string;
  };
}

export function HouseholdCreateSheet({
  title,
  isSaving,
  values,
  onOpen,
  onFieldChange,
  onSubmit,
  labels,
}: HouseholdCreateSheetProps) {
  return (
    <SheetDialog
      trigger={
        <Button onClick={onOpen}>
          {labels.create}
        </Button>
      }
      title={title}
      contentClassName="gap-3"
    >
      {({ close }) => (
        <HouseholdFormFields
          values={values}
          isSaving={isSaving}
          labels={{
            submit: labels.create,
            submitting: labels.creating,
            name: labels.name,
            address: labels.address,
            city: labels.city,
            country: labels.country,
            contextNotes: labels.contextNotes,
            aiPromptContext: labels.aiPromptContext,
          }}
          onFieldChange={onFieldChange}
          onSubmit={async () => {
            const created = await onSubmit();
            if (created) {
              close();
            }
          }}
        />
      )}
    </SheetDialog>
  );
}
