import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Alert, AlertDescription } from '@/design-system/alert';
import { fetchContact, updateContact, type Contact } from '@/lib/api/contacts';

interface ContactEditFormProps {
  contactId: string;
  householdId?: string | null;
  backUrl?: string;
}

type FormState = {
  firstName: string;
  lastName: string;
  position: string;
  notes: string;
};

export default function ContactEditForm({ contactId, backUrl }: ContactEditFormProps) {
  const { t } = useTranslation();
  const [contact, setContact] = React.useState<Contact | null>(null);
  const [form, setForm] = React.useState<FormState>({ firstName: '', lastName: '', position: '', notes: '' });
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const detailUrl = backUrl ?? `/app/directory/contacts/${contactId}/`;

  React.useEffect(() => {
    let cancelled = false;
    fetchContact(contactId)
      .then((c) => {
        if (!cancelled) {
          setContact(c);
          setForm({
            firstName: c.first_name ?? '',
            lastName: c.last_name ?? '',
            position: c.position ?? '',
            notes: c.notes ?? '',
          });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('contacts.loadFailed', { defaultValue: 'Failed to load contact.' }));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [contactId, t]);

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
      await updateContact(contactId, {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        position: form.position.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      window.location.href = detailUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || t('contacts.saveFailed', { defaultValue: 'Failed to save contact.' }));
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>;
  }

  if (!contact && error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
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
            : t('common.saveChanges', { defaultValue: 'Save changes' })}
        </Button>
        <a href={detailUrl} className={buttonVariants({ variant: 'outline' })}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </a>
      </div>
    </form>
  );
}
