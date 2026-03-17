import { Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/design-system/button';
import type { Contact } from '@/lib/api/contacts';

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: string) => void;
}

function getPrimaryEmail(contact: Contact): string | null {
  const entry = contact.emails.find((e) => e.is_primary) ?? contact.emails[0] ?? null;
  return entry?.email ?? null;
}

function getPrimaryPhone(contact: Contact): string | null {
  const entry = contact.phones.find((p) => p.is_primary) ?? contact.phones[0] ?? null;
  return entry?.phone ?? null;
}

export default function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || '—';
  const email = getPrimaryEmail(contact);
  const phone = getPrimaryPhone(contact);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{fullName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {email ? (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-1 hover:text-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="h-3 w-3" />
                {email}
              </a>
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-1 hover:text-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="h-3 w-3" />
                {phone}
              </a>
            ) : null}
            {contact.structure?.name ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {contact.structure.name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => onDelete(contact.id)}
            aria-label="Supprimer"
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit(contact)}
            aria-label="Modifier"
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
