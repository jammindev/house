import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Alert, AlertDescription } from '@/design-system/alert';
import { Select } from '@/design-system/select';
import {
  createStructure,
  fetchStructure,
  updateStructure,
  type Structure,
  type StructureFormValues,
} from '@/lib/api/structures';

import { useHouseholdId } from '@/lib/useHouseholdId';

interface StructureFormProps {
  mode: 'create' | 'edit';
  structureId?: string;
  redirectUrl?: string;
  backUrl?: string;
}

type AddressRow = {
  id?: string;
  address_1: string;
  address_2: string;
  city: string;
  zipcode: string;
  country: string;
  label: string;
  is_primary: boolean;
};

type EmailRow = {
  id?: string;
  email: string;
  label: string;
  is_primary: boolean;
};

type PhoneRow = {
  id?: string;
  phone: string;
  label: string;
  is_primary: boolean;
};

type CoreForm = {
  name: string;
  type: string;
  website: string;
  description: string;
};

const STRUCTURE_TYPES = ['company', 'association', 'administration', 'artisan', 'other'];

const EMPTY_ADDR: AddressRow = { address_1: '', address_2: '', city: '', zipcode: '', country: '', label: '', is_primary: false };
const EMPTY_EMAIL: EmailRow = { email: '', label: '', is_primary: false };
const EMPTY_PHONE: PhoneRow = { phone: '', label: '', is_primary: false };

function structureToForm(s: Structure): { core: CoreForm; emails: EmailRow[]; phones: PhoneRow[]; addresses: AddressRow[] } {
  return {
    core: { name: s.name ?? '', type: s.type ?? '', website: s.website ?? '', description: s.description ?? '' },
    emails: (s.emails ?? []).map((e) => ({ id: e.id, email: e.email, label: e.label ?? '', is_primary: !!e.is_primary })),
    phones: (s.phones ?? []).map((p) => ({ id: p.id, phone: p.phone, label: p.label ?? '', is_primary: !!p.is_primary })),
    addresses: (s.addresses ?? []).map((a) => ({
      id: a.id,
      address_1: a.address_1 ?? '',
      address_2: a.address_2 ?? '',
      city: a.city ?? '',
      zipcode: a.zipcode ?? '',
      country: a.country ?? '',
      label: a.label ?? '',
      is_primary: !!a.is_primary,
    })),
  };
}

export default function StructureForm({ mode, structureId, redirectUrl, backUrl }: StructureFormProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [core, setCore] = React.useState<CoreForm>({ name: '', type: '', website: '', description: '' });
  const [emails, setEmails] = React.useState<EmailRow[]>([]);
  const [phones, setPhones] = React.useState<PhoneRow[]>([]);
  const [addresses, setAddresses] = React.useState<AddressRow[]>([]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const cancelUrl = backUrl
    ?? (mode === 'edit' && structureId ? `/app/directory/structures/${structureId}/` : '/app/directory/?view=structures');

  const successUrl = redirectUrl
    ?? (mode === 'edit' && structureId ? `/app/directory/structures/${structureId}/` : '/app/directory/?view=structures');

  React.useEffect(() => {
    if (mode !== 'edit' || !structureId) return;
    let cancelled = false;
    fetchStructure(structureId)
      .then((s) => {
        if (!cancelled) {
          const parsed = structureToForm(s);
          setCore(parsed.core);
          setEmails(parsed.emails);
          setPhones(parsed.phones);
          setAddresses(parsed.addresses);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(t('structures.loadFailed', { defaultValue: 'Failed to load structure.' }));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [mode, structureId, t]);

  function changeCore(field: keyof CoreForm, value: string) {
    setCore((prev) => ({ ...prev, [field]: value }));
  }

  function changeEmail(idx: number, field: keyof EmailRow, value: string | boolean) {
    setEmails((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }
  function changePhone(idx: number, field: keyof PhoneRow, value: string | boolean) {
    setPhones((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }
  function changeAddress(idx: number, field: keyof AddressRow, value: string | boolean) {
    setAddresses((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!core.name.trim()) {
      setError(t('structures.nameRequired', { defaultValue: 'Structure name is required.' }));
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload: StructureFormValues = {
      name: core.name.trim(),
      type: core.type || undefined,
      website: core.website.trim() || undefined,
      description: core.description.trim() || undefined,
      emails: emails.filter((r) => r.email.trim()).map((r) => ({ id: r.id, email: r.email, label: r.label, is_primary: r.is_primary })),
      phones: phones.filter((r) => r.phone.trim()).map((r) => ({ id: r.id, phone: r.phone, label: r.label, is_primary: r.is_primary })),
      addresses: addresses.filter((r) => r.address_1.trim() || r.city.trim()).map((r) => ({ id: r.id, address_1: r.address_1, address_2: r.address_2, zipcode: r.zipcode, city: r.city, country: r.country, label: r.label, is_primary: r.is_primary })),
    };

    try {
      if (mode === 'create') {
        await createStructure(payload, householdId ?? undefined);
      } else {
        await updateStructure(structureId!, payload);
      }
      window.location.href = successUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || t('structures.saveFailed', { defaultValue: 'Failed to save structure.' }));
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>;
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Core */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-700">
          {t('structures.general', { defaultValue: 'General' })}
        </legend>

        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">{t('structures.name', { defaultValue: 'Name' })} <span aria-hidden className="text-red-500">*</span></label>
          <Input
            id="name"
            required
            value={core.name}
            onChange={(e) => changeCore('name', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="type" className="text-sm font-medium">{t('structures.type', { defaultValue: 'Type' })}</label>
          <Select
            value={core.type}
            onChange={(e) => changeCore('type', (e.target as HTMLSelectElement).value)}
          >
            <option value="">{t('common.select', { defaultValue: 'Select…' })}</option>
            {STRUCTURE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`structures.types.${type}`, { defaultValue: type })}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <label htmlFor="website" className="text-sm font-medium">{t('structures.website', { defaultValue: 'Website' })}</label>
          <Input
            id="website"
            type="url"
            value={core.website}
            onChange={(e) => changeCore('website', e.target.value)}
            placeholder="https://"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">{t('structures.description', { defaultValue: 'Description' })}</label>
          <Textarea
            id="description"
            rows={3}
            value={core.description}
            onChange={(e) => changeCore('description', e.target.value)}
          />
        </div>
      </fieldset>

      {/* Emails */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-700">
          {t('contacts.emails', { defaultValue: 'Emails' })}
        </legend>
        {emails.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label htmlFor={`email-${idx}`} className="text-sm font-medium">{t('contacts.emailAddress', { defaultValue: 'Email' })}</label>
              <Input
                id={`email-${idx}`}
                type="email"
                value={row.email}
                onChange={(e) => changeEmail(idx, 'email', e.target.value)}
              />
            </div>
            <div className="w-28 space-y-1">
              <label htmlFor={`emailLabel-${idx}`} className="text-sm font-medium">{t('contacts.label', { defaultValue: 'Label' })}</label>
              <Input
                id={`emailLabel-${idx}`}
                value={row.label}
                onChange={(e) => changeEmail(idx, 'label', e.target.value)}
                placeholder="main"
              />
            </div>
            <button
              type="button"
              className="mb-1 text-gray-400 hover:text-red-500"
              onClick={() => setEmails((prev) => prev.filter((_, i) => i !== idx))}
              aria-label={t('common.remove', { defaultValue: 'Remove' })}
            >×</button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() => setEmails((prev) => [...prev, { ...EMPTY_EMAIL }])}
        >
          + {t('contacts.addEmail', { defaultValue: 'Add email' })}
        </button>
      </fieldset>

      {/* Phones */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-700">
          {t('contacts.phones', { defaultValue: 'Phones' })}
        </legend>
        {phones.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label htmlFor={`phone-${idx}`} className="text-sm font-medium">{t('contacts.phoneNumber', { defaultValue: 'Phone' })}</label>
              <Input
                id={`phone-${idx}`}
                type="tel"
                value={row.phone}
                onChange={(e) => changePhone(idx, 'phone', e.target.value)}
              />
            </div>
            <div className="w-28 space-y-1">
              <label htmlFor={`phoneLabel-${idx}`} className="text-sm font-medium">{t('contacts.label', { defaultValue: 'Label' })}</label>
              <Input
                id={`phoneLabel-${idx}`}
                value={row.label}
                onChange={(e) => changePhone(idx, 'label', e.target.value)}
                placeholder="mobile"
              />
            </div>
            <button
              type="button"
              className="mb-1 text-gray-400 hover:text-red-500"
              onClick={() => setPhones((prev) => prev.filter((_, i) => i !== idx))}
              aria-label={t('common.remove', { defaultValue: 'Remove' })}
            >×</button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() => setPhones((prev) => [...prev, { ...EMPTY_PHONE }])}
        >
          + {t('contacts.addPhone', { defaultValue: 'Add phone' })}
        </button>
      </fieldset>

      {/* Addresses */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-700">
          {t('contacts.addresses', { defaultValue: 'Addresses' })}
        </legend>
        {addresses.map((row, idx) => (
          <div key={idx} className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3 relative">
            <button
              type="button"
              className="absolute right-3 top-3 text-gray-400 hover:text-red-500 text-lg leading-none"
              onClick={() => setAddresses((prev) => prev.filter((_, i) => i !== idx))}
              aria-label={t('common.remove', { defaultValue: 'Remove' })}
            >×</button>
            <div className="space-y-1">
              <label htmlFor={`addr1-${idx}`} className="text-sm font-medium">{t('contacts.address1', { defaultValue: 'Address 1' })}</label>
              <Input id={`addr1-${idx}`} value={row.address_1} onChange={(e) => changeAddress(idx, 'address_1', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor={`addr2-${idx}`} className="text-sm font-medium">{t('contacts.address2', { defaultValue: 'Address 2' })}</label>
              <Input id={`addr2-${idx}`} value={row.address_2} onChange={(e) => changeAddress(idx, 'address_2', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor={`zipcode-${idx}`} className="text-sm font-medium">{t('contacts.postcode', { defaultValue: 'Postcode' })}</label>
                <Input id={`zipcode-${idx}`} value={row.zipcode} onChange={(e) => changeAddress(idx, 'zipcode', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <label htmlFor={`city-${idx}`} className="text-sm font-medium">{t('contacts.city', { defaultValue: 'City' })}</label>
                <Input id={`city-${idx}`} value={row.city} onChange={(e) => changeAddress(idx, 'city', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor={`country-${idx}`} className="text-sm font-medium">{t('contacts.country', { defaultValue: 'Country' })}</label>
              <Input id={`country-${idx}`} value={row.country} onChange={(e) => changeAddress(idx, 'country', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor={`addrLabel-${idx}`} className="text-sm font-medium">{t('contacts.label', { defaultValue: 'Label' })}</label>
              <Input id={`addrLabel-${idx}`} value={row.label} placeholder="main" onChange={(e) => changeAddress(idx, 'label', e.target.value)} />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() => setAddresses((prev) => [...prev, { ...EMPTY_ADDR }])}
        >
          + {t('contacts.addAddress', { defaultValue: 'Add address' })}
        </button>
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting
            ? t('common.saving', { defaultValue: 'Saving…' })
            : mode === 'create'
              ? t('structures.createStructure', { defaultValue: 'Create structure' })
              : t('common.saveChanges', { defaultValue: 'Save changes' })}
        </button>
        <a
          href={cancelUrl}
          className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </a>
      </div>
    </form>
  );
}
