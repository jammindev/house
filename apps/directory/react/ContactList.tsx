
import { Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Contact } from '@/lib/api/contacts';
import RepertoireListItem, {
  type RepertoireListItemAction,
  type RepertoireListItemMetadata,
} from './RepertoireListItem';

type ContactListProps = {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
};

function getPrimaryEmail(contact: Contact) {
  return contact.emails.find((e) => e.is_primary) ?? contact.emails[0] ?? null;
}

function getPrimaryPhone(contact: Contact) {
  return contact.phones.find((p) => p.is_primary) ?? contact.phones[0] ?? null;
}

function formatFullName(contact: Contact): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
}

export default function ContactList({ contacts, onSelect }: ContactListProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
      <ul className="divide-y divide-gray-100">
        {contacts.map((contact) => {
          const primaryEmail = getPrimaryEmail(contact);
          const primaryPhone = getPrimaryPhone(contact);
          const fullName = formatFullName(contact);
          const displayName = fullName || t('contacts.unnamedContact', { defaultValue: 'Unnamed contact' });

          const metadata: RepertoireListItemMetadata[] = [];
          if (contact.position) metadata.push({ label: contact.position, variant: 'text' });
          if (contact.structure?.name) metadata.push({ label: contact.structure.name, variant: 'badge' });

          const actions: RepertoireListItemAction[] = [];
          if (primaryEmail) {
            actions.push({
              icon: Mail,
              ariaLabel: t('contacts.emailAction', { defaultValue: `Email ${displayName}`, name: displayName }),
              href: `mailto:${primaryEmail.email}`,
            });
          }
          if (primaryPhone) {
            actions.push({
              icon: Phone,
              ariaLabel: t('contacts.phoneAction', { defaultValue: `Call ${displayName}`, name: displayName }),
              href: `tel:${primaryPhone.phone}`,
            });
          }

          return (
            <li key={contact.id}>
              <RepertoireListItem
                title={displayName}
                metadata={metadata.length > 0 ? metadata : undefined}
                actions={actions}
                onSelect={() => onSelect(contact)}
                detailAriaLabel={t('contacts.viewDetails', { defaultValue: `View ${displayName}`, name: displayName })}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
