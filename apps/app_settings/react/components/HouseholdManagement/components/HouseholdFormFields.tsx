import * as React from 'react';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';

import type { HouseholdEditFormValues } from '../types';

interface HouseholdFormFieldsProps {
  values: HouseholdEditFormValues;
  isSaving: boolean;
  labels: {
    submit: string;
    submitting: string;
    name: string;
    address: string;
    city: string;
    country: string;
    contextNotes: string;
    aiPromptContext: string;
  };
  onFieldChange: <K extends keyof HouseholdEditFormValues>(field: K, value: HouseholdEditFormValues[K]) => void;
  onSubmit: () => Promise<void>;
}

export function HouseholdFormFields({
  values,
  isSaving,
  labels,
  onFieldChange,
  onSubmit,
}: HouseholdFormFieldsProps) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
    >
      <Input
        value={values.name}
        onChange={(e) => onFieldChange('name', e.target.value)}
        placeholder={labels.name}
        autoFocus
      />
      <Input
        value={values.address}
        onChange={(e) => onFieldChange('address', e.target.value)}
        placeholder={labels.address}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          value={values.city}
          onChange={(e) => onFieldChange('city', e.target.value)}
          placeholder={labels.city}
        />
        <Input
          value={values.country}
          onChange={(e) => onFieldChange('country', e.target.value)}
          placeholder={labels.country}
        />
      </div>
      <Textarea
        value={values.context_notes}
        onChange={(e) => onFieldChange('context_notes', e.target.value)}
        placeholder={labels.contextNotes}
        rows={4}
      />
      <Textarea
        value={values.ai_prompt_context}
        onChange={(e) => onFieldChange('ai_prompt_context', e.target.value)}
        placeholder={labels.aiPromptContext}
        rows={4}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}
