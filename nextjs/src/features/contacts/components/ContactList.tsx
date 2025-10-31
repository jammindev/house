// nextjs/src/features/contacts/components/ContactList.tsx
import { Mail, Notebook, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contact } from "../types";
import { formatFullName, getPrimaryEmail, getPrimaryPhone } from "../lib/format";
import { Button } from "@/components/ui/button";

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

          return (
            <li key={contact.id}>
              <div
                className={cn(
                  "flex w-full items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                )}
              >
                {/* Bloc principal : infos du contact */}
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    {/* Nom */}
                    <div className="truncate text-sm font-medium text-gray-900">
                      {displayName}
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-1">
                      {primaryEmail && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="hover:bg-primary/10 transition-colors"
                        >
                          <a
                            href={`mailto:${primaryEmail.email}`}
                            aria-label={t("contacts.emailAction", { name: displayName })}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Mail className="h-4 w-4 text-gray-600" aria-hidden />
                          </a>
                        </Button>
                      )}
                      {primaryPhone && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="hover:bg-primary/10 transition-colors"
                        >
                          <a
                            href={`tel:${primaryPhone.phone}`}
                            aria-label={t("contacts.phoneAction", { name: displayName })}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Phone className="h-4 w-4 text-gray-600" aria-hidden />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onSelect(contact)}
                        aria-label={t("contacts.viewDetails", { name: displayName })}
                      >
                        <Notebook className="h-4 w-4 text-gray-700" />
                      </Button>
                    </div>
                  </div>

                  {/* Détails métier / structure */}
                  {(position || structure) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      {position && (
                        <span className="font-medium text-gray-700">{position}</span>
                      )}
                      {structure && (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                          {structure}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
