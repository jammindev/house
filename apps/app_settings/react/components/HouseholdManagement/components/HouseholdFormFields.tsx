import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import type { SelectOption } from '@/design-system/select';

import type { HouseholdEditFormValues } from '../types';

/** Common ISO 3166-1 alpha-2 country codes shown in the selector. */
const COUNTRY_CODES = [
  'AT', 'AU', 'BE', 'BR', 'CA', 'CH', 'CN', 'CZ', 'DE', 'DK',
  'DZ', 'ES', 'FI', 'FR', 'GB', 'GR', 'HU', 'IE', 'IN', 'IS',
  'IT', 'JP', 'KR', 'LU', 'MA', 'MX', 'NL', 'NO', 'NZ', 'PL',
  'PT', 'RO', 'SE', 'SG', 'SK', 'TN', 'US', 'ZA',
];

function useCountryOptions(locale: string): SelectOption[] {
  return React.useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([locale], { type: 'region' });
      return COUNTRY_CODES
        .map((code) => ({ value: code, label: dn.of(code) ?? code }))
        .sort((a, b) => a.label.localeCompare(b.label, locale));
    } catch {
      return COUNTRY_CODES.map((code) => ({ value: code, label: code }));
    }
  }, [locale]);
}

function useTimezoneOptions(): SelectOption[] {
  return React.useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zones: string[] = (Intl as any).supportedValuesOf('timeZone');
      return zones.map((tz) => ({ value: tz, label: tz.replace(/_/g, '\u00a0') }));
    } catch {
      return [
        { value: 'UTC', label: 'UTC' },
        { value: 'Europe/London', label: 'Europe/London' },
        { value: 'Europe/Paris', label: 'Europe/Paris' },
        { value: 'Europe/Berlin', label: 'Europe/Berlin' },
        { value: 'Europe/Madrid', label: 'Europe/Madrid' },
        { value: 'America/New_York', label: 'America/New\u00a0York' },
        { value: 'America/Chicago', label: 'America/Chicago' },
        { value: 'America/Los_Angeles', label: 'America/Los\u00a0Angeles' },
        { value: 'America/Sao_Paulo', label: 'America/Sao\u00a0Paulo' },
        { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
        { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
        { value: 'Australia/Sydney', label: 'Australia/Sydney' },
      ];
    }
  }, []);
}

function FieldGroup({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium leading-none text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
      {children}
    </p>
  );
}

export interface HouseholdFormFieldsLabels {
  submit: string;
  submitting: string;
  name: string;
  sectionLocation: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  countryPlaceholder: string;
  timezone: string;
  timezonePlaceholder: string;
  sectionContext: string;
  contextNotes: string;
  aiPromptContext: string;
}

interface HouseholdFormFieldsProps {
  values: HouseholdEditFormValues;
  isSaving: boolean;
  labels: HouseholdFormFieldsLabels;
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
  const { i18n } = useTranslation();
  const locale = i18n.language ?? 'en';
  const countryOptions = useCountryOptions(locale);
  const timezoneOptions = useTimezoneOptions();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
    >
      {/* Name */}
      <FieldGroup id="hh-name" label={labels.name}>
        <Input
          id="hh-name"
          value={values.name}
          onChange={(e) => onFieldChange('name', e.target.value)}
          required
          autoFocus
        />
      </FieldGroup>

      {/* Location section */}
      <SectionTitle>{labels.sectionLocation}</SectionTitle>

      <FieldGroup id="hh-address" label={labels.address}>
        <Input
          id="hh-address"
          value={values.address}
          onChange={(e) => onFieldChange('address', e.target.value)}
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-2">
        <FieldGroup id="hh-city" label={labels.city}>
          <Input
            id="hh-city"
            value={values.city}
            onChange={(e) => onFieldChange('city', e.target.value)}
          />
        </FieldGroup>
        <FieldGroup id="hh-postal" label={labels.postalCode}>
          <Input
            id="hh-postal"
            value={values.postal_code}
            onChange={(e) => onFieldChange('postal_code', e.target.value)}
          />
        </FieldGroup>
      </div>

      <FieldGroup id="hh-country" label={labels.country}>
        <Select
          id="hh-country"
          value={values.country}
          onChange={(e) => onFieldChange('country', e.target.value)}
          options={countryOptions}
          placeholder={labels.countryPlaceholder}
        />
      </FieldGroup>

      <FieldGroup id="hh-timezone" label={labels.timezone}>
        <Select
          id="hh-timezone"
          value={values.timezone}
          onChange={(e) => onFieldChange('timezone', e.target.value)}
          options={timezoneOptions}
          placeholder={labels.timezonePlaceholder}
        />
      </FieldGroup>

      {/* Context section */}
      <SectionTitle>{labels.sectionContext}</SectionTitle>

      <FieldGroup id="hh-context-notes" label={labels.contextNotes}>
        <Textarea
          id="hh-context-notes"
          value={values.context_notes}
          onChange={(e) => onFieldChange('context_notes', e.target.value)}
          rows={3}
        />
      </FieldGroup>

      <FieldGroup id="hh-ai-prompt" label={labels.aiPromptContext}>
        <Textarea
          id="hh-ai-prompt"
          value={values.ai_prompt_context}
          onChange={(e) => onFieldChange('ai_prompt_context', e.target.value)}
          rows={3}
        />
      </FieldGroup>

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}
