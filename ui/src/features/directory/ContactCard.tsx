import { Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
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

  const actions: CardAction[] = [
    { label: 'Modifier', icon: Pencil, onClick: () => onEdit(contact) },
    { label: 'Supprimer', icon: Trash2, onClick: () => onDelete(contact.id), variant: 'danger' },
  ];

  return (
    <Card className="p-3 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{fullName}</p>
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
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {contact.structure.name}
              </span>
            ) : null}
          </div>
        </div>

        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
