"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, StickyNote } from "lucide-react";

import type { Contact } from "../types";
import { formatAddress, formatFullName } from "../lib/format";

type ContactDetailsDialogProps = {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export default function ContactDetailsDialog({ contact, open, onOpenChange, t }: ContactDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {contact && (
        <DialogContent className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-none p-0 sm:rounded-lg">
          <DialogHeader className="border-b border-gray-100 px-4 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {formatFullName(contact) || t("contacts.unnamedContact")}
            </DialogTitle>
            {(contact.position || contact.structure?.name) && (
              <div className="mt-2 space-y-1">
                {contact.position && <DialogDescription className="text-sm text-gray-600">{contact.position}</DialogDescription>}
                {contact.structure?.name && (
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{contact.structure.name}</div>
                )}
              </div>
            )}
          </DialogHeader>

          {(() => {
            const sections: { key: string; content: ReactNode }[] = [];

            if (contact.emails.length > 0) {
              sections.push({
                key: "emails",
                content: (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <Mail className="h-4 w-4" aria-hidden />
                      {t("contacts.emails")}
                    </div>
                    <ul className="mt-2 space-y-2">
                      {contact.emails.map((email) => (
                        <li key={email.id} className="flex items-start justify-between gap-2">
                          <div>
                            <div className="break-all text-sm text-gray-900">{email.email}</div>
                            {email.label && <div className="text-xs text-gray-500">{email.label}</div>}
                          </div>
                          {email.is_primary && (
                            <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                              {t("contacts.primary")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              });
            }

            if (contact.phones.length > 0) {
              sections.push({
                key: "phones",
                content: (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <Phone className="h-4 w-4" aria-hidden />
                      {t("contacts.phones")}
                    </div>
                    <ul className="mt-2 space-y-2">
                      {contact.phones.map((phone) => (
                        <li key={phone.id} className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm text-gray-900">{phone.phone}</div>
                            {phone.label && <div className="text-xs text-gray-500">{phone.label}</div>}
                          </div>
                          {phone.is_primary && (
                            <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                              {t("contacts.primary")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              });
            }

            if (contact.addresses.length > 0) {
              sections.push({
                key: "addresses",
                content: (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <MapPin className="h-4 w-4" aria-hidden />
                      {t("contacts.addresses")}
                    </div>
                    <ul className="mt-2 space-y-3">
                      {contact.addresses.map((address) => (
                        <li key={address.id} className="flex items-start justify-between gap-2">
                          <div className="whitespace-pre-line text-sm text-gray-900">
                            {formatAddress(address)}
                            {address.label && <div className="mt-1 text-xs text-gray-500">{address.label}</div>}
                          </div>
                          {address.is_primary && (
                            <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                              {t("contacts.primary")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              });
            }

            if (contact.notes && contact.notes.trim().length > 0) {
              sections.push({
                key: "notes",
                content: (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <StickyNote className="h-4 w-4" aria-hidden />
                      {t("contacts.notes")}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{contact.notes}</p>
                  </div>
                ),
              });
            }

            if (sections.length === 0) {
              return (
                <section className="px-4 py-6 text-center text-sm text-gray-500">
                  {t("contacts.noDetails")}
                </section>
              );
            }

            return (
              <section className="px-4 py-4 text-sm text-gray-700">
                {sections.map((section, index) => (
                  <div key={section.key} className="py-2">
                    {index > 0 && <Separator className="mb-4 mt-2" />}
                    {section.content}
                  </div>
                ))}
              </section>
            );
          })()}

          <DialogFooter className="border-t border-gray-100 bg-gray-50 px-4 py-3 gap-2">
            <DialogClose asChild>
              <Button variant="secondary" className="w-full sm:w-auto">
                {t("common.close")}
              </Button>
            </DialogClose>
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/app/contacts/${contact.id}/edit`}>{t("contacts.editContact")}</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
