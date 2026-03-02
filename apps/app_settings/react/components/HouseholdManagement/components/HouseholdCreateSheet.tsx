import { Button } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';

import type { HouseholdEditFormValues } from '../types';
import { HouseholdFormFields } from './HouseholdFormFields';
import type { HouseholdFormFieldsLabels } from './HouseholdFormFields';

interface HouseholdCreateSheetProps {
  title: string;
  isSaving: boolean;
  values: HouseholdEditFormValues;
  onOpen: () => void;
  onFieldChange: <K extends keyof HouseholdEditFormValues>(field: K, value: HouseholdEditFormValues[K]) => void;
  onSubmit: () => Promise<boolean>;
  labels: HouseholdFormFieldsLabels & { create: string; creating: string };
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
        <Button onClick={onOpen} size="sm">
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
            ...labels,
            submit: labels.create,
            submitting: labels.creating,
          }}
          onFieldChange={onFieldChange}
          onSubmit={async () => {
            const created = await onSubmit();
            if (created) close();
          }}
        />
      )}
    </SheetDialog>
  );
}
