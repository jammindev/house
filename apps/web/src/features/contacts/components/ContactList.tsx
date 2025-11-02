// nextjs/src/features/contacts/components/ContactList.tsx
import { Mail, Phone } from "lucide-react";

import type { Contact } from "../types";
import { formatFullName, getPrimaryEmail, getPrimaryPhone } from "../lib/format";
import RepertoireListItem, {
  type RepertoireListItemAction,
  type RepertoireListItemMetadata,
} from "@shared/components/RepertoireListItem";

type ContactListProps = {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export default function ContactList({ contacts, onSelect, t }: ContactListProps) {
  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
      <ul className="divide-y divide-gray-100">
        {contacts.map((contact) => {
          const primaryEmail = getPrimaryEmail(contact);
          const primaryPhone = getPrimaryPhone(contact);
          const fullName = formatFullName(contact);
          const displayName = fullName || t("contacts.unnamedContact");

          const position = contact.position;
          const structure = contact.structure?.name;

          const metadata: RepertoireListItemMetadata[] = [];
          if (position) {
            metadata.push({ label: position, variant: "text" });
          }
          if (structure) {
            metadata.push({ label: structure, variant: "badge" });
          }

          const actions: RepertoireListItemAction[] = [];
          if (primaryEmail) {
            actions.push({
              icon: Mail,
              ariaLabel: t("contacts.emailAction", { name: displayName }),
              href: `mailto:${primaryEmail.email}`,
            });
          }
          if (primaryPhone) {
            actions.push({
              icon: Phone,
              ariaLabel: t("contacts.phoneAction", { name: displayName }),
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
                detailAriaLabel={t("contacts.viewDetails", { name: displayName })}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
