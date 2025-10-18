import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contact } from "../types";
import { formatFullName, getPrimaryEmail, getPrimaryPhone } from "../lib/format";

type ContactListProps = {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
  t: (key: string, values?: Record<string, any>) => string;
};

export default function ContactList({ contacts, onSelect, t }: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        {t("contacts.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <ul className="divide-y divide-gray-100">
        {contacts.map((contact, index) => {
          const primaryEmail = getPrimaryEmail(contact);
          const primaryPhone = getPrimaryPhone(contact);
          const fullName = formatFullName(contact);
          const isFirst = index === 0;

          return (
            <li key={contact.id}>
              <button
                type="button"
                onClick={() => onSelect(contact)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  isFirst ? "rounded-t-md" : ""
                )}
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="text-sm font-medium text-gray-900">{fullName || t("contacts.unnamedContact")}</div>
                  {(contact.position || contact.structure?.name) && (
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {contact.position && <span>{contact.position}</span>}
                      {contact.structure?.name && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">{contact.structure.name}</span>
                      )}
                    </div>
                  )}
                  <div className="mt-1 flex flex-col gap-1 text-xs text-gray-500">
                    {primaryEmail && (
                      <div>
                        <span className="font-medium text-gray-600">{t("contacts.primaryEmail")}:</span>{" "}
                        <span className="break-all text-gray-700">{primaryEmail.email}</span>
                      </div>
                    )}
                    {primaryPhone && (
                      <div>
                        <span className="font-medium text-gray-600">{t("contacts.primaryPhone")}:</span>{" "}
                        <span className="text-gray-700">{primaryPhone.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
