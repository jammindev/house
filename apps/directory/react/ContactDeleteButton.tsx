import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/design-system/dialog';
import { deleteContact } from '@/lib/api/contacts';

interface ContactDeleteButtonProps {
  contactId: string;
  contactName?: string;
  redirectUrl?: string;
}

export default function ContactDeleteButton({
  contactId,
  contactName,
  redirectUrl = '/app/directory/?view=contacts',
}: ContactDeleteButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      await deleteContact(contactId);
      window.location.href = redirectUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || t('contacts.deleteFailed', { defaultValue: 'Failed to delete contact.' }));
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
          {t('common.delete', { defaultValue: 'Delete' })}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('contacts.deleteTitle', { defaultValue: 'Delete contact' })}</DialogTitle>
          <DialogDescription>
            {contactName
              ? t('contacts.deleteConfirmNamed', {
                  name: contactName,
                  defaultValue: `Are you sure you want to delete "${contactName}"? This action cannot be undone.`,
                })
              : t('contacts.deleteConfirm', {
                  defaultValue: 'Are you sure you want to delete this contact? This action cannot be undone.',
                })}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleting}>
            {deleting
              ? t('common.deleting', { defaultValue: 'Deleting…' })
              : t('common.delete', { defaultValue: 'Delete' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
