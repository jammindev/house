import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { createContact, updateContact, type Contact } from '@/lib/api/contacts';
import { useStructures } from './hooks';

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existingContact?: Contact;
}

export default function ContactDialog({
  open,
  onOpenChange,
  onSaved,
  existingContact,
}: ContactDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingContact);

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [structureId, setStructureId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { data: structures = [] } = useStructures();

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existingContact) {
      setFirstName(existingContact.first_name ?? '');
      setLastName(existingContact.last_name ?? '');
      setEmail(existingContact.emails.find((e) => e.is_primary)?.email ?? existingContact.emails[0]?.email ?? '');
      setPhone(existingContact.phones.find((p) => p.is_primary)?.phone ?? existingContact.phones[0]?.phone ?? '');
      setStructureId(existingContact.structure?.id ?? '');
      setNotes(existingContact.notes ?? '');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setStructureId('');
      setNotes('');
    }
  }, [open, existingContact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim()) {
      setError(t('contacts.nameRequired'));
      return;
    }
    setLoading(true);
    setError(null);

    const input = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      notes: notes.trim() || undefined,
      structure: structureId || null,
    };

    const action = isEditing && existingContact
      ? updateContact(existingContact.id, input)
      : createContact(
          input,
          email.trim() ? { email: email.trim(), label: 'main' } : null,
          phone.trim() ? { phone: phone.trim(), label: 'mobile' } : null,
        );

    action
      .then(() => {
        setLoading(false);
        onOpenChange(false);
        onSaved();
      })
      .catch(() => {
        setLoading(false);
        setError(t('common.saveFailed'));
      });
  };

  const structureOptions = structures.map((s) => ({ value: s.id, label: s.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('contacts.editTitle') : t('contacts.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('contacts.firstName')} htmlFor="contact-first-name">
              <Input
                id="contact-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </FormField>
            <FormField label={t('contacts.lastName')} htmlFor="contact-last-name">
              <Input
                id="contact-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </FormField>
          </div>

          <FormField label={t('contacts.email')} htmlFor="contact-email">
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </FormField>

          <FormField label={t('contacts.phone')} htmlFor="contact-phone">
            <Input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </FormField>

          {structureOptions.length > 0 && (
            <FormField label={t('contacts.structure')} htmlFor="contact-structure">
              <Select
                id="contact-structure"
                value={structureId}
                onChange={(e) => setStructureId(e.target.value)}
                options={structureOptions}
                placeholder={t('contacts.noStructure')}
              />
            </FormField>
          )}

          <FormField label={t('contacts.notes')} htmlFor="contact-notes">
            <Textarea
              id="contact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
