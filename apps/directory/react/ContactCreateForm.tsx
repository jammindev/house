import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Alert, AlertDescription } from '@/design-system/alert';
import { createContact } from '@/lib/api/contacts';
interface ContactCreateFormProps {
  redirectUrl?: string;
}

type FormState = {
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  emailLabel: string;
  phone: string;
  phoneLabel: string;
  notes: string;
};

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  position: '',
  email: '',
  emailLabel: '',
  phone: '',
  phoneLabel: '',
  notes: '',
};

export default function ContactCreateForm({ redirectUrl = '/app/directory/?view=contacts' }: ContactCreateFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function change(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() && !form.lastName.trim()) {
      setError(t('contacts.nameRequired', { defaultValue: 'Please enter at least a first or last name.' }));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createContact(
        {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          position: form.position.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
        form.email.trim() ? {
          email: form.email.trim(),
          label: form.emailLabel.trim() || 'main',
        } : undefined,
        form.phone.trim() ? {
          phone: form.phone.trim(),
          label: form.phoneLabel.trim() || 'mobile',
        } : undefined,
      );
      window.location.href = redirectUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || t('contacts.saveFailed', { defaultValue: 'Failed to save contact.' }));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-700">
          {t('contacts.identity', { defaultValue: 'Identity' })}
        </legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="firstName" className="text-sm font-medium">{t('contacts.firstName', { defaultValue: 'First name' })}</label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => change('firstName', e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="lastName" className="text-sm font-medium">{t('contacts.lastName', { defaultValue: 'Last name' })}</label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => change('lastName', e.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="position" className="text-sm font-medium">{t('contacts.position', { defaultValue: 'Position / role' })}</label>
          <Input
            id="position"
            value={form.position}
            onChange={(e) => change('position', e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-700">
          {t('contacts.email', { defaultValue: 'Email' })}
        </legend>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-1">
            <label htmlFor="email" className="text-sm font-medium">{t('contacts.emailAddress', { defaultValue: 'Email address' })}</label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => change('email', e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="emailLabel" className="text-sm font-medium">{t('contacts.label', { defaultValue: 'Label' })}</label>
            <Input
              id="emailLabel"
              placeholder="main"
              value={form.emailLabel}
              onChange={(e) => change('emailLabel', e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-700">
          {t('contacts.phone', { defaultValue: 'Phone' })}
        </legend>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-1">
            <label htmlFor="phone" className="text-sm font-medium">{t('contacts.phoneNumber', { defaultValue: 'Phone number' })}</label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => change('phone', e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="phoneLabel" className="text-sm font-medium">{t('contacts.label', { defaultValue: 'Label' })}</label>
            <Input
              id="phoneLabel"
              placeholder="mobile"
              value={form.phoneLabel}
              onChange={(e) => change('phoneLabel', e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm font-medium">{t('contacts.notes', { defaultValue: 'Notes' })}</label>
        <Textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => change('notes', e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? t('common.saving', { defaultValue: 'Saving…' })
            : t('contacts.createContact', { defaultValue: 'Create contact' })}
        </Button>
        <a href={redirectUrl} className={buttonVariants({ variant: 'outline' })}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </a>
      </div>
    </form>
  );
}
